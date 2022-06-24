import {
    APIInteractionResponse,
    APIMessageComponentInteraction,
    ButtonStyle,
    ChannelType,
    ComponentType,
    FormattingPatterns,
    InteractionResponseType,
    MessageFlags,
    OverwriteType,
    PermissionFlagsBits,
} from "discord-api-types";
import {
    AddGuildMemberRole,
    CreateGuildChannel,
    CreateGuildRole,
    CreateMessage,
    CreateMessageUrl,
    EditMessage,
    GetChannel,
    GetChannelMessage,
    GetEmbedFields,
    LogChannelMessage,
    RemoveGuildMemberRole,
    Unformat,
} from "./discord.ts";
import { EmbedFieldNames, GroupMainEmbedFields, MasterListMainEmbedFields } from "./types.ts";

export interface Button {
    interaction: (
        input: APIMessageComponentInteraction,
    ) => Promise<APIInteractionResponse>;
}

export const AddGroup = {
    id: () => {
        return "AddGroup";
    },
    interaction: async (input: APIMessageComponentInteraction): Promise<APIInteractionResponse> => {
        const isAdminUser = (BigInt(input.member!.permissions) & PermissionFlagsBits.Administrator) ===
            PermissionFlagsBits.Administrator;

        if (!isAdminUser) {
            const masterListMessage = await GetChannelMessage(input.channel_id, input.message.id);
            const masterListMainEmbedFields = GetEmbedFields<MasterListMainEmbedFields>(masterListMessage.embeds[0]);
            const groupManagerRole = masterListMainEmbedFields[EmbedFieldNames.GroupManagerRole];
            const groupManagerRoleId = Unformat(groupManagerRole, FormattingPatterns.Role);

            if (!input.member!.roles.find((role) => role === groupManagerRoleId)) {
                return {
                    type: InteractionResponseType.ChannelMessageWithSource,
                    data: {
                        content:
                            `You do not have permission to create a group. Only users with ${groupManagerRole} and users with full admin permissions can add groups.`,
                        flags: MessageFlags.Ephemeral,
                    },
                };
            }
        }

        return {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
                content:
                    "Use the UI below to modify the group details and settings. These can be changed after creation too.",
                flags: MessageFlags.Ephemeral,
                embeds: [
                    {
                        title: `${input.member?.user.username}'s Group`,
                        description: "",
                        fields: [
                            { name: EmbedFieldNames.GroupLeader, value: `<@${input.member!.user.id}>`, inline: true },
                            { name: EmbedFieldNames.MembershipPolicy, value: "Private", inline: true },
                            { name: EmbedFieldNames.ChannelVisibility, value: "Private", inline: true },
                        ],
                    },
                ],
                components: [
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.Button,
                                style: ButtonStyle.Primary,
                                custom_id: "GroupName",
                                label: "Change Name",
                            },
                            {
                                type: ComponentType.Button,
                                style: ButtonStyle.Primary,
                                custom_id: "GroupDescription",
                                label: "Change Description",
                            },
                        ],
                    },
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.SelectMenu,
                                disabled: true,
                                custom_id: EmbedFieldNames.MembershipPolicy,
                                options: [
                                    {
                                        "label": "Public membership - anyone can join",
                                        "value": "public",
                                        "description":
                                            "Group can be joined by anyone without approval from the group leader",
                                    },
                                    {
                                        "label": "Private membership - group leader approves",
                                        "value": "private",
                                        "description": "Group leader must approve requests to join the group",
                                        "default": true,
                                    },
                                ],
                            },
                        ],
                    },
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.SelectMenu,
                                disabled: true,
                                custom_id: EmbedFieldNames.ChannelVisibility,
                                options: [
                                    {
                                        "label": "Public group channel",
                                        "value": "public",
                                        "description": "Everyone can see the groups channel",
                                    },
                                    {
                                        "label": "Private group channel",
                                        "value": "private",
                                        "description": "Only group members can see the groups channel",
                                        "default": true,
                                    },
                                ],
                            },
                        ],
                    },
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.Button,
                                style: ButtonStyle.Primary,
                                custom_id: SubmitNewGroup.id(input.message.id),
                                label: "Submit",
                            },
                        ],
                    },
                ],
            },
        };
    },
};

