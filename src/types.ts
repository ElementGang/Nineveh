
export interface Server {

}

export interface MasterList {
    CreateGroupRole: string;
    Admin: string;
    GroupDeletePolicy: "owner" | "admin";
    LeaderRole: string;
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
    MembershipPolicy: "closed" | "open";
    MemberList: GroupMember[];
}
