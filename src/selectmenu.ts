import {
    APIEmbed,
    APIInteractionResponse,
    APIMessage,
    APIMessageComponentInteraction,
    APIMessageSelectMenuInteractionData,
    APISelectMenuComponent,
    ComponentType,
    InteractionResponseType,
} from "discord-api-types";
import { EditMessage, EphemeralMessage, GetChannelMessage } from "./discord.ts";
import { DefaultCharacterEmbed, FindGroupMemberEmbedInList, FormatMemberInfo, UnformatMemberInfo } from "./types.ts";

export interface SelectMenu {
    interaction: (
        input: APIMessageComponentInteraction,
    ) => Promise<APIInteractionResponse>;
}

function SetEmbedFields(embeds: APIEmbed[], data: APIMessageSelectMenuInteractionData) {
    const [_, fieldName] = data.custom_id.split("_");
    // Update all embed fields who's name match the custom id of this select menu
    const embedFields = embeds.flatMap((embed) => embed.fields?.filter((f) => f.name === fieldName) ?? []);
    for (const embedField of embedFields) {
        if (embedField && data.values.length === 1) {
            const value = data.values[0];
            // Capitalize first letter of any values
            embedField.value = value[0].toUpperCase() + value.slice(1).toLowerCase();
        }
        // TODO: Multi-select is not handled, join the values?
    }
}

function UpdateSelectMenu(message: APIMessage, data: APIMessageSelectMenuInteractionData) {
    const selectMenu = message.components?.flatMap((x) => x.components).find((y) =>
        y.type === ComponentType.SelectMenu && y.custom_id === data.custom_id
    ) as APISelectMenuComponent;
    if (selectMenu) {
        for (const options of selectMenu.options) {
            options.default = data.values.includes(options.value);
        }
    }
}

// Behaviour of dynamic embed field select menu is to set all embed fields with names matching the select menu custom id to the same value
// This will modify the message that the select menu is attached to
export const DynamicEmbedField = {
    id: (name: string) => {
        return `DynamicEmbedField_${name}`;
    },
    // deno-lint-ignore require-await
    interaction: async (input: APIMessageComponentInteraction): Promise<APIInteractionResponse> => {
        if (input.data.component_type !== ComponentType.SelectMenu) { // TODO: Better way to not need this
            return EphemeralMessage("Component type was not select menu");
        }

        UpdateSelectMenu(input.message, input.data);

        SetEmbedFields(input.message.embeds, input.data);

        return {
            type: InteractionResponseType.UpdateMessage,
            data: {
                embeds: input.message.embeds,
                components: input.message.components,
            },
        };
    },
};

export const EditCharacterClass = {
    id: (groupsChannelId?: string, groupMessageId?: string) => {
        return `EditCharacterClass_${groupsChannelId}_${groupMessageId}`;
    },
    interaction: async (input: APIMessageComponentInteraction): Promise<APIInteractionResponse> => {
        if (input.data.component_type !== ComponentType.SelectMenu) { // TODO: Better way to not need this
            return EphemeralMessage("Component type was not select menu");
        }
        const [_, groupsChannelId, groupMessageId] = input.data.custom_id.split("_");

        const user = input.member!.user;

        const updateMessage = groupsChannelId === "undefined" && groupMessageId === "undefined";

        function ModifyMessage(message: APIMessage, data: APIMessageSelectMenuInteractionData) {
            let embed = FindGroupMemberEmbedInList(message.embeds, user.id);
            if (!embed) {
                embed = DefaultCharacterEmbed(user.username, user.id); // Make a new one if it was not found for some reason
            }

            UpdateSelectMenu(input.message, data); // Select menu is always on the input message, not the target message

            const [username, current] = UnformatMemberInfo(embed.title!);
            if (current === undefined) throw new Error(`Couldn't read member info from ${embed.title}`);
            const values = data.values;
            current.Class = values.length === 1 ? values[0] : values.join();
            const updated = FormatMemberInfo(username, current)!; // Set by menu options, can't cause validation failure
            embed.title = updated;
        }

        if (updateMessage) {
            ModifyMessage(input.message, input.data);

            return {
                type: InteractionResponseType.UpdateMessage,
                data: {
                    embeds: input.message.embeds,
                    components: input.message.components,
                },
            };
        } else {
            const message = await GetChannelMessage(groupsChannelId, groupMessageId);
            ModifyMessage(message, input.data);
            await EditMessage(groupsChannelId, groupMessageId, { embeds: message.embeds });

            return {
                type: InteractionResponseType.DeferredMessageUpdate,
            };
        }
    },
};

export const SelectMenus: Record<string, SelectMenu> = { DynamicEmbedField, EditCharacterClass };
