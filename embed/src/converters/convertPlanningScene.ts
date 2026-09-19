// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/**
 * moveit_msgs/PlanningScene -> foxglove.SceneUpdate
 *
 * STATEFUL. MoveIt's /monitored_planning_scene sends one full scene and then diffs
 * (is_diff: true) carrying only what changed, with CollisionObject.operation saying how
 * (ADD / REMOVE / APPEND / MOVE). So we keep our own copy of the scene per topic, apply each
 * message to it, and emit the whole current scene every time. Deletions are computed by
 * comparing against the IDs emitted on the previous message.
 *
 * /monitored_planning_scene is not latched, so an embed that connects late would only see
 * diffs about objects it never knew. useSeedPlanningScene covers that: on connect it calls
 * move_group's /get_planning_scene service and hands the result to seedPlanningScene().
 */

type Vec3 = { x: number; y: number; z: number };
type Quat = { x: number; y: number; z: number; w: number };
type Pose = { position: Vec3; orientation: Quat };
type Color = { r: number; g: number; b: number; a: number };
type Time = { sec: number; nsec: number };

// shape_msgs/SolidPrimitive.type
const BOX = 1;
const SPHERE = 2;
const CYLINDER = 3;
const CONE = 4;

// moveit_msgs/CollisionObject.operation
const OP_ADD = 0;
const OP_REMOVE = 1;
const OP_APPEND = 2;
const OP_MOVE = 3;

// foxglove.SceneEntityDeletion.type (MATCHING_ID = 0, ALL = 1)
const DELETE_MATCHING_ID = 0;

const WORLD_COLOR: Color = { r: 0.2, g: 0.8, b: 0.3, a: 0.8 };
const ATTACHED_COLOR: Color = { r: 1.0, g: 0.6, b: 0.1, a: 0.9 };
const ZERO_TIME: Time = { sec: 0, nsec: 0 };

const IDENTITY: Pose = {
  position: { x: 0, y: 0, z: 0 },
  orientation: { x: 0, y: 0, z: 0, w: 1 },
};

// ---------------------------------------------------------------------------------------------
// State

/** A collision object as last known, reduced to what rendering needs. */
type StoredObject = {
  id: string;
  frameId: string; // "" means "the planning frame"
  pose: Pose;
  primitives: any[];
  primitivePoses: Pose[];
  meshes: any[];
  meshPoses: Pose[];
};

type SceneState = {
  planningFrame: string;
  world: Map<string, StoredObject>;
  attached: Map<string, { linkName: string; object: StoredObject }>;
  colors: Map<string, Color>;
  emittedIds: Set<string>;
};

// One scene, shared by the converter and seedPlanningScene(). Subscribe the layout to a
// single PlanningScene topic (/monitored_planning_scene); two topics would fight over this.
const state: SceneState = {
  planningFrame: "world",
  world: new Map(),
  attached: new Map(),
  colors: new Map(),
  emittedIds: new Set(),
};

// ---------------------------------------------------------------------------------------------
// Math

function quatMul(a: Quat, b: Quat): Quat {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}

function rotate(q: Quat, v: Vec3): Vec3 {
  // v + 2 * cross(q.xyz, cross(q.xyz, v) + q.w * v)
  const tx = 2 * (q.y * v.z - q.z * v.y);
  const ty = 2 * (q.z * v.x - q.x * v.z);
  const tz = 2 * (q.x * v.y - q.y * v.x);
  return {
    x: v.x + q.w * tx + (q.y * tz - q.z * ty),
    y: v.y + q.w * ty + (q.z * tx - q.x * tz),
    z: v.z + q.w * tz + (q.x * ty - q.y * tx),
  };
}

/** Compose a parent pose with a child pose expressed in the parent's frame. */
function composePose(parent: Pose, child: Pose): Pose {
  const r = rotate(parent.orientation, child.position);
  return {
    position: {
      x: parent.position.x + r.x,
      y: parent.position.y + r.y,
      z: parent.position.z + r.z,
    },
    orientation: quatMul(parent.orientation, child.orientation),
  };
}

function normalizePose(p: any): Pose {
  if (p?.position == undefined || p?.orientation == undefined) {
    return IDENTITY;
  }
  const { x: qx = 0, y: qy = 0, z: qz = 0, w: qw = 0 } = p.orientation;
  // An all-zero quaternion (default-constructed msg) is invalid; treat it as identity.
  const isZero = qx === 0 && qy === 0 && qz === 0 && qw === 0;
  return {
    position: { x: p.position.x ?? 0, y: p.position.y ?? 0, z: p.position.z ?? 0 },
    orientation: isZero ? IDENTITY.orientation : { x: qx, y: qy, z: qz, w: qw },
  };
}

