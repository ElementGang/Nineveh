import {
    APIEmbed,
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
    Load,
    Unformat,
} from "./discord.ts";
import { EmbedFieldNames, MasterListMainEmbedFields } from "./types.ts";

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
                        title: "New Group",
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

        const groupRole = await CreateGuildRole(input.guild_id!, {
            name: `[Group] ${submitEmbed.title}`,
        });

        await AddGuildMemberRole(input.guild_id!, input.member!.user.id, groupRole.id);

        const masterListChannel = await GetChannel(input.channel_id);
        if (masterListChannel.type !== ChannelType.GuildText) {
            throw new Error("Master list channel was not guild text");
        }

        const groupChannel = await CreateGuildChannel(input.guild_id!, {
            name: `[Group] ${submitEmbed.title}`,
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

        const groupsChannelMessage = await CreateMessage(groupsChannelId, {
            embeds: [
                {
                    title: submitEmbed.title,
                    description: submitEmbed.description,
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
        });

        masterListMessage.embeds.push({
            title: submitEmbed.title,
            description: submitEmbed.description,
            url: CreateMessageUrl(input.guild_id!, groupsChannelMessage.channel_id, groupsChannelMessage.id),
            fields: [
                submitEmbed.fields![0], // Leader field
                {
                    name: EmbedFieldNames.GroupMemberCount,
                    value: "1", // New group always has 1 member
                    inline: true,
                },
            ],
        });

        await EditMessage(masterListMessage.channel_id, masterListMessage.id, masterListMessage);

        const logChannelIdFormatted = masterListMainEmbedFields[EmbedFieldNames.LogChannel];
        if (logChannelIdFormatted) {
            const logChannelId = Unformat(logChannelIdFormatted, FormattingPatterns.Channel);
            await CreateMessage(logChannelId, {
                content:
                    `Created group '${submitEmbed.title}' with role <@&${groupRole.id}> and private channel <#${groupChannel.id}>`,
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
        }

        return {
            type: InteractionResponseType.UpdateMessage,
            data: {
                embeds: [],
                content:
                    `Created group '${submitEmbed.title}' with role <@&${groupRole.id}> and private channel <#${groupChannel.id}>`,
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

export const Buttons: Record<string, Button> = { AddGroup, SubmitNewGroup };
