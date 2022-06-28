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
    TextInputStyle,
} from "discord-api-types";
import {
    AddGuildMemberRole,
    CreateGuildChannel,
    CreateGuildRole,
    CreateMessage,
    CreateMessageUrl,
    EditMessage,
    EphemeralMessage,
    GetChannel,
    GetChannelMessage,
    GetEmbedFields,
    RemoveGuildMemberRole,
    Unformat,
} from "./discord.ts";
import { EditGroupCharacter, EmbedUpdate } from "./modals.ts";
import {
    ClassSelectMenuOptions,
    DynamicSelectMenuId,
    EmbedFieldNames,
    GetCharacterEmbedFromList,
    GroupMainEmbedFields,
    LogChannelMessage,
    MasterListMainEmbedFields,
    MemberCharacterEmbedFields,
} from "./types.ts";

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
                        title: `${input.member!.user.username}'s Group`,
                        description: "",
                        fields: [
                            { name: EmbedFieldNames.GroupLeader, value: `<@${input.member!.user.id}>`, inline: true },
                            // { name: EmbedFieldNames.MembershipPolicy, value: "Private", inline: true },
                            // { name: EmbedFieldNames.ChannelVisibility, value: "Private", inline: true },
                        ],
                    },
                    {
                        title: "Character Details",
                        fields: [
                            {
                                name: EmbedFieldNames.MemberCharacterName,
                                value: input.member!.user.username,
                                inline: true,
                            },
                            { name: EmbedFieldNames.MemberCharacterILVL, value: "????", inline: true },
                            { name: EmbedFieldNames.MemberCharacterClass, value: "????", inline: true },
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
                                custom_id: GroupAddEditGroup.id(),
                                label: "Edit Group",
                            },
                            {
                                type: ComponentType.Button,
                                style: ButtonStyle.Primary,
                                custom_id: GroupAddEditCharacter.id(),
                                label: "Edit Character",
                            },
                        ],
                    },
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.SelectMenu,
                                custom_id: DynamicSelectMenuId(
                                    EmbedFieldNames.MemberCharacterClass,
                                ),
                                placeholder: "Select class",
                                max_values: 1,
                                min_values: 1,
                                options: ClassSelectMenuOptions,
                            },
                        ],
                    },
                    // {
                    //     type: ComponentType.ActionRow,
                    //     components: [
                    //         {
                    //             type: ComponentType.SelectMenu,
                    //             disabled: true,
                    //             custom_id: DynamicSelectMenuId(EmbedFieldNames.MembershipPolicy),
                    //             options: [
                    //                 {
                    //                     "label": "Public membership - anyone can join",
                    //                     "value": "public",
                    //                     "description":
                    //                         "Group can be joined by anyone without approval from the group leader",
                    //                 },
                    //                 {
                    //                     "label": "Private membership - group leader approves",
                    //                     "value": "private",
                    //                     "description": "Group leader must approve requests to join the group",
                    //                     "default": true,
                    //                 },
                    //             ],
                    //         },
                    //     ],
                    // },
                    // {
                    //     type: ComponentType.ActionRow,
                    //     components: [
                    //         {
                    //             type: ComponentType.SelectMenu,
                    //             disabled: true,
                    //             custom_id: DynamicSelectMenuId(EmbedFieldNames.ChannelVisibility),
                    //             options: [
                    //                 {
                    //                     "label": "Public group channel",
                    //                     "value": "public",
                    //                     "description": "Everyone can see the groups channel",
                    //                 },
                    //                 {
                    //                     "label": "Private group channel",
                    //                     "value": "private",
                    //                     "description": "Only group members can see the groups channel",
                    //                     "default": true,
                    //                 },
                    //             ],
                    //         },
                    //     ],
                    // },
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

