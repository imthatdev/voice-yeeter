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
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { listYeetsForGuild } from "../lib/yeet-manager";
import {
  buildNoticeComponents,
  buildYeetListComponents,
  EPHEMERAL_V2_MESSAGE_FLAGS,
} from "../lib/yeet-ui";

type ListCommand = {
  data: {
    name: string;
    toJSON: () => unknown;
  };
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
};

const command: ListCommand = {
  data: new SlashCommandBuilder()
    .setName("yeets-incoming")
    .setDescription("List the currently scheduled yeets in this server.")
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
        components: buildNoticeComponents("No yeets incoming", [
          "There are no active yeets scheduled in this server right now.",
        ]),
        flags: EPHEMERAL_V2_MESSAGE_FLAGS,
      });
      return;
    }

    await interaction.reply({
      components: buildYeetListComponents({
        title: "Yeets incoming",
        subtitle:
          "Here are the active yeets for this server. Internal IDs stay hidden.",
        yeets: activeYeets,
      }),
      flags: EPHEMERAL_V2_MESSAGE_FLAGS,
    });
  },
};

export = command;
