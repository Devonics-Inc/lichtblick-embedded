// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import path from "path";

import {
  ConfigParams,
  devServerConfig,
  mainConfig,
} from "@lichtblick/suite-web/src/webpackConfigs";

import packageJson from "../package.json";

const params: ConfigParams = {
  outputPath: path.resolve(__dirname, ".webpack"),   // build lands in embed/.webpack
  contextPath: path.resolve(__dirname, "src"),       // where entrypoint + tsconfig live
  entrypoint: "./entrypoint.tsx",                    // relative to contextPath
  prodSourceMap: "source-map",
  version: packageJson.version,
  indexHtmlOptions: {
    foxgloveExtraHeadTags: `<title>Lichtblick Embed</title>`,
  },
};

// foxglove-depcheck-used: webpack-dev-server
const [devServer, main] = [devServerConfig(params), mainConfig(params)];
devServer.devServer = { ...devServer.devServer, port: 8081 };
export default [devServer, main];