export const GroupAddEditCharacter = {
    id: () => {
        return `GroupAddEditCharacter`;
    },
    // deno-lint-ignore require-await
    interaction: async (input: APIMessageComponentInteraction): Promise<APIInteractionResponse> => {
        const characterEmbed = input.message.embeds[1];
        const characterEmbedFields = GetEmbedFields<MemberCharacterEmbedFields>(characterEmbed);

        return {
            type: InteractionResponseType.Modal,
            data: {
                title: "Edit Character Details",
                custom_id: EmbedUpdate.id(1),
                components: [
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.TextInput,
                                custom_id: EmbedFieldNames.MemberCharacterName,
                                value: characterEmbedFields[EmbedFieldNames.MemberCharacterName],
                                style: TextInputStyle.Short,
                                label: EmbedFieldNames.MemberCharacterName,
                                required: true,
                                min_length: 2,
                                max_length: 16,
                            },
                        ],
                    },
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.TextInput,
                                custom_id: EmbedFieldNames.MemberCharacterILVL,
                                value: characterEmbedFields[EmbedFieldNames.MemberCharacterILVL],
                                style: TextInputStyle.Short,
                                label: EmbedFieldNames.MemberCharacterILVL,
                                required: true,
                                min_length: 3,
                                max_length: 4,
                            },
                        ],
                    },
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.TextInput,
                                custom_id: "Description",
                                value: characterEmbed.description,
                                placeholder:
                                    "Additional notes e.g. preferred schedule or anything additional character information",
                                style: TextInputStyle.Paragraph,
                                label: "Notes",
                                required: false,
                            },
                        ],
                    },
                ],
            },
        };
    },
};

export const GroupAddEditGroup = {
    id: () => {
        return `GroupAddEditGroup`;
    },
    // deno-lint-ignore require-await
    interaction: async (input: APIMessageComponentInteraction): Promise<APIInteractionResponse> => {
        const groupEmbed = input.message.embeds[0];

        return {
            type: InteractionResponseType.Modal,
            data: {
                title: "Edit Group Details",
                custom_id: EmbedUpdate.id(0),
                components: [
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.TextInput,
                                custom_id: "Title",
                                value: groupEmbed.title,
                                style: TextInputStyle.Short,
                                label: "Group Name",
                                required: true,
                            },
                        ],
                    },
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.TextInput,
                                custom_id: "Description",
                                value: groupEmbed.description,
                                style: TextInputStyle.Paragraph,
                                label: "Group Description",
                                placeholder:
                                    "Extra information about the group, e.g. bosses you do, schedule, classes you're recruiting, etc",
                                required: false,
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
        const leaderMemberDetailsEmbed = input.message.embeds[1];
        leaderMemberDetailsEmbed.title = input.member!.user.username;
        leaderMemberDetailsEmbed.fields![0].value = `<@${input.member!.user.id}> - ${
            leaderMemberDetailsEmbed.fields![0].value
        }`;

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
                {
                    id: Deno.env.get("APP_ID")!,
                    type: OverwriteType.Member,
                    allow: String(PermissionFlagsBits.ViewChannel),
                },
            ],
        });

        const groupsChannelIdFormatted = masterListMainEmbedFields[EmbedFieldNames.GroupListChannel];
        const groupsChannelId = Unformat(groupsChannelIdFormatted, FormattingPatterns.Channel)!;

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
                            name: EmbedFieldNames.GroupRole,
                            value: `<@&${groupRole.id}>`,
                            inline: true,
                        },
                        {
                            name: EmbedFieldNames.GroupChannel,
                            value: `<#${groupChannel.id}>`,
                            inline: true,
                        },
                        ...submitEmbed.fields!.slice(1, submitEmbed.fields!.length),
                    ],
                },
                leaderMemberDetailsEmbed,
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
                            custom_id: GroupMemberEdit.id(),
                            label: "Edit My Details",
                        },
                        {
                            type: ComponentType.Button,
                            style: ButtonStyle.Secondary,
                            custom_id: GroupEdit.id(masterListChannel.id, masterListMessageId),
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
                content:
                    "The application below will be sent to the group channel and displayed on the group's member list if the application is accepted",
                embeds: [
                    {
                        title: `${input.member!.user.username}'s Group Application`,
                        fields: [
                            {
                                name: EmbedFieldNames.MemberCharacterName,
                                value: input.member!.user.username,
                                inline: true,
                            },
                            { name: EmbedFieldNames.MemberCharacterILVL, value: "????", inline: true },
                            { name: EmbedFieldNames.MemberCharacterClass, value: "????", inline: true },
                        ],
                    },
                ],
                flags: MessageFlags.Ephemeral,
                components: [
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.Button,
                                style: ButtonStyle.Primary,
                                label: "Edit",
                                custom_id: GroupApplicationEditCharacter.id(),
                            },
                        ],
                    },
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.SelectMenu,
                                custom_id: DynamicSelectMenuId(
                                    EmbedFieldNames.MemberCharacterClass,
                                ),
                                placeholder: "Select class",
                                max_values: 1,
                                min_values: 1,
                                options: ClassSelectMenuOptions,
                            },
                        ],
                    },
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

