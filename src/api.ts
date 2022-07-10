import {
    APIChatInputApplicationCommandInteraction,
    APIInteraction,
    APIInteractionResponse,
    ApplicationCommandType,
    ComponentType,
    InteractionResponseType,
    InteractionType,
} from "discord-api-types";
import nacl from "nacl";
import { Commands } from "./commands.ts";
import { Buttons } from "./buttons.ts";
import { Buffer } from "std/node/buffer.ts";
import { Modals } from "./modals.ts";
import { SelectMenus } from "./selectmenu.ts";
import { logMode } from "./index.ts";
import { EphemeralMessage } from "./discord.ts";

const encoder = new TextEncoder();
export function encode(x: string | Uint8Array): Uint8Array {
    return typeof x === "string" ? encoder.encode(x) : x;
}

const decoder = new TextDecoder();
export function decode(x: string | Uint8Array): string {
    return typeof x === "string" ? x : decoder.decode(x);
}

function concatArray(a: Uint8Array, b: Uint8Array): Uint8Array {
    const c = new Uint8Array(a.length + b.length);
    c.set(a);
    c.set(b, a.length);
    return c;
}

function fromHexString(str: string): Uint8Array {
    // NOTE: node.js only
    return Buffer.from(str, "hex");
}

function VerifyKey(
    body: Uint8Array | string,
    headers: (name: string) => string | null | undefined,
): boolean {
    const bodyData = encode(body);
    const timestamp = encode(headers("X-Signature-Timestamp") ?? "");
    const signature = fromHexString(headers("X-Signature-Ed25519") ?? "");
    const publicKeyData = fromHexString(Deno.env.get("DISCORD_PUBLIC_KEY") ?? "");
    return nacl.sign.detached.verify(
        concatArray(timestamp, bodyData),
        signature,
        publicKeyData,
    );
}

export async function HandleInteraction(
    body: Uint8Array | string,
    headers: (name: string) => string | null | undefined,
    respond: (status: number, body: unknown) => Promise<void>,
): Promise<void> {
    if (!VerifyKey(body, headers)) {
        console.error("Invalid signature");
        console.error(body);
        respond(401, "Invalid signature");
        return;
    }

    const bodyDecoded = decode(body);

    const interaction = JSON.parse(bodyDecoded) as APIInteraction;

    if (logMode === "BOTH" || logMode === "RECEIVED") {
        console.log(`RECEIVED JSON: ${bodyDecoded}`);
    }

    async function Respond<T>(
        entries: Record<string, T>,
        customId: string,
        typeString: string,
        bodyFunc: (input: T) => unknown,
    ) {
        const result = Object.entries(entries).find((entry) => customId.split("_")[0] === entry[0]);
        const component = result?.[1] ?? undefined;
        if (component) {
            try {
                const body = await bodyFunc(component);
                await respond(200, body);
            } catch (e: unknown) {
                if (e instanceof Error) {
                    const body = EphemeralMessage(e.message);
                    await respond(200, body);
                }
            }
        } else {
            await respond(404, "");
            console.error(`${typeString} not found: ${customId}`);
        }
    }

    switch (interaction.type) {
        case InteractionType.Ping:
            await respond(200, {
                type: InteractionResponseType.Pong,
            } as APIInteractionResponse);
            break;
        case InteractionType.ApplicationCommand: {
            switch (interaction.data.type) {
                case ApplicationCommandType.ChatInput:
                    {
                        const command = Commands.find((x) => interaction.data.name === x.name);
                        if (command) {
                            await respond(
                                200,
                                await command.interaction(interaction as APIChatInputApplicationCommandInteraction),
                            );
                        } else {
                            await respond(404, "");
                            console.error(`Command not found: ${interaction.data.name}`);
                        }
                    }
                    break;
            }

            break;
        }
        case InteractionType.MessageComponent: {
            switch (interaction.data.component_type) {
                case ComponentType.Button: {
                    Respond(
                        Buttons,
                        interaction.data.custom_id,
                        "Button",
                        (button) => button.interaction(interaction),
                    );
                    break;
                }
                case ComponentType.SelectMenu: {
                    Respond(
                        SelectMenus,
                        interaction.data.custom_id,
                        "Select menu",
                        (menu) => menu.interaction(interaction),
                    );
                    break;
                }
            }
            break;
        }
        case InteractionType.ModalSubmit: {
            Respond(
                Modals,
                interaction.data.custom_id,
                "Modal",
                (modal) => modal.interaction(interaction),
            );
            break;
        }
    }
}
