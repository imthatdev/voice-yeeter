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

import "dotenv/config";

import fs from "node:fs";
import path from "node:path";
import {
  ActivityType,
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  type ChatInputCommandInteraction,
} from "discord.js";

type CommandModule = {
  data: {
    name: string;
    toJSON: () => unknown;
  };
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
};

const token = process.env.BOT_TOKEN;

if (!token) {
  console.error("Missing BOT_TOKEN in environment variables.");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

const commands = new Collection<string, CommandModule>();

const commandsPath = path.join(__dirname, "commands");
if (!fs.existsSync(commandsPath)) {
  console.error("Commands folder not found. Expected ./commands");
  process.exit(1);
}

const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => /\.(js|ts)$/i.test(file) && !file.endsWith(".d.ts"));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const loaded = require(filePath) as
    | CommandModule
    | { default: CommandModule };
  const command = "default" in loaded ? loaded.default : loaded;

  if ("data" in command && "execute" in command) {
    commands.set(command.data.name, command);
  } else {
    console.warn(
      `[WARNING] The command at ${filePath} is missing a required \"data\" or \"execute\" property.`,
    );
  }
}

client.once(Events.ClientReady, (readyClient) => {
  readyClient.user.setActivity("iconical.dev/sponsor", {
    type: ActivityType.Watching,
  });
  console.log(`Logged in as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  const command = commands.get(interaction.commandName);
  if (!command) {
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error executing /${interaction.commandName}:`, error);

    const errorReply = {
      content: "There was an error while executing this command.",
      flags: ["Ephemeral"] as const,
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorReply).catch(() => null);
    } else {
      await interaction.reply(errorReply).catch(() => null);
    }
  }
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Promise rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
});

void client.login(token);
