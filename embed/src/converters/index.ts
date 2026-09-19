// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { convertPlanningScene } from "./convertPlanningScene";

/**
 * The registrations from moveit-scene-converter's activate(), as plain data.
 *
 * Extensions in the web build are loaded from IndexedDB by IdbExtensionLoader (see
 * WebRoot.tsx), i.e. installed per browser - and an iframe on another origin gets its own
 * partitioned storage with nothing in it. Every user of the host app would otherwise have to
 * install the .foxe by hand, through a settings UI the embed does not have.
 *
 * Compiling the converter into the bundle instead means it is present in every browser with
 * nothing to install. Passed to ExtensionCatalogProvider as `mockMessageConverters` in
 * EmbedApp.tsx - the name is unfortunate (it exists for tests and Storybook) but it is a
 * normal prop and this is exactly what it does.
 *
 * Keep this in sync with moveit-scene-converter/src/index.ts if the schema names change.
 */
export const bundledMessageConverters = [
  {
    fromSchemaName: "moveit_msgs/msg/PlanningScene",
    toSchemaName: "foxglove.SceneUpdate",
    converter: convertPlanningScene,
  },
];