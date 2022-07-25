import {
    APIEmbed,
    APIEmbedField,
    APIMessage,
    ButtonStyle,
    ChannelType,
    ComponentType,
    FormattingPatterns,
    OverwriteType,
    PermissionFlagsBits,
    RESTPostAPIChannelMessageJSONBody,
} from "discord-api-types";
import * as Buttons from "./buttons.ts";
import {
    AddGuildMemberRole,
    CreateGuildChannel,
    CreateGuildRole,
    CreateMessage,
    CreateMessageUrl,
    DeleteChannel,
    DeleteGuildRole,
    DeleteMessage,
    EditMessage,
    GetChannel,
    GetChannelMessage,
    GetChannelMessages,
    GetEmbedFields,
    RemoveGuildMemberRole,
    Unformat,
} from "./discord.ts";
import {
    CreateGroupInfo,
    CustomIds,
    FormatMemberDescription,
    FormatMemberInfo,
    GetUserIdFromMemberDescription,
    GroupInfo,
    GroupMainEmbedFields,
    MasterListMainEmbedFields,
} from "./types.ts";

export async function LogChannelMessage(
    masterListMainEmbedFields: MasterListMainEmbedFields,
    message: RESTPostAPIChannelMessageJSONBody,
): Promise<APIMessage | undefined> {
    const logChannelIdFormatted = masterListMainEmbedFields[CustomIds.LogChannel];
    if (logChannelIdFormatted) {
        const logChannelId = Unformat(logChannelIdFormatted, FormattingPatterns.Channel)!;
        return await CreateMessage(logChannelId, message);
    }
    return undefined;
}

async function TryWithRecordFail(
    action: () => Promise<unknown>,
    actionName: string,
    errors: Record<string, string>,
) {
    try {
        await action();
    } catch (e: unknown) {
        errors[actionName] = CatchToString(e);
    }
}

function CatchToString(e: unknown): string {
    if (typeof e === "string") {
        return e;
    } else if (e instanceof Error) {
        return e.message;
    } else {
        return `Unhandled error type '${typeof e}'`;
    }
}

