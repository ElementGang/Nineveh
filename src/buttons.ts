import {
    APIEmbed,
    APIInteractionResponse,
    APIMessage,
    APIMessageComponentInteraction,
    ButtonStyle,
    ComponentType,
    FormattingPatterns,
    InteractionResponseType,
    MessageFlags,
    PermissionFlagsBits,
} from "discord-api-types";
import { AddToGroup, CreateGroup, DeleteGroup as ActionDeleteGroup, RemoveFromGroup } from "./actions.ts";
import {
    CreateMessage,
    CreateMessageUrl,
    EphemeralMessage,
    GetChannelMessage,
    GetEmbedFields,
    GetGuildMember,
    Unformat,
} from "./discord.ts";
import { EditCharacterInfo, EditGroupInfo } from "./modals.ts";
import { EditCharacterClass } from "./selectmenu.ts";
import {
    CharacterInfo,
    ClassSelectMenuOptions,
    CustomIds,
    DefaultCharacterEmbed,
    DefaultCharacterInfo,
    FindGroupMemberEmbedInList,
    GetUserIdFromMemberDescription,
    GroupMainEmbedFields,
    MasterListMainEmbedFields,
    UnformatMemberDescription,
    UnformatMemberInfo,
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
            const groupManagerRole = masterListMainEmbedFields[CustomIds.GroupManagerRole];
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

        const member = input.member!;
        const user = member.user;
        const userName = member.nick ?? user.username;

        return {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
                content:
                    "Use the UI below to modify the group details and settings. These can be changed after creation too.",
                flags: MessageFlags.Ephemeral,
                embeds: [
                    {
                        title: `${userName}'s Group`,
                        description: "",
                        fields: [
                            { name: CustomIds.GroupLeader, value: `<@${user.id}>`, inline: true },
                            // { name: EmbedFieldNames.MembershipPolicy, value: "Private", inline: true },
                            // { name: EmbedFieldNames.ChannelVisibility, value: "Private", inline: true },
                        ],
                    },
                    DefaultCharacterEmbed(userName, user.id),
                ],
                components: [
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.Button,
                                style: ButtonStyle.Primary,
                                custom_id: EditGroupDetails.id(
                                    "Create",
                                    input.channel_id,
                                    input.message.id,
                                    undefined,
                                    undefined,
                                ),
                                label: "Edit Group Details",
                            },
                            {
                                type: ComponentType.Button,
                                style: ButtonStyle.Primary,
                                custom_id: EditCharacter.id(),
                                label: "Edit Character",
                            },
                        ],
                    },
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.SelectMenu,
                                custom_id: EditCharacterClass.id(),
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

export const EditMemberDetails = {
    id: () => {
        return `EditMemberDetails`;
    },
    // deno-lint-ignore require-await
    interaction: async (input: APIMessageComponentInteraction): Promise<APIInteractionResponse> => {
        const groupMainEmbed = input.message.embeds[0];
        const groupMainEmbedFields = GetEmbedFields<GroupMainEmbedFields>(groupMainEmbed);
        const groupRoleFormatted = groupMainEmbedFields[CustomIds.GroupRole];
        const groupRoleId = Unformat(groupRoleFormatted, FormattingPatterns.Role);

        if (!input.member?.roles.find((role) => role === groupRoleId)) {
            return EphemeralMessage(`You are not a member of this group`);
        }

        return {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
                flags: MessageFlags.Ephemeral,
                components: [
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.Button,
                                style: ButtonStyle.Primary,
                                custom_id: EditCharacter.id(input.message.channel_id, input.message.id),
                                label: "Edit Character",
                            },
                        ],
                    },
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.SelectMenu,
                                custom_id: EditCharacterClass.id(input.message.channel_id, input.message.id),
                                placeholder: "Select class",
                                max_values: 1,
                                min_values: 1,
                                options: ClassSelectMenuOptions,
                            },
                        ],
                    },
                ],
            },
        };
    },
};

