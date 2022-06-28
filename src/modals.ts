import {
    APIEmbed,
    APIInteractionResponse,
    APIModalSubmission,
    APIModalSubmitInteraction,
    FormattingPatterns,
    InteractionResponseType,
    MessageFlags,
} from "discord-api-types";
import { EditMessage, EphemeralMessage, GetChannelMessage, Unformat } from "./discord.ts";
import { GetCharacterEmbedFromList } from "./types.ts";

export interface Modal {
    interaction: (
        input: APIModalSubmitInteraction,
    ) => Promise<APIInteractionResponse>;
}

function UpdateEmbedFromModal(embed: APIEmbed, data: APIModalSubmission) {
    const specialCaseComponents =
        data.components?.flatMap((c) => c.components).filter((c) =>
            c.custom_id.startsWith("Title") || c.custom_id.startsWith("Description")
        ) ?? [];
    for (const component of specialCaseComponents) {
        const name = component.custom_id;
        if (name === "Title") {
            embed.title = component.value;
        } else if (name === "Description") {
            embed.description = component.value;
        }
    }

    const textFields = data.components?.flatMap((f) => f.components)!;

    for (const textInput of textFields) {
        const matchingFields = embed.fields?.filter((f) => f.name === textInput.custom_id) ?? [];
        for (const field of matchingFields) {
            field.value = textInput.value;
        }
    }
}

export const EmbedUpdate = {
    id: (embedNumber: number) => {
        return `EmbedUpdate_${embedNumber}`;
    },
    // deno-lint-ignore require-await
    interaction: async (input: APIModalSubmitInteraction): Promise<APIInteractionResponse> => {
        const [_, embedNumberStr] = input.data.custom_id.split("_");
        const embedNumber = Number.parseInt(embedNumberStr);
        const message = input.message!;
        const embed = message.embeds.at(embedNumber);

        if (!embed) {
            return {
                type: InteractionResponseType.ChannelMessageWithSource,
                data: {
                    content: `Embed '${embedNumberStr}' not found`,
                    flags: MessageFlags.Ephemeral,
                },
            };
        }

        UpdateEmbedFromModal(embed, input.data);

        const result: APIInteractionResponse = {
            type: InteractionResponseType.UpdateMessage,
            data: {
                embeds: message.embeds,
            },
        };
        return result;
    },
};

export const EditGroupCharacter = {
    id: (channelId: string, messageId: string) => {
        return `EditGroupCharacter_${channelId}_${messageId}`;
    },
    interaction: async (input: APIModalSubmitInteraction): Promise<APIInteractionResponse> => {
        const [_, channelId, messageId] = input.data.custom_id.split("_");
        const channelMessage = await GetChannelMessage(channelId, messageId);
        const embedToUpdate = GetCharacterEmbedFromList(channelMessage.embeds, input.member!.user.id);

        if (!embedToUpdate) {
            return EphemeralMessage(
                "Could not find character details to modify - has the embed for your character been deleted?",
            );
        }

        UpdateEmbedFromModal(embedToUpdate, input.data);

        await EditMessage(channelId, messageId, { embeds: channelMessage.embeds });

        return {
            type: InteractionResponseType.DeferredMessageUpdate,
        };
    },
};

// export const IndirectEmbedUpdate = {
//     id: (channelId: string, messageId: string) => {
//         return `DynamicIndirectModal_${channelId}_${messageId}`;
//     },
//     interaction: async (input: APIModalSubmitInteraction): Promise<APIInteractionResponse> => {
//         const [_, _name, channelId, messageId] = input.data.custom_id.split("_");
//         const message = await GetChannelMessage(channelId, messageId);

//         SetEmbedFields(message.embeds, input.data);

//         await EditMessage(channelId, messageId, { embeds: message.embeds });

//         const result: APIInteractionResponse = {
//             type: InteractionResponseType.DeferredMessageUpdate,
//         };
//         return result;
//     },
// };

export const Modals: Record<string, Modal> = { EmbedUpdate, EditGroupCharacter };
