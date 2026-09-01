import {
  getHardwareProfile,
  type HardwareProfile,
} from '@led-studio/hardware-profiles';
import {
  DEFAULT_PROJECT_TIMING,
  HexColourSchema,
  BrightnessKeyframeSchema,
  ColourKeyframeSchema,
  EffectLayerSchema,
  EffectSchema,
  KeyframeEasingSchema,
  KeyframeLayerSchema,
  LayerTargetSchema,
  PaletteTokenNameSchema,
  PaletteTokenSchema,
  PositiveQuarterBeatSchema,
  PROJECT_LIMITS,
  PROJECT_SCHEMA_VERSION,
  ProjectEntityIdSchema,
  ProjectGroupNameSchema,
  ProjectGroupSchema,
  ProjectNameSchema,
  ProjectTimingSchema,
  QuarterBeatSchema,
  SceneBrightnessPercentSchema,
  SceneLayerNameSchema,
  SceneLayerSchema,
  SceneLoopLengthSchema,
  SceneNameSchema,
  parseProject,
  type BrightnessKeyframe,
  type ColourKeyframe,
  type PaletteToken,
  type Effect,
  type KeyframeEasing,
  type KeyframeLayer,
  type LayerTarget,
  type Project,
  type ProjectGroup,
  type ProjectTiming,
  type Scene,
  type SceneLayer,
} from '@led-studio/project-format';
import {
  paletteTokenUsageCount,
  projectEntityIds,
  projectGroupUsageCount,
} from './projectQueries.js';
import { commitEditorProject } from './history.js';

export {
  paletteTokenUsageCount,
  projectGroupUsageCount,
} from './projectQueries.js';
export {
  createEditorHistory,
  MAX_EDITOR_HISTORY_REVISIONS,
  redoEditorHistory,
  undoEditorHistory,
  type EditorHistory,
  type EditorHistoryTransition,
  type EditorRevision,
} from './history.js';
import type { EditorHistory, EditorHistoryTransition } from './history.js';

export type KeyframeTrackKind = 'brightness' | 'colour';

export interface KeyframeReference {
  id: string;
  track: KeyframeTrackKind;
}

export interface KeyframeMove extends KeyframeReference {
  beat: number;
}

export type PastedKeyframe =
  | {
      beat: number;
      brightnessPercent: number;
      easing: KeyframeEasing;
      id: string;
      track: 'brightness';
    }
  | {
      beat: number;
      easing: KeyframeEasing;
      id: string;
      paletteTokenId: string;
      track: 'colour';
    };

export interface SceneLayerChanges {
  colourInterpolation?: KeyframeLayer['tracks']['colour']['interpolation'];
  effect?: Effect;
  enabled?: boolean;
  endBeat?: number;
  locked?: boolean;
  name?: string;
  startBeat?: number;
  target?: LayerTarget;
}

export type KeyframeValue =
  | {
      brightnessPercent: number;
      easing?: KeyframeEasing;
      track: 'brightness';
    }
  | {
      easing?: KeyframeEasing;
      paletteTokenId: string;
      track: 'colour';
    };

export type EditorCommand =
  | { name: string; type: 'project-renamed' }
  | { changes: Partial<ProjectTiming>; type: 'project-timing-updated' }
  | { id: string; type: 'palette-token-added' }
  | {
      changes: Partial<Pick<PaletteToken, 'name' | 'value'>>;
      id: string;
      type: 'palette-token-updated';
    }
  | { id: string; sourceId: string; type: 'palette-token-duplicated' }
  | { id: string; type: 'palette-token-deleted' }
  | { id: string; type: 'scene-added' }
  | {
      id: string;
      keyframeIds: string[][];
      layerIds: string[];
      sourceId: string;
      type: 'scene-duplicated';
    }
  | { id: string; type: 'scene-deleted' }
  | {
      changes: Partial<Pick<Scene, 'loopLengthBeats' | 'name'>>;
      id: string;
      type: 'scene-updated';
    }
  | {
      ledIds: string[];
      paletteTokenId: string;
      sceneId: string;
      type: 'scene-leds-painted';
    }
  | {
      brightnessPercent: number;
      ledIds: string[];
      sceneId: string;
      type: 'scene-led-brightness-set';
    }
  | { ledIds: string[]; sceneId: string; type: 'scene-leds-turned-off' }
  | { id: string; ledIds: string[]; type: 'group-added' }
  | {
      changes: Partial<Pick<ProjectGroup, 'ledIds' | 'name'>>;
      id: string;
      type: 'group-updated';
    }
  | { id: string; sourceId: string; type: 'group-duplicated' }
  | { id: string; type: 'group-deleted' }
  | {
      layerType: Effect['type'] | 'keyframe';
      id: string;
      sceneId: string;
      target: LayerTarget;
      type: 'scene-layer-added';
    }
  | {
      changes: SceneLayerChanges;
      id: string;
      sceneId: string;
      type: 'scene-layer-updated';
    }
  | {
      id: string;
      keyframeIds: string[];
      newId: string;
      sceneId: string;
      type: 'scene-layer-duplicated';
    }
  | { id: string; sceneId: string; type: 'scene-layer-deleted' }
  | {
      id: string;
      sceneId: string;
      toIndex: number;
      type: 'scene-layer-moved';
    }
  | {
      layer: SceneLayer;
      sceneId: string;
      toIndex: number;
      type: 'scene-layer-pasted';
    }
  | {
      beat: number;
      id: string;
      layerId: string;
      sceneId: string;
      type: 'keyframe-added';
      value: KeyframeValue;
    }
  | {
      changes: {
        beat?: number;
        brightnessPercent?: number;
        easing?: KeyframeEasing;
        paletteTokenId?: string;
      };
      id: string;
      layerId: string;
      sceneId: string;
      track: KeyframeTrackKind;
      type: 'keyframe-updated';
    }
  | {
      easing: KeyframeEasing;
      keyframes: KeyframeReference[];
      layerId: string;
      sceneId: string;
      type: 'keyframes-easing-set';
    }
  | {
      id: string;
      layerId: string;
      newBeat: number;
      newId: string;
      sceneId: string;
      track: KeyframeTrackKind;
      type: 'keyframe-duplicated';
    }
  | {
      id: string;
      layerId: string;
      sceneId: string;
      track: KeyframeTrackKind;
      type: 'keyframe-deleted';
    }
  | {
      keyframes: KeyframeReference[];
      layerId: string;
      sceneId: string;
      type: 'keyframes-deleted';
    }
  | {
      keyframes: KeyframeMove[];
      layerId: string;
      sceneId: string;
      type: 'keyframes-moved';
    }
  | {
      keyframes: PastedKeyframe[];
      layerId: string;
      sceneId: string;
      type: 'keyframes-pasted';
    };

export type EditorCommandErrorCode =
  | 'duplicate-entity-id'
  | 'duplicate-name'
  | 'invalid-command'
  | 'missing-entity'
  | 'entity-in-use'
  | 'locked-entity'
  | 'palette-token-in-use'
  | 'unknown-hardware-profile';

export class EditorCommandError extends Error {
  constructor(
    readonly code: EditorCommandErrorCode,
    message: string,
    readonly referenceCount?: number,
  ) {
    super(message);
    this.name = 'EditorCommandError';
  }
}

export interface ExecuteEditorCommandOptions {
  historyGroupId?: string;
}

export type ProjectEntityIdFactory = () => string;

export interface CreateDefaultProjectInput {
  name: string;
  profile: HardwareProfile;
}

function generateProjectEntityId(): string {
  return globalThis.crypto.randomUUID();
}

interface CommandValueSchema<T> {
  safeParse(
    input: unknown,
  ):
    | { data: T; success: true }
    | { error: { issues: readonly { message: string }[] }; success: false };
}

function parseCommandValue<T>(
  schema: CommandValueSchema<T>,
  input: unknown,
): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw new EditorCommandError(
    'invalid-command',
    result.error.issues[0]?.message ?? 'The edit is not valid.',
  );
}

function normalizedName(name: string): string {
  return name.trim().toLowerCase();
}

function uniqueName(existingNames: string[], preferredName: string): string {
  const baseName = preferredName.trim();
  const normalizedNames = new Set(existingNames.map(normalizedName));
  if (!normalizedNames.has(normalizedName(baseName))) return baseName;

  let suffix = 2;
  while (normalizedNames.has(normalizedName(`${baseName} ${suffix}`))) {
    suffix += 1;
  }
  return `${baseName} ${suffix}`;
}