export const EditCharacter = {
    id: (groupsChannelId?: string, groupMessageId?: string) => {
        return `EditCharacter_${groupsChannelId}_${groupMessageId}`;
    },
    interaction: async (input: APIMessageComponentInteraction): Promise<APIInteractionResponse> => {
        const [_, groupsChannelId, groupMessageId] = input.data.custom_id.split("_");

        const member = input.member!;
        const user = member.user;
        const memberUserName = member.nick ?? user.username;
        const updateMessageMode = groupsChannelId === "undefined" && groupMessageId === "undefined";

        function FillCharacterInfo(message: APIMessage): [APIEmbed | undefined, CharacterInfo] {
            const embed = FindGroupMemberEmbedInList(message.embeds, user.id);
            let characterInfo: CharacterInfo;
            if (embed) {
                const [_username, info] = UnformatMemberInfo(embed.title!);
                characterInfo = info ?? DefaultCharacterInfo(memberUserName);
            } else {
                characterInfo = DefaultCharacterInfo(memberUserName);
            }
            return [embed, characterInfo];
        }

        let characterEmbed;
        let characterInfo: CharacterInfo;
        let buttonCustomId: string;

        if (updateMessageMode) {
            buttonCustomId = EditCharacterInfo.id("UpdateMessage");
            [characterEmbed, characterInfo] = FillCharacterInfo(input.message);
        } else {
            buttonCustomId = EditCharacterInfo.id("EditOtherMessage", groupsChannelId, groupMessageId);
            const message = await GetChannelMessage(groupsChannelId, groupMessageId);
            [characterEmbed, characterInfo] = FillCharacterInfo(message);
        }
        characterInfo.Description = characterEmbed?.description ?? `<@${user.id}>`;

        return {
            type: InteractionResponseType.Modal,
            data: {
                title: "Edit Character Details",
                custom_id: buttonCustomId,
                components: EditCharacterInfo.components(characterInfo),
            },
        };
    },
};

export const EditGroup = {
    id: (masterListChannelId: string, masterListMessageId: string, masterListGroupMessageId: string) => {
        return `EditGroup_${masterListChannelId}_${masterListMessageId}_${masterListGroupMessageId}`;
    },
    // deno-lint-ignore require-await
    interaction: async (input: APIMessageComponentInteraction): Promise<APIInteractionResponse> => {
        const [_, masterListChannelId, masterListMessageId, masterListGroupMessageId] = input.data.custom_id.split("_");

        const isAdminUser = (BigInt(input.member!.permissions) & PermissionFlagsBits.Administrator) ===
            PermissionFlagsBits.Administrator;

        const groupMainEmbed = input.message.embeds[0];
        const groupMainEmbedFields = GetEmbedFields<GroupMainEmbedFields>(groupMainEmbed);
        const groupLeaderFormatted = groupMainEmbedFields[CustomIds.GroupLeader];
        const groupLeaderId = Unformat(groupLeaderFormatted, FormattingPatterns.User);

        if (!isAdminUser && input.member!.user.id !== groupLeaderId) {
            return EphemeralMessage(
                `You do not have permission to edit this group. Only the group leader ${groupLeaderFormatted} and users with full admin permissions can edit`,
            );
        }

        return {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
                flags: MessageFlags.Ephemeral,
                components: [
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.Button,
                                style: ButtonStyle.Primary,
                                custom_id: EditGroupDetails.id(
                                    "Listed",
                                    masterListChannelId,
                                    masterListGroupMessageId,
                                    input.channel_id,
                                    input.message.id,
                                ),
                                label: "Edit Group Details",
                            },
                            {
                                type: ComponentType.Button,
                                style: ButtonStyle.Danger,
                                custom_id: KickGroupMember.id(masterListChannelId, masterListMessageId),
                                label: "Kick Member",
                            },
                            {
                                type: ComponentType.Button,
                                style: ButtonStyle.Danger,
                                custom_id: DeleteGroup.id(
                                    masterListChannelId,
                                    masterListMessageId,
                                    masterListGroupMessageId,
                                    input.message.id,
                                ),
                                label: "Delete Group",
                            },
                        ],
                    },
                ],
            },
        };
    },
};