export const SubmitNewGroup = {
    id: (masterListMessageId: string) => {
        return `SubmitNewGroup_${masterListMessageId}`;
    },
    interaction: async (input: APIMessageComponentInteraction): Promise<APIInteractionResponse> => {
        const [_, masterListMessageId] = input.data.custom_id.split("_");

        const submitEmbed = input.message.embeds[0];

        const masterListMessage = await GetChannelMessage(input.channel_id, masterListMessageId);
        const masterListMainEmbedFields = GetEmbedFields<MasterListMainEmbedFields>(masterListMessage.embeds[0]);

        // Create role
        const groupRole = await CreateGuildRole(input.guild_id!, {
            name: submitEmbed.title,
        });

        await AddGuildMemberRole(input.guild_id!, input.member!.user.id, groupRole.id);

        const masterListChannel = await GetChannel(input.channel_id);
        if (masterListChannel.type !== ChannelType.GuildText) {
            throw new Error("Master list channel was not guild text");
        }

        // Create group channel
        const groupChannel = await CreateGuildChannel(input.guild_id!, {
            name: submitEmbed.title!,
            parent_id: masterListChannel.parent_id,
            permission_overwrites: [
                {
                    id: input.guild_id!,
                    type: OverwriteType.Role,
                    deny: String(PermissionFlagsBits.ViewChannel),
                },
                {
                    id: groupRole.id,
                    type: OverwriteType.Role,
                    allow: String(PermissionFlagsBits.ViewChannel),
                },
            ],
        });

        const groupsChannelIdFormatted = masterListMainEmbedFields[EmbedFieldNames.GroupListChannel];
        const groupsChannelId = Unformat(groupsChannelIdFormatted, FormattingPatterns.Channel);

        // Post group ad
        const groupsChannelMessage = await CreateMessage(groupsChannelId, {
            embeds: [
                {
                    title: submitEmbed.title,
                    description: submitEmbed.description,
                    url: CreateMessageUrl(input.guild_id!, input.channel_id, masterListMessageId),
                    fields: [
                        submitEmbed.fields![0], // Leader field
                        {
                            name: EmbedFieldNames.GroupChannel,
                            value: `<#${groupChannel.id}>`,
                            inline: true,
                        },
                        {
                            name: EmbedFieldNames.GroupRole,
                            value: `<@&${groupRole.id}>`,
                            inline: true,
                        },
                        ...submitEmbed.fields!.slice(1, submitEmbed.fields!.length),
                    ],
                },
            ],
            components: [
                {
                    type: ComponentType.ActionRow,
                    components: [
                        {
                            type: ComponentType.Button,
                            style: ButtonStyle.Primary,
                            custom_id: ApplyToGroup.id(masterListChannel.id, masterListMessageId),
                            label: "Apply",
                        },
                        {
                            type: ComponentType.Button,
                            style: ButtonStyle.Danger,
                            custom_id: LeaveGroup.id(masterListChannel.id, masterListMessageId),
                            label: "Leave",
                        },
                        {
                            type: ComponentType.Button,
                            style: ButtonStyle.Secondary,
                            custom_id: EditGroupMember.id(masterListChannel.id, masterListMessageId),
                            label: "Change My Details",
                        },
                        {
                            type: ComponentType.Button,
                            style: ButtonStyle.Secondary,
                            custom_id: EditGroup.id(masterListChannel.id, masterListMessageId),
                            label: "Edit Group",
                        },
                    ],
                },
            ],
        });

        masterListMessage.embeds.push({
            title: submitEmbed.title,
            description: submitEmbed.description,
            url: CreateMessageUrl(input.guild_id!, groupsChannelMessage.channel_id, groupsChannelMessage.id),
            fields: [
                submitEmbed.fields![0], // Leader field
                {
                    name: EmbedFieldNames.GroupRole,
                    value: `<@&${groupRole.id}>`,
                    inline: true,
                },
            ],
        });

        await EditMessage(masterListMessage.channel_id, masterListMessage.id, masterListMessage);

        LogChannelMessage(masterListMainEmbedFields, {
            content: `New group '${submitEmbed.title}' created by <@${
                input.member!.user.id
            }> with role <@&${groupRole.id}> and private channel <#${groupChannel.id}>`,
            components: [
                {
                    type: ComponentType.ActionRow,
                    components: [
                        {
                            type: ComponentType.Button,
                            style: ButtonStyle.Link,
                            label: "Go To Listing",
                            url: CreateMessageUrl(input.guild_id!, groupsChannelId, groupsChannelMessage.id),
                        },
                    ],
                },
            ],
        });

        return {
            type: InteractionResponseType.UpdateMessage,
            data: {
                embeds: [],
                content: `Success!`,
                components: [
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.Button,
                                style: ButtonStyle.Link,
                                label: "Go To Listing",
                                url: CreateMessageUrl(input.guild_id!, groupsChannelId, groupsChannelMessage.id),
                            },
                        ],
                    },
                ],
            },
        };
    },
};