function createEntityId(
  project: Project,
  idFactory: ProjectEntityIdFactory,
): string {
  const existingIds = projectEntityIds(project);
  let id = ProjectEntityIdSchema.parse(idFactory());
  while (existingIds.has(id)) id = ProjectEntityIdSchema.parse(idFactory());
  return id;
}

function assertNewEntityId(project: Project, id: string): string {
  return assertNewEntityIds(project, [id])[0];
}

function assertNewEntityIds(
  project: Project,
  ids: readonly string[],
): string[] {
  const reserved = projectEntityIds(project);
  if (reserved.size + ids.length > PROJECT_LIMITS.totalEntities) {
    throw new EditorCommandError(
      'invalid-command',
      `Projects cannot contain more than ${PROJECT_LIMITS.totalEntities} total entities.`,
    );
  }
  return ids.map((id) => {
    const parsedId = parseCommandValue(ProjectEntityIdSchema, id);
    if (reserved.has(parsedId)) {
      throw new EditorCommandError(
        'duplicate-entity-id',
        `Entity ID "${parsedId}" is already in use.`,
      );
    }
    reserved.add(parsedId);
    return parsedId;
  });
}

function tokenIndex(project: Project, id: string): number {
  const index = project.palette.findIndex((token) => token.id === id);
  if (index === -1) {
    throw new EditorCommandError(
      'missing-entity',
      `Palette token "${id}" does not exist.`,
    );
  }
  return index;
}

function sceneIndex(project: Project, id: string): number {
  const index = project.scenes.findIndex((scene) => scene.id === id);
  if (index === -1) {
    throw new EditorCommandError(
      'missing-entity',
      `Scene "${id}" does not exist.`,
    );
  }
  return index;
}

function groupIndex(project: Project, id: string): number {
  const index = project.groups.findIndex((group) => group.id === id);
  if (index === -1) {
    throw new EditorCommandError(
      'missing-entity',
      `Group "${id}" does not exist.`,
    );
  }
  return index;
}

function layerIndex(scene: Scene, id: string): number {
  const index = scene.layers.findIndex((layer) => layer.id === id);
  if (index === -1) {
    throw new EditorCommandError(
      'missing-entity',
      `Layer "${id}" does not exist.`,
    );
  }
  return index;
}

function assertUniquePaletteName(
  project: Project,
  name: string,
  exceptId?: string,
): void {
  if (
    project.palette.some(
      (token) =>
        token.id !== exceptId &&
        normalizedName(token.name) === normalizedName(name),
    )
  ) {
    throw new EditorCommandError(
      'duplicate-name',
      `Palette token name "${name}" is already in use.`,
    );
  }
}

function assertUniqueSceneName(
  project: Project,
  name: string,
  exceptId?: string,
): void {
  if (
    project.scenes.some(
      (scene) =>
        scene.id !== exceptId &&
        normalizedName(scene.name) === normalizedName(name),
    )
  ) {
    throw new EditorCommandError(
      'duplicate-name',
      `Scene name "${name}" is already in use.`,
    );
  }
}

function assertUniqueGroupName(
  project: Project,
  name: string,
  exceptId?: string,
): void {
  if (
    project.groups.some(
      (group) =>
        group.id !== exceptId &&
        normalizedName(group.name) === normalizedName(name),
    )
  ) {
    throw new EditorCommandError(
      'duplicate-name',
      `Group name "${name}" is already in use.`,
    );
  }
}

function assertUniqueLayerName(
  scene: Scene,
  name: string,
  exceptId?: string,
): void {
  if (
    scene.layers.some(
      (layer) =>
        layer.id !== exceptId &&
        normalizedName(layer.name) === normalizedName(name),
    )
  ) {
    throw new EditorCommandError(
      'duplicate-name',
      `Layer name "${name}" is already in use.`,
    );
  }
}

function projectProfile(project: Project): HardwareProfile {
  const profile = getHardwareProfile(project.hardwareProfile);
  if (!profile) {
    throw new EditorCommandError(
      'unknown-hardware-profile',
      `Hardware profile "${project.hardwareProfile}" is not available.`,
    );
  }
  return profile;
}

function assertLedIds(project: Project, ledIds: readonly string[]): void {
  const profileLedIds = new Set(
    projectProfile(project).leds.map((led) => led.id),
  );
  for (const ledId of ledIds) {
    if (!profileLedIds.has(ledId)) {
      throw new EditorCommandError(
        'invalid-command',
        `LED "${ledId}" is not part of the active hardware profile.`,
      );
    }
  }
}

function canonicalLedIds(
  project: Project,
  ledIds: readonly string[],
): string[] {
  assertLedIds(project, ledIds);
  const selected = new Set(ledIds);
  return projectProfile(project)
    .leds.filter((led) => selected.has(led.id))
    .map((led) => led.id);
}

function assertTarget(project: Project, target: LayerTarget): LayerTarget {
  const parsed = parseCommandValue(LayerTargetSchema, target);
  if (parsed.kind === 'leds') {
    return { ...parsed, ledIds: canonicalLedIds(project, parsed.ledIds) };
  }
  if (parsed.kind === 'profile-group') {
    if (
      !projectProfile(project).groups.some(
        (group) => group.id === parsed.groupId,
      )
    ) {
      throw new EditorCommandError(
        'invalid-command',
        `Profile group "${parsed.groupId}" does not exist.`,
      );
    }
    return parsed;
  }
  groupIndex(project, parsed.groupId);
  return parsed;
}

function updateScene(
  project: Project,
  id: string,
  updater: (scene: Scene) => Scene,
): Project {
  const index = sceneIndex(project, id);
  const nextScene = updater(project.scenes[index]);
  if (nextScene === project.scenes[index]) return project;
  const scenes = [...project.scenes];
  scenes[index] = nextScene;
  return { ...project, scenes };
}

function layerTargetsEqual(left: LayerTarget, right: LayerTarget): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === 'leds' && right.kind === 'leds')
    return (
      left.ledIds.length === right.ledIds.length &&
      left.ledIds.every((id, index) => id === right.ledIds[index])
    );
  return (
    'groupId' in left && 'groupId' in right && left.groupId === right.groupId
  );
}

function effectsEqual(left: Effect, right: Effect): boolean {
  if (left.type !== right.type) return false;
  if (left.type === 'pulse' && right.type === 'pulse')
    return (
      left.cycleLengthBeats === right.cycleLengthBeats &&
      left.maxBrightnessPercent === right.maxBrightnessPercent &&
      left.minBrightnessPercent === right.minBrightnessPercent &&
      left.paletteTokenId === right.paletteTokenId &&
      left.phaseOffsetBeats === right.phaseOffsetBeats &&
      left.waveform === right.waveform
    );
  if (left.type === 'chase' && right.type === 'chase')
    return (
      left.brightnessPercent === right.brightnessPercent &&
      left.direction === right.direction &&
      left.paletteTokenId === right.paletteTokenId &&
      left.stepLengthBeats === right.stepLengthBeats &&
      left.trailLength === right.trailLength &&
      left.width === right.width
    );
  return false;
}

function sceneLayersEqual(left: SceneLayer, right: SceneLayer): boolean {
  if (
    left.kind !== right.kind ||
    left.enabled !== right.enabled ||
    left.endBeat !== right.endBeat ||
    left.locked !== right.locked ||
    left.name !== right.name ||
    left.startBeat !== right.startBeat ||
    !layerTargetsEqual(left.target, right.target)
  )
    return false;
  if (left.kind === 'effect' && right.kind === 'effect')
    return effectsEqual(left.effect, right.effect);
  return (
    left.kind === 'keyframe' &&
    right.kind === 'keyframe' &&
    left.tracks.colour.interpolation === right.tracks.colour.interpolation
  );
}

function insertKeyframeByBeat<T extends { beat: number }>(
  keyframes: readonly T[],
  keyframe: T,
): T[] {
  let low = 0;
  let high = keyframes.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (keyframes[middle].beat < keyframe.beat) low = middle + 1;
    else high = middle;
  }
  return [...keyframes.slice(0, low), keyframe, ...keyframes.slice(low)];
}

