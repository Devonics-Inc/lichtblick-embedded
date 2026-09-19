// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import PanelLayout from "@lichtblick/suite-base/components/PanelLayout";
import Stack from "@lichtblick/suite-base/components/Stack";
import { WorkspaceContextStore } from "@lichtblick/suite-base/context/Workspace/WorkspaceContext";
import { PanelStateContextProvider } from "@lichtblick/suite-base/providers/PanelStateContextProvider";
import WorkspaceContextProvider from "@lichtblick/suite-base/providers/WorkspaceContextProvider";
import { useAutoConnect } from "./useAutoConnect";
import { useEnforceLayout } from "./useEnforceLayout";
/**
 * The counterpart to `packages/suite-base/src/Workspace.tsx`.
 *
 * Open that file alongside this one. Its default export wraps WorkspaceContent in
 * WorkspaceContextProvider, and WorkspaceContent wraps everything in
 * PanelStateContextProvider. Those two providers are what panels actually need.
 * Everything else in that file is application chrome, and none of it is here:
 *
 *   AppBar, Sidebars (topic list + panel settings editor), PlaybackControls,
 *   DataSourceDialog, WorkspaceDialogs, DocumentDropListener, KeyListener,
 *   RemountOnValueChange
 *
 * SyncAdapters is also deliberately absent. It renders URLStateSyncAdapter and
 * CurrentLayoutLocalStorageSyncAdapter, and the latter writes layout changes back to
 * localStorage. Leaving it out keeps the embed stateless: every reload returns to the
 * injected preset rather than whatever the user last changed. That is a policy choice -
 * add it back if you want user tweaks to persist.
 */

// Both dialogs closed on startup.
//
// Workspace.tsx computes `open: initialItem != undefined` from the
// SHOW_OPEN_DIALOG_ON_STARTUP app setting, which is why the normal app greets you with
// the data-source picker. The embed hardcodes it closed - the host app decides what
// data to show, not the end user.
//
// WorkspaceContextProvider takes Partial<WorkspaceContextStore>, so specifying `dialogs`
// alone is fine; everything else falls back to defaults.
const INITIAL_STATE: Partial<WorkspaceContextStore> = {
  dialogs: {
    dataSource: {
      activeDataSource: undefined,
      open: false,
      item: undefined,
    },
    preferences: {
      initialTab: undefined,
      open: false,
    },
  },
};

export function EmbedWorkspace(): React.JSX.Element {
  return (
    <WorkspaceContextProvider initialState={INITIAL_STATE}>
      <PanelStateContextProvider>
        <AutoConnect />
        <Stack fullHeight style={{ overflow: "hidden" }}>
          <PanelLayout />
        </Stack>
      </PanelStateContextProvider>
    </WorkspaceContextProvider>
  );
}

function AutoConnect(): null {
  useEnforceLayout();
  useAutoConnect();
  return null;
} 