export const ApplyToGroup = {
    id: (masterListChannelId: string, masterListMessageId: string) => {
        return `ApplyToGroup_${masterListChannelId}_${masterListMessageId}`;
    },
    // deno-lint-ignore require-await
    interaction: async (input: APIMessageComponentInteraction): Promise<APIInteractionResponse> => {
        const [_, masterListChannelId, masterListMessageId] = input.data.custom_id.split("_");

        const groupMainEmbed = input.message.embeds[0];
        const groupMainEmbedFields = GetEmbedFields<GroupMainEmbedFields>(groupMainEmbed);

        const groupRoleFormatted = groupMainEmbedFields[EmbedFieldNames.GroupRole];
        const groupRole = Unformat(groupRoleFormatted, FormattingPatterns.Role);

        if (input.member?.roles.find((role) => role === groupRole)) {
            return {
                type: InteractionResponseType.ChannelMessageWithSource,
                data: {
                    content: `You are already in this group`,
                    flags: MessageFlags.Ephemeral,
                },
            };
        }

        return {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
                content: "Application details",
                flags: MessageFlags.Ephemeral,
                components: [
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.Button,
                                style: ButtonStyle.Primary,
                                label: "Submit Application",
                                custom_id: SubmitGroupApplication.id(
                                    masterListChannelId,
                                    masterListMessageId,
                                    input.message.id,
                                ),
                            },
                        ],
                    },
                ],
            },
        };
    },
};

export const SubmitGroupApplication = {
    id: (masterListChannelId: string, masterListMessageId: string, groupMessageId: string) => {
        return `SubmitGroupApplication_${masterListChannelId}_${masterListMessageId}_${groupMessageId}`;
    },
    interaction: async (input: APIMessageComponentInteraction): Promise<APIInteractionResponse> => {
        const [_, masterListChannelId, masterListMessageId, groupMessageId] = input.data.custom_id.split("_");

        const groupMessage = await GetChannelMessage(input.channel_id, groupMessageId);
        const groupMainEmbed = groupMessage.embeds[0];
        const groupMainEmbedFields = GetEmbedFields<GroupMainEmbedFields>(groupMainEmbed);

        const groupChannelId = Unformat(groupMainEmbedFields[EmbedFieldNames.GroupChannel], FormattingPatterns.Channel);

        await CreateMessage(groupChannelId, {
            content: `Application received. ${groupMainEmbedFields[EmbedFieldNames.GroupLeader]} Accept?`,
            embeds: [
                {
                    title: `<@${input.member!.user.id}>`,
                    description: "Additional details",
                    fields: [
                        { name: "Character Name", value: "Asmongoldseller", inline: true },
                        { name: "Class", value: "Berserker", inline: true },
                        { name: "Item Level", value: "1337", inline: true },
                    ],
                },
            ],
            components: [
                {
                    type: ComponentType.ActionRow,
                    components: [
                        {
                            type: ComponentType.Button,
                            style: ButtonStyle.Primary,
                            custom_id: AcceptApplication.id(
                                masterListChannelId,
                                masterListMessageId,
                                input.channel_id,
                                input.message.id,
                            ),
                            label: "Accept Application",
                        },
                    ],
                },
            ],
        });

        return {
            type: InteractionResponseType.UpdateMessage,
            data: {
                content:
                    "Success! Your application has been posted in the group channel and the group leader has been notified.",
                flags: MessageFlags.Ephemeral,
            },
        };
    },
};