function assertCollectionCapacity(
  current: number,
  maximum: number,
  subject: string,
): void {
  if (current >= maximum) {
    throw new EditorCommandError(
      'invalid-command',
      `${subject} cannot contain more than ${maximum} items.`,
    );
  }
}

export function createDefaultProject(
  { name, profile }: CreateDefaultProjectInput,
  idFactory: ProjectEntityIdFactory = generateProjectEntityId,
): Project {
  const whiteTokenId = ProjectEntityIdSchema.parse(idFactory());
  let sceneId = ProjectEntityIdSchema.parse(idFactory());
  while (sceneId === whiteTokenId)
    sceneId = ProjectEntityIdSchema.parse(idFactory());
  return parseProject({
    schemaVersion: PROJECT_SCHEMA_VERSION,
    name,
    hardwareProfile: profile.id,
    palette: [{ id: whiteTokenId, name: 'White', value: '#FFFFFF' }],
    scenes: [
      {
        id: sceneId,
        layers: [],
        ledStates: Object.fromEntries(
          profile.leds.map((led) => [
            led.id,
            { brightnessPercent: 100, paletteTokenId: whiteTokenId },
          ]),
        ),
        loopLengthBeats: 4,
        name: 'Scene 1',
      },
    ],
    sequence: [],
    groups: [],
    timing: DEFAULT_PROJECT_TIMING,
  });
}

export function createPaletteTokenAddedCommand(
  project: Project,
  idFactory: ProjectEntityIdFactory = generateProjectEntityId,
): Extract<EditorCommand, { type: 'palette-token-added' }> {
  return {
    id: createEntityId(project, idFactory),
    type: 'palette-token-added',
  };
}

export function createPaletteTokenDuplicatedCommand(
  project: Project,
  sourceId: string,
  idFactory: ProjectEntityIdFactory = generateProjectEntityId,
): Extract<EditorCommand, { type: 'palette-token-duplicated' }> {
  tokenIndex(project, sourceId);
  return {
    id: createEntityId(project, idFactory),
    sourceId,
    type: 'palette-token-duplicated',
  };
}

export function createSceneAddedCommand(
  project: Project,
  idFactory: ProjectEntityIdFactory = generateProjectEntityId,
): Extract<EditorCommand, { type: 'scene-added' }> {
  return { id: createEntityId(project, idFactory), type: 'scene-added' };
}

export function createSceneDuplicatedCommand(
  project: Project,
  sourceId: string,
  idFactory: ProjectEntityIdFactory = generateProjectEntityId,
): Extract<EditorCommand, { type: 'scene-duplicated' }> {
  const source = project.scenes[sceneIndex(project, sourceId)];
  const reserved = projectEntityIds(project);
  const nextId = () => {
    let id = ProjectEntityIdSchema.parse(idFactory());
    while (reserved.has(id)) id = ProjectEntityIdSchema.parse(idFactory());
    reserved.add(id);
    return id;
  };
  return {
    id: nextId(),
    keyframeIds: source.layers.map((layer) =>
      layer.kind === 'keyframe'
        ? [
            ...layer.tracks.brightness.keyframes.map(nextId),
            ...layer.tracks.colour.keyframes.map(nextId),
          ]
        : [],
    ),
    layerIds: source.layers.map(nextId),
    sourceId,
    type: 'scene-duplicated',
  };
}

export function createGroupAddedCommand(
  project: Project,
  ledIds: string[],
  idFactory: ProjectEntityIdFactory = generateProjectEntityId,
): Extract<EditorCommand, { type: 'group-added' }> {
  return {
    id: createEntityId(project, idFactory),
    ledIds: canonicalLedIds(project, ledIds),
    type: 'group-added',
  };
}

export function createGroupDuplicatedCommand(
  project: Project,
  sourceId: string,
  idFactory: ProjectEntityIdFactory = generateProjectEntityId,
): Extract<EditorCommand, { type: 'group-duplicated' }> {
  groupIndex(project, sourceId);
  return {
    id: createEntityId(project, idFactory),
    sourceId,
    type: 'group-duplicated',
  };
}

export function createSceneLayerAddedCommand(
  project: Project,
  sceneId: string,
  layerType: Effect['type'] | 'keyframe',
  target: LayerTarget,
  idFactory: ProjectEntityIdFactory = generateProjectEntityId,
): Extract<EditorCommand, { type: 'scene-layer-added' }> {
  sceneIndex(project, sceneId);
  return {
    layerType,
    id: createEntityId(project, idFactory),
    sceneId,
    target: assertTarget(project, target),
    type: 'scene-layer-added',
  };
}

export function createSceneLayerDuplicatedCommand(
  project: Project,
  sceneId: string,
  id: string,
  idFactory: ProjectEntityIdFactory = generateProjectEntityId,
): Extract<EditorCommand, { type: 'scene-layer-duplicated' }> {
  const layer =
    project.scenes[sceneIndex(project, sceneId)].layers[
      layerIndex(project.scenes[sceneIndex(project, sceneId)], id)
    ];
  const reserved = projectEntityIds(project);
  const nextId = () => {
    let next = ProjectEntityIdSchema.parse(idFactory());
    while (reserved.has(next)) next = ProjectEntityIdSchema.parse(idFactory());
    reserved.add(next);
    return next;
  };
  return {
    id,
    keyframeIds:
      layer.kind === 'keyframe'
        ? [
            ...layer.tracks.brightness.keyframes.map(nextId),
            ...layer.tracks.colour.keyframes.map(nextId),
          ]
        : [],
    newId: nextId(),
    sceneId,
    type: 'scene-layer-duplicated',
  };
}

export function createKeyframeAddedCommand(
  project: Project,
  sceneId: string,
  layerId: string,
  beat: number,
  value: KeyframeValue,
  idFactory: ProjectEntityIdFactory = generateProjectEntityId,
): Extract<EditorCommand, { type: 'keyframe-added' }> {
  const scene = project.scenes[sceneIndex(project, sceneId)];
  const layer = scene.layers[layerIndex(scene, layerId)];
  if (layer.kind !== 'keyframe') {
    throw new EditorCommandError(
      'invalid-command',
      'Keyframes can only be added to a keyframe layer.',
    );
  }
  return {
    beat,
    id: createEntityId(project, idFactory),
    layerId,
    sceneId,
    type: 'keyframe-added',
    value,
  };
}

export function nextAvailableKeyframeBeat(
  layer: KeyframeLayer,
  track: KeyframeTrackKind,
  sourceBeat: number,
  loopLengthBeats: number,
): number | null {
  const occupied = new Set(
    layer.tracks[track].keyframes.map(({ beat }) => beat),
  );
  for (let beat = sourceBeat + 0.25; beat <= loopLengthBeats; beat += 0.25)
    if (!occupied.has(beat)) return beat;
  for (let beat = sourceBeat - 0.25; beat >= 0; beat -= 0.25)
    if (!occupied.has(beat)) return beat;
  return null;
}

export function createKeyframeDuplicatedCommand(
  project: Project,
  sceneId: string,
  layerId: string,
  track: KeyframeTrackKind,
  id: string,
  idFactory: ProjectEntityIdFactory = generateProjectEntityId,
): Extract<EditorCommand, { type: 'keyframe-duplicated' }> {
  const scene = project.scenes[sceneIndex(project, sceneId)];
  const layer = scene.layers[layerIndex(scene, layerId)];
  if (layer.kind !== 'keyframe') {
    throw new EditorCommandError(
      'invalid-command',
      'Keyframes can only be duplicated in a keyframe layer.',
    );
  }
  const keyframe = layer.tracks[track].keyframes.find(
    (candidate) => candidate.id === id,
  );
  if (!keyframe)
    throw new EditorCommandError(
      'missing-entity',
      `Keyframe "${id}" does not exist.`,
    );
  const newBeat = nextAvailableKeyframeBeat(
    layer,
    track,
    keyframe.beat,
    scene.loopLengthBeats,
  );
  if (newBeat === null) {
    throw new EditorCommandError(
      'invalid-command',
      'There is no free quarter-beat position for a duplicate keyframe.',
    );
  }
  return {
    id,
    layerId,
    newBeat,
    newId: createEntityId(project, idFactory),
    sceneId,
    track,
    type: 'keyframe-duplicated',
  };
}

