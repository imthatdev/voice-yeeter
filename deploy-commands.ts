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
import { REST, Routes } from "discord.js";

type DeployableCommand = {
  data?: { toJSON: () => unknown };
};

const token = process.env.BOT_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId) {
  console.error(
    "Missing required env vars. Ensure BOT_TOKEN and CLIENT_ID are set.",
  );
  process.exit(1);
}

const commands: unknown[] = [];
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => /\.(js|ts)$/i.test(file) && !file.endsWith(".d.ts"));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const loaded = require(filePath) as
    | DeployableCommand
    | { default: DeployableCommand };
  const command = "default" in loaded ? loaded.default : loaded;

  if (command.data) {
    commands.push(command.data.toJSON());
  } else {
    console.warn(
      `[WARNING] Skipping ${filePath} because it has no command.data.`,
    );
  }
}

const rest = new REST({ version: "10" }).setToken(token);

void (async () => {
  try {
    if (guildId) {
      console.log(
        `Refreshing guild application commands for guild ${guildId}...`,
      );
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: commands,
      });
      console.log("Successfully reloaded guild application commands.");
      return;
    }

    console.log("Refreshing global application commands...");
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log("Successfully reloaded global application commands.");
  } catch (error) {
    console.error("Failed to deploy slash commands:", error);
    process.exit(1);
  }
})();