export async function CreateGroup(info: CreateGroupInfo): Promise<GroupInfo | string> {
    const guildId = info.GuildId;
    const groupName = info.GroupName;
    const masterListMessage = await GetChannelMessage(info.MasterListChannelId, info.MasterListMessageId);
    const masterListMainEmbedFields = GetEmbedFields<MasterListMainEmbedFields>(masterListMessage.embeds[0]);

    const groupsChannelIdFormatted = masterListMainEmbedFields[CustomIds.GroupListChannel];
    const groupsChannelId = Unformat(groupsChannelIdFormatted, FormattingPatterns.Channel)!;

    const masterListMessages = await GetChannelMessages(info.MasterListChannelId);

    if (masterListMessages.some((msg) => msg.embeds[0]?.title === groupName)) {
        throw new Error("Group with that name already exists, pick a different name");
    }
    let roleId = info.ExistingRoleId;
    const roleExistedBefore = roleId !== undefined;
    let groupChannelId = info.ExistingChannelId;
    const channelExistedBefore = groupChannelId !== undefined;
    let masterListGroupMessage: APIMessage | undefined = undefined;
    let groupsChannelMessage: APIMessage | undefined = undefined;
    let masterListGroupMessagePosted = false;

    try {
        if (roleId === undefined) {
            const groupRole = await CreateGuildRole(info.GuildId, {
                name: groupName,
                mentionable: true,
            });
            roleId = groupRole.id;
        }

        await AddGuildMemberRole(info.GuildId, info.LeaderUserId, roleId);

        const masterListChannel = await GetChannel(info.MasterListChannelId);
        if (masterListChannel.type !== ChannelType.GuildText) {
            throw new Error("Master list channel was not guild text");
        }

        // Create group channel
        if (groupChannelId === undefined) {
            const groupChannel = await CreateGuildChannel(guildId, {
                name: groupName,
                parent_id: masterListChannel.parent_id,
                permission_overwrites: [
                    {
                        id: guildId,
                        type: OverwriteType.Role,
                        deny: String(PermissionFlagsBits.ViewChannel),
                    },
                    {
                        id: roleId,
                        type: OverwriteType.Role,
                        allow: String(PermissionFlagsBits.ViewChannel),
                    },
                    {
                        id: Deno.env.get("APP_ID")!, // Adds bot to channel, bot user ID is same as APP ID
                        type: OverwriteType.Member,
                        allow: String(PermissionFlagsBits.ViewChannel),
                    },
                ],
            });
            groupChannelId = groupChannel.id;
        }

        const leaderEmbedField = {
            name: CustomIds.GroupLeader,
            value: `<@${info.LeaderUserId}>`,
            inline: true,
        };
        const roleEmbedField = {
            name: CustomIds.GroupRole,
            value: `<@&${roleId}>`,
            inline: true,
        };
        const channelEmbedField = {
            name: CustomIds.GroupChannel,
            value: `<#${groupChannelId}>`,
            inline: true,
        };

        const memberInfoString = FormatMemberInfo(info.LeaderUserName, info.CharacterInfo)!; // Will never fail here
        const memberDescription = FormatMemberDescription(info.LeaderUserId, info.CharacterInfo?.Description);
        const leaderMemberEmbedField: APIEmbedField = {
            name: memberInfoString,
            value: memberDescription,
        };

        const masterListGroupMessageEmbed: APIEmbed = {
            title: groupName,
            description: info.GroupDescription,
            fields: [leaderEmbedField, roleEmbedField],
        };

        masterListGroupMessage = await CreateMessage(masterListMessage.channel_id, {
            embeds: [masterListGroupMessageEmbed],
        });
        masterListGroupMessagePosted = masterListGroupMessage !== undefined;

        // Post group ad
        groupsChannelMessage = await CreateMessage(groupsChannelId, {
            embeds: [
                {
                    title: groupName,
                    description: info.GroupDescription,
                    url: CreateMessageUrl(guildId, info.MasterListChannelId, masterListGroupMessage.id),
                    fields: [leaderEmbedField, roleEmbedField, channelEmbedField, leaderMemberEmbedField],
                },
            ],
            components: [
                {
                    type: ComponentType.ActionRow,
                    components: [
                        {
                            type: ComponentType.Button,
                            style: ButtonStyle.Primary,
                            custom_id: Buttons.ApplyToGroup.id(masterListChannel.id, info.MasterListMessageId),
                            label: "Apply",
                        },
                        {
                            type: ComponentType.Button,
                            style: ButtonStyle.Danger,
                            custom_id: Buttons.LeaveGroup.id(masterListChannel.id, info.MasterListMessageId),
                            label: "Leave",
                        },
                        {
                            type: ComponentType.Button,
                            style: ButtonStyle.Secondary,
                            custom_id: Buttons.EditMemberDetails.id(),
                            label: "Edit My Details",
                        },
                        {
                            type: ComponentType.Button,
                            style: ButtonStyle.Secondary,
                            custom_id: Buttons.EditGroup.id(
                                masterListChannel.id,
                                masterListMessage.id,
                                masterListGroupMessage.id,
                            ),
                            label: "Edit Group",
                        },
                    ],
                },
            ],
        });

        masterListGroupMessageEmbed.url = CreateMessageUrl(
            guildId,
            groupsChannelMessage.channel_id,
            groupsChannelMessage.id,
        );
        await EditMessage(masterListGroupMessage.channel_id, masterListGroupMessage.id, {
            embeds: [masterListGroupMessageEmbed],
        });

        LogChannelMessage(masterListMainEmbedFields, {
            content:
                `Group '${groupName}' created with leader <@${info.LeaderUserId}>, role <@&${roleId}> and channel <#${groupChannelId}>`,
            components: [
                {
                    type: ComponentType.ActionRow,
                    components: [
                        {
                            type: ComponentType.Button,
                            style: ButtonStyle.Link,
                            label: "Go To Listing",
                            url: CreateMessageUrl(guildId, groupsChannelId, groupsChannelMessage.id),
                        },
                    ],
                },
            ],
        });

        return {
            Name: groupName,
            Description: info.GroupDescription,
            GroupsChannelId: groupsChannelId,
            GroupsChannelMessageId: groupsChannelMessage.id,
            RoleId: roleId,
            ChannelId: groupChannelId,
            LeaderId: info.LeaderUserId,
            Members: [{
                Username: info.LeaderUserName,
                CharacterInfo: info.CharacterInfo,
            }],
        };
    } catch (e: unknown) {
        DeleteGroupComponents(
            guildId,
            masterListGroupMessagePosted ? masterListGroupMessage : undefined,
            groupsChannelMessage,
            roleExistedBefore ? undefined : roleId, // If role existed before, never delete it on cleanup
            channelExistedBefore ? undefined : groupChannelId, // If channel existed before, never delete it on cleanup
        );
        return CatchToString(e);
    }
}