export function applyEditorCommand(
  project: Project,
  command: EditorCommand,
): Project {
  switch (command.type) {
    case 'project-renamed': {
      const name = parseCommandValue(ProjectNameSchema, command.name);
      return name === project.name ? project : { ...project, name };
    }
    case 'project-timing-updated': {
      const timing = parseCommandValue(ProjectTimingSchema, {
        ...project.timing,
        ...command.changes,
      });
      if (
        timing.previewBpm === project.timing.previewBpm &&
        timing.timeSignature.numerator ===
          project.timing.timeSignature.numerator &&
        timing.timeSignature.denominator ===
          project.timing.timeSignature.denominator
      )
        return project;
      return { ...project, timing };
    }
    case 'palette-token-added': {
      assertCollectionCapacity(
        project.palette.length,
        PROJECT_LIMITS.paletteTokens,
        'Projects',
      );
      const token = parseCommandValue(PaletteTokenSchema, {
        id: assertNewEntityId(project, command.id),
        name: uniqueName(
          project.palette.map(({ name }) => name),
          'New Colour',
        ),
        value: '#FFFFFF',
      });
      return { ...project, palette: [...project.palette, token] };
    }
    case 'palette-token-updated': {
      const index = tokenIndex(project, command.id);
      const current = project.palette[index];
      const name =
        command.changes.name === undefined
          ? current.name
          : parseCommandValue(PaletteTokenNameSchema, command.changes.name);
      const value =
        command.changes.value === undefined
          ? current.value
          : parseCommandValue(
              HexColourSchema,
              command.changes.value.toUpperCase(),
            );
      assertUniquePaletteName(project, name, current.id);
      if (name === current.name && value === current.value) return project;
      const palette = [...project.palette];
      palette[index] = { ...current, name, value };
      return { ...project, palette };
    }
    case 'palette-token-duplicated': {
      assertCollectionCapacity(
        project.palette.length,
        PROJECT_LIMITS.paletteTokens,
        'Projects',
      );
      const sourceIndex = tokenIndex(project, command.sourceId);
      const source = project.palette[sourceIndex];
      const duplicate = parseCommandValue(PaletteTokenSchema, {
        id: assertNewEntityId(project, command.id),
        name: uniqueName(
          project.palette.map(({ name }) => name),
          `${source.name} Copy`,
        ),
        value: source.value,
      });
      const palette = [...project.palette];
      palette.splice(sourceIndex + 1, 0, duplicate);
      return { ...project, palette };
    }
    case 'palette-token-deleted': {
      const index = tokenIndex(project, command.id);
      const referenceCount = paletteTokenUsageCount(project, command.id);
      if (referenceCount > 0) {
        throw new EditorCommandError(
          'palette-token-in-use',
          `This colour has ${referenceCount} project ${referenceCount === 1 ? 'reference' : 'references'}.`,
          referenceCount,
        );
      }
      return {
        ...project,
        palette: project.palette.filter((_, position) => position !== index),
      };
    }
    case 'scene-added': {
      assertCollectionCapacity(
        project.scenes.length,
        PROJECT_LIMITS.scenes,
        'Projects',
      );
      const scene: Scene = {
        id: assertNewEntityId(project, command.id),
        layers: [],
        ledStates: {},
        loopLengthBeats: 4,
        name: uniqueName(
          project.scenes.map(({ name }) => name),
          `Scene ${project.scenes.length + 1}`,
        ),
      };
      return { ...project, scenes: [...project.scenes, scene] };
    }
    case 'scene-duplicated': {
      assertCollectionCapacity(
        project.scenes.length,
        PROJECT_LIMITS.scenes,
        'Projects',
      );
      const sourceIndex = sceneIndex(project, command.sourceId);
      const source = project.scenes[sourceIndex];
      if (
        command.layerIds.length !== source.layers.length ||
        command.keyframeIds.length !== source.layers.length
      ) {
        throw new EditorCommandError(
          'invalid-command',
          'Scene duplication requires new IDs for every layer and keyframe.',
        );
      }
      const validatedIds = assertNewEntityIds(project, [
        command.id,
        ...command.layerIds,
        ...command.keyframeIds.flat(),
      ]);
      const duplicateId = validatedIds[0];
      const layerIds = validatedIds.slice(1, 1 + command.layerIds.length);
      let keyframeIdOffset = 1 + command.layerIds.length;
      const nextLayers = source.layers.map((layer, index): SceneLayer => {
        const cloned = { ...structuredClone(layer), id: layerIds[index] };
        if (cloned.kind !== 'keyframe') {
          if (command.keyframeIds[index].length !== 0) {
            throw new EditorCommandError(
              'invalid-command',
              'Effect layers cannot receive keyframe IDs.',
            );
          }
          return cloned;
        }
        const expectedCount =
          cloned.tracks.brightness.keyframes.length +
          cloned.tracks.colour.keyframes.length;
        if (command.keyframeIds[index].length !== expectedCount) {
          throw new EditorCommandError(
            'invalid-command',
            'Scene duplication requires one new ID per keyframe.',
          );
        }
        const nextKeyframeIds = validatedIds.slice(
          keyframeIdOffset,
          keyframeIdOffset + expectedCount,
        );
        keyframeIdOffset += expectedCount;
        const brightnessCount = cloned.tracks.brightness.keyframes.length;
        return {
          ...cloned,
          tracks: {
            brightness: {
              keyframes: cloned.tracks.brightness.keyframes.map(
                (keyframe, keyframeIndex) => ({
                  ...keyframe,
                  id: nextKeyframeIds[keyframeIndex],
                }),
              ),
            },
            colour: {
              ...cloned.tracks.colour,
              keyframes: cloned.tracks.colour.keyframes.map(
                (keyframe, keyframeIndex) => ({
                  ...keyframe,
                  id: nextKeyframeIds[brightnessCount + keyframeIndex],
                }),
              ),
            },
          },
        };
      });
      const duplicate: Scene = {
        ...structuredClone(source),
        id: duplicateId,
        layers: nextLayers,
        name: uniqueName(
          project.scenes.map(({ name }) => name),
          `${source.name} Copy`,
        ),
      };
      const scenes = [...project.scenes];
      scenes.splice(sourceIndex + 1, 0, duplicate);
      return { ...project, scenes };
    }
    case 'scene-deleted': {
      const index = sceneIndex(project, command.id);
      return {
        ...project,
        scenes: project.scenes.filter((_, position) => position !== index),
      };
    }
    case 'scene-updated':
      return updateScene(project, command.id, (scene) => {
        const name =
          command.changes.name === undefined
            ? scene.name
            : parseCommandValue(SceneNameSchema, command.changes.name);
        const loopLengthBeats =
          command.changes.loopLengthBeats === undefined
            ? scene.loopLengthBeats
            : parseCommandValue(
                SceneLoopLengthSchema,
                command.changes.loopLengthBeats,
              );
        if (
          scene.layers.some(
            (layer) =>
              layer.endBeat > loopLengthBeats ||
              (layer.kind === 'keyframe' &&
                [
                  ...layer.tracks.brightness.keyframes,
                  ...layer.tracks.colour.keyframes,
                ].some((keyframe) => keyframe.beat > loopLengthBeats)),
          )
        ) {
          throw new EditorCommandError(
            'invalid-command',
            'Scene loop cannot end before a layer or stored keyframe. Adjust it first.',
          );
        }
        assertUniqueSceneName(project, name, scene.id);
        return name === scene.name && loopLengthBeats === scene.loopLengthBeats
          ? scene
          : { ...scene, loopLengthBeats, name };
      });
    case 'scene-leds-painted': {
      tokenIndex(project, command.paletteTokenId);
      assertLedIds(project, command.ledIds);
      return updateScene(project, command.sceneId, (scene) => {
        if (
          command.ledIds.length === 0 ||
          command.ledIds.every(
            (ledId) =>
              scene.ledStates[ledId]?.paletteTokenId === command.paletteTokenId,
          )
        )
          return scene;
        const ledStates = { ...scene.ledStates };
        command.ledIds.forEach((ledId) => {
          ledStates[ledId] = {
            brightnessPercent: ledStates[ledId]?.brightnessPercent ?? 100,
            paletteTokenId: command.paletteTokenId,
          };
        });
        return { ...scene, ledStates };
      });
    }
    case 'scene-led-brightness-set': {
      if (
        !Number.isInteger(command.brightnessPercent) ||
        command.brightnessPercent < 0 ||
        command.brightnessPercent > 100
      ) {
        throw new EditorCommandError(
          'invalid-command',
          'Brightness must be an integer from 0 to 100.',
        );
      }
      assertLedIds(project, command.ledIds);
      return updateScene(project, command.sceneId, (scene) => {
        const affected = command.ledIds.filter(
          (ledId) => scene.ledStates[ledId],
        );
        const unchanged = affected.every(
          (ledId) =>
            scene.ledStates[ledId].brightnessPercent ===
            command.brightnessPercent,
        );
        if (affected.length === 0 || unchanged) return scene;
        const ledStates = { ...scene.ledStates };
        affected.forEach((ledId) => {
          ledStates[ledId] = {
            ...ledStates[ledId],
            brightnessPercent: parseCommandValue(
              SceneBrightnessPercentSchema,
              command.brightnessPercent,
            ),
          };
        });
        return { ...scene, ledStates };
      });
    }
    case 'scene-leds-turned-off': {
      assertLedIds(project, command.ledIds);
      return updateScene(project, command.sceneId, (scene) => {
        if (!command.ledIds.some((ledId) => scene.ledStates[ledId]))
          return scene;
        const ledStates = { ...scene.ledStates };
        command.ledIds.forEach((ledId) => delete ledStates[ledId]);
        return { ...scene, ledStates };
      });
    }
    case 'group-added': {
      assertCollectionCapacity(
        project.groups.length,
        PROJECT_LIMITS.groups,
        'Projects',
      );
      const group = parseCommandValue(ProjectGroupSchema, {
        id: assertNewEntityId(project, command.id),
        ledIds: canonicalLedIds(project, command.ledIds),
        name: uniqueName(
          project.groups.map(({ name }) => name),
          'New Group',
        ),
      });
      return { ...project, groups: [...project.groups, group] };
    }
    case 'group-updated': {
      const index = groupIndex(project, command.id);
      const current = project.groups[index];
      const name =
        command.changes.name === undefined
          ? current.name
          : parseCommandValue(ProjectGroupNameSchema, command.changes.name);
      const ledIds =
        command.changes.ledIds === undefined
          ? current.ledIds
          : canonicalLedIds(project, command.changes.ledIds);
      assertUniqueGroupName(project, name, current.id);
      const next = parseCommandValue(ProjectGroupSchema, {
        ...current,
        ledIds,
        name,
      });
      if (
        name === current.name &&
        ledIds.join('\0') === current.ledIds.join('\0')
      )
        return project;
      const groups = [...project.groups];
      groups[index] = next;
      return { ...project, groups };
    }
    case 'group-duplicated': {
      assertCollectionCapacity(
        project.groups.length,
        PROJECT_LIMITS.groups,
        'Projects',
      );
      const sourceIndex = groupIndex(project, command.sourceId);
      const source = project.groups[sourceIndex];
      const duplicate = parseCommandValue(ProjectGroupSchema, {
        ...source,
        id: assertNewEntityId(project, command.id),
        name: uniqueName(
          project.groups.map(({ name }) => name),
          `${source.name} Copy`,
        ),
      });
      const groups = [...project.groups];
      groups.splice(sourceIndex + 1, 0, duplicate);
      return { ...project, groups };
    }
    case 'group-deleted': {
      const index = groupIndex(project, command.id);
      const referenceCount = projectGroupUsageCount(project, command.id);
      if (referenceCount > 0) {
        throw new EditorCommandError(
          'entity-in-use',
          `This group is targeted by ${referenceCount} ${referenceCount === 1 ? 'layer' : 'layers'}.`,
          referenceCount,
        );
      }
      return {
        ...project,
        groups: project.groups.filter((_, position) => position !== index),
      };
    }
    case 'scene-layer-added': {
      if (command.layerType !== 'keyframe' && project.palette.length === 0) {
        throw new EditorCommandError(
          'invalid-command',
          'Add a palette colour before creating an effect layer.',
        );
      }
      const scene = project.scenes[sceneIndex(project, command.sceneId)];
      assertCollectionCapacity(
        scene.layers.length,
        PROJECT_LIMITS.layersPerScene,
        'Scenes',
      );
      const common = {
        enabled: true,
        endBeat: scene.loopLengthBeats,
        id: assertNewEntityId(project, command.id),
        locked: false,
        startBeat: 0,
        target: assertTarget(project, command.target),
      };
      const layer: SceneLayer =
        command.layerType === 'keyframe'
          ? parseCommandValue(KeyframeLayerSchema, {
              ...common,
              kind: 'keyframe',
              name: uniqueName(
                scene.layers.map(({ name }) => name),
                'Keyframes',
              ),
              tracks: {
                brightness: { keyframes: [] },
                colour: { interpolation: 'linear-rgb', keyframes: [] },
              },
            })
          : parseCommandValue(EffectLayerSchema, {
              ...common,
              effect:
                command.layerType === 'pulse'
                  ? {
                      cycleLengthBeats: 1,
                      maxBrightnessPercent: 100,
                      minBrightnessPercent: 0,
                      paletteTokenId: project.palette[0].id,
                      phaseOffsetBeats: 0,
                      type: 'pulse',
                      waveform: 'sine',
                    }
                  : {
                      brightnessPercent: 100,
                      direction: 'forward',
                      paletteTokenId: project.palette[0].id,
                      stepLengthBeats: 0.25,
                      trailLength: 0,
                      type: 'chase',
                      width: 1,
                    },
              kind: 'effect',
              name: uniqueName(
                scene.layers.map(({ name }) => name),
                command.layerType === 'pulse' ? 'Pulse' : 'Chase',
              ),
            });
      return updateScene(project, scene.id, (current) => ({
        ...current,
        layers: [...current.layers, layer],
      }));
    }
    case 'scene-layer-updated': {
      return updateScene(project, command.sceneId, (scene) => {
        const index = layerIndex(scene, command.id);
        const current = scene.layers[index];
        if (current.locked) {
          const keys = Object.keys(command.changes);
          if (keys.some((key) => key !== 'enabled' && key !== 'locked')) {
            throw new EditorCommandError(
              'locked-entity',
              `Layer "${current.name}" is locked.`,
            );
          }
        }
        const changes = { ...command.changes };
        if (changes.name !== undefined)
          changes.name = parseCommandValue(SceneLayerNameSchema, changes.name);
        if (changes.startBeat !== undefined)
          changes.startBeat = parseCommandValue(
            QuarterBeatSchema,
            changes.startBeat,
          );
        if (changes.endBeat !== undefined)
          changes.endBeat = parseCommandValue(
            PositiveQuarterBeatSchema,
            changes.endBeat,
          );
        if (changes.effect !== undefined) {
          if (current.kind !== 'effect') {
            throw new EditorCommandError(
              'invalid-command',
              'Only effect layers can update an effect.',
            );
          }
          changes.effect = parseCommandValue(EffectSchema, changes.effect);
        }
        if (
          changes.colourInterpolation !== undefined &&
          current.kind !== 'keyframe'
        ) {
          throw new EditorCommandError(
            'invalid-command',
            'Only keyframe layers have colour interpolation.',
          );
        }
        if (changes.target !== undefined)
          changes.target = assertTarget(project, changes.target);
        const { colourInterpolation, ...layerChanges } = changes;
        const next = {
          ...current,
          ...layerChanges,
          ...(current.kind === 'keyframe' && colourInterpolation !== undefined
            ? {
                tracks: {
                  ...current.tracks,
                  colour: {
                    ...current.tracks.colour,
                    interpolation: colourInterpolation,
                  },
                },
              }
            : {}),
        } as SceneLayer;
        if (next.endBeat <= next.startBeat) {
          throw new EditorCommandError(
            'invalid-command',
            'Layer end must be after its start.',
          );
        }
        if (next.endBeat > scene.loopLengthBeats) {
          throw new EditorCommandError(
            'invalid-command',
            'Layer must end within the scene loop.',
          );
        }
        assertUniqueLayerName(scene, next.name, current.id);
        if (sceneLayersEqual(next, current)) return scene;
        const layers = [...scene.layers];
        layers[index] = next;
        return { ...scene, layers };
      });
    }
    case 'scene-layer-duplicated': {
      return updateScene(project, command.sceneId, (scene) => {
        assertCollectionCapacity(
          scene.layers.length,
          PROJECT_LIMITS.layersPerScene,
          'Scenes',
        );
        const index = layerIndex(scene, command.id);
        const source = scene.layers[index];
        const expectedKeyframes =
          source.kind === 'keyframe'
            ? source.tracks.brightness.keyframes.length +
              source.tracks.colour.keyframes.length
            : 0;
        if (command.keyframeIds.length !== expectedKeyframes) {
          throw new EditorCommandError(
            'invalid-command',
            'Layer duplication requires one new ID per keyframe.',
          );
        }
        const [duplicateId, ...keyframeIds] = assertNewEntityIds(project, [
          command.newId,
          ...command.keyframeIds,
        ]);
        let duplicate: SceneLayer = {
          ...structuredClone(source),
          id: duplicateId,
          locked: false,
          name: uniqueName(
            scene.layers.map(({ name }) => name),
            `${source.name} Copy`,
          ),
        };
        if (duplicate.kind === 'keyframe') {
          const brightnessCount = duplicate.tracks.brightness.keyframes.length;
          duplicate = {
            ...duplicate,
            tracks: {
              brightness: {
                keyframes: duplicate.tracks.brightness.keyframes.map(
                  (keyframe, keyframeIndex) => ({
                    ...keyframe,
                    id: keyframeIds[keyframeIndex],
                  }),
                ),
              },
              colour: {
                ...duplicate.tracks.colour,
                keyframes: duplicate.tracks.colour.keyframes.map(
                  (keyframe, keyframeIndex) => ({
                    ...keyframe,
                    id: keyframeIds[brightnessCount + keyframeIndex],
                  }),
                ),
              },
            },
          };
        }
        duplicate = parseCommandValue(SceneLayerSchema, duplicate);
        const layers = [...scene.layers];
        layers.splice(index + 1, 0, duplicate);
        return { ...scene, layers };
      });
    }
    case 'scene-layer-deleted': {
      return updateScene(project, command.sceneId, (scene) => {
        const index = layerIndex(scene, command.id);
        if (scene.layers[index].locked) {
          throw new EditorCommandError(
            'locked-entity',
            `Layer "${scene.layers[index].name}" is locked.`,
          );
        }
        return {
          ...scene,
          layers: scene.layers.filter((_, position) => position !== index),
        };
      });
    }
    case 'scene-layer-moved': {
      return updateScene(project, command.sceneId, (scene) => {
        const index = layerIndex(scene, command.id);
        if (scene.layers[index].locked) {
          throw new EditorCommandError(
            'locked-entity',
            `Layer "${scene.layers[index].name}" is locked.`,
          );
        }
        if (!Number.isInteger(command.toIndex)) {
          throw new EditorCommandError(
            'invalid-command',
            'Layer position must be an integer.',
          );
        }
        const toIndex = Math.max(
          0,
          Math.min(scene.layers.length - 1, command.toIndex),
        );
        if (toIndex === index) return scene;
        const layers = [...scene.layers];
        const [layer] = layers.splice(index, 1);
        layers.splice(toIndex, 0, layer);
        return { ...scene, layers };
      });
    }
    case 'scene-layer-pasted': {
      return updateScene(project, command.sceneId, (scene) => {
        assertCollectionCapacity(
          scene.layers.length,
          PROJECT_LIMITS.layersPerScene,
          'Scenes',
        );
        if (!Number.isInteger(command.toIndex))
          throw new EditorCommandError(
            'invalid-command',
            'Layer position must be an integer.',
          );
        const nestedIds =
          command.layer.kind === 'keyframe'
            ? [
                ...command.layer.tracks.brightness.keyframes.map(
                  ({ id }) => id,
                ),
                ...command.layer.tracks.colour.keyframes.map(({ id }) => id),
              ]
            : [];
        assertNewEntityIds(project, [command.layer.id, ...nestedIds]);
        if (
          command.layer.startBeat < 0 ||
          command.layer.endBeat > scene.loopLengthBeats
        )
          throw new EditorCommandError(
            'invalid-command',
            'Pasted layer must fit within the scene loop.',
          );
        const target = assertTarget(project, command.layer.target);
        if (command.layer.kind === 'effect')
          tokenIndex(project, command.layer.effect.paletteTokenId);
        else
          command.layer.tracks.colour.keyframes.forEach(({ paletteTokenId }) =>
            tokenIndex(project, paletteTokenId),
          );
        const layer = parseCommandValue(SceneLayerSchema, {
          ...command.layer,
          locked: false,
          name: uniqueName(
            scene.layers.map(({ name }) => name),
            command.layer.name,
          ),
          target,
        });
        const layers = [...scene.layers];
        layers.splice(
          Math.max(0, Math.min(layers.length, command.toIndex)),
          0,
          layer,
        );
        return { ...scene, layers };
      });
    }
    case 'keyframes-easing-set': {
      return updateScene(project, command.sceneId, (scene) => {
        const layerPosition = layerIndex(scene, command.layerId);
        const layer = scene.layers[layerPosition];
        if (layer.kind !== 'keyframe')
          throw new EditorCommandError(
            'invalid-command',
            'Easing can only be updated in a keyframe layer.',
          );
        if (layer.locked)
          throw new EditorCommandError(
            'locked-entity',
            `Layer "${layer.name}" is locked.`,
          );
        if (command.keyframes.length === 0) return scene;
        const easing = parseCommandValue(KeyframeEasingSchema, command.easing);
        const selected = {
          brightness: new Set<string>(),
          colour: new Set<string>(),
        };
        command.keyframes.forEach(({ id, track }) => {
          if (selected[track].has(id))
            throw new EditorCommandError(
              'invalid-command',
              'A keyframe easing can only be updated once per command.',
            );
          if (!layer.tracks[track].keyframes.some((key) => key.id === id))
            throw new EditorCommandError(
              'missing-entity',
              `Keyframe "${id}" does not exist.`,
            );
          selected[track].add(id);
        });
        let changed = false;
        const updateTrack = <T extends { easing: KeyframeEasing; id: string }>(
          keyframes: readonly T[],
          ids: ReadonlySet<string>,
        ): T[] =>
          keyframes.map((keyframe) => {
            if (!ids.has(keyframe.id) || keyframe.easing === easing)
              return keyframe;
            changed = true;
            return { ...keyframe, easing };
          });
        const brightness = updateTrack(
          layer.tracks.brightness.keyframes,
          selected.brightness,
        );
        const colour = updateTrack(
          layer.tracks.colour.keyframes,
          selected.colour,
        );
        if (!changed) return scene;
        const layers = [...scene.layers];
        layers[layerPosition] = {
          ...layer,
          tracks: {
            brightness: { keyframes: brightness },
            colour: { ...layer.tracks.colour, keyframes: colour },
          },
        };
        return { ...scene, layers };
      });
    }
    case 'keyframes-moved': {
      return updateScene(project, command.sceneId, (scene) => {
        const layerPosition = layerIndex(scene, command.layerId);
        const layer = scene.layers[layerPosition];
        if (layer.kind !== 'keyframe')
          throw new EditorCommandError(
            'invalid-command',
            'Keyframes can only be moved in a keyframe layer.',
          );
        if (layer.locked)
          throw new EditorCommandError(
            'locked-entity',
            `Layer "${layer.name}" is locked.`,
          );
        if (command.keyframes.length === 0) return scene;
        const identities = new Set<string>();
        const movesByTrack = {
          brightness: new Map<string, number>(),
          colour: new Map<string, number>(),
        };
        command.keyframes.forEach((move) => {
          const identity = `${move.track}:${move.id}`;
          if (identities.has(identity))
            throw new EditorCommandError(
              'invalid-command',
              'A keyframe can only be moved once per command.',
            );
          identities.add(identity);
          const beat = parseCommandValue(QuarterBeatSchema, move.beat);
          if (beat > scene.loopLengthBeats)
            throw new EditorCommandError(
              'invalid-command',
              'Keyframe must be within the scene loop.',
            );
          movesByTrack[move.track].set(move.id, beat);
        });

        function moveTrack<T extends { beat: number; id: string }>(
          track: KeyframeTrackKind,
          keyframes: readonly T[],
        ): T[] {
          const moves = movesByTrack[track];
          if (moves.size === 0) return keyframes as T[];
          const existingIds = new Set(keyframes.map(({ id }) => id));
          moves.forEach((_, id) => {
            if (!existingIds.has(id))
              throw new EditorCommandError(
                'missing-entity',
                `Keyframe "${id}" does not exist.`,
              );
          });
          const occupied = new Set(
            keyframes
              .filter(({ id }) => !moves.has(id))
              .map(({ beat }) => beat),
          );
          moves.forEach((beat) => {
            if (occupied.has(beat))
              throw new EditorCommandError(
                'invalid-command',
                'A keyframe already exists at a destination beat.',
              );
            occupied.add(beat);
          });
          if (
            keyframes.every(
              (keyframe) =>
                (moves.get(keyframe.id) ?? keyframe.beat) === keyframe.beat,
            )
          )
            return keyframes as T[];
          return keyframes
            .map((keyframe) => ({
              ...keyframe,
              beat: moves.get(keyframe.id) ?? keyframe.beat,
            }))
            .sort((left, right) => left.beat - right.beat);
        }

        const brightness = moveTrack(
          'brightness',
          layer.tracks.brightness.keyframes,
        );
        const colour = moveTrack('colour', layer.tracks.colour.keyframes);
        const changed =
          brightness.some(
            (keyframe, index) =>
              keyframe !== layer.tracks.brightness.keyframes[index],
          ) ||
          colour.some(
            (keyframe, index) =>
              keyframe !== layer.tracks.colour.keyframes[index],
          );
        if (!changed) return scene;
        const layers = [...scene.layers];
        layers[layerPosition] = {
          ...layer,
          tracks: {
            brightness: { keyframes: brightness },
            colour: { ...layer.tracks.colour, keyframes: colour },
          },
        };
        return { ...scene, layers };
      });
    }
    case 'keyframes-deleted': {
      return updateScene(project, command.sceneId, (scene) => {
        const layerPosition = layerIndex(scene, command.layerId);
        const layer = scene.layers[layerPosition];
        if (layer.kind !== 'keyframe')
          throw new EditorCommandError(
            'invalid-command',
            'Keyframes can only be deleted from a keyframe layer.',
          );
        if (layer.locked)
          throw new EditorCommandError(
            'locked-entity',
            `Layer "${layer.name}" is locked.`,
          );
        const deleteIds = {
          brightness: new Set<string>(),
          colour: new Set<string>(),
        };
        command.keyframes.forEach(({ id, track }) => {
          if (deleteIds[track].has(id))
            throw new EditorCommandError(
              'invalid-command',
              'A keyframe can only be deleted once per command.',
            );
          if (!layer.tracks[track].keyframes.some((key) => key.id === id))
            throw new EditorCommandError(
              'missing-entity',
              `Keyframe "${id}" does not exist.`,
            );
          deleteIds[track].add(id);
        });
        if (command.keyframes.length === 0) return scene;
        const layers = [...scene.layers];
        layers[layerPosition] = {
          ...layer,
          tracks: {
            brightness: {
              keyframes: layer.tracks.brightness.keyframes.filter(
                ({ id }) => !deleteIds.brightness.has(id),
              ),
            },
            colour: {
              ...layer.tracks.colour,
              keyframes: layer.tracks.colour.keyframes.filter(
                ({ id }) => !deleteIds.colour.has(id),
              ),
            },
          },
        };
        return { ...scene, layers };
      });
    }
    case 'keyframes-pasted': {
      return updateScene(project, command.sceneId, (scene) => {
        const layerPosition = layerIndex(scene, command.layerId);
        const layer = scene.layers[layerPosition];
        if (layer.kind !== 'keyframe')
          throw new EditorCommandError(
            'invalid-command',
            'Keyframes can only be pasted into a keyframe layer.',
          );
        if (layer.locked)
          throw new EditorCommandError(
            'locked-entity',
            `Layer "${layer.name}" is locked.`,
          );
        if (command.keyframes.length === 0) return scene;
        const brightnessInput = command.keyframes.filter(
          (
            keyframe,
          ): keyframe is Extract<PastedKeyframe, { track: 'brightness' }> =>
            keyframe.track === 'brightness',
        );
        const colourInput = command.keyframes.filter(
          (
            keyframe,
          ): keyframe is Extract<PastedKeyframe, { track: 'colour' }> =>
            keyframe.track === 'colour',
        );
        if (
          layer.tracks.brightness.keyframes.length + brightnessInput.length >
            PROJECT_LIMITS.keyframesPerTrack ||
          layer.tracks.colour.keyframes.length + colourInput.length >
            PROJECT_LIMITS.keyframesPerTrack
        )
          throw new EditorCommandError(
            'invalid-command',
            `Tracks cannot contain more than ${PROJECT_LIMITS.keyframesPerTrack} keyframes.`,
          );
        assertNewEntityIds(
          project,
          command.keyframes.map(({ id }) => id),
        );

        function assertFreeBeats(
          existing: readonly { beat: number }[],
          incoming: readonly { beat: number }[],
        ) {
          const occupied = new Set(existing.map(({ beat }) => beat));
          incoming.forEach(({ beat }) => {
            const parsedBeat = parseCommandValue(QuarterBeatSchema, beat);
            if (parsedBeat > scene.loopLengthBeats || occupied.has(parsedBeat))
              throw new EditorCommandError(
                'invalid-command',
                parsedBeat > scene.loopLengthBeats
                  ? 'Pasted keyframes must fit within the scene loop.'
                  : 'A keyframe already exists at a destination beat.',
              );
            occupied.add(parsedBeat);
          });
        }
        assertFreeBeats(layer.tracks.brightness.keyframes, brightnessInput);
        assertFreeBeats(layer.tracks.colour.keyframes, colourInput);
        const brightness = brightnessInput.map((keyframe) =>
          parseCommandValue(BrightnessKeyframeSchema, {
            beat: keyframe.beat,
            brightnessPercent: keyframe.brightnessPercent,
            easing: keyframe.easing,
            id: keyframe.id,
          }),
        );
        const colour = colourInput.map((keyframe) => {
          tokenIndex(project, keyframe.paletteTokenId);
          return parseCommandValue(ColourKeyframeSchema, {
            beat: keyframe.beat,
            easing: keyframe.easing,
            id: keyframe.id,
            paletteTokenId: keyframe.paletteTokenId,
          });
        });
        const layers = [...scene.layers];
        layers[layerPosition] = {
          ...layer,
          tracks: {
            brightness: {
              keyframes: [
                ...layer.tracks.brightness.keyframes,
                ...brightness,
              ].sort((left, right) => left.beat - right.beat),
            },
            colour: {
              ...layer.tracks.colour,
              keyframes: [...layer.tracks.colour.keyframes, ...colour].sort(
                (left, right) => left.beat - right.beat,
              ),
            },
          },
        };
        return { ...scene, layers };
      });
    }
    case 'keyframe-added': {
      return updateScene(project, command.sceneId, (scene) => {
        const layerPosition = layerIndex(scene, command.layerId);
        const layer = scene.layers[layerPosition];
        if (layer.kind !== 'keyframe') {
          throw new EditorCommandError(
            'invalid-command',
            'Keyframes can only be added to a keyframe layer.',
          );
        }
        if (layer.locked)
          throw new EditorCommandError(
            'locked-entity',
            `Layer "${layer.name}" is locked.`,
          );
        if (command.beat > scene.loopLengthBeats) {
          throw new EditorCommandError(
            'invalid-command',
            'Keyframe must be within the scene loop.',
          );
        }
        const track = layer.tracks[command.value.track];
        if (track.keyframes.length >= PROJECT_LIMITS.keyframesPerTrack) {
          throw new EditorCommandError(
            'invalid-command',
            `Tracks cannot contain more than ${PROJECT_LIMITS.keyframesPerTrack} keyframes.`,
          );
        }
        if (track.keyframes.some(({ beat }) => beat === command.beat)) {
          throw new EditorCommandError(
            'invalid-command',
            'A keyframe already exists at this beat.',
          );
        }
        const keyframe =
          command.value.track === 'brightness'
            ? parseCommandValue(BrightnessKeyframeSchema, {
                beat: command.beat,
                brightnessPercent: command.value.brightnessPercent,
                easing: command.value.easing,
                id: assertNewEntityId(project, command.id),
              })
            : parseCommandValue(ColourKeyframeSchema, {
                beat: command.beat,
                easing: command.value.easing,
                id: assertNewEntityId(project, command.id),
                paletteTokenId:
                  project.palette[
                    tokenIndex(project, command.value.paletteTokenId)
                  ].id,
              });
        const nextLayer: KeyframeLayer =
          command.value.track === 'brightness'
            ? {
                ...layer,
                tracks: {
                  ...layer.tracks,
                  brightness: {
                    keyframes: insertKeyframeByBeat(
                      layer.tracks.brightness.keyframes,
                      keyframe as BrightnessKeyframe,
                    ),
                  },
                },
              }
            : {
                ...layer,
                tracks: {
                  ...layer.tracks,
                  colour: {
                    ...layer.tracks.colour,
                    keyframes: insertKeyframeByBeat(
                      layer.tracks.colour.keyframes,
                      keyframe as ColourKeyframe,
                    ),
                  },
                },
              };
        const layers = [...scene.layers];
        layers[layerPosition] = nextLayer;
        return { ...scene, layers };
      });
    }
    case 'keyframe-updated': {
      return updateScene(project, command.sceneId, (scene) => {
        const layerPosition = layerIndex(scene, command.layerId);
        const layer = scene.layers[layerPosition];
        if (layer.kind !== 'keyframe')
          throw new EditorCommandError(
            'invalid-command',
            'Keyframes can only be updated in a keyframe layer.',
          );
        if (layer.locked)
          throw new EditorCommandError(
            'locked-entity',
            `Layer "${layer.name}" is locked.`,
          );
        let nextLayer: KeyframeLayer;
        if (command.track === 'brightness') {
          const track = layer.tracks.brightness;
          const keyframePosition = track.keyframes.findIndex(
            ({ id }) => id === command.id,
          );
          if (keyframePosition < 0)
            throw new EditorCommandError(
              'missing-entity',
              `Keyframe "${command.id}" does not exist.`,
            );
          const current = track.keyframes[keyframePosition];
          const beat = parseCommandValue(
            QuarterBeatSchema,
            command.changes.beat ?? current.beat,
          );
          if (beat > scene.loopLengthBeats)
            throw new EditorCommandError(
              'invalid-command',
              'Keyframe must be within the scene loop.',
            );
          if (
            track.keyframes.some(
              (candidate) =>
                candidate.id !== command.id && candidate.beat === beat,
            )
          )
            throw new EditorCommandError(
              'invalid-command',
              'A keyframe already exists at this beat.',
            );
          const nextKeyframe = parseCommandValue(BrightnessKeyframeSchema, {
            ...current,
            beat,
            brightnessPercent:
              command.changes.brightnessPercent ?? current.brightnessPercent,
            easing: command.changes.easing ?? current.easing,
          });
          if (
            nextKeyframe.beat === current.beat &&
            nextKeyframe.brightnessPercent === current.brightnessPercent &&
            nextKeyframe.easing === current.easing
          )
            return scene;
          const keyframes =
            beat === current.beat
              ? track.keyframes.map((keyframe, index) =>
                  index === keyframePosition ? nextKeyframe : keyframe,
                )
              : insertKeyframeByBeat(
                  track.keyframes.filter(
                    (_, index) => index !== keyframePosition,
                  ),
                  nextKeyframe,
                );
          nextLayer = {
            ...layer,
            tracks: {
              ...layer.tracks,
              brightness: { keyframes },
            },
          };
        } else {
          const track = layer.tracks.colour;
          const keyframePosition = track.keyframes.findIndex(
            ({ id }) => id === command.id,
          );
          if (keyframePosition < 0)
            throw new EditorCommandError(
              'missing-entity',
              `Keyframe "${command.id}" does not exist.`,
            );
          const current = track.keyframes[keyframePosition];
          const beat = parseCommandValue(
            QuarterBeatSchema,
            command.changes.beat ?? current.beat,
          );
          if (beat > scene.loopLengthBeats)
            throw new EditorCommandError(
              'invalid-command',
              'Keyframe must be within the scene loop.',
            );
          if (
            track.keyframes.some(
              (candidate) =>
                candidate.id !== command.id && candidate.beat === beat,
            )
          )
            throw new EditorCommandError(
              'invalid-command',
              'A keyframe already exists at this beat.',
            );
          const nextKeyframe = parseCommandValue(ColourKeyframeSchema, {
            ...current,
            beat,
            easing: command.changes.easing ?? current.easing,
            paletteTokenId:
              command.changes.paletteTokenId ?? current.paletteTokenId,
          });
          tokenIndex(project, nextKeyframe.paletteTokenId);
          if (
            nextKeyframe.beat === current.beat &&
            nextKeyframe.paletteTokenId === current.paletteTokenId &&
            nextKeyframe.easing === current.easing
          )
            return scene;
          const keyframes =
            beat === current.beat
              ? track.keyframes.map((keyframe, index) =>
                  index === keyframePosition ? nextKeyframe : keyframe,
                )
              : insertKeyframeByBeat(
                  track.keyframes.filter(
                    (_, index) => index !== keyframePosition,
                  ),
                  nextKeyframe,
                );
          nextLayer = {
            ...layer,
            tracks: {
              ...layer.tracks,
              colour: { ...track, keyframes },
            },
          };
        }
        const layers = [...scene.layers];
        layers[layerPosition] = nextLayer;
        return { ...scene, layers };
      });
    }
    case 'keyframe-duplicated': {
      const scene = project.scenes[sceneIndex(project, command.sceneId)];
      const layer = scene.layers[layerIndex(scene, command.layerId)];
      if (layer.kind !== 'keyframe')
        throw new EditorCommandError(
          'invalid-command',
          'Keyframes can only be duplicated in a keyframe layer.',
        );
      const source = layer.tracks[command.track].keyframes.find(
        ({ id }) => id === command.id,
      );
      if (!source)
        throw new EditorCommandError(
          'missing-entity',
          `Keyframe "${command.id}" does not exist.`,
        );
      return applyEditorCommand(project, {
        beat: command.newBeat,
        id: command.newId,
        layerId: command.layerId,
        sceneId: command.sceneId,
        type: 'keyframe-added',
        value:
          command.track === 'brightness'
            ? {
                brightnessPercent: (source as { brightnessPercent: number })
                  .brightnessPercent,
                easing: source.easing,
                track: 'brightness',
              }
            : {
                easing: source.easing,
                paletteTokenId: (source as { paletteTokenId: string })
                  .paletteTokenId,
                track: 'colour',
              },
      });
    }
    case 'keyframe-deleted': {
      return updateScene(project, command.sceneId, (scene) => {
        const layerPosition = layerIndex(scene, command.layerId);
        const layer = scene.layers[layerPosition];
        if (layer.kind !== 'keyframe')
          throw new EditorCommandError(
            'invalid-command',
            'Keyframes can only be deleted from a keyframe layer.',
          );
        if (layer.locked)
          throw new EditorCommandError(
            'locked-entity',
            `Layer "${layer.name}" is locked.`,
          );
        const track = layer.tracks[command.track];
        if (!track.keyframes.some(({ id }) => id === command.id))
          throw new EditorCommandError(
            'missing-entity',
            `Keyframe "${command.id}" does not exist.`,
          );
        const nextLayer: KeyframeLayer =
          command.track === 'brightness'
            ? {
                ...layer,
                tracks: {
                  ...layer.tracks,
                  brightness: {
                    keyframes: layer.tracks.brightness.keyframes.filter(
                      ({ id }) => id !== command.id,
                    ),
                  },
                },
              }
            : {
                ...layer,
                tracks: {
                  ...layer.tracks,
                  colour: {
                    ...layer.tracks.colour,
                    keyframes: layer.tracks.colour.keyframes.filter(
                      ({ id }) => id !== command.id,
                    ),
                  },
                },
              };
        const layers = [...scene.layers];
        layers[layerPosition] = nextLayer;
        return { ...scene, layers };
      });
    }
  }
}

export function executeEditorCommand(
  history: EditorHistory,
  command: EditorCommand,
  { historyGroupId }: ExecuteEditorCommandOptions = {},
): EditorHistoryTransition {
  const project = applyEditorCommand(history.present.project, command);
  return commitEditorProject(history, project, historyGroupId);
}