export const GroupApplicationEditCharacter = {
    id: () => {
        return `GroupApplicationEditCharacter`;
    },
    // deno-lint-ignore require-await
    interaction: async (input: APIMessageComponentInteraction): Promise<APIInteractionResponse> => {
        const characterEmbed = input.message.embeds[0];
        const characterEmbedFields = GetEmbedFields<MemberCharacterEmbedFields>(characterEmbed);

        return {
            type: InteractionResponseType.Modal,
            data: {
                title: "Edit Character Details",
                custom_id: EmbedUpdate.id(0),
                components: [
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.TextInput,
                                custom_id: EmbedFieldNames.MemberCharacterName,
                                value: characterEmbedFields[EmbedFieldNames.MemberCharacterName],
                                style: TextInputStyle.Short,
                                label: EmbedFieldNames.MemberCharacterName,
                                required: true,
                                min_length: 2,
                                max_length: 16,
                            },
                        ],
                    },
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.TextInput,
                                custom_id: EmbedFieldNames.MemberCharacterILVL,
                                value: characterEmbedFields[EmbedFieldNames.MemberCharacterILVL],
                                style: TextInputStyle.Short,
                                label: EmbedFieldNames.MemberCharacterILVL,
                                required: true,
                                min_length: 3,
                                max_length: 4,
                            },
                        ],
                    },
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.TextInput,
                                custom_id: "Description",
                                value: characterEmbed.description,
                                placeholder:
                                    "Additional notes e.g. preferred schedule or anything additional character information",
                                style: TextInputStyle.Paragraph,
                                label: "Notes",
                                required: false,
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

        const applicationEmbed = input.message.embeds[0];
        applicationEmbed.fields![0].value = `<@${input.member!.user.id}> - ${applicationEmbed.fields![0].value}`;

        const groupMessage = await GetChannelMessage(input.channel_id, groupMessageId);
        const groupMainEmbed = groupMessage.embeds[0];
        const groupMainEmbedFields = GetEmbedFields<GroupMainEmbedFields>(groupMainEmbed);

        const groupChannelId = Unformat(
            groupMainEmbedFields[EmbedFieldNames.GroupChannel],
            FormattingPatterns.Channel,
        )!;

        // TODO: validate the application embed?

        await CreateMessage(groupChannelId, {
            content: `${groupMainEmbedFields[EmbedFieldNames.GroupLeader]} group application received`,
            embeds: [applicationEmbed],
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
                                groupMessageId,
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
                components: [],
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

        if (!isAdminUser && input.member!.user.id !== groupLeaderId) {
            return EphemeralMessage(
                `You do not have permission to edit this group. Only the group leader ${groupLeaderFormatted} and users with full admin permissions can edit`,
            );
        }

        const applicationEmbed = input.message.embeds[0];
        const applicantUserId = Unformat(applicationEmbed.title!, FormattingPatterns.User)!;

        const groupRoleId = Unformat(groupMainEmbedFields[EmbedFieldNames.GroupRole], FormattingPatterns.Role)!;
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
        const [_, masterListChannelId, masterListMessageId] = input.data.custom_id.split("_");
        const groupMainEmbed = input.message.embeds[0];
        const groupMainEmbedFields = GetEmbedFields<GroupMainEmbedFields>(groupMainEmbed);
        const groupRoleFormatted = groupMainEmbedFields[EmbedFieldNames.GroupRole];
        const groupRoleId = Unformat(groupRoleFormatted, FormattingPatterns.Role);
        const groupLeaderId = Unformat(groupMainEmbedFields[EmbedFieldNames.GroupLeader], FormattingPatterns.User);

        if (!input.member?.roles.find((role) => role === groupRoleId)) {
            return EphemeralMessage(`You are not a member of this group`);
        }

        if (input.member!.user.id === groupLeaderId) {
            return EphemeralMessage(
                `You cannot leave a group while you are the leader. You can pass leader to another user or delete the group in Edit Group.`,
            );
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
                                custom_id: ConfirmLeaveGroup.id(
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

export const ConfirmLeaveGroup = {
    id: (masterListChannelId: string, masterListMessageId: string, groupMessageId: string) => {
        return `ConfirmLeaveGroup_${masterListChannelId}_${masterListMessageId}_${groupMessageId}`;
    },
    interaction: async (input: APIMessageComponentInteraction): Promise<APIInteractionResponse> => {
        const [_, masterListChannelId, masterListMessageId, groupMessageId] = input.data.custom_id.split("_");

        const groupMessage = await GetChannelMessage(input.channel_id, groupMessageId);
        const groupMainEmbed = groupMessage.embeds[0];
        const groupMainEmbedFields = GetEmbedFields<GroupMainEmbedFields>(groupMainEmbed);

        const groupRoleId = Unformat(groupMainEmbedFields[EmbedFieldNames.GroupRole], FormattingPatterns.Role)!;
        await RemoveGuildMemberRole(input.guild_id!, input.member!.user.id, groupRoleId);
        const userFormatted = `<@${input.member!.user.id}>`;

        const newEmbeds = groupMessage.embeds.filter((embed) => embed.title !== userFormatted);

        await EditMessage(input.channel_id, groupMessageId, { embeds: newEmbeds });

        const groupChannelId = Unformat(
            groupMainEmbedFields[EmbedFieldNames.GroupChannel],
            FormattingPatterns.Channel,
        )!;
        await CreateMessage(groupChannelId, { content: `<@${input.member?.user.id}> has left the group` });

        const masterListMessage = await GetChannelMessage(masterListChannelId, masterListMessageId);
        const masterListMainEmbed = GetEmbedFields<MasterListMainEmbedFields>(masterListMessage.embeds[0]);
        LogChannelMessage(masterListMainEmbed, {
            content: `<@${input.member?.user.id}> has left '${groupMainEmbed.title}'`,
        });

        return {
            type: InteractionResponseType.UpdateMessage,
            data: {
                content: "You have left the group",
                components: [],
            },
        };
    },
};

export const GroupMemberEdit = {
    id: () => {
        return `GroupMemberEdit`;
    },
    // deno-lint-ignore require-await
    interaction: async (input: APIMessageComponentInteraction): Promise<APIInteractionResponse> => {
        const groupMainEmbed = input.message.embeds[0];
        const groupMainEmbedFields = GetEmbedFields<GroupMainEmbedFields>(groupMainEmbed);
        const groupRoleFormatted = groupMainEmbedFields[EmbedFieldNames.GroupRole];
        const groupRoleId = Unformat(groupRoleFormatted, FormattingPatterns.Role);

        if (!input.member?.roles.find((role) => role === groupRoleId)) {
            return EphemeralMessage(`You are not a member of this group`);
        }

        const characterEmbed = GetCharacterEmbedFromList(input.message.embeds, input.member!.user.id);

        if (!characterEmbed) {
            return EphemeralMessage(
                "Could not find character details to modify - has the embed for your character been deleted?",
            );
        }
        const characterEmbedFields = GetEmbedFields<MemberCharacterEmbedFields>(characterEmbed);

        return {
            type: InteractionResponseType.Modal,
            data: {
                title: "Edit Character Details",
                custom_id: EditGroupCharacter.id(input.channel_id, input.message.id),
                components: [
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.TextInput,
                                custom_id: EmbedFieldNames.MemberCharacterName,
                                value: characterEmbedFields[EmbedFieldNames.MemberCharacterName].split(" - ")[1],
                                style: TextInputStyle.Short,
                                label: EmbedFieldNames.MemberCharacterName,
                                required: true,
                                min_length: 2,
                                max_length: 16,
                            },
                        ],
                    },
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.TextInput,
                                custom_id: EmbedFieldNames.MemberCharacterILVL,
                                value: characterEmbedFields[EmbedFieldNames.MemberCharacterILVL],
                                style: TextInputStyle.Short,
                                label: EmbedFieldNames.MemberCharacterILVL,
                                required: true,
                                min_length: 3,
                                max_length: 4,
                            },
                        ],
                    },
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.TextInput,
                                custom_id: "Description",
                                value: characterEmbed.description,
                                placeholder:
                                    "Additional notes e.g. preferred schedule or anything additional character information",
                                style: TextInputStyle.Paragraph,
                                label: "Notes",
                                required: false,
                            },
                        ],
                    },
                ],
            },
        };
    },
};