export const AcceptApplication = {
    id: (masterListChannelId: string, masterListMessageId: string, groupsChannelId: string, groupMessageId: string) => {
        return `AcceptApplication_${masterListChannelId}_${masterListMessageId}_${groupsChannelId}_${groupMessageId}`;
    },
    interaction: async (input: APIMessageComponentInteraction): Promise<APIInteractionResponse> => {
        const [_, masterListChannelId, masterListMessageId, groupsChannelId, groupMessageId] = input.data.custom_id
            .split("_");

        const isAdminUser = (BigInt(input.member!.permissions) & PermissionFlagsBits.Administrator) ===
            PermissionFlagsBits.Administrator;

        const groupMessage = await GetChannelMessage(groupsChannelId, groupMessageId);
        const groupMainEmbed = groupMessage.embeds[0];
        const groupMainEmbedFields = GetEmbedFields<GroupMainEmbedFields>(groupMainEmbed);
        const groupLeaderFormatted = groupMainEmbedFields[EmbedFieldNames.GroupLeader];
        const groupLeaderId = Unformat(groupLeaderFormatted, FormattingPatterns.User);

        if (!isAdminUser || input.member!.user.id !== groupLeaderId) {
            return {
                type: InteractionResponseType.ChannelMessageWithSource,
                data: {
                    content:
                        `You do not have permission to edit this group. Only the group leader ${groupLeaderFormatted} and users with full admin permissions can edit`,
                    flags: MessageFlags.Ephemeral,
                },
            };
        }

        const applicationEmbed = input.message.embeds[0];
        const applicantUserId = Unformat(applicationEmbed.title!, FormattingPatterns.User);

        const groupRoleId = Unformat(groupMainEmbedFields[EmbedFieldNames.GroupRole], FormattingPatterns.Role);
        await AddGuildMemberRole(input.guild_id!, applicantUserId, groupRoleId);

        groupMessage.embeds.push({
            title: applicationEmbed.title,
            description: applicationEmbed.description,
            fields: applicationEmbed.fields,
        });

        await EditMessage(groupsChannelId, groupMessageId, { embeds: groupMessage.embeds });

        const masterListMessage = await GetChannelMessage(masterListChannelId, masterListMessageId);
        const masterListMainEmbed = GetEmbedFields<MasterListMainEmbedFields>(masterListMessage.embeds[0]);
        LogChannelMessage(masterListMainEmbed, {
            content: `${applicationEmbed.title} has joined '${groupMainEmbed.title}'`,
        });

        return {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
                content: `${applicationEmbed.title} has joined the group`,
            },
        };
    },
};

export const LeaveGroup = {
    id: (masterListChannelId: string, masterListMessageId: string) => {
        return `LeaveGroup_${masterListChannelId}_${masterListMessageId}`;
    },
    // deno-lint-ignore require-await
    interaction: async (input: APIMessageComponentInteraction): Promise<APIInteractionResponse> => {
        const [_, masterListChannelId, masterListMessageId] = input.data.custom_id;
        const groupMainEmbed = input.message.embeds[0];
        const groupMainEmbedFields = GetEmbedFields<GroupMainEmbedFields>(groupMainEmbed);
        const groupRoleFormatted = groupMainEmbedFields[EmbedFieldNames.GroupRole];
        const groupRoleId = Unformat(groupRoleFormatted, FormattingPatterns.Role);

        if (!input.member?.roles.find((role) => role === groupRoleId)) {
            return {
                type: InteractionResponseType.ChannelMessageWithSource,
                data: {
                    content: `You are not a member of this group`,
                    flags: MessageFlags.Ephemeral,
                },
            };
        }

        return {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
                content: "Are you sure?",
                flags: MessageFlags.Ephemeral,
                components: [
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.Button,
                                style: ButtonStyle.Danger,
                                label: "Yes",
                                custom_id: LeaveGroupConfirm.id(
                                    masterListChannelId,
                                    masterListMessageId,
                                    input.message.id,
                                ),
                            },
                        ],
                    },
                ],
            },
        };
    },
};

