// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Suspense, useMemo } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

import { IdbLayoutStorage } from "@lichtblick/suite-base/IdbLayoutStorage";
import MultiProvider from "@lichtblick/suite-base/components/MultiProvider";
import PlayerManager from "@lichtblick/suite-base/components/PlayerManager";
import SendNotificationToastAdapter from "@lichtblick/suite-base/components/SendNotificationToastAdapter";
import StudioToastProvider from "@lichtblick/suite-base/components/StudioToastProvider";
import LayoutStorageContext from "@lichtblick/suite-base/context/LayoutStorageContext";
import { useSharedRootContext } from "@lichtblick/suite-base/context/SharedRootContext";
import { UserScriptStateProvider } from "@lichtblick/suite-base/context/UserScriptStateContext";
import AlertsContextProvider from "@lichtblick/suite-base/providers/AlertsContextProvider";
import CurrentLayoutProvider from "@lichtblick/suite-base/providers/CurrentLayoutProvider";
import EventsProvider from "@lichtblick/suite-base/providers/EventsProvider";
import ExtensionCatalogProvider from "@lichtblick/suite-base/providers/ExtensionCatalogProvider/ExtensionCatalogProvider";
import ExtensionMarketplaceProvider from "@lichtblick/suite-base/providers/ExtensionMarketplaceProvider";
import LayoutManagerProvider from "@lichtblick/suite-base/providers/LayoutManagerProvider";
import PanelCatalogProvider from "@lichtblick/suite-base/providers/PanelCatalogProvider";
import { StudioLogsSettingsProvider } from "@lichtblick/suite-base/providers/StudioLogsSettingsProvider";
import TimelineInteractionStateProvider from "@lichtblick/suite-base/providers/TimelineInteractionStateProvider";
import UserProfileLocalStorageProvider from "@lichtblick/suite-base/providers/UserProfileLocalStorageProvider";

import { EmbedWorkspace } from "./EmbedWorkspace";
import { bundledMessageConverters } from "./converters";

/**
 * The counterpart to `packages/suite-base/src/StudioApp.tsx`.
 *
 * Same provider stack, minus the pieces that only make sense for the standalone app.
 * Read the two files side by side - StudioApp is the reference.
 *
 * Provider ORDER matters. StudioApp builds its array with a mix of push/unshift which
 * hides the final order; this writes it out literally. Rules inherited from StudioApp:
 *   - logs + toast come first, so everything downstream can report
 *   - AlertsContextProvider must precede its dependents
 *   - CurrentLayoutProvider needs LayoutManagerProvider, which needs LayoutStorageContext
 */

/**
 *  The counterpart to `packages/suite-base/src/StudioApp.tsx`.
 *
 *
 */
export function EmbedApp(): React.JSX.Element {

  // get the shared context from the root of the app, which is provided by the suite-web package
  const { dataSources, extensionLoaders, extraProviders } = useSharedRootContext();

  // store layout in indexedDB, so that the user can customize the layout and it will be persisted across sessions
  const layoutStorage = useMemo(() => new IdbLayoutStorage(), []);

  const providers = [
    /* eslint-disable react/jsx-key */
    <LayoutStorageContext.Provider value={layoutStorage} />,
    <LayoutManagerProvider />,
    <UserProfileLocalStorageProvider />,
    <CurrentLayoutProvider />,
    <AlertsContextProvider />,
    <StudioLogsSettingsProvider />,
    <StudioToastProvider />,
    ...(extraProviders ?? []),
    <TimelineInteractionStateProvider />,
    <ExtensionMarketplaceProvider />,
    <ExtensionCatalogProvider
  loaders={[]}
  mockMessageConverters={bundledMessageConverters}
/>,
    <UserScriptStateProvider />,
    <PlayerManager playerSources={dataSources} />,
    <EventsProvider />,
    /* eslint-enable react/jsx-key */
  ];

  return (
    <MultiProvider providers={providers}>
      {/* Surfaces errors as toasts instead of failing silently. */}
      <SendNotificationToastAdapter />
      {/* PanelLayout calls useDrop() and throws without a DnD backend. */}
      <DndProvider backend={HTML5Backend}>
        {/* Panels are lazy-loaded. */}
        <Suspense fallback={<></>}>
          {/* Maps the panel type string in the layout to a component. */}
          <PanelCatalogProvider>
            <EmbedWorkspace />
          </PanelCatalogProvider>
        </Suspense>
      </DndProvider>
    </MultiProvider>
  );
}
