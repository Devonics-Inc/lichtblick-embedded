<h1 align="center">Lichtblick Embed</h1>

<div align="center">
  <a href="https://opensource.org/licenses/MPL-2.0"><img src="https://img.shields.io/badge/License-MPL_2.0-brightgreen.svg" alt="License: MPL 2.0"></a>
  <img src="https://img.shields.io/badge/ROS%202-Humble-blue" alt="ROS 2 Humble">
  <img src="https://img.shields.io/badge/MoveIt-2-orange" alt="MoveIt 2">

  <br />
  <p align="center">
    A fork of <a href="https://github.com/lichtblick-suite/lichtblick">Lichtblick</a> that adds an <b>embed</b> build target:
    a stripped-down 3D robot view you can drop into any web app as an iframe, with live MoveIt planning scene support.
  </p>
  <!-- <p align="center"><img alt="Embed screenshot" src="resources/embed-screenshot.png"></p> -->
</div>

## :sparkles: What this fork adds

The full Lichtblick app is still here and works as usual. On top of it, the `embed/` workspace builds a separate page that shows **only the robot's 3D view**. It has no app bar, sidebars, playback controls or data-source picker, so it can live inside another product.

- **Robot-only view.** A single 3D panel fills the page, with none of the application chrome.
- **Locked preset layout.** Camera, colours, visible topics and hidden frames come from `defaultLayout.ts`. The layout is applied on every load, overriding anything stale in the browser's storage.
- **Auto-connect.** The data source is picked from URL parameters, so the host app decides what to show and the end user never sees a picker.
- **Live MoveIt planning scene.** The embed subscribes directly to `/monitored_planning_scene`. Collision objects appear, move, attach to the gripper, detach and disappear in real time, with no relay node needed.
- **Late-join safe.** On connect, the embed asks move_group for the full scene through `/get_planning_scene`, so objects spawned before the page opened still show up.
- **Nothing to install per browser.** The MoveIt converter is compiled into the bundle, so there's no `.foxe` extension to install in each browser.

## :rocket: Quick start

**Requirements:** Node.js 16.10+ with Corepack, plus the ROS 2 side described below.

```sh
git clone <this-repo-url>
cd lichtblick
corepack enable
yarn install
yarn embed:serve        # http://localhost:8081
```

Then open the embed and point it at your robot:

```
http://localhost:8081/?ds=foxglove-websocket&ds.url=ws://localhost:8765
```

### URL parameters

| Parameter | Example | Purpose |
|-----------|---------|---------|
| `ds` | `foxglove-websocket` | Data source type |
| `ds.url` | `ws://localhost:8765` | Address of the data source |

Supported sources include `foxglove-websocket` (foxglove_bridge), `rosbridge-websocket` (rosbridge on port 9090) and `remote-file` (a URL to an `.mcap` recording).

## :robot: ROS 2 side

The embed expects these to be running:

```sh
ros2 launch <your_moveit_config> demo.launch.py              # move_group + robot_state_publisher
ros2 launch foxglove_bridge foxglove_bridge_launch.xml     # ws://localhost:8765
```

| Needed | Why |
|--------|-----|
| `/robot_description` | Robot model (URDF) |
| `/tf`, `/tf_static` | Robot motion, and attached objects following the gripper |
| `/monitored_planning_scene` | Live collision object updates |
| `/get_planning_scene` service | Initial full scene for late joiners (loaded in move_group by default) |

`moveit_msgs` must be sourced in the environment where foxglove_bridge runs. Service calls must also be allowed, which is the bridge's default.

### Try it

Spawn a box and watch it appear in the embed:

```sh
ros2 topic pub --once /planning_scene moveit_msgs/msg/PlanningScene "{is_diff: true, world: {collision_objects: [{header: {frame_id: world}, id: box1, primitives: [{type: 1, dimensions: [0.2, 0.2, 0.2]}], primitive_poses: [{position: {x: 0.4, y: 0.0, z: 0.1}, orientation: {w: 1.0}}], operation: 0}]}}"
```

Remove it:

```sh
ros2 topic pub --once /planning_scene moveit_msgs/msg/PlanningScene "{is_diff: true, world: {collision_objects: [{id: box1, operation: 1}]}}"
```

## :jigsaw: Embedding in your app

The embed is a normal web page, so any frontend can host it in an iframe. In React:

```tsx
export function RobotView() {
  return (
    <iframe
      title="Robot 3D view"
      src="http://localhost:8081/?ds=foxglove-websocket&ds.url=ws://localhost:8765"
      style={{ width: "100%", height: 480, border: 0 }}
    ></iframe>
  );
}
```

For production, build the bundle and serve `embed/.webpack` from any static host:

```sh
yarn embed:build:prod
```

## :art: Customising the view

Everything the viewer sees is set in `embed/src/defaultLayout.ts`: camera position, background colour, robot fallback colour, which topics are visible and which TF frames are hidden.

The easiest way to change it is to build the view you want in the full app (`yarn web:serve`), export the layout from the Layouts menu, and paste the panel config into `defaultLayout.ts`.

## :motorway: MoveIt planning scene support

| Supported | Details |
|-----------|---------|
| Primitives | Box, sphere, cylinder, cone |
| Meshes | Rendered as triangle lists |
| Operations | ADD, REMOVE, APPEND, MOVE |
| Attached objects | Drawn in the attach link's frame, so they follow the gripper |
| Colours | From `object_colors`; attached objects are highlighted in orange |

**Not rendered:** octomap and planes.

The converter keeps a single shared scene, so subscribe the layout to only one PlanningScene topic.

## :file_folder: Project structure

```
embed/
├── webpack.config.ts           # Build target (dev server on :8081)
└── src/
    ├── entrypoint.tsx          # Boots the app; loads the preset layout first
    ├── EmbedApp.tsx            # Provider stack (counterpart of StudioApp.tsx)
    ├── EmbedWorkspace.tsx      # Renders only the panel layout (counterpart of Workspace.tsx)
    ├── defaultLayout.ts        # The locked preset layout
    ├── useEnforceLayout.ts     # Reapplies the preset after the stored layout loads
    ├── useAutoConnect.ts       # Connects to the data source named in the URL
    ├── useSeedPlanningScene.ts # Fetches the full MoveIt scene on connect
    └── converters/
        ├── index.ts                  # Registers bundled message converters
        └── convertPlanningScene.ts   # moveit_msgs/PlanningScene -> foxglove.SceneUpdate
```

## :computer: Full Lichtblick app

The upstream app is unchanged and still builds as normal:

```sh
yarn web:serve              # web app on http://localhost:8080
yarn desktop:serve          # desktop: webpack dev server
yarn desktop:start          # desktop: launch Electron (after desktop:serve finishes)
yarn web:build:prod         # production web build -> web/.webpack
yarn clean                  # remove build output
```

:warning: **Ubuntu GPU issues:** if the 3D view misbehaves, run with software rendering, e.g. `LIBGL_ALWAYS_SOFTWARE=1 yarn desktop:start`.

For the full upstream instructions, Docker usage and Linux package dependencies, see the [Lichtblick README](https://github.com/lichtblick-suite/lichtblick#readme) and [documentation](https://lichtblick-suite.github.io/docs/).

## :pencil: License

Licensed under the [Mozilla Public License v2.0](/LICENSE), the same as upstream Lichtblick. Files carrying an MPL header remain under the MPL; modified files keep their original notices.

## :star: Credits

Built on [Lichtblick](https://github.com/lichtblick-suite/lichtblick) by BMW Group, which began as a fork of [Foxglove Studio](https://github.com/foxglove/studio) by [Foxglove](https://foxglove.dev/).
