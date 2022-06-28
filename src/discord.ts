import {
    APIApplicationCommand,
    APIChannel,
    APIEmbed,
    APIInteractionResponse,
    APIMessage,
    APIRole,
    ApplicationCommandType,
    InteractionResponseType,
    MessageFlags,
    RESTPatchAPIChannelMessageJSONBody,
    RESTPostAPIApplicationCommandsJSONBody,
    RESTPostAPIChannelMessageJSONBody,
    RESTPostAPIGuildChannelJSONBody,
    RESTPostAPIGuildRoleJSONBody,
    RouteBases,
    Routes,
} from "discord-api-types";
import { Command } from "./commands.ts";
import * as PNG from "pngs";
import { decode, encode } from "./api.ts";

function PostCmdToJson(
    command: Command,
): RESTPostAPIApplicationCommandsJSONBody {
    return {
        name: command.name,
        type: ApplicationCommandType.ChatInput,
        description: command.description,
        dm_permission: false,
        options: command.parameters ?? [],
        default_member_permissions: String(command.permissions),
    };
}

async function ApiGet<TResponse>(route: string): Promise<TResponse> {
    const url = RouteBases.api + route;
    const response = await fetch(url, {
        method: "GET",
        headers: {
            "Authorization": `Bot ${Deno.env.get("BOT_TOKEN")}`,
        },
    });
    console.log(response.status);
    const responseBody = await response.json() as TResponse;
    console.log(JSON.stringify(responseBody));

    if (!response.ok) {
        throw Error(`Get failed: ${response.status}`);
    }

    return responseBody;
}

async function ApiInvoke<TRequest, TResponse>(
    method: "POST" | "PUT" | "PATCH" | "DELETE",
    route: string,
    request: TRequest,
): Promise<TResponse> {
    const url = RouteBases.api + route;
    const response = await fetch(url, {
        method: method,
        body: request ? JSON.stringify(request) : "",
        headers: {
            "Authorization": `Bot ${Deno.env.get("BOT_TOKEN")}`,
            "Content-Type": "application/json",
        },
    });
    console.log(response.status);
    const responseBody = await response.json() as TResponse;
    console.log(JSON.stringify(responseBody));

    if (!response.ok) {
        throw Error(`${method} failed: ${response.status}`);
    }

    return responseBody;
}

async function ApiInvokeVoid(
    method: "POST" | "PUT" | "PATCH" | "DELETE",
    route: string,
): Promise<void> {
    const url = RouteBases.api + route;
    const response = await fetch(url, {
        method: method,
        headers: {
            "Authorization": `Bot ${Deno.env.get("BOT_TOKEN")}`,
            "Content-Type": "application/json",
        },
    });
    console.log(response.status);
    if (response.status !== 204) {
        const responseBody = await response.json();
        console.log(JSON.stringify(responseBody));
    }

    if (!response.ok) {
        throw Error(`${method} failed: ${response.status}`);
    }
}

export function GetGlobalApplicationCommands(): Promise<APIApplicationCommand[]> {
    return ApiGet(Routes.applicationCommands(Deno.env.get("APP_ID")!));
}

export async function CreateGlobalApplicationCommand(
    cmd: Command,
): Promise<void> {
    await ApiInvoke("POST", Routes.applicationCommands(Deno.env.get("APP_ID")!), PostCmdToJson(cmd));
}

export function DeleteGlobalApplicationCommand(commandId: string): Promise<void> {
    return ApiInvokeVoid("DELETE", Routes.applicationCommand(Deno.env.get("APP_ID")!, commandId));
}

export async function CreateGuildApplicationCommand(cmd: Command, guildID: string): Promise<void> {
    await ApiInvoke("POST", Routes.applicationGuildCommands(Deno.env.get("APP_ID")!, guildID), PostCmdToJson(cmd));
}

export function GetChannelMessage(channelId: string, messageId: string): Promise<APIMessage> {
    return ApiGet(Routes.channelMessage(channelId, messageId));
}

export function CreateMessage(channelId: string, message: RESTPostAPIChannelMessageJSONBody): Promise<APIMessage> {
    return ApiInvoke("POST", Routes.channelMessages(channelId), message);
}

export function EditMessage(
    channelId: string,
    messageId: string,
    message: RESTPatchAPIChannelMessageJSONBody,
): Promise<APIMessage> {
    return ApiInvoke("PATCH", Routes.channelMessage(channelId, messageId), message);
}

export function CreateGuildRole(guildId: string, message: RESTPostAPIGuildRoleJSONBody): Promise<APIRole> {
    return ApiInvoke("POST", Routes.guildRoles(guildId), message);
}

export function AddGuildMemberRole(guildId: string, userId: string, roleId: string): Promise<void> {
    return ApiInvokeVoid("PUT", Routes.guildMemberRole(guildId, userId, roleId));
}

export function RemoveGuildMemberRole(guildId: string, userId: string, roleId: string): Promise<void> {
    return ApiInvokeVoid("DELETE", Routes.guildMemberRole(guildId, userId, roleId));
}

export function CreateGuildChannel(guildId: string, message: RESTPostAPIGuildChannelJSONBody): Promise<APIChannel> {
    return ApiInvoke("POST", Routes.guildChannels(guildId), message);
}

export function GetChannel(channelId: string): Promise<APIChannel> {
    return ApiGet(Routes.channel(channelId));
}

export function CreateMessageUrl(serverId: string, channelId: string, messageId: string): string {
    return `https://discord.com/channels/${serverId}/${channelId}/${messageId}`;
}

export function GetEmbedFields<T>(embed: APIEmbed): T {
    const fields = Object.fromEntries(embed.fields!.map((x) => [x.name, x.value]));
    return fields as unknown as T;
}

export function Unformat(formatted: string, pattern: RegExp): string | undefined {
    const match = formatted.match(pattern);
    return match ? match[1] : undefined;
}

export function EphemeralMessage(message: string): APIInteractionResponse {
    return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
            content: message,
            flags: MessageFlags.Ephemeral,
        },
    };
}

export async function Save<TState>(
    state: TState,
    toSend: Partial<APIMessage>,
): Promise<BodyInit> {
    const data = await Compression("compress", encode(JSON.stringify(state)));
    const png = PNG.encode(data, Math.ceil(data.length / 4), 1);

    const formData = new FormData();
    formData.append("payload_json", JSON.stringify(toSend));
    formData.append(
        `files[0]`,
        new Blob([png], { type: "image/png" }),
        "SPOILER_game-state.png",
    );
    return formData;
}

export async function Load<TState>(message: APIMessage): Promise<TState> {
    const response = await fetch(message.attachments[0].url);
    const data = await response.arrayBuffer();
    const raw = await Compression(
        "decompress",
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        PNG.decode(new Uint8Array(data)).image,
    );
    return JSON.parse(decode(raw)) as TState;
}

async function Compression(
    dir: "compress" | "decompress",
    input: Uint8Array,
): Promise<Uint8Array> {
    const cs = dir === "compress" ? new CompressionStream("deflate") : new DecompressionStream("deflate");
    const writer = cs.writable.getWriter();
    await writer.write(input);
    await writer.close();
    const chunks: Uint8Array[] = [];
    for await (const chunk of cs.readable) {
        chunks.push(chunk as Uint8Array);
    }
    const result = new Uint8Array(chunks.reduce((a, b) => a + b.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
    }
    return result;
}