export async function DeleteGroup(
    guildId: string,
    masterListChannelId: string,
    masterListMessageId: string,
    masterListGroupMessageId: string,
    groupsChannelId: string,
    groupsMessageId: string,
    deleteRole: boolean,
    deleteChannel: boolean,
) {
    const groupMessage = await GetChannelMessage(groupsChannelId, groupsMessageId);
    const groupName = groupMessage.embeds[0].title!;
    const embedFields = GetEmbedFields<GroupMainEmbedFields>(groupMessage.embeds[0]);

    const roleFormatted = embedFields[CustomIds.GroupRole];
    const roleId = Unformat(roleFormatted, FormattingPatterns.Role);
    const channelFormatted = embedFields[CustomIds.GroupChannel];
    const channelId = Unformat(channelFormatted, FormattingPatterns.Channel);

    const masterListMessage = await GetChannelMessage(masterListChannelId, masterListMessageId);
    const masterListGroupMessage = await GetChannelMessage(masterListChannelId, masterListGroupMessageId);

    await DeleteGroupComponents(
        guildId,
        masterListGroupMessage,
        groupMessage,
        deleteRole ? roleId : undefined,
        deleteChannel ? channelId : undefined,
    );

    const masterListMainEmbedFields = GetEmbedFields<MasterListMainEmbedFields>(masterListMessage.embeds[0]);

    let extraMessageInfo = "";
    switch ([deleteRole, deleteChannel]) {
        case [true, true]:
            extraMessageInfo = " along with associated channel and role";
            break;
        case [true, false]:
            extraMessageInfo = " along with associated role, but not channel";
            break;
        case [false, true]:
            extraMessageInfo = " along with associated channel, but not role";
            break;
    }

    LogChannelMessage(masterListMainEmbedFields, {
        content: `Deleted group '${groupName}'${extraMessageInfo}`,
    });

    return;
}

async function DeleteGroupComponents(
    guildId: string,
    masterListGroupMessage: APIMessage | undefined,
    groupMessage: APIMessage | undefined,
    roleId: string | undefined,
    channelId: string | undefined,
) {
    const errors: Record<string, string> = {};

    if (masterListGroupMessage) {
        await TryWithRecordFail(
            async () => await DeleteMessage(masterListGroupMessage.channel_id, masterListGroupMessage.id),
            "Delete Master List Group Message",
            errors,
        );
    }

    if (groupMessage) {
        await TryWithRecordFail(
            async () => await DeleteMessage(groupMessage.channel_id, groupMessage.id),
            "Delete Group Message",
            errors,
        );
    }

    if (roleId) {
        await TryWithRecordFail(async () => await DeleteGuildRole(guildId, roleId), "Delete Role", errors);
    }

    if (channelId) {
        await TryWithRecordFail(async () => await DeleteChannel(channelId), "Delete Channel", errors);
    }

    if (Object.keys(errors).length > 0) {
        for (const [str, err] of Object.entries(errors)) {
            console.log(`${str} failed: ${err}`);
        }
    }
}

