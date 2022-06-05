import * as dotenv from "dotenv";
import { Commands } from "./commands.ts";
import { CreateGlobalApplicationCommand } from "./discord.ts";

dotenv.config();

const globalCommands = Commands.filter((x) => x.scope === "global");

for (const cmd of globalCommands) {
    CreateGlobalApplicationCommand(cmd);
}
