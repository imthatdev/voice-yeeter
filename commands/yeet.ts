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
  ChannelType,
  type Collection,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type StageChannel,
  type VoiceChannel,
} from "discord.js";
import {
  createYeetId,
  registerYeet,
  removeYeet,
  syncPresence,
} from "../lib/yeet-manager";
import {
  buildNoticeComponents,
  EPHEMERAL_V2_MESSAGE_FLAGS,
  V2_MESSAGE_FLAGS,
} from "../lib/yeet-ui";

type YeetCommand = {
  data: {
    name: string;
    toJSON: () => unknown;
  };
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
};

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
        .setMaxValue(1440),
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

    if (minutes < 1 || minutes > 1440) {
      await interaction.reply({
        content: "Minutes must be between 1 and 1440.",
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

    const targetSummary = selectedChannel
      ? `from #${selectedChannel.name}`
      : "from all voice channels";

    const createdAt = Date.now();
    const executeAt = createdAt + minutes * 60 * 1000;

    const yeetId = createYeetId();

    await interaction.reply({
      components: buildNoticeComponents("Yeet scheduled", [
        `I will yeet **${plannedDisconnectCount}** non-bot user(s) ${targetSummary}.`,
        `The countdown ends <t:${Math.floor(executeAt / 1000)}:R>.`,
      ]),
      flags: EPHEMERAL_V2_MESSAGE_FLAGS,
    });

    const timeout = setTimeout(() => {
      void (async () => {
        try {
          let disconnectedCount = 0;
          const liveVoiceAndStageChannels = guild.channels.cache.filter(
            (channel): channel is VoiceChannel | StageChannel =>
              channel.type === ChannelType.GuildVoice ||
              channel.type === ChannelType.GuildStageVoice,
          );
          const liveTargetVoiceChannels = getTargetVoiceChannels(
            liveVoiceAndStageChannels,
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
            await channel.send({
              components: buildNoticeComponents("Voice Yeeter activated", [
                `Disconnected **${disconnectedCount}** human(s) ${targetSummary}.`,
                `Server: **${guild.name}**`,
              ]),
              flags: V2_MESSAGE_FLAGS,
            });
          }
        } catch (error) {
          console.error("Error during yeet timer execution:", error);
        } finally {
          if (yeetId) {
            removeYeet(yeetId);
          }

          if (interaction.client.isReady()) {
            syncPresence(interaction.client);
          }
        }
      })();
    }, minutes * 60 * 1000);

    const activeYeet = registerYeet({
      id: yeetId,
      guildId: guild.id,
      guildName: guild.name,
      channelId: selectedChannelId,
      channelName: selectedChannel?.name ?? undefined,
      createdAt,
      executeAt,
      minutes,
      plannedDisconnectCount,
      startedByUserId: interaction.user.id,
      startedByTag: interaction.user.tag,
      timeout,
    });

    await interaction.editReply({
      components: buildNoticeComponents("Yeet scheduled", [
        `I will yeet **${plannedDisconnectCount}** non-bot user(s) ${targetSummary}.`,
        `The countdown ends <t:${Math.floor(activeYeet.executeAt / 1000)}:R>.`,
      ]),
      flags: V2_MESSAGE_FLAGS,
    });

    if (interaction.client.isReady()) {
      syncPresence(interaction.client);
    }
  },
};

export = command;
