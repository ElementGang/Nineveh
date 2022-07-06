import { APIEmbed, APISelectMenuOption, FormattingPatterns } from "discord-api-types";
import { Unformat } from "./discord.ts";

export const CustomIds = {
    // Group Embed
    GroupLeader: "Leader",
    GroupChannel: "Channel",
    GroupRole: "Role",
    MembershipPolicy: "Membership",
    ChannelVisibility: "Channel Visibility",

    // Master List Embed
    GroupManagerRole: "Group Manager Role",
    GroupListChannel: "Groups Channel",
    LogChannel: "Log Channel",
} as const;
Object.freeze(CustomIds); // Prevent unwanted changes

export interface MasterListMainEmbedFields {
    [CustomIds.GroupManagerRole]: string;
    [CustomIds.GroupListChannel]: string;
    [CustomIds.LogChannel]?: string;
}

export interface MasterListGroupEmbedFields {
    [CustomIds.GroupLeader]: string;
    [CustomIds.GroupRole]: string;
}

export interface GroupMainEmbedFields {
    [CustomIds.GroupLeader]: string;
    [CustomIds.GroupChannel]: string;
    [CustomIds.GroupRole]: string;
    [CustomIds.MembershipPolicy]: string;
    [CustomIds.ChannelVisibility]: string;
}

export interface GroupMemberInfo {
    Username: string;
    CharacterInfo: CharacterInfo | undefined;
}

export interface CharacterInfo {
    Name: string;
    Description: string;
    ItemLevel: string;
    Class: string;
}

export function DefaultCharacterInfo(username: string): CharacterInfo {
    return {
        Name: username,
        Class: "Class",
        Description: "",
        ItemLevel: "0000",
    };
}

export function DefaultMemberInfo(username: string) {
    return `${username} - Character <0000> [Class]`;
}

export function DefaultCharacterEmbed(username: string, userId: string): APIEmbed {
    return {
        title: DefaultMemberInfo(username),
        description: `<@${userId}>`,
    };
}

export function FormatMemberInfo(userName: string, characterInfo: CharacterInfo | undefined): string | undefined {
    if (characterInfo === undefined) return userName;
    const formatted = `${userName} - ${characterInfo.Name} <${characterInfo.ItemLevel}> [${characterInfo.Class}]`;
    return formatted.match(MemberInfoRegExp) ? formatted : undefined;
}
const MemberInfoRegExp = /(\w+)\s\-\s(\w+)\s\<(\d+)\>\s\[(\w+)\]/;
export function UnformatMemberInfo(formatted: string): [string, CharacterInfo | undefined] {
    const match = MemberInfoRegExp.exec(formatted);
    if (!match) return [formatted, undefined];
    return [match[1], { Name: match[2], ItemLevel: match[3], Class: match[4], Description: "" }];
}

export function FormatMemberDescription(userId: string, description: string | undefined): string {
    return description === undefined || description === "" ? `<@${userId}>` : `<@${userId}> ${description}`;
}

export function GetUserIdFromMemberDescription(formatted: string): string {
    const userIdEnd = formatted.indexOf(">");
    const id = Unformat(formatted.substring(0, userIdEnd + 1), FormattingPatterns.User);
    if (!id) throw new Error("Unformatting description to user id failed");
    return id;
}

export function UnformatMemberDescription(formatted: string): string {
    const descriptionStart = formatted.indexOf(">");
    if (descriptionStart === -1) return formatted;
    return formatted.substring(descriptionStart + 1).trimStart();
}

export interface GroupInfo {
    Name: string;
    Description: string;

    GroupsChannelId: string;
    GroupsChannelMessageId: string;

    LeaderId: string;
    RoleId: string;
    ChannelId: string;

    Members: GroupMemberInfo[];
}

export interface CreateGroupInfo {
    GroupName: string;
    GroupDescription: string;
    GuildId: string;
    MasterListChannelId: string;
    MasterListMessageId: string;
    LeaderUserName: string;
    LeaderUserId: string;
    ExistingRoleId: string | undefined;
    ExistingChannelId: string | undefined;
    CharacterInfo: CharacterInfo | undefined;
}

export function FindGroupMemberEmbedInList(embeds: APIEmbed[], userId: string): APIEmbed | undefined {
    return embeds.find((embed) => {
        const description = embed.description;
        if (!description) return;
        const idEndChar = description.indexOf(">");
        const idFormatted = description.substring(0, idEndChar + 1);
        const id = Unformat(idFormatted, FormattingPatterns.User);
        return id === userId;
    });
}

export const Classes: string[] = [
    "Artillerist",
    "Bard",
    "Berserker",
    "Deadeye",
    "Deathblade",
    "Gunlancer",
    "Gunslinger",
    "Paladin",
    "Scrapper",
    "Shadowhunter",
    "Sharpshooter",
    "Sorceress",
    "Soulfist",
    "Striker",
    "Wardancer",
];

export const ClassSelectMenuOptions: APISelectMenuOption[] = Classes.map((value) => ({
    label: value,
    value: value,
}));
