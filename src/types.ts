export interface MasterList {
    CreateGroupRole: string;
    Admin: string;
    GroupDeletePolicy: "owner" | "admin";
    Description: string;
    GroupListChannel: string;
}

export interface GroupMember {
    Name: string;
    Class: string;
    IL: number;
}

export interface Group {
    Leader: string;
    Role: string;
    Description: string;
    MembershipPolicy: "private" | "public";
    ChannelVisibility: "private" | "public";
    MemberList: GroupMember[];
}

export const EmbedFieldNames = {
    // Group Embed
    GroupName: "Name",
    GroupLeader: "Leader",
    GroupMemberCount: "Members",
    GroupChannel: "Channel",
    GroupRole: "Role",
    MembershipPolicy: "Membership",
    ChannelVisibility: "Channel Visibility",

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
    [EmbedFieldNames.GroupMemberCount]: string;
}
