/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */

module.exports = async () => {
    if (!globalThis.fetch) {
        const fetch = await import("node-fetch");
        globalThis.fetch = fetch.default;
        globalThis.Headers = fetch.Headers;
        globalThis.Request = fetch.Request;
        globalThis.Response = fetch.Response;
        globalThis.FormData = fetch.FormData;
        globalThis.Blob = fetch.Blob;
    }
};