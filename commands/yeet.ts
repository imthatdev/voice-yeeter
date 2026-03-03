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
  ActivityType,
  type Client,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";

type YeetCommand = {
  data: {
    name: string;
    toJSON: () => unknown;
  };
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
};

let activeYeetTimers = 0;
let pendingKickTargets = 0;
let rotatePresenceInterval: NodeJS.Timeout | null = null;
let showSponsorPresence = false;

const SPONSOR_PRESENCE = "iconical.dev/sponsor";

function setKickPresence(client: Client<true>): void {
  client.user.setActivity(`Going to kick ${pendingKickTargets} user(s)`, {
    type: ActivityType.Watching,
  });
}

function setSponsorPresence(client: Client<true>): void {
  client.user.setActivity(SPONSOR_PRESENCE, {
    type: ActivityType.Watching,
  });
}

function startPresenceRotation(client: Client<true>): void {
  if (rotatePresenceInterval) {
    return;
  }

  showSponsorPresence = false;
  setKickPresence(client);

  rotatePresenceInterval = setInterval(() => {
    if (activeYeetTimers <= 0) {
      if (rotatePresenceInterval) {
        clearInterval(rotatePresenceInterval);
        rotatePresenceInterval = null;
      }
      setSponsorPresence(client);
      return;
    }

    showSponsorPresence = !showSponsorPresence;

    if (showSponsorPresence) {
      setSponsorPresence(client);
    } else {
      setKickPresence(client);
    }
  }, 3000);
}

function syncPresence(client: Client<true>): void {
  if (activeYeetTimers > 0) {
    setKickPresence(client);
    startPresenceRotation(client);
    return;
  }

  if (rotatePresenceInterval) {
    clearInterval(rotatePresenceInterval);
    rotatePresenceInterval = null;
  }

  setSponsorPresence(client);
}

const command: YeetCommand = {
  data: new SlashCommandBuilder()
    .setName("yeet")
    .setDescription(
      "Disconnect all humans from voice channels after a timer :>",
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addIntegerOption((option) =>
      option
        .setName("minutes")
        .setDescription("How many minutes to wait before yeeting everyone.")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(180),
    ),

  async execute(interaction) {
    const minutes = interaction.options.getInteger("minutes", true);

    if (minutes < 1 || minutes > 180) {
      await interaction.reply({
        content: "Minutes must be between 1 and 180.",
        flags: ["Ephemeral"],
      });
      return;
    }

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

    const botMember = guild.members.me;
    if (
      !botMember ||
      !botMember.permissions.has(PermissionFlagsBits.MoveMembers)
    ) {
      await interaction.reply({
        content:
          "I need the Move Members permission before I can disconnect voice users.",
        flags: ["Ephemeral"],
      });
      return;
    }

    let plannedDisconnectCount = 0;
    for (const channel of guild.channels.cache.values()) {
      if (!channel.isVoiceBased() || !("members" in channel)) {
        continue;
      }

      for (const member of channel.members.values()) {
        if (!member.user.bot) {
          plannedDisconnectCount += 1;
        }
      }
    }

    pendingKickTargets += plannedDisconnectCount;
    activeYeetTimers += 1;

    if (interaction.client.isReady()) {
      syncPresence(interaction.client);
    }

    await interaction.reply({
      content: `Timer started. I will yeet ${plannedDisconnectCount} non-bot user(s) from voice channels in ${minutes} minute(s).`,
      flags: ["Ephemeral"],
    });

    const delayMs = minutes * 60 * 1000;

    setTimeout(() => {
      void (async () => {
        try {
          let disconnectedCount = 0;

          for (const channel of guild.channels.cache.values()) {
            if (!channel.isVoiceBased() || !("members" in channel)) {
              continue;
            }

            for (const member of channel.members.values()) {
              if (member.user.bot) {
                continue;
              }

              try {
                await member.voice.setChannel(
                  null,
                  "Voice Yeeter timer expired",
                );
                disconnectedCount += 1;
              } catch (moveError) {
                console.error(
                  `Failed to disconnect ${member.user.tag} from ${channel.name}:`,
                  moveError,
                );
              }
            }
          }

          const channel = interaction.channel;
          if (channel && channel.isTextBased() && "send" in channel) {
            await channel.send(
              `Voice Yeeter activated: disconnected ${disconnectedCount} human(s) from voice channels.`,
            );
          }
        } catch (error) {
          console.error("Error during yeet timer execution:", error);
        } finally {
          activeYeetTimers = Math.max(0, activeYeetTimers - 1);
          pendingKickTargets = Math.max(
            0,
            pendingKickTargets - plannedDisconnectCount,
          );

          if (interaction.client.isReady()) {
            syncPresence(interaction.client);
          }
        }
      })();
    }, delayMs);
  },
};

export = command;
