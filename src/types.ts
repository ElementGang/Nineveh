import {
    APIEmbed,
    APIMessage,
    APISelectMenuOption,
    FormattingPatterns,
    RESTPostAPIChannelMessageJSONBody,
} from "discord-api-types";
import { CreateMessage, Unformat } from "./discord.ts";

export const EmbedFieldNames = {
    // Group Embed
    GroupName: "Name",
    GroupLeader: "Leader",
    GroupMemberCount: "Members",
    GroupChannel: "Channel",
    GroupRole: "Role",
    MembershipPolicy: "Membership",
    ChannelVisibility: "Channel Visibility",

    // Group Member
    MemberCharacterName: "Name",
    MemberCharacterILVL: "Item Level",
    MemberCharacterClass: "Class",

    // Master List Embed
    GroupManagerRole: "Group Manager Role",
    GroupListChannel: "Groups Channel",
    LogChannel: "Log Channel",
} as const;
Object.freeze(EmbedFieldNames); // Prevent unwanted changes

export interface MasterListMainEmbedFields {
    [EmbedFieldNames.GroupManagerRole]: string;
    [EmbedFieldNames.GroupListChannel]: string;
    [EmbedFieldNames.LogChannel]?: string;
}

export interface MasterListGroupEmbedFields {
    [EmbedFieldNames.GroupLeader]: string;
    [EmbedFieldNames.GroupRole]: string;
}

export interface GroupMainEmbedFields {
    [EmbedFieldNames.GroupLeader]: string;
    [EmbedFieldNames.GroupChannel]: string;
    [EmbedFieldNames.GroupRole]: string;
    [EmbedFieldNames.MembershipPolicy]: string;
    [EmbedFieldNames.ChannelVisibility]: string;
}

export interface MemberCharacterEmbedFields {
    [EmbedFieldNames.MemberCharacterName]: string;
    [EmbedFieldNames.MemberCharacterILVL]: string;
    [EmbedFieldNames.MemberCharacterClass]: string;
}

export async function LogChannelMessage(
    masterListMainEmbedFields: MasterListMainEmbedFields,
    message: RESTPostAPIChannelMessageJSONBody,
): Promise<APIMessage | undefined> {
    const logChannelIdFormatted = masterListMainEmbedFields[EmbedFieldNames.LogChannel];
    if (logChannelIdFormatted) {
        const logChannelId = Unformat(logChannelIdFormatted, FormattingPatterns.Channel)!;
        return await CreateMessage(logChannelId, message);
    }
    return undefined;
}

export const DynamicSelectMenuPrefix = "%SM_";

export function DynamicSelectMenuId(name: string): string {
    return `${DynamicSelectMenuPrefix}${name}`;
}

export function GetCharacterEmbedFromList(embeds: APIEmbed[], userId: string): APIEmbed | undefined {
    return embeds.find((embed) => {
        const field = embed.fields?.find((field) => {
            if (field.name !== EmbedFieldNames.MemberCharacterName) return false;
            const id = Unformat(field.value.split(" - ")[0], FormattingPatterns.User);
            return id === userId;
        });
        return field !== undefined;
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
