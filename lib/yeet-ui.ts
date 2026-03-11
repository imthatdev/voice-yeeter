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
  MessageFlags,
  SeparatorSpacingSize,
  StringSelectMenuBuilder,
  type ComponentInContainerData,
  type TopLevelComponentData,
} from "discord.js";
import type { ActiveYeet } from "./yeet-manager";

const ACCENT_COLOR = 0xff8a3d;

export const EPHEMERAL_V2_MESSAGE_FLAGS =
  MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
export const V2_MESSAGE_FLAGS = MessageFlags.IsComponentsV2;

export function formatYeetTarget(yeet: Pick<ActiveYeet, "channelName">): string {
  return yeet.channelName ? `#${yeet.channelName}` : "All voice channels";
}

export function buildNoticeComponents(
  title: string,
  lines: string[],
): TopLevelComponentData[] {
  const components: ComponentInContainerData[] = [
    {
      type: ComponentType.TextDisplay,
      content: `## ${title}`,
    },
    ...lines.map((line) => ({
      type: ComponentType.TextDisplay as const,
      content: line,
    })),
  ];

  return [
    {
      type: ComponentType.Container,
      accentColor: ACCENT_COLOR,
      components,
    },
  ];
}

type BuildYeetListOptions = {
  title: string;
  subtitle: string;
  yeets: ActiveYeet[];
  stopMenuCustomId?: string;
  stopMenuDisabled?: boolean;
  footerLines?: string[];
};

function getYeetSummary(yeet: ActiveYeet, index: number): string {
  const executeAt = Math.floor(yeet.executeAt / 1000);
  const createdAt = Math.floor(yeet.createdAt / 1000);

  return [
    `### ${index + 1}. ${formatYeetTarget(yeet)}`,
    `${yeet.plannedDisconnectCount} planned human(s)`,
    `Runs <t:${executeAt}:R> at <t:${executeAt}:t>`,
    `Created <t:${createdAt}:R>`,
  ].join("\n");
}

export function buildYeetListComponents({
  title,
  subtitle,
  yeets,
  stopMenuCustomId,
  stopMenuDisabled = false,
  footerLines = [],
}: BuildYeetListOptions): TopLevelComponentData[] {
  const containerComponents: ComponentInContainerData[] = [
    {
      type: ComponentType.TextDisplay,
      content: `## ${title}`,
    },
    {
      type: ComponentType.TextDisplay,
      content: subtitle,
    },
  ];

  yeets.forEach((yeet, index) => {
    if (index > 0) {
      containerComponents.push({
        type: ComponentType.Separator,
        spacing: SeparatorSpacingSize.Small,
        divider: true,
      });
    }

    containerComponents.push({
      type: ComponentType.TextDisplay,
      content: getYeetSummary(yeet, index),
    });
  });

  const selectableYeets = yeets.slice(0, 25);
  const allFooterLines =
    yeets.length > selectableYeets.length
      ? [
          ...footerLines,
          `Stop menu shows the first ${selectableYeets.length} yeets because Discord caps select menus at 25 options.`,
        ]
      : footerLines;

  if (allFooterLines.length > 0) {
    containerComponents.push({
      type: ComponentType.Separator,
      spacing: SeparatorSpacingSize.Small,
      divider: true,
    });

    containerComponents.push(
      ...allFooterLines.map((line) => ({
        type: ComponentType.TextDisplay as const,
        content: line,
      })),
    );
  }

  if (stopMenuCustomId && selectableYeets.length > 0) {
    const stopMenu = new StringSelectMenuBuilder()
      .setCustomId(stopMenuCustomId)
      .setPlaceholder("Pick a yeet to cancel")
      .setMinValues(1)
      .setMaxValues(1)
      .setDisabled(stopMenuDisabled)
      .addOptions(
        selectableYeets.map((yeet) => ({
          label: `${formatYeetTarget(yeet)} • ${yeet.plannedDisconnectCount} human(s)`,
          description: "Use the timing details shown above.",
          value: yeet.id,
        })),
      );

    containerComponents.push({
      type: ComponentType.Separator,
      spacing: SeparatorSpacingSize.Small,
      divider: true,
    });
    containerComponents.push({
      type: ComponentType.ActionRow,
      components: [stopMenu],
    });
  }

  return [
    {
      type: ComponentType.Container,
      accentColor: ACCENT_COLOR,
      components: containerComponents,
    },
  ];
}
