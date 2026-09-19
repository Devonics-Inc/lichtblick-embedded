// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// SPDX-License-Identifier: MPL-2.0

// Import the layout configuration of the embed App.
import "./defaultLayout";


// Import the main entrypoint of the suite-web package, which will render the embed App.
import { main } from "@lichtblick/suite-web";

void main(async () => {
  const [{ EmbedApp }, { WebRoot }] = await Promise.all([
    import("./EmbedApp"),
    import("@lichtblick/suite-web/src/WebRoot"),
  ]);


  // in summary the entry point loads 2 different components
  // 1 - EmbedAPP - this is our custom component that is used to render the robot
  // 2 - WebRoot - this is the root component of the suite-web package that is used to render the entire app
  return {
    rootElement: (
      <WebRoot dataSources={undefined} extraProviders={undefined}>
        <EmbedApp />
      </WebRoot>
    ),
  };
});
