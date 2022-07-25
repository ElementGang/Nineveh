import {
    APIApplicationCommandInteractionDataOption,
    APIApplicationCommandOption,
    APIChatInputApplicationCommandInteraction,
    APIInteractionResponse,
    ApplicationCommandOptionType,
    ButtonStyle,
    ComponentType,
    InteractionResponseType,
    MessageFlags,
    PermissionFlagsBits,
} from "discord-api-types";
import {
    CreateGuildApplicationCommand,
    EditMessage,
    EphemeralMessage,
    GetChannelMessages,
    GetGuildMember,
} from "./discord.ts";
import { AddGroup } from "./buttons.ts";
import { CustomIds } from "./types.ts";
import { CreateGroup } from "./actions.ts";

export interface Command {
    name: string;
    description: string;
    permissions: bigint;
    scope: "global" | "server";
    parameters: APIApplicationCommandOption[];
    interaction: (
        input: APIChatInputApplicationCommandInteraction,
    ) => Promise<APIInteractionResponse>;
}

function getOption<
    T extends APIApplicationCommandInteractionDataOption & { type: R },
    R extends ApplicationCommandOptionType,
>(
    options: APIApplicationCommandInteractionDataOption[],
    name: string,
    type: R,
): T | undefined {
    const found = options.find((x) => x.name === name);
    if (!found) return undefined;
    if (found.type !== type) {
        throw new Error(`Type of found option ${found.type} didn't match expected type ${type}`);
    }
    return found as T;
}

export const Commands: Command[] = [
    {
        name: "create-group-list",
        description: "Creates a group list in the channel this command is run to manage a set of groups.",
        permissions: PermissionFlagsBits.ManageChannels | PermissionFlagsBits.ManageRoles,
        scope: "global",
        parameters: [
            {
                type: ApplicationCommandOptionType.Role,
                name: "group-manager",
                description: "Role that permits creating and managing groups through the group list",
                required: true,
            },
            {
                type: ApplicationCommandOptionType.Channel,
                name: "groups-channel",
                description: "Channel where groups details will be posted and users can apply to join",
                required: true,
            },
            {
                type: ApplicationCommandOptionType.Channel,
                name: "log-channel",
                description:
                    "Channel where activity is logged, e.g. members joining/leaving a group or a group being deleted",
                required: false,
            },
        ],
        // deno-lint-ignore require-await
        async interaction(input) {
            const serverCommands = Commands.filter((x) => x.scope === "server");
            for (const cmd of serverCommands) {
                CreateGuildApplicationCommand(cmd, input.guild_id!);
            }

            const options = input.data.options!;
            const selectedGroupManagerRole = getOption(options, "group-manager", ApplicationCommandOptionType.Role)!;
            const selectedGroupListChannel = getOption(
                options,
                "groups-channel",
                ApplicationCommandOptionType.Channel,
            )!;
            const selectedLogChannel = getOption(options, "log-channel", ApplicationCommandOptionType.Channel);

            const result: APIInteractionResponse = {
                type: InteractionResponseType.ChannelMessageWithSource,
                data: {
                    embeds: [
                        {
                            title: "Groups",
                            color: 16729344,
                            fields: [
                                {
                                    name: CustomIds.GroupManagerRole,
                                    value: `<@&${selectedGroupManagerRole.value}>`,
                                    inline: true,
                                },
                                {
                                    name: CustomIds.GroupListChannel,
                                    value: `<#${selectedGroupListChannel.value}>`,
                                    inline: true,
                                },
                                ...(selectedLogChannel?.type === ApplicationCommandOptionType.Channel
                                    ? [{
                                        name: CustomIds.LogChannel,
                                        value: `<#${selectedLogChannel.value}>`,
                                        inline: true,
                                    }]
                                    : []),
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
                                    custom_id: AddGroup.id(),
                                    label: "➕ New Group",
                                },
                            ],
                        },
                    ],
                },
            };
            return result;
        },
    },
    {
        name: "add-group",
        description: "Add a role/channel to a new group in the first group list of a channel.",
        permissions: PermissionFlagsBits.ManageChannels | PermissionFlagsBits.ManageRoles,
        scope: "global",
        parameters: [
            {
                type: ApplicationCommandOptionType.String,
                name: "name",
                description: "Name of the group. Wont't overwrite channel/role name.",
                required: true,
            },
            {
                type: ApplicationCommandOptionType.User,
                name: "leader",
                description: "Leader of the group.",
                required: true,
            },
            {
                type: ApplicationCommandOptionType.Channel,
                name: "channel",
                description: "Existing channel of the group.",
                required: true,
            },
            {
                type: ApplicationCommandOptionType.Role,
                name: "role",
                description: "Role of the group.",
                required: true,
            },
        ],
        async interaction(input): Promise<APIInteractionResponse> {
            const options = input.data.options!;

            const messages = await GetChannelMessages(input.channel_id);
            const masterListMessage = messages.find((msg) => {
                return msg.embeds?.[0].fields?.[0].name === CustomIds.GroupManagerRole;
            });
            if (!masterListMessage) {
                return EphemeralMessage("Couldn't find a group list in this channel");
            }

            const leaderId = getOption(options, "leader", ApplicationCommandOptionType.User)!.value;
            const leaderMember = await GetGuildMember(input.guild_id!, leaderId);
            const groupName = getOption(options, "name", ApplicationCommandOptionType.String)!.value;

            await CreateGroup({
                GroupName: groupName,
                GroupDescription: "",
                GuildId: input.guild_id!,
                MasterListChannelId: input.channel_id,
                MasterListMessageId: masterListMessage.id,
                CharacterInfo: undefined,
                LeaderUserId: leaderId,
                LeaderUserName: leaderMember.nick ?? leaderMember.user!.username,
                ExistingChannelId: getOption(options, "channel", ApplicationCommandOptionType.Channel)!.value,
                ExistingRoleId: getOption(options, "role", ApplicationCommandOptionType.Role)!.value,
            });

            return {
                type: InteractionResponseType.ChannelMessageWithSource,
                data: {
                    flags: MessageFlags.Ephemeral,
                    content: `Migrated group ${groupName}`,
                },
            };
        },
    },
    {
        name: "update",
        description: "Update data model. Do not use unless you know what you're doing - docs may come in future.",
        permissions: PermissionFlagsBits.ManageChannels | PermissionFlagsBits.ManageRoles,
        scope: "global",
        parameters: [
            {
                type: ApplicationCommandOptionType.String,
                name: "operation",
                description: "What operation to perform",
                required: true,
            },
        ],
        async interaction(input): Promise<APIInteractionResponse> {
            const options = input.data.options!;

            const operation = getOption(options, "operation", ApplicationCommandOptionType.String)!.value;

            switch (operation) {
                case "reducecomponentids":
                    {
                        for (const msg of await GetChannelMessages(input.channel_id)) {
                            if (!msg.components) continue;
                            msg.components.forEach((row) =>
                                row.components.filter((c) => "custom_id" in c).forEach((c) => {
                                    const component = c as { custom_id: string };
                                    const [before, ...after] = component.custom_id.split("_");
                                    component.custom_id = `${before.replace("/[^A-Z]/g", "")}${after.join("_")}`;
                                })
                            );
                            await EditMessage(msg.channel_id, msg.id, { components: msg.components });
                        }
                    }
                    break;
                default:
                    return EphemeralMessage(`Operation '${operation}' not found`);
            }

            return {
                type: InteractionResponseType.ChannelMessageWithSource,
                data: {
                    flags: MessageFlags.Ephemeral,
                    content: `Completed`,
                },
            };
        },
    },
];