// ---------------------------------------------------------------------------------------------
// Applying messages to state

function toStored(obj: any): StoredObject {
  return {
    id: obj.id ?? "",
    frameId: obj.header?.frame_id ?? "",
    pose: normalizePose(obj.pose),
    primitives: Array.from(obj.primitives ?? []),
    primitivePoses: Array.from(obj.primitive_poses ?? [], (p) => normalizePose(p)),
    meshes: Array.from(obj.meshes ?? []),
    meshPoses: Array.from(obj.mesh_poses ?? [], (p) => normalizePose(p)),
  };
}

function applyCollisionObject(world: Map<string, StoredObject>, obj: any): void {
  const id: string = obj.id ?? "";
  switch (obj.operation ?? OP_ADD) {
    case OP_REMOVE:
      // Empty id means "remove every world object".
      if (id === "") {
        world.clear();
      } else {
        world.delete(id);
      }
      return;

    case OP_APPEND: {
      const existing = world.get(id);
      if (existing == undefined) {
        world.set(id, toStored(obj));
        return;
      }
      const extra = toStored(obj);
      existing.primitives.push(...extra.primitives);
      existing.primitivePoses.push(...extra.primitivePoses);
      existing.meshes.push(...extra.meshes);
      existing.meshPoses.push(...extra.meshPoses);
      return;
    }

    case OP_MOVE: {
      const existing = world.get(id);
      if (existing == undefined) {
        return;
      }
      const next = toStored(obj);
      // MoveIt 2: MOVE sets the object origin pose.
      if (obj.pose != undefined) {
        existing.pose = next.pose;
      }
      // Older MoveIt: MOVE carried new per-shape poses instead.
      if (next.primitivePoses.length > 0 && next.primitivePoses.length === existing.primitivePoses.length) {
        existing.primitivePoses = next.primitivePoses;
      }
      if (next.meshPoses.length > 0 && next.meshPoses.length === existing.meshPoses.length) {
        existing.meshPoses = next.meshPoses;
      }
      if (next.frameId !== "") {
        existing.frameId = next.frameId;
      }
      return;
    }

    case OP_ADD:
    default:
      // ADD on an existing id replaces it (MoveIt 2 semantics).
      world.set(id, toStored(obj));
  }
}

function applyAttachedObject(
  attached: SceneState["attached"],
  aco: any,
): void {
  const obj = aco.object ?? {};
  const id: string = obj.id ?? "";
  const linkName: string = aco.link_name ?? "";

  if ((obj.operation ?? OP_ADD) === OP_REMOVE) {
    if (id !== "") {
      attached.delete(id);
      return;
    }
    // Empty id: detach everything from link_name, or everything at all if that is empty too.
    for (const [key, value] of attached) {
      if (linkName === "" || value.linkName === linkName) {
        attached.delete(key);
      }
    }
    return;
  }

  attached.set(id, { linkName, object: toStored(obj) });
}

// ---------------------------------------------------------------------------------------------
// Rendering

function toColor(c: any): Color | undefined {
  if (c == undefined) {
    return undefined;
  }
  return { r: c.r ?? 0, g: c.g ?? 0, b: c.b ?? 0, a: c.a ?? 1 };
}

function meshToTriangles(mesh: any, pose: Pose, color: Color) {
  const points = Array.from(mesh.vertices ?? [], (v: any) => ({
    x: v.x ?? 0,
    y: v.y ?? 0,
    z: v.z ?? 0,
  }));
  const indices: number[] = [];
  for (const tri of mesh.triangles ?? []) {
    // vertex_indices is uint32[3]; may arrive as a Uint32Array.
    const [a, b, c] = Array.from(tri.vertex_indices ?? []) as number[];
    if (a == undefined || b == undefined || c == undefined) {
      continue;
    }
    indices.push(a, b, c);
  }
  if (points.length === 0 || indices.length === 0) {
    return undefined;
  }
  return { pose, points, color, colors: [], indices };
}

