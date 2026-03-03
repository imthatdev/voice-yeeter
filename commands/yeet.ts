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
  ChannelType,
  type Client,
  type Collection,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type StageChannel,
  type VoiceChannel,
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
let presenceRotationIndex = 0;

const AURA_PRESENCE = "I am the aura, Voice Yeeter-sama >:3";
const SPONSOR_PRESENCE = "Tip your sama here -> iconical.dev/sponsor";

function getPresenceSequence(): string[] {
  if (activeYeetTimers > 0) {
    return [
      AURA_PRESENCE,
      `Going to kick ${pendingKickTargets} Human(s) heheh`,
      SPONSOR_PRESENCE,
    ];
  }

  return [AURA_PRESENCE, SPONSOR_PRESENCE];
}

function getTargetVoiceChannels(
  channels: Collection<string, VoiceChannel | StageChannel>,
  selectedChannelId?: string,
): Array<VoiceChannel | StageChannel> {
  if (selectedChannelId) {
    const selectedChannel = channels.get(selectedChannelId);

    if (selectedChannel) {
      return [selectedChannel];
    }

    return [];
  }

  return [...channels.values()];
}

function applyNextPresence(client: Client<true>): void {
  const sequence = getPresenceSequence();
  const nextPresence = sequence[presenceRotationIndex % sequence.length];

  client.user.setActivity(nextPresence, {
    type: ActivityType.Watching,
  });

  presenceRotationIndex = (presenceRotationIndex + 1) % sequence.length;
}

function ensurePresenceRotation(client: Client<true>): void {
  if (rotatePresenceInterval) {
    return;
  }

  rotatePresenceInterval = setInterval(() => {
    applyNextPresence(client);
  }, 3000);
}

function syncPresence(client: Client<true>): void {
  ensurePresenceRotation(client);

  presenceRotationIndex = 0;
  applyNextPresence(client);
}

const command: YeetCommand = {
  data: new SlashCommandBuilder()
    .setName("yeet")
    .setDescription(
      "Disconnect humans from a selected voice channel (or all voice channels) after a timer :>",
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addIntegerOption((option) =>
      option
        .setName("minutes")
        .setDescription("How many minutes to wait before yeeting everyone.")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(180),
    )
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("Optional: only yeet users from this voice channel")
        .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice),
    ),

  async execute(interaction) {
    const minutes = interaction.options.getInteger("minutes", true);
    const selectedChannel = interaction.options.getChannel("channel");

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

    if (
      selectedChannel &&
      "guildId" in selectedChannel &&
      selectedChannel.guildId !== guild.id
    ) {
      await interaction.reply({
        content: "Selected channel must belong to this server.",
        flags: ["Ephemeral"],
      });
      return;
    }

    const selectedChannelId = selectedChannel?.id;
    const voiceAndStageChannels = guild.channels.cache.filter(
      (channel): channel is VoiceChannel | StageChannel =>
        channel.type === ChannelType.GuildVoice ||
        channel.type === ChannelType.GuildStageVoice,
    );

    const targetVoiceChannels = getTargetVoiceChannels(
      voiceAndStageChannels,
      selectedChannelId,
    );

    let plannedDisconnectCount = 0;
    for (const channel of targetVoiceChannels) {
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

    const targetSummary = selectedChannel
      ? `from #${selectedChannel.name}`
      : "from all voice channels";

    await interaction.reply({
      content: `Timer started. I will yeet ${plannedDisconnectCount} non-bot user(s) ${targetSummary} in ${minutes} minute(s).`,
      flags: ["Ephemeral"],
    });

    const delayMs = minutes * 60 * 1000;

    setTimeout(() => {
      void (async () => {
        try {
          let disconnectedCount = 0;
          const liveTargetVoiceChannels = getTargetVoiceChannels(
            voiceAndStageChannels,
            selectedChannelId,
          );

          for (const channel of liveTargetVoiceChannels) {
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
              `Voice Yeeter activated in ${guild.name}: disconnected ${disconnectedCount} human(s) ${targetSummary}.`,
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
