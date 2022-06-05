import { ApplicationCommandType, RESTPostAPIApplicationCommandsJSONBody } from "discord-api-types/v10"
import { Command } from "./commands"

const baseUrl = "https://discord.com/api/v10"

export function CmdToJson(command: Command): RESTPostAPIApplicationCommandsJSONBody {
    return {
        name: command.name,
        type: ApplicationCommandType.ChatInput,
        description: command.description,
        dm_permission: false,
        default_member_permissions: command.permissions === "admin" ? "0" : null
    }
}

export async function CreateGlobalApplicationCommand(cmd: Command): Promise<void> {
    CreateGlobalApplicationCommandImpl(CmdToJson(cmd))
}

async function CreateGlobalApplicationCommandImpl(json: RESTPostAPIApplicationCommandsJSONBody): Promise<void> {
    const url = `${baseUrl}/applications/${process.env.APP_ID}/commands`

    const response = await fetch(url,
        {
            method: "POST",
            body: JSON.stringify(json),
            headers:
            {
                "Authorization": `Bot ${process.env.BOT_TOKEN}`,
                "Content-Type": "application/json"
            }
        }
    )
    console.log(response.status)
    console.log(JSON.stringify(await response.json()))
}

export async function CreateGuildApplicationCommand(json: RESTPostAPIApplicationCommandsJSONBody, guildID: string) {
    const url = `${baseUrl}/applications/${process.env.APP_ID}/guilds/${guildID}/commands`

    const response = await fetch(url,
        {
            method: "POST",
            body: JSON.stringify(json),
            headers:
            {
                "Authorization": `Bot ${process.env.BOT_TOKEN}`,
                "Content-Type": "application/json"
            }
        }
    )
    console.log(response.status)
    console.log(JSON.stringify(await response.json()))
}