function renderObject(obj: StoredObject, frameId: string, color: Color, entityId: string) {
  const cubes: any[] = [];
  const spheres: any[] = [];
  const cylinders: any[] = [];
  const triangles: any[] = [];

  obj.primitives.forEach((prim: any, i: number) => {
    const rel = obj.primitivePoses[i];
    if (rel == undefined) {
      return;
    }
    const pose = composePose(obj.pose, rel);
    const d: number[] = Array.from(prim.dimensions ?? []);

    switch (prim.type) {
      case BOX: {
        const [x, y, z] = d;
        if (x != undefined && y != undefined && z != undefined) {
          cubes.push({ pose, size: { x, y, z }, color });
        }
        break;
      }
      case SPHERE: {
        const r = d[0];
        if (r != undefined) {
          spheres.push({ pose, size: { x: 2 * r, y: 2 * r, z: 2 * r }, color });
        }
        break;
      }
      case CYLINDER:
      case CONE: {
        // Both are [height, radius]. A cone is a cylinder whose top (+Z) shrinks to a point.
        const [height, r] = d;
        if (height != undefined && r != undefined) {
          cylinders.push({
            pose,
            size: { x: 2 * r, y: 2 * r, z: height },
            bottom_scale: 1,
            top_scale: prim.type === CONE ? 0 : 1,
            color,
          });
        }
        break;
      }
      default:
        break;
    }
  });

  obj.meshes.forEach((mesh: any, i: number) => {
    const rel = obj.meshPoses[i];
    if (rel == undefined) {
      return;
    }
    const tri = meshToTriangles(mesh, composePose(obj.pose, rel), color);
    if (tri != undefined) {
      triangles.push(tri);
    }
  });

  if (cubes.length + spheres.length + cylinders.length + triangles.length === 0) {
    return undefined;
  }

  // All SceneEntity array fields are present so the renderer never meets an undefined one.
  return {
    timestamp: ZERO_TIME,
    frame_id: frameId,
    id: entityId,
    lifetime: ZERO_TIME,
    frame_locked: true,
    metadata: [],
    arrows: [],
    cubes,
    spheres,
    cylinders,
    lines: [],
    triangles,
    texts: [],
    models: [],
  };
}

// ---------------------------------------------------------------------------------------------
// Entry point

/**
 * Load a complete scene (e.g. the response of /get_planning_scene) into the converter's state.
 *
 * Nothing is drawn here - the 3D panel only redraws when a message arrives on the topic. The
 * next /monitored_planning_scene diff (move_group sends them continuously while joint_states
 * are streaming) renders everything, seeded objects included.
 */
export function seedPlanningScene(scene: any): void {
  applyScene({ ...scene, is_diff: false });
}

/** Converter registered for moveit_msgs/PlanningScene -> foxglove.SceneUpdate. */
export function convertPlanningScene(msg: any) {
  applyScene(msg);
  return render();
}

function applyScene(msg: any): void {
  const isDiff = msg.is_diff === true;

  // fixed_frame_transforms are expressed in the planning frame.
  const frame = msg.fixed_frame_transforms?.[0]?.header?.frame_id;
  if (typeof frame === "string" && frame !== "") {
    state.planningFrame = frame;
  }

  // A full scene replaces everything; a diff is applied on top of what we have.
  if (!isDiff) {
    state.world.clear();
    state.attached.clear();
    state.colors.clear();
  }

  for (const obj of msg.world?.collision_objects ?? []) {
    applyCollisionObject(state.world, obj);
  }
  for (const aco of msg.robot_state?.attached_collision_objects ?? []) {
    applyAttachedObject(state.attached, aco);
  }
  for (const oc of msg.object_colors ?? []) {
    const c = toColor(oc.color);
    if (oc.id != undefined && c != undefined) {
      state.colors.set(oc.id, c);
    }
  }
}

function render() {
  const entities: any[] = [];

  for (const obj of state.world.values()) {
    const entity = renderObject(
      obj,
      obj.frameId !== "" ? obj.frameId : state.planningFrame,
      state.colors.get(obj.id) ?? WORLD_COLOR,
      `co_${obj.id}`,
    );
    if (entity != undefined) {
      entities.push(entity);
    }
  }

  for (const { linkName, object } of state.attached.values()) {
    // Attached poses are relative to the link; frame_locked makes it ride along with the TCP.
    const frameId = linkName !== "" ? linkName : object.frameId !== "" ? object.frameId : state.planningFrame;
    const entity = renderObject(object, frameId, ATTACHED_COLOR, `aco_${object.id}`);
    if (entity != undefined) {
      entities.push(entity);
    }
  }

  const currentIds = new Set<string>(entities.map((e) => e.id as string));
  const deletions = [...state.emittedIds]
    .filter((id) => !currentIds.has(id))
    .map((id) => ({ timestamp: ZERO_TIME, type: DELETE_MATCHING_ID, id }));
  state.emittedIds = currentIds;

  return { deletions, entities };
}
