// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useEffect, useMemo, useRef } from "react";

import { usePlayerSelection } from "@lichtblick/suite-base/context/PlayerSelectionContext";
import { parseAppURLState } from "@lichtblick/suite-base/util/appURLState";

/**
 * Connects the embed to a data source named in the page URL, e.g.
 *
 *   http://localhost:8081/?ds=foxglove-websocket&ds.url=ws://localhost:8765
 *
 * This is the part of `Workspace.tsx` (~line 502, `unappliedSourceArgs`) that the embed
 * still needs. The full app also handles `layoutUrl`, `mcap-bundle` and `time` there; this
 * covers only `ds` + `ds.*`, which is what an embedded live view needs.
 *
 * Source IDs come from the factory list in `WebRoot.tsx`. The common ones:
 *   foxglove-websocket    ds.url=ws://host:8765
 *   rosbridge-websocket   ds.url=ws://host:9090
 *   remote-file           ds.url=https://host/recording.mcap
 */
export function useAutoConnect(): void {
  const { selectSource } = usePlayerSelection();

  const urlState = useMemo(() => {
    try {
      return parseAppURLState(new URL(globalThis.location.href));
    } catch {
      return undefined;
    }
  }, []);

  // selectSource must fire exactly once. Re-running it would tear down the player and
  // reconnect, which on a live websocket means dropping and re-subscribing every render.
  const connected = useRef(false);

  useEffect(() => {
    if (connected.current || !urlState?.ds) {
      return;
    }
    connected.current = true;

    selectSource(urlState.ds, {
      type: "connection",
      params: urlState.dsParams,
    });
  }, [selectSource, urlState]);
}