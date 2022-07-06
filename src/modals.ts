import {
    APIActionRowComponent,
    APIEmbed,
    APIInteractionResponse,
    APIModalActionRowComponent,
    APIModalSubmission,
    APIModalSubmitInteraction,
    ComponentType,
    FormattingPatterns,
    InteractionResponseType,
    MessageFlags,
    TextInputStyle,
} from "discord-api-types";
import {
    CreateMessage,
    EditMessage,
    EphemeralMessage,
    GetChannel,
    GetChannelMessage,
    GetChannelMessages,
    GetEmbedFields,
    GetGuildRoles,
    ModifyGuildRole,
    Unformat,
} from "./discord.ts";
import {
    CharacterInfo,
    CustomIds,
    DefaultCharacterEmbed,
    FindGroupMemberEmbedInList,
    FormatMemberDescription,
    FormatMemberInfo,
    GroupMainEmbedFields,
    UnformatMemberDescription,
    UnformatMemberInfo,
} from "./types.ts";

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

export const EditCharacterInfo = {
    fields: {
        Character: "Character Name",
        ItemLevel: "Item Level",
        Description: "Description",
    },
    id: (mode: "UpdateMessage" | "EditOtherMessage", channelId?: string, messageId?: string) => {
        return `EditCharacterInfo_${mode}_${channelId}_${messageId}`;
    },
    components: (characterInfo: CharacterInfo | undefined): APIActionRowComponent<APIModalActionRowComponent>[] => {
        const description = UnformatMemberDescription(characterInfo?.Description ?? "");
        return [{
            type: ComponentType.ActionRow,
            components: [
                {
                    type: ComponentType.TextInput,
                    custom_id: EditCharacterInfo.fields.Character,
                    value: characterInfo?.Name,
                    style: TextInputStyle.Short,
                    label: EditCharacterInfo.fields.Character,
                    required: true,
                    min_length: 2,
                    max_length: 16,
                },
            ],
        }, {
            type: ComponentType.ActionRow,
            components: [
                {
                    type: ComponentType.TextInput,
                    custom_id: EditCharacterInfo.fields.ItemLevel,
                    value: characterInfo?.ItemLevel,
                    style: TextInputStyle.Short,
                    label: EditCharacterInfo.fields.ItemLevel,
                    required: true,
                    min_length: 3,
                    max_length: 4,
                },
            ],
        }, {
            type: ComponentType.ActionRow,
            components: [
                {
                    type: ComponentType.TextInput,
                    custom_id: EditCharacterInfo.fields.Description,
                    value: description !== "" ? description : undefined,
                    placeholder: "Additional notes e.g. preferred schedule, etc",
                    style: TextInputStyle.Paragraph,
                    label: "Notes",
                    required: false,
                    max_length: 256,
                },
            ],
        }];
    },
    interaction: async (input: APIModalSubmitInteraction): Promise<APIInteractionResponse> => {
        const [_, mode, channelId, messageId] = input.data.custom_id.split("_");
        const user = input.member!.user;

        function ModifyEmbed(embed: APIEmbed, data: APIModalSubmission): boolean {
            const [_username, current] = UnformatMemberInfo(embed.title!);
            if (current === undefined) throw new Error(`Couldn't read member info from ${embed.title}`);

            const byName = Object.fromEntries(
                data.components!.flatMap((row) => row.components.map((c) => [c.custom_id, c.value])),
            );

            const description = byName[EditCharacterInfo.fields.Description];
            const title = FormatMemberInfo(input.member!.user.username, {
                Name: byName[EditCharacterInfo.fields.Character],
                ItemLevel: byName[EditCharacterInfo.fields.ItemLevel],
                Class: current.Class,
                Description: "", // Member info title doesn't use description
            });
            if (title) {
                embed.title = title;
            }

            embed.description = FormatMemberDescription(input.member!.user.id, description);
            return title !== undefined;
        }

        if (mode === "EditOtherMessage") {
            const channelMessage = await GetChannelMessage(channelId, messageId);
            let embedToUpdate = FindGroupMemberEmbedInList(channelMessage.embeds, input.member!.user.id);

            // Add an embed if we couldn't find one
            if (!embedToUpdate) {
                embedToUpdate = DefaultCharacterEmbed(user.username, user.id);
                channelMessage.embeds.push(embedToUpdate);
            }

            const titleModified = ModifyEmbed(embedToUpdate, input.data);
            await EditMessage(channelId, messageId, { embeds: channelMessage.embeds });

            if (!titleModified) {
                return EphemeralMessage(
                    "Failed to update character name/ilvl - formatting was incorrect. Likely due to a number in the name or item level containing letters/symbols.",
                );
            }

            return {
                type: InteractionResponseType.DeferredMessageUpdate,
            };
        } else if (mode === "UpdateMessage") {
            const message = input.message!;
            let embedToUpdate = FindGroupMemberEmbedInList(message.embeds, input.member!.user.id);

            // Add an embed if we couldn't find one
            if (!embedToUpdate) {
                embedToUpdate = DefaultCharacterEmbed(user.username, user.id);
                message.embeds.push(embedToUpdate);
            }

            const titleModified = ModifyEmbed(embedToUpdate, input.data);

            if (!titleModified) {
                return EphemeralMessage(
                    "Failed to update character name/ilvl - formatting was incorrect. Likely due to a number in the name or item level containing letters/symbols.",
                );
            }

            return {
                type: InteractionResponseType.UpdateMessage,
                data: { embeds: message.embeds },
            };
        }

        return EphemeralMessage(`Mode ${mode} not supported`);
    },
};

