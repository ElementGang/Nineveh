import { config } from "dotenv"
import { CmdToJson, Commands } from "./commands";
import { CreateGlobalApplicationCommand } from "./discord";
import * as go from "./fetch-polyfill";

(async () => {
    await go();
    config()
    

    const globalCommands = Commands.filter(x => x.scope === "global");

    for(const cmd of globalCommands)
    {    
        CreateGlobalApplicationCommand(cmd)
    }
})();