import { HandleInteraction } from "./api.ts";
import * as dotenv from "dotenv";

dotenv.config();
const port = Number(Deno.env.get("PORT") ?? 3000);
const server = Deno.listen({ port });

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
                new TextDecoder().decode(
                    await requestEvent.request.arrayBuffer(),
                ),
                (name) => requestEvent.request.headers.get(name),
                async (status, body) => {
                    await requestEvent.respondWith(
                        new Response(JSON.stringify(body), {
                            status,
                            headers: {
                                "Content-Type": "application/json",
                            },
                        }),
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
