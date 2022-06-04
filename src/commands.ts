import { ApplicationCommandType, RESTPostAPIApplicationCommandsJSONBody } from "discord-api-types/v10"
import { config } from "dotenv"
import * as go from "./fetch-polyfill";

(async () => {
    await go();
    config()
    const url = `https://discord.com/api/v10/applications/${process.env.APP_ID}/commands`
    const json : RESTPostAPIApplicationCommandsJSONBody = {
        name: "create-guild",
        type: ApplicationCommandType.ChatInput,
        description: "Creates a guild within this server to manage a set of groups. Creates a group summary channel.",
        dm_permission: false,
        default_member_permissions: "0"
    }

    void fetch(url, { method: "POST", body: JSON.stringify(json), headers: {"Authorization": `Bot ${process.env.BOT_TOKEN}`} });
})();