export async function AddToGroup(
    guildId: string,
    masterListChannelId: string,
    masterListMessageId: string,
    membedId: string,
    memberField: APIEmbedField,
    groupsMessage: APIMessage,
    groupMainEmbedFields: GroupMainEmbedFields,
) {
    const groupRoleId = Unformat(groupMainEmbedFields[CustomIds.GroupRole], FormattingPatterns.Role)!;

    await AddGuildMemberRole(guildId, membedId, groupRoleId);

    groupsMessage.embeds[0].fields!.push(memberField);

    await EditMessage(groupsMessage.channel_id, groupsMessage.id, { embeds: groupsMessage.embeds });

    const masterListMessage = await GetChannelMessage(masterListChannelId, masterListMessageId);
    const masterListMainEmbed = GetEmbedFields<MasterListMainEmbedFields>(masterListMessage.embeds[0]);
    LogChannelMessage(masterListMainEmbed, {
        content: `<@${membedId}> has joined '${groupsMessage.embeds[0].title}'`,
    });
}

export async function ChangeGroupLeader(
    userId: string,
    masterListMessageParam: APIMessage | [masterListChannelId: string, masterListMessageId: string],
    groupMessageParam: APIMessage | [groupsChannelId: string, groupMessageId: string],
    newLeaderId: string,
) {
    const masterListMessage = masterListMessageParam instanceof Array
        ? await GetChannelMessage(masterListMessageParam[0], masterListMessageParam[1])
        : masterListMessageParam;
    const groupMessage = groupMessageParam instanceof Array
        ? await GetChannelMessage(groupMessageParam[0], groupMessageParam[1])
        : groupMessageParam;

    async function UpdateLeaderInMessage(message: APIMessage) {
        const field = message.embeds?.[0].fields?.find((f) => f.name === CustomIds.GroupLeader);
        if (!field) return;
        if (Unformat(field.value, FormattingPatterns.User) !== userId) {
            throw new Error("You are not the leader of the group");
        }
        field.value = `<@${newLeaderId}>`;
        await EditMessage(message.channel_id, message.id, { embeds: message.embeds });
    }

    await UpdateLeaderInMessage(masterListMessage);
    await UpdateLeaderInMessage(groupMessage);
}

export async function RemoveFromGroup(
    guildId: string,
    masterListChannelId: string,
    masterListMessageId: string,
    groupsChannelId: string,
    groupsChannelMessageId: string,
    memberId: string,
) {
    const groupMessage = await GetChannelMessage(groupsChannelId, groupsChannelMessageId);
    const groupEmbed = groupMessage.embeds[0];
    const groupMainEmbedFields = GetEmbedFields<GroupMainEmbedFields>(groupEmbed);

    const groupRoleId = Unformat(groupMainEmbedFields[CustomIds.GroupRole], FormattingPatterns.Role)!;
    await RemoveGuildMemberRole(guildId, memberId, groupRoleId);

    groupEmbed.fields = groupEmbed.fields!.filter((field) => {
        if (!field.value) return true;
        return GetUserIdFromMemberDescription(field.value) !== memberId;
    });

    await EditMessage(groupsChannelId, groupsChannelMessageId, { embeds: [groupEmbed] });

    const groupChannelId = Unformat(
        groupMainEmbedFields[CustomIds.GroupChannel],
        FormattingPatterns.Channel,
    )!;
    await CreateMessage(groupChannelId, { content: `<@${memberId}> has left the group` });

    const masterListMessage = await GetChannelMessage(masterListChannelId, masterListMessageId);
    const masterListMainEmbed = GetEmbedFields<MasterListMainEmbedFields>(masterListMessage.embeds[0]);
    LogChannelMessage(masterListMainEmbed, {
        content: `<@${memberId}> has left '${groupEmbed.title}'`,
    });
}
