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

type InviteCommand = {
  data: {
    name: string;
    toJSON: () => unknown;
  };
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
};

const REQUIRED_PERMISSIONS =
  PermissionFlagsBits.ViewChannel |
  PermissionFlagsBits.SendMessages |
  PermissionFlagsBits.MoveMembers;

const command: InviteCommand = {
  data: new SlashCommandBuilder()
    .setName("invite")
    .setDescription("Get the invite link for Voice Yeeter."),

  async execute(interaction) {
    const appId = interaction.client.application?.id ?? process.env.CLIENT_ID;

    if (!appId) {
      await interaction.reply({
        content:
          "I could not resolve the bot application ID. Set CLIENT_ID in your environment.",
        flags: ["Ephemeral"],
      });
      return;
    }

    const inviteUrl =
      `https://discord.com/oauth2/authorize?client_id=${appId}` +
      `&scope=bot%20applications.commands` +
      `&permissions=${REQUIRED_PERMISSIONS.toString()}`;

    await interaction.reply({
      content: `Invite Voice Yeeter: ${inviteUrl}`,
      flags: ["Ephemeral"],
    });
  },
};

export = command;
