// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useEffect, useRef } from "react";

import {
  LayoutState,
  useCurrentLayoutActions,
  useCurrentLayoutSelector,
} from "@lichtblick/suite-base/context/CurrentLayoutContext";

import { embedDefaultLayout } from "./defaultLayout";

const selectHasLayout = (state: LayoutState) => state.selectedLayout?.data != undefined;

/**
 * Forces the embed's preset layout, overriding whatever CurrentLayoutProvider loaded.
 *
 * WHY THIS EXISTS
 * The globalThis.LICHTBLICK_SUITE_DEFAULT_LAYOUT hook only applies when the browser has no
 * saved layouts - CurrentLayoutProvider saves DEFAULT_LAYOUT only if layouts.length === 0.
 * Any browser that has opened the app before keeps a stale "Default" that wins forever after.
 * An iframe on a different origin gets its OWN partitioned copy of that storage, so clearing
 * site data in a normal tab does not touch it. The embed has to look identical everywhere.
 *
 * WHY IT WAITS
 * CurrentLayoutProvider loads layouts from IndexedDB asynchronously. Applying the preset on
 * plain mount is too early: the async load resolves afterwards and overwrites it. That is why
 * a direct tab (no stored layout, nothing to overwrite) looked correct while an iframe with
 * stale partitioned storage did not. So we wait for selectedLayout to be populated, then
 * apply on top of it.
 */
export function useEnforceLayout(): void {
  const { changePanelLayout, savePanelConfigs } = useCurrentLayoutActions();

  // Flips to true once the provider has finished loading and selected something.
  const hasLayout = useCurrentLayoutSelector(selectHasLayout);

  const applied = useRef(false);

  useEffect(() => {
    if (applied.current || !hasLayout) {
      return;
    }
    applied.current = true;

    // changePanelLayout sets the mosaic tree (which panels, how they are arranged).
    // trimConfigById: false keeps configs that would otherwise be pruned before the
    // savePanelConfigs call below lands in the same tick.
    changePanelLayout({
      layout: embedDefaultLayout.layout,
      trimConfigById: false,
    });

    // savePanelConfigs sets each panel's config (camera, topics, layers, colors).
    // override: true replaces any stored config for that panel ID outright.
    savePanelConfigs({
      configs: Object.entries(embedDefaultLayout.configById).map(([id, config]) => ({
        id,
        config,
        override: true,
      })),
    });
  }, [changePanelLayout, hasLayout, savePanelConfigs]);
}