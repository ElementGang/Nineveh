import {
    APIApplicationCommandInteractionDataOption,
    APIApplicationCommandOption,
    APIChatInputApplicationCommandInteraction,
    APIInteractionResponse,
    ApplicationCommandOptionType,
    ButtonStyle,
    ComponentType,
    InteractionResponseType,
    PermissionFlagsBits,
} from "discord-api-types";
import { CreateGuildApplicationCommand } from "./discord.ts";
import { AddGroup } from "./buttons.ts";
import { CustomIds } from "./types.ts";

export interface Command {
    name: string;
    description: string;
    permissions: bigint;
    scope: "global" | "server";
    parameters: APIApplicationCommandOption[];
    interaction: (
        input: APIChatInputApplicationCommandInteraction,
    ) => APIInteractionResponse;
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
        interaction(input) {
            const serverCommands = Commands.filter((x) => x.scope === "server");
            for (const cmd of serverCommands) {
                CreateGuildApplicationCommand(cmd, input.guild_id!);
            }

            function getOption(name: string): APIApplicationCommandInteractionDataOption | undefined {
                return input.data.options?.find((x) => x.name === name);
            }

            const selectedGroupManagerRole = getOption("group-manager")!;
            const selectedGroupListChannel = getOption("groups-channel")!;
            const selectedLogChannel = getOption("log-channel");

            if (selectedGroupManagerRole?.type !== ApplicationCommandOptionType.Role) {
                throw new Error("Groups manager option not found in response");
            }

            if (selectedGroupListChannel?.type !== ApplicationCommandOptionType.Channel) {
                throw new Error("Groups channel option not found in response");
            }

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
];
