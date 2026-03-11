/*
 *   Copyright (c) 2026 Laith Alkhaddam aka Iconical.
 *   All rights reserved.

 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at

 *   http://www.apache.org/licenses/LICENSE-2.0

 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */

import {
  ComponentType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type StringSelectMenuInteraction,
} from "discord.js";
import { listYeetsForGuild, stopYeet, syncPresence } from "../lib/yeet-manager";
import {
  buildNoticeComponents,
  buildYeetListComponents,
  EPHEMERAL_V2_MESSAGE_FLAGS,
  formatYeetTarget,
  V2_MESSAGE_FLAGS,
} from "../lib/yeet-ui";

type StopCommand = {
  data: {
    name: string;
    toJSON: () => unknown;
  };
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
};

const command: StopCommand = {
  data: new SlashCommandBuilder()
    .setName("okay-dont-yeet")
    .setDescription("Pick one of the scheduled yeets in this server and stop it.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        flags: ["Ephemeral"],
      });
      return;
    }

    if (
      !interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)
    ) {
      await interaction.reply({
        content: "You need the Manage Channels permission to use this command.",
        flags: ["Ephemeral"],
      });
      return;
    }

    const activeYeets = listYeetsForGuild(guild.id);
    if (activeYeets.length === 0) {
      await interaction.reply({
        components: buildNoticeComponents("Nothing to stop", [
          "There are no active yeets scheduled in this server right now.",
        ]),
        flags: EPHEMERAL_V2_MESSAGE_FLAGS,
      });
      return;
    }

    const stopMenuCustomId = `stop-yeet:${interaction.id}`;
    await interaction.reply({
      components: buildYeetListComponents({
        title: "Pick a yeet to stop",
        subtitle:
          "Choose one active yeet from this server. The menu uses hidden internal IDs behind the scenes.",
        yeets: activeYeets,
        stopMenuCustomId,
        footerLines: ["This selector times out after 60 seconds."],
      }),
      flags: EPHEMERAL_V2_MESSAGE_FLAGS,
    });
    const reply = await interaction.fetchReply();

    try {
      const selected = await reply.awaitMessageComponent({
        componentType: ComponentType.StringSelect,
        time: 60_000,
        filter: (menuInteraction: StringSelectMenuInteraction) =>
          menuInteraction.user.id === interaction.user.id &&
          menuInteraction.customId === stopMenuCustomId,
      });

      const selectedYeetId = selected.values[0];
      const stoppedYeet = stopYeet(selectedYeetId);

      if (!stoppedYeet || stoppedYeet.guildId !== guild.id) {
        await selected.update({
          components: buildNoticeComponents("Too late", [
            "That yeet was already gone before I could cancel it.",
          ]),
          flags: V2_MESSAGE_FLAGS,
        });
        return;
      }

      if (interaction.client.isReady()) {
        syncPresence(interaction.client);
      }

      const executeAt = Math.floor(stoppedYeet.executeAt / 1000);

      await selected.update({
        components: buildNoticeComponents("Yeet canceled", [
          `Stopped the yeet for **${formatYeetTarget(stoppedYeet)}**.`,
          `It was going to run <t:${executeAt}:R>.`,
        ]),
        flags: V2_MESSAGE_FLAGS,
      });
    } catch {
      await interaction.editReply({
        components: buildYeetListComponents({
          title: "Pick a yeet to stop",
          subtitle:
            "The selector timed out. Run the command again if you still want to cancel one.",
          yeets: activeYeets,
          stopMenuCustomId,
          stopMenuDisabled: true,
          footerLines: ["Selection timed out."],
        }),
        flags: V2_MESSAGE_FLAGS,
      });
    }
  },
};

export = command;
