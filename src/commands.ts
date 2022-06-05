import { ApplicationCommandType, RESTPostAPIApplicationCommandsJSONBody } from "discord-api-types";
import * as dotenv from "dotenv";

dotenv.config()
const url = `https://discord.com/api/v10/applications/${Deno.env.get('APP_ID')}/commands`
const json : RESTPostAPIApplicationCommandsJSONBody = {
    name: "create-guild",
    type: ApplicationCommandType.ChatInput,
    description: "Creates a guild within this server to manage a set of groups. Creates a group summary channel.",
    dm_permission: false,
    default_member_permissions: "0"
}

void fetch(url, { method: "POST", body: JSON.stringify(json), headers: {"Authorization": `Bot ${Deno.env.get('BOT_TOKEN')}`} });
