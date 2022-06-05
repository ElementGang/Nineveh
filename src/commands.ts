import { APIApplicationCommandInteraction, APIInteractionResponse, ApplicationCommandType, ButtonStyle, ComponentType, InteractionResponseType, RESTPostAPIApplicationCommandsJSONBody } from "discord-api-types/v10";
import { CreateGuildApplicationCommand } from "./discord";

export interface Command {
    name: string,
    description: string,
    permissions: "admin" | "user",
    scope: "global" | "server",
    interaction: (input: APIApplicationCommandInteraction) => APIInteractionResponse
}

export const Commands: Command[] = [
    {
        name: "create-guild",
        description: "Creates a guild within this server to manage a set of groups. Creates a group summary channel.",
        permissions: "admin",
        scope: "global",
        interaction(input) {

            const serverCommands = Commands.filter(x => x.scope === "server")
            for(const cmd of serverCommands)
            {
                CreateGuildApplicationCommand(cmd, input.guild_id!)
            }

            return {
                type: InteractionResponseType.ChannelMessageWithSource,
                data: {
                    content: "Hello, world!"
                }
            }
        }
    },
    {
        name: "migrate-group",
        description: "Creates a group using an existing channel",
        permissions: "admin",
        scope: "server",
        interaction(input) {

            return {
                type: InteractionResponseType.ChannelMessageWithSource,
                data: {
                    content: "Migrate"
                }
            }
        }
    },

]