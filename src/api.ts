import {
    APIChatInputApplicationCommandInteraction,
    APIInteraction,
    APIInteractionResponse,
    APISelectMenuComponent,
    ApplicationCommandType,
    ComponentType,
    InteractionResponseType,
    InteractionType,
} from "discord-api-types";
import nacl from "nacl";
import { Commands } from "./commands.ts";
import { Buttons } from "./buttons.ts";
import { Buffer } from "std/node/buffer.ts";

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
    const publicKeyData = fromHexString(Deno.env.get("PUBLIC_KEY") ?? "");
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

    const interaction = JSON.parse(decode(body)) as APIInteraction;
    console.log(JSON.stringify(interaction));

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
                        const result = Commands.find((x) => interaction.data.name === x.name);
                        if (result) {
                            await respond(
                                200,
                                result.interaction(interaction as APIChatInputApplicationCommandInteraction),
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
                    const result = Object.entries(Buttons).find((entry) =>
                        interaction.data.custom_id.startsWith(entry[0])
                    );
                    if (result) {
                        await respond(200, await result[1].interaction(interaction));
                    } else {
                        await respond(404, "");
                        console.error(`Button interaction not found: ${interaction.data.custom_id}`);
                    }
                    break;
                }
                case ComponentType.SelectMenu: {
                    const selectMenu = interaction.message.components?.flatMap((x) => x.components).find((y) =>
                        y.type === ComponentType.SelectMenu && y.custom_id === interaction.data.custom_id
                    ) as APISelectMenuComponent;
                    if (selectMenu) {
                        for (const options of selectMenu.options) {
                            options.default = interaction.data.values.includes(options.value);
                        }
                    }

                    // Update first embed field with value of this change if there is a field with the same name as the custom id
                    const embedField = interaction.message.embeds[0]?.fields?.find((f) =>
                        f.name === selectMenu.custom_id
                    );
                    if (embedField && interaction.data.values.length === 1) {
                        const value = interaction.data.values[0];
                        embedField.value = value[0].toUpperCase() + value.slice(1).toLowerCase();
                    }

                    const result: APIInteractionResponse = {
                        type: InteractionResponseType.UpdateMessage,
                        data: {
                            embeds: interaction.message.embeds,
                            components: interaction.message.components,
                        },
                    };
                    await respond(200, result);
                    break;
                }
            }
            break;
        }
    }
}
