// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useEffect } from "react";

import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@lichtblick/suite-base/components/MessagePipeline";
import { PlayerPresence } from "@lichtblick/suite-base/players/types";

import { seedPlanningScene } from "./converters/convertPlanningScene";

/**
 * Fetches the complete planning scene once per connection, so a late-joining embed shows
 * objects that were spawned before it connected.
 *
 * /monitored_planning_scene only carries diffs after its first message, and it is not
 * latched. Instead of a relay node, we ask move_group directly over the existing data-source
 * connection (foxglove_bridge and rosbridge both support service calls) and load the answer
 * into the converter's state.
 */

const SERVICE = "/get_planning_scene";

// moveit_msgs/PlanningSceneComponents bits: SCENE_SETTINGS | ROBOT_STATE |
// ROBOT_STATE_ATTACHED_OBJECTS | WORLD_OBJECT_NAMES | WORLD_OBJECT_GEOMETRY | TRANSFORMS |
// OBJECT_COLORS. Octomap and the ACM are skipped - the view doesn't draw them.
const COMPONENTS = 1 | 2 | 4 | 8 | 16 | 64 | 512;

// move_group may still be starting when the embed connects.
const RETRY_MS = 2000;

const selectCallService = (ctx: MessagePipelineContext) => ctx.callService;
const selectPlayerId = (ctx: MessagePipelineContext) => ctx.playerState.playerId;
const selectCanCallServices = (ctx: MessagePipelineContext) =>
  ctx.playerState.presence === PlayerPresence.PRESENT &&
  ctx.playerState.capabilities.includes("callServices");

export function useSeedPlanningScene(): void {
  const callService = useMessagePipeline(selectCallService);
  const playerId = useMessagePipeline(selectPlayerId);
  const canCallServices = useMessagePipeline(selectCanCallServices);

  // Re-runs on every new connection (playerId changes), so a reconnect re-seeds too.
  useEffect(() => {
    if (!canCallServices) {
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const attempt = async () => {
      try {
        const response = (await callService(SERVICE, {
          components: { components: COMPONENTS },
        })) as { scene?: unknown } | undefined;
        if (cancelled) {
          return;
        }
        if (response?.scene != undefined) {
          seedPlanningScene(response.scene);
          return;
        }
      } catch (err) {
        if (cancelled) {
          return;
        }
        console.debug(`[embed] ${SERVICE} not available yet, retrying`, err);
      }
      timer = setTimeout(() => void attempt(), RETRY_MS);
    };

    void attempt();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [callService, playerId, canCallServices]);
}