export const GroupEdit = {
    id: (masterListChannelId: string, masterListMessageId: string) => {
        return `GroupEdit_${masterListChannelId}_${masterListMessageId}`;
    },
    // deno-lint-ignore require-await
    interaction: async (input: APIMessageComponentInteraction): Promise<APIInteractionResponse> => {
        const [_, masterListChannelId, masterListMessageId] = input.data.custom_id.split("_");
        const isAdminUser = (BigInt(input.member!.permissions) & PermissionFlagsBits.Administrator) ===
            PermissionFlagsBits.Administrator;

        const groupMainEmbed = input.message.embeds[0];
        const groupMainEmbedFields = GetEmbedFields<GroupMainEmbedFields>(groupMainEmbed);
        const groupLeaderFormatted = groupMainEmbedFields[EmbedFieldNames.GroupLeader];
        const groupLeaderId = Unformat(groupLeaderFormatted, FormattingPatterns.User);

        if (!isAdminUser || input.member!.user.id !== groupLeaderId) {
            return EphemeralMessage(
                `You do not have permission to edit this group. Only the group leader ${groupLeaderFormatted} and users with full admin permissions can edit`,
            );
        }

        return EphemeralMessage("Edit menu is not implemented yet");
    },
};

export const KickGroupMember = {
    id: (masterListChannelId: string, masterListMessageId: string) => {
        return `KickGroupMember_${masterListChannelId}_${masterListMessageId}`;
    },
    // deno-lint-ignore require-await
    interaction: async (input: APIMessageComponentInteraction): Promise<APIInteractionResponse> => {
        return EphemeralMessage("Kick not implemented yet");
    },
};

export const DeleteGroup = {
    id: (masterListChannelId: string, masterListMessageId: string) => {
        return `DeleteGroup_${masterListChannelId}_${masterListMessageId}`;
    },
    // deno-lint-ignore require-await
    interaction: async (input: APIMessageComponentInteraction): Promise<APIInteractionResponse> => {
        return EphemeralMessage("Delete not implemented yet");
    },
};

export const Buttons: Record<string, Button> = {
    AddGroup,
    SubmitNewGroup,
    ApplyToGroup,
    SubmitGroupApplication,
    AcceptApplication,
    LeaveGroup,
    ConfirmLeaveGroup,
    GroupMemberEdit,
    GroupEdit,
    GroupAddEditCharacter,
    GroupApplicationEditCharacter,
    GroupAddEditGroup,
    KickGroupMember,
    DeleteGroup,
};
