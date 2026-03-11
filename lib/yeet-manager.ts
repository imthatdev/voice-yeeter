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

import { ActivityType, type Client } from "discord.js";

export type ActiveYeet = {
  id: string;
  guildId: string;
  guildName: string;
  channelId?: string;
  channelName?: string;
  createdAt: number;
  executeAt: number;
  minutes: number;
  plannedDisconnectCount: number;
  startedByUserId: string;
  startedByTag: string;
  timeout: NodeJS.Timeout;
};

type RegisterYeetInput = ActiveYeet;

const AURA_PRESENCE = "I am the aura, Voice Yeeter-sama >:3";
const SPONSOR_PRESENCE = "Tip your sama here -> iconical.dev/sponsor";

let nextYeetId = 1;
let rotatePresenceInterval: NodeJS.Timeout | null = null;
let presenceRotationIndex = 0;

const activeYeets = new Map<string, ActiveYeet>();

export function createYeetId(): string {
  const yeetId = `${nextYeetId}`;
  nextYeetId += 1;
  return yeetId;
}

export function registerYeet(input: RegisterYeetInput): ActiveYeet {
  const yeet = {
    ...input,
    id: input.id,
  };

  activeYeets.set(yeet.id, yeet);

  return yeet;
}

export function removeYeet(id: string): ActiveYeet | undefined {
  const existingYeet = activeYeets.get(id);

  if (!existingYeet) {
    return undefined;
  }

  activeYeets.delete(id);
  return existingYeet;
}

export function stopYeet(id: string): ActiveYeet | undefined {
  const existingYeet = activeYeets.get(id);

  if (!existingYeet) {
    return undefined;
  }

  clearTimeout(existingYeet.timeout);
  activeYeets.delete(id);

  return existingYeet;
}

export function getYeetById(id: string): ActiveYeet | undefined {
  return activeYeets.get(id);
}

export function listYeetsForGuild(guildId: string): ActiveYeet[] {
  return [...activeYeets.values()]
    .filter((yeet) => yeet.guildId === guildId)
    .sort((left, right) => left.executeAt - right.executeAt);
}

export function getPendingKickTargets(): number {
  return [...activeYeets.values()].reduce(
    (total, yeet) => total + yeet.plannedDisconnectCount,
    0,
  );
}

function getPresenceSequence(): string[] {
  if (activeYeets.size > 0) {
    return [
      AURA_PRESENCE,
      `Going to kick ${getPendingKickTargets()} Human(s) heheh`,
      SPONSOR_PRESENCE,
    ];
  }

  return [AURA_PRESENCE, SPONSOR_PRESENCE];
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

export function syncPresence(client: Client<true>): void {
  ensurePresenceRotation(client);

  presenceRotationIndex = 0;
  applyNextPresence(client);
}
