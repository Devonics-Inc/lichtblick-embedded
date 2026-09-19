// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { LayoutData } from "@lichtblick/suite-base/context/CurrentLayoutContext/actions";

/**
 * The embed's preset layout: one 3D panel showing the robot.
 *
 * Authored by building the view in the full app (yarn web:serve), exporting the layout from
 * the Layouts menu, and pasting the result here. That is the reliable way to get these
 * config keys right - hand-writing them means guessing at the shape of RendererConfig
 * (packages/suite-base/src/panels/ThreeDeeRender/IRenderer.ts).
 *
 * Applied two ways:
 *   - globalThis.LICHTBLICK_SUITE_DEFAULT_LAYOUT below, read by suite-base's defaultLayout.ts.
 *     Covers first-time visitors with empty storage, so there is no flash of the stock layout.
 *   - useEnforceLayout, which reapplies it after the async layout load, overriding anything
 *     stale in IndexedDB.
 *
 * IMPORT ORDER: entrypoint.tsx imports this module first, as a side-effect import, so the
 * global is set before anything from suite-base reaches defaultLayout.ts. The `import type`
 * above is erased at compile time, so nothing is pulled in at runtime.
 */

// The part before "!" is the panel type PanelCatalogProvider looks up. The suffix just has to
// match between `configById` and `layout` below.
const PANEL_ID = "3D!489sl3x";

export const embedDefaultLayout: LayoutData = {
  configById: {
    [PANEL_ID]: {
      cameraState: {
        perspective: true,
        distance: 1.5388995055323618,
        phi: 67.29336133868972,
        thetaOffset: 24.987253279184575,
        targetOffset: [-0.1010431634279121, 0.08684076108216886, 3.488830595271907e-17],
        target: [0, 0, 0],
        targetOrientation: [0, 0, 0, 1],
        fovy: 45,
        near: 0.5,
        far: 5000,
      },

      followMode: "follow-position",
      followTf: "base_link",

      scene: {
        enableStats: false,
        backgroundColor: "#000000",
        ignoreColladaUpAxis: false,
        meshUpAxis: "z_up",
      },

      // Every coordinate frame hidden - the robot mesh is the only thing on screen.
      transforms: {
        "frame:world": { visible: false },
        "frame:base_link": { visible: false },
        "frame:shoulder_link": { visible: false },
        "frame:upperarm_link": { visible: false },
        "frame:forearm_link": { visible: false },
        "frame:wrist1_link": { visible: false },
        "frame:wrist2_link": { visible: false },
        "frame:wrist3_link": { visible: false },
        "frame:dh_ag95_grasp_link": { visible: false },
        "frame:dh_ag95_ag95_base_link": { visible: false },
        "frame:dh_ag95_ag95_body": { visible: false },
        "frame:dh_ag95_left_finger": { visible: false },
        "frame:dh_ag95_left_finger_pad": { visible: false },
        "frame:dh_ag95_left_inner_knuckle": { visible: false },
        "frame:dh_ag95_left_outer_knuckle": { visible: false },
        "frame:dh_ag95_right_finger": { visible: false },
        "frame:dh_ag95_right_finger_pad": { visible: false },
        "frame:dh_ag95_right_inner_knuckle": { visible: false },
        "frame:dh_ag95_right_outer_knuckle": { visible: false },
      },

      // This is the "hide or activate objects" surface. fallbackColor is the robot colour
      // used where the URDF does not specify one.
      topics: {
        "/robot_description": {
          visible: true,
          displayMode: "visual",
          fallbackColor: "#ffffff",
        },
        "/initialpose": { visible: false },
        "/move_base_simple/goal": { visible: false },
        "/planning_scene_latched": { visible: true },
      },

      layers: {},

      publish: {
        type: "point",
        poseTopic: "/move_base_simple/goal",
        pointTopic: "/clicked_point",
        poseEstimateTopic: "/initialpose",
        poseEstimateXDeviation: 0.5,
        poseEstimateYDeviation: 0.5,
        poseEstimateThetaDeviation: 0.26179939,
      },

      imageMode: {},
    },
  },

  globalVariables: {},
  userNodes: {},
  playbackConfig: { speed: 1 },

  // A bare panel ID means a single undivided pane filling the whole area.
  layout: PANEL_ID,
};

(globalThis as { LICHTBLICK_SUITE_DEFAULT_LAYOUT?: LayoutData }).LICHTBLICK_SUITE_DEFAULT_LAYOUT =
  embedDefaultLayout;
