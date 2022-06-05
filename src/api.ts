import { APIInteraction, APIInteractionResponse, ComponentType, InteractionResponseType, InteractionType } from "discord-api-types";
import nacl from "nacl";


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
    headers: (name: string) => string | null | undefined
): boolean {
    const bodyData = encode(body);
    const timestamp = encode(headers("X-Signature-Timestamp") ?? "");
    const signature = fromHexString(headers("X-Signature-Ed25519") ?? "");
    const publicKeyData = fromHexString(Deno.env.get('PUBLIC_KEY') ?? "");
    return nacl.sign.detached.verify(
        concatArray(timestamp, bodyData),
        signature,
        publicKeyData
    );
}

// deno-lint-ignore require-await
export async function HandleInteraction(
    body: Uint8Array | string,
    headers: (name: string) => string | null | undefined,
    respond: (status: number, body: unknown) => void
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
            respond(200, {
                type: InteractionResponseType.Pong
            } as APIInteractionResponse)
            break;
        case InteractionType.ApplicationCommand:
            switch (interaction.data.name) {
                case "init":
                    respond(200, {
                        type: InteractionResponseType.ChannelMessageWithSource,
                        data: {
                            content: "Hello, world!",
                            components: [
                                {
                                    type: ComponentType.ActionRow,
                                    components: [
                                        {
                                            type: ComponentType.Button,
                                            label: "Button!",
                                            custom_id: "btn_add_group"
                                        }
                                    ]
                                }
                            ]
                        }
                    } as APIInteractionResponse)
                    break;
            }
            break;
    }
}