export const LeaveGroupConfirm = {
    id: (masterListChannelId: string, masterListMessageId: string, groupMessageId: string) => {
        return `ConfirmLeaveGroup_${masterListChannelId}_${masterListMessageId}_${groupMessageId}`;
    },
    interaction: async (input: APIMessageComponentInteraction): Promise<APIInteractionResponse> => {
        const [_, masterListChannelId, masterListMessageId, groupMessageId] = input.data.custom_id;

        const groupMessage = await GetChannelMessage(input.channel_id, groupMessageId);
        const groupMainEmbed = groupMessage.embeds[0];
        const groupMainEmbedFields = GetEmbedFields<GroupMainEmbedFields>(groupMainEmbed);

        const groupRoleId = Unformat(groupMainEmbedFields[EmbedFieldNames.GroupRole], FormattingPatterns.Role);
        await RemoveGuildMemberRole(input.guild_id!, input.member!.user.id, groupRoleId);
        const userFormatted = `<@${input.member!.user.id}>`;

        const newEmbeds = groupMessage.embeds.filter((embed) => embed.title !== userFormatted);

        await EditMessage(input.channel_id, groupMessageId, { embeds: newEmbeds });

        const masterListMessage = await GetChannelMessage(masterListChannelId, masterListMessageId);
        const masterListMainEmbed = GetEmbedFields<MasterListMainEmbedFields>(masterListMessage.embeds[0]);
        LogChannelMessage(masterListMainEmbed, {
            content: `<@${input.member?.user.id}> has left '${groupMainEmbed.title}'`,
        });

        return {
            type: InteractionResponseType.UpdateMessage,
            data: {
                content: "You have left the group",
            },
        };
    },
};

export const EditGroupMember = {
    id: (masterListChannelId: string, masterListMessageId: string) => {
        return `GroupMemberEdit_${masterListChannelId}_${masterListMessageId}`;
    },
    interaction: async (input: APIMessageComponentInteraction): Promise<APIInteractionResponse> => {
        const [_, masterListChannelId, masterListMessageId] = input.data.custom_id.split("_");
        return {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
                content: "Edit group member is not implemented yet",
                flags: MessageFlags.Ephemeral,
            },
        };
    },
};

export const EditGroup = {
    id: (masterListChannelId: string, masterListMessageId: string) => {
        return `GroupEdit_${masterListChannelId}_${masterListMessageId}`;
    },
    interaction: async (input: APIMessageComponentInteraction): Promise<APIInteractionResponse> => {
        const [_, masterListChannelId, masterListMessageId] = input.data.custom_id.split("_");
        const isAdminUser = (BigInt(input.member!.permissions) & PermissionFlagsBits.Administrator) ===
            PermissionFlagsBits.Administrator;

        const groupMainEmbed = input.message.embeds[0];
        const groupMainEmbedFields = GetEmbedFields<GroupMainEmbedFields>(groupMainEmbed);
        const groupLeaderFormatted = groupMainEmbedFields[EmbedFieldNames.GroupLeader];
        const groupLeaderId = Unformat(groupLeaderFormatted, FormattingPatterns.User);

        if (!isAdminUser || input.member!.user.id !== groupLeaderId) {
            return {
                type: InteractionResponseType.ChannelMessageWithSource,
                data: {
                    content:
                        `You do not have permission to edit this group. Only the group leader ${groupLeaderFormatted} and users with full admin permissions can edit`,
                    flags: MessageFlags.Ephemeral,
                },
            };
        }

        return {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
                content: "Edit menu is not implemented yet",
                flags: MessageFlags.Ephemeral,
            },
        };
    },
};

export const Buttons: Record<string, Button> = {
    AddGroup,
    SubmitNewGroup,
    ApplyToGroup,
    SubmitGroupApplication,
    AcceptApplication,
    LeaveGroup,
    LeaveGroupConfirm,
    EditGroupMember,
    EditGroup,
};
