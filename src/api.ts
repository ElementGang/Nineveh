import * as nacl from "tweetnacl";
import { APIInteraction, APIInteractionResponse, ButtonStyle, ComponentType, InteractionResponseType, InteractionType } from "discord-api-types/v10";
import { Commands } from "./commands";


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
    const publicKeyData = fromHexString(process.env.PUBLIC_KEY ?? "");
    return nacl.sign.detached.verify(
        concatArray(timestamp, bodyData),
        signature,
        publicKeyData
    );
}

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
            const result = Commands.find(x => interaction.data.name === x.name);
            if (result)
            {
                respond(200, result.interaction(interaction))
            }
            else
            {
                respond(404, "")
                console.error(`Command not found: ${interaction.data.name}`)
            }
            break;
    }
}