import * as dotenv from "dotenv";
import { Commands } from "./commands.ts";
import {
    CreateGlobalApplicationCommand,
    DeleteGlobalApplicationCommand,
    GetGlobalApplicationCommands,
} from "./discord.ts";

dotenv.config();

const globalCommands = Commands.filter((x) => x.scope === "global");

// Overwrite commands in the list
for (const cmd of globalCommands) {
    CreateGlobalApplicationCommand(cmd);
}

const uploadedGlobalCommands = await GetGlobalApplicationCommands();
const filteredGlobalCommands = uploadedGlobalCommands.filter((cmd) =>
    !globalCommands.find((existing) => existing.name === cmd.name)
);

for (const cmd of filteredGlobalCommands) {
    DeleteGlobalApplicationCommand(cmd.id);
}