export const EditGroupDetails = {
    id: (
        mode: "Create" | "Listed",
        masterListChannelId: string,
        masterListGroupMessageId: string,
        groupsChannelId: string | undefined,
        groupMessageId: string | undefined,
    ) => {
        return `EditGroupDetails_${mode}_${masterListChannelId}_${masterListGroupMessageId}_${groupsChannelId}_${groupMessageId}`;
    },
    interaction: async (input: APIMessageComponentInteraction): Promise<APIInteractionResponse> => {
        const [_, mode, masterListChannelId, masterListGroupMessageId, groupsChannelId, groupMessageId] = input.data
            .custom_id
            .split("_");

        let currentTitle: string;
        let currentDescription: string | undefined;
        if (mode === "Create") {
            const embed = input.message.embeds[0]; // In create mode the first embed contains the group details
            currentTitle = embed.title!;
            currentDescription = embed.description;
        } else if (mode === "Listed") {
            const groupMessage = await GetChannelMessage(groupsChannelId, groupMessageId);
            const embed = groupMessage.embeds[0];
            currentTitle = embed.title!;
            currentDescription = embed.description;
        } else {
            return EphemeralMessage(`Mode ${mode} not supported`);
        }

        return {
            type: InteractionResponseType.Modal,
            data: {
                title: "Edit Group Details",
                custom_id: EditGroupInfo.id(
                    mode,
                    masterListChannelId,
                    masterListGroupMessageId,
                    groupsChannelId,
                    groupMessageId,
                ),
                components: EditGroupInfo.components(currentTitle, currentDescription),
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
        const leaderMemberEmbed = input.message.embeds[1];

        // TODO: Allow no character info
        const [_username, characterInfo] = UnformatMemberInfo(leaderMemberEmbed.title!);
        characterInfo!.Description = UnformatMemberDescription(leaderMemberEmbed.description ?? "");

        const member = input.member!;
        const user = member.user;
        const username = member.nick ?? user.username;

        const groupInfo = await CreateGroup({
            MasterListChannelId: input.channel_id,
            MasterListMessageId: masterListMessageId,
            GroupName: submitEmbed.title!,
            GroupDescription: submitEmbed.description ?? "",
            GuildId: input.guild_id!,
            ExistingChannelId: undefined,
            ExistingRoleId: undefined,
            LeaderUserName: username,
            LeaderUserId: user.id,
            CharacterInfo: characterInfo,
        });

        if (typeof groupInfo === "string") {
            return EphemeralMessage(`Failed to create group: ${groupInfo}`);
        }

        return {
            type: InteractionResponseType.UpdateMessage,
            data: {
                embeds: [],
                content: `Successfully created group`,
                components: [
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.Button,
                                style: ButtonStyle.Link,
                                label: "Go To Listing",
                                url: CreateMessageUrl(
                                    input.guild_id!,
                                    groupInfo.GroupsChannelId,
                                    groupInfo.GroupsChannelMessageId,
                                ),
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

        const groupRoleFormatted = groupMainEmbedFields[CustomIds.GroupRole];
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

        const member = input.member!;
        const user = member.user;
        const memberUserName = member.nick ?? user.username;

        return {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
                content:
                    "The application below will be sent to the group channel and displayed on the group's member list if the application is accepted",
                embeds: [DefaultCharacterEmbed(memberUserName, user.id)],
                flags: MessageFlags.Ephemeral,
                components: [
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.Button,
                                style: ButtonStyle.Primary,
                                label: "Edit",
                                custom_id: EditCharacter.id(),
                            },
                        ],
                    },
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.SelectMenu,
                                custom_id: EditCharacterClass.id(),
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

export const SubmitGroupApplication = {
    id: (masterListChannelId: string, masterListMessageId: string, groupMessageId: string) => {
        return `SubmitGroupApplication_${masterListChannelId}_${masterListMessageId}_${groupMessageId}`;
    },
    interaction: async (input: APIMessageComponentInteraction): Promise<APIInteractionResponse> => {
        const [_, masterListChannelId, masterListMessageId, groupMessageId] = input.data.custom_id.split("_");

        const applicationEmbed = input.message.embeds[0];

        const groupMessage = await GetChannelMessage(input.channel_id, groupMessageId);
        const groupMainEmbed = groupMessage.embeds[0];
        const groupMainEmbedFields = GetEmbedFields<GroupMainEmbedFields>(groupMainEmbed);

        const groupChannelId = Unformat(
            groupMainEmbedFields[CustomIds.GroupChannel],
            FormattingPatterns.Channel,
        )!;

        await CreateMessage(groupChannelId, {
            content: `${groupMainEmbedFields[CustomIds.GroupLeader]} group application received`,
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
        const groupLeaderFormatted = groupMainEmbedFields[CustomIds.GroupLeader];
        const groupLeaderId = Unformat(groupLeaderFormatted, FormattingPatterns.User);
        const groupRoleFormatted = groupMainEmbedFields[CustomIds.GroupRole];
        const groupRoleId = Unformat(groupRoleFormatted, FormattingPatterns.Role);

        if (!isAdminUser && input.member!.user.id !== groupLeaderId) {
            return EphemeralMessage(
                `You do not have permission to edit this group. Only the group leader ${groupLeaderFormatted} and users with full admin permissions can edit`,
            );
        }

        const guildId = input.guild_id!;
        const membedEmbed = input.message.embeds[0];
        const memberId = GetUserIdFromMemberDescription(membedEmbed.description!);
        const member = await GetGuildMember(guildId, memberId);

        if (member.roles.find((roleId) => roleId === groupRoleId)) {
            return EphemeralMessage("Applicant is already in the group");
        }

        await AddToGroup(
            guildId,
            masterListChannelId,
            masterListMessageId,
            memberId,
            membedEmbed,
            groupMessage,
            groupMainEmbedFields,
        );

        return {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
                content: `<@${memberId}> has joined the group`,
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
        const groupRoleFormatted = groupMainEmbedFields[CustomIds.GroupRole];
        const groupRoleId = Unformat(groupRoleFormatted, FormattingPatterns.Role);
        const groupLeaderId = Unformat(groupMainEmbedFields[CustomIds.GroupLeader], FormattingPatterns.User);

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

        await RemoveFromGroup(
            input.guild_id!,
            masterListChannelId,
            masterListMessageId,
            input.channel_id,
            groupMessageId,
            input.member!.user.id,
        );

        return {
            type: InteractionResponseType.UpdateMessage,
            data: {
                content: "You have left the group",
                components: [],
            },
        };
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
    id: (
        masterListChannelId: string,
        masterListMessageId: string,
        masterListGroupMessageId: string,
        groupMessageId: string,
    ) => {
        return `DeleteGroup_${masterListChannelId}_${masterListMessageId}_${masterListGroupMessageId}_${groupMessageId}`;
    },
    // deno-lint-ignore require-await
    interaction: async (input: APIMessageComponentInteraction): Promise<APIInteractionResponse> => {
        const [_, masterListChannelId, masterListMessageId, masterListGroupMessageId, groupMessageId] = input.data
            .custom_id.split("_");

        return {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
                content: "This action cannot be undone. Which components do you want to delete?",
                flags: MessageFlags.Ephemeral,
                components: [
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.Button,
                                style: ButtonStyle.Danger,
                                label: "All (incl channel and role)",
                                custom_id: ConfirmDeleteGroup.id(
                                    ChannelDeleteBit | RoleDeleteBit,
                                    masterListChannelId,
                                    masterListMessageId,
                                    masterListGroupMessageId,
                                    groupMessageId,
                                ),
                            },
                            {
                                type: ComponentType.Button,
                                style: ButtonStyle.Danger,
                                label: "Listing only (wont delete channel or role)",
                                custom_id: ConfirmDeleteGroup.id(
                                    0,
                                    masterListChannelId,
                                    masterListMessageId,
                                    masterListGroupMessageId,
                                    groupMessageId,
                                ),
                            },
                        ],
                    },
                ],
            },
        };
    },
};

const ChannelDeleteBit = 1 << 1;
const RoleDeleteBit = 1 << 2;

export const ConfirmDeleteGroup = {
    id: (
        mode: number,
        masterListChannelId: string,
        masterListMessageId: string,
        masterListGroupMessageId: string,
        groupMessageId: string,
    ) => {
        return `ConfirmDeleteGroup_${mode}_${masterListChannelId}_${masterListMessageId}_${masterListGroupMessageId}_${groupMessageId}`;
    },
    interaction: async (input: APIMessageComponentInteraction): Promise<APIInteractionResponse> => {
        const [_, modeStr, masterListChannelId, masterListMessageId, masterListGroupMessageId, groupMessageId] = input
            .data.custom_id.split("_");
        const mode = Number(modeStr);

        const deleteRole = (mode & RoleDeleteBit) === RoleDeleteBit;
        const deleteChannel = (mode & ChannelDeleteBit) === ChannelDeleteBit;
        await ActionDeleteGroup(
            input.guild_id!,
            masterListChannelId,
            masterListMessageId,
            masterListGroupMessageId,
            input.channel_id,
            groupMessageId,
            deleteRole,
            deleteChannel,
        );

        return {
            type: InteractionResponseType.UpdateMessage,
            data: {
                content: "You have deleted the group",
                components: [],
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
    ConfirmLeaveGroup,
    EditMemberDetails,
    EditCharacter,
    EditGroup,
    EditGroupDetails,
    KickGroupMember,
    DeleteGroup,
    ConfirmDeleteGroup,
};
