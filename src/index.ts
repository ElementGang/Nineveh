import { HandleInteraction } from "./api.ts";
import * as dotenv from "dotenv";

dotenv.config();
const port = Number(Deno.env.get("PORT") ?? 3000);
const server = Deno.listen({ port });
export const logMode = Deno.env.get("LOG");

for await (const conn of server) {
    serveHttp(conn);
}

async function serveHttp(conn: Deno.Conn) {
    const httpConn = Deno.serveHttp(conn);
    for await (const requestEvent of httpConn) {
        if (
            requestEvent.request.url.endsWith("/interactions") &&
            requestEvent.request.method === "POST"
        ) {
            HandleInteraction(
                new TextDecoder().decode(await requestEvent.request.arrayBuffer()),
                (name) => requestEvent.request.headers.get(name),
                async (status, body) => {
                    const bodyJson = JSON.stringify(body);
                    const response = new Response(bodyJson, {
                        status,
                        headers: {
                            "Content-Type": "application/json",
                        },
                    });
                    if (logMode === "BOTH" || logMode === "RESPONSE") {
                        console.log(`RESPONSE JSON: ${bodyJson}`);
                    }

                    await requestEvent.respondWith(
                        response,
                    );
                },
            );
        } else {
            requestEvent.respondWith(
                new Response("Not found", {
                    status: 404,
                }),
            );
        }
    }
}