export const EditGroupInfo = {
    fields: {
        Name: "Group Name",
        Description: "Description",
    },
    id: (
        mode: "Create" | "Listed",
        masterListChannelId: string,
        masterListMessageId: string,
        groupsChannelId: string | undefined,
        groupMessageId: string | undefined,
    ) => {
        return `EditGroupInfo_${mode}_${masterListChannelId}_${masterListMessageId}_${groupsChannelId}_${groupMessageId}`;
    },
    components: (
        groupName: string,
        groupDescription: string | undefined,
    ): APIActionRowComponent<APIModalActionRowComponent>[] => {
        return [
            {
                type: ComponentType.ActionRow,
                components: [
                    {
                        type: ComponentType.TextInput,
                        custom_id: EditGroupInfo.fields.Name,
                        value: groupName,
                        style: TextInputStyle.Short,
                        label: EditGroupInfo.fields.Name,
                        required: true,
                        min_length: 3,
                        max_length: 64,
                    },
                ],
            },
            {
                type: ComponentType.ActionRow,
                components: [
                    {
                        type: ComponentType.TextInput,
                        custom_id: EditGroupInfo.fields.Description,
                        value: groupDescription,
                        style: TextInputStyle.Paragraph,
                        label: EditGroupInfo.fields.Description,
                        placeholder:
                            "Extra information about the group, e.g. bosses/activities, schedule, what you're recruiting, etc",
                        required: false,
                        max_length: 512,
                    },
                ],
            },
        ];
    },
    interaction: async (input: APIModalSubmitInteraction): Promise<APIInteractionResponse> => {
        const [_, mode, masterListChannelId, masterListMessageId, groupsChannelId, groupMessageId] = input.data
            .custom_id
            .split("_");

        const byName = Object.fromEntries(
            input.data.components!.flatMap((row) => row.components.map((c) => [c.custom_id, c.value])),
        );
        const newGroupName = byName[EditGroupInfo.fields.Name];
        const newDescription = byName[EditGroupInfo.fields.Description];

        const masterListMessage = await GetChannelMessage(masterListChannelId, masterListMessageId);

        if (mode === "Create") {
            // Check all against all group names, this group isn't listed yet
            if (masterListMessage.embeds.some((embed) => embed.title === newGroupName)) {
                return EphemeralMessage("Group with that name already exists, pick a different name");
            }

            const message = input.message!;
            const embed = message.embeds[0];

            embed.title = newGroupName;
            embed.description = newDescription;

            return {
                type: InteractionResponseType.UpdateMessage,
                data: { embeds: message.embeds },
            };
        } else if (mode === "Listed") {
            const groupMessage = await GetChannelMessage(groupsChannelId, groupMessageId);
            const groupEmbed = groupMessage.embeds[0];
            const currentGroupName = groupEmbed.title!;

            // Check against group names, ignoring the existing embed with the current name
            if (
                masterListMessage.embeds.some((embed) =>
                    embed.title === newGroupName && newGroupName !== currentGroupName
                )
            ) {
                return EphemeralMessage("Group with that name already exists, pick a different name");
            }

            const masterListEmbed = masterListMessage.embeds.find((e) => e.title === currentGroupName)!;

            const roleId = Unformat(
                GetEmbedFields<GroupMainEmbedFields>(groupEmbed)[CustomIds.GroupRole],
                FormattingPatterns.Role,
            )!;
            await ModifyGuildRole(input.guild_id!, roleId, { name: newGroupName });

            groupEmbed.title = newGroupName;
            groupEmbed.description = newDescription;
            await EditMessage(groupsChannelId, groupMessageId, { embeds: groupMessage.embeds });

            masterListEmbed.title = newGroupName;
            masterListEmbed.description = newDescription;
            await EditMessage(masterListChannelId, masterListMessageId, { embeds: masterListMessage.embeds });

            return {
                type: InteractionResponseType.DeferredMessageUpdate,
            };
        } else {
            return EphemeralMessage(`Mode ${mode} not supported`);
        }
    },
};

export const Modals: Record<string, Modal> = { EmbedUpdate, EditCharacterInfo, EditGroupInfo };
