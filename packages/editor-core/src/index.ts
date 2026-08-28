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
  KeyframeLayerSchema,
  LayerTargetSchema,
  PaletteTokenNameSchema,
  PaletteTokenSchema,
  PROJECT_SCHEMA_VERSION,
  ProjectEntityIdSchema,
  ProjectGroupNameSchema,
  ProjectGroupSchema,
  ProjectNameSchema,
  ProjectTimingSchema,
  SceneBrightnessPercentSchema,
  SceneLayerNameSchema,
  SceneLayerSchema,
  SceneLoopLengthSchema,
  SceneNameSchema,
  parseProject,
  type PaletteToken,
  type Effect,
  type EffectLayer,
  type KeyframeLayer,
  type LayerTarget,
  type Project,
  type ProjectGroup,
  type ProjectTiming,
  type Scene,
  type SceneLayer,
} from '@led-studio/project-format';

export const MAX_EDITOR_HISTORY_REVISIONS = 200;

export type KeyframeTrackKind = 'brightness' | 'colour';

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
  | { brightnessPercent: number; track: 'brightness' }
  | { paletteTokenId: string; track: 'colour' };

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
        paletteTokenId?: string;
      };
      id: string;
      layerId: string;
      sceneId: string;
      track: KeyframeTrackKind;
      type: 'keyframe-updated';
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

export interface EditorRevision {
  historyGroupId: string | null;
  project: Project;
  revision: number;
}

export interface EditorHistory {
  future: EditorRevision[];
  nextRevision: number;
  past: EditorRevision[];
  present: EditorRevision;
}

export interface ExecuteEditorCommandOptions {
  historyGroupId?: string;
}

export interface EditorHistoryTransition {
  changed: boolean;
  history: EditorHistory;
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

function allEntityIds(project: Project): Set<string> {
  return new Set([
    ...project.palette.map((token) => token.id),
    ...project.groups.map((group) => group.id),
    ...project.scenes.map((scene) => scene.id),
    ...project.scenes.flatMap((scene) => scene.layers.map((layer) => layer.id)),
    ...project.scenes.flatMap((scene) =>
      scene.layers.flatMap((layer) =>
        layer.kind === 'keyframe'
          ? [
              ...layer.tracks.brightness.keyframes.map(({ id }) => id),
              ...layer.tracks.colour.keyframes.map(({ id }) => id),
            ]
          : [],
      ),
    ),
  ]);
}

function createEntityId(
  project: Project,
  idFactory: ProjectEntityIdFactory,
): string {
  const existingIds = allEntityIds(project);
  let id = ProjectEntityIdSchema.parse(idFactory());
  while (existingIds.has(id)) id = ProjectEntityIdSchema.parse(idFactory());
  return id;
}

function assertNewEntityId(project: Project, id: string): string {
  const parsedId = parseCommandValue(ProjectEntityIdSchema, id);
  if (allEntityIds(project).has(parsedId)) {
    throw new EditorCommandError(
      'duplicate-entity-id',
      `Entity ID "${parsedId}" is already in use.`,
    );
  }
  return parsedId;
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

export function paletteTokenUsageCount(project: Project, id: string): number {
  return project.scenes.reduce(
    (total, scene) =>
      total +
      Object.values(scene.ledStates).filter(
        (state) => state.paletteTokenId === id,
      ).length +
      scene.layers.reduce(
        (layerTotal, layer) =>
          layerTotal +
          (layer.kind === 'effect' && layer.effect.paletteTokenId === id
            ? 1
            : 0) +
          (layer.kind === 'keyframe'
            ? layer.tracks.colour.keyframes.filter(
                (keyframe) => keyframe.paletteTokenId === id,
              ).length
            : 0),
        0,
      ),
    0,
  );
}

export function projectGroupUsageCount(project: Project, id: string): number {
  return project.scenes.reduce(
    (total, scene) =>
      total +
      scene.layers.filter(
        (layer) =>
          layer.target.kind === 'project-group' && layer.target.groupId === id,
      ).length,
    0,
  );
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
  const reserved = allEntityIds(project);
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
  const reserved = allEntityIds(project);
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
      const duplicateId = assertNewEntityId(project, command.id);
      const duplicateIds = new Set([duplicateId]);
      const layerIds = command.layerIds.map((id) => {
        const parsed = assertNewEntityId(project, id);
        if (duplicateIds.has(parsed)) {
          throw new EditorCommandError(
            'duplicate-entity-id',
            `Entity ID "${parsed}" is already in use.`,
          );
        }
        duplicateIds.add(parsed);
        return parsed;
      });
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
        const nextKeyframeIds = command.keyframeIds[index].map((id) => {
          const parsed = assertNewEntityId(project, id);
          if (duplicateIds.has(parsed)) {
            throw new EditorCommandError(
              'duplicate-entity-id',
              `Entity ID "${parsed}" is already in use.`,
            );
          }
          duplicateIds.add(parsed);
          return parsed;
        });
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
        const candidate = {
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
        };
        const next = parseCommandValue(SceneLayerSchema, candidate);
        if (next.endBeat > scene.loopLengthBeats) {
          throw new EditorCommandError(
            'invalid-command',
            'Layer must end within the scene loop.',
          );
        }
        assertUniqueLayerName(scene, next.name, current.id);
        if (JSON.stringify(next) === JSON.stringify(current)) return scene;
        const layers = [...scene.layers];
        layers[index] = next;
        return { ...scene, layers };
      });
    }
    case 'scene-layer-duplicated': {
      return updateScene(project, command.sceneId, (scene) => {
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
        const duplicateIds = new Set<string>();
        const keyframeIds = command.keyframeIds.map((id) => {
          const parsed = assertNewEntityId(project, id);
          if (duplicateIds.has(parsed)) {
            throw new EditorCommandError(
              'duplicate-entity-id',
              `Entity ID "${parsed}" is already in use.`,
            );
          }
          duplicateIds.add(parsed);
          return parsed;
        });
        const duplicateId = assertNewEntityId(project, command.newId);
        if (duplicateIds.has(duplicateId)) {
          throw new EditorCommandError(
            'duplicate-entity-id',
            `Entity ID "${duplicateId}" is already in use.`,
          );
        }
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
                id: assertNewEntityId(project, command.id),
              })
            : parseCommandValue(ColourKeyframeSchema, {
                beat: command.beat,
                id: assertNewEntityId(project, command.id),
                paletteTokenId:
                  project.palette[
                    tokenIndex(project, command.value.paletteTokenId)
                  ].id,
              });
        const nextLayer: KeyframeLayer = {
          ...layer,
          tracks: {
            ...layer.tracks,
            [command.value.track]: {
              ...track,
              keyframes: [...track.keyframes, keyframe].sort(
                (left, right) => left.beat - right.beat,
              ),
            },
          },
        } as KeyframeLayer;
        const layers = [...scene.layers];
        layers[layerPosition] = parseCommandValue(
          KeyframeLayerSchema,
          nextLayer,
        );
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
        const track = layer.tracks[command.track];
        const keyframePosition = track.keyframes.findIndex(
          ({ id }) => id === command.id,
        );
        if (keyframePosition < 0)
          throw new EditorCommandError(
            'missing-entity',
            `Keyframe "${command.id}" does not exist.`,
          );
        const current = track.keyframes[keyframePosition];
        const beat = command.changes.beat ?? current.beat;
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
        const nextKeyframe =
          command.track === 'brightness'
            ? parseCommandValue(BrightnessKeyframeSchema, {
                ...current,
                beat,
                brightnessPercent:
                  command.changes.brightnessPercent ??
                  ('brightnessPercent' in current
                    ? current.brightnessPercent
                    : undefined),
              })
            : parseCommandValue(ColourKeyframeSchema, {
                ...current,
                beat,
                paletteTokenId:
                  command.changes.paletteTokenId ??
                  ('paletteTokenId' in current
                    ? current.paletteTokenId
                    : undefined),
              });
        if ('paletteTokenId' in nextKeyframe)
          tokenIndex(project, nextKeyframe.paletteTokenId);
        if (JSON.stringify(nextKeyframe) === JSON.stringify(current))
          return scene;
        const keyframes = [...track.keyframes];
        keyframes[keyframePosition] = nextKeyframe as never;
        keyframes.sort((left, right) => left.beat - right.beat);
        const layers = [...scene.layers];
        layers[layerPosition] = parseCommandValue(KeyframeLayerSchema, {
          ...layer,
          tracks: {
            ...layer.tracks,
            [command.track]: { ...track, keyframes },
          },
        });
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
                track: 'brightness',
              }
            : {
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
        const layers = [...scene.layers];
        layers[layerPosition] = parseCommandValue(KeyframeLayerSchema, {
          ...layer,
          tracks: {
            ...layer.tracks,
            [command.track]: {
              ...track,
              keyframes: track.keyframes.filter(({ id }) => id !== command.id),
            },
          },
        });
        return { ...scene, layers };
      });
    }
  }
}

export function createEditorHistory(project: Project): EditorHistory {
  return {
    future: [],
    nextRevision: 1,
    past: [],
    present: { historyGroupId: null, project, revision: 0 },
  };
}

export function executeEditorCommand(
  history: EditorHistory,
  command: EditorCommand,
  { historyGroupId }: ExecuteEditorCommandOptions = {},
): EditorHistoryTransition {
  const project = applyEditorCommand(history.present.project, command);
  if (project === history.present.project) return { changed: false, history };

  const groupId = historyGroupId ?? null;
  const replacePresent =
    groupId !== null && history.present.historyGroupId === groupId;
  const past = replacePresent
    ? history.past
    : [...history.past, history.present].slice(-MAX_EDITOR_HISTORY_REVISIONS);

  return {
    changed: true,
    history: {
      future: [],
      nextRevision: history.nextRevision + 1,
      past,
      present: {
        historyGroupId: groupId,
        project,
        revision: history.nextRevision,
      },
    },
  };
}

export function undoEditorHistory(history: EditorHistory): EditorHistory {
  const present = history.past.at(-1);
  if (!present) return history;
  return {
    ...history,
    future: [history.present, ...history.future],
    past: history.past.slice(0, -1),
    present,
  };
}

export function redoEditorHistory(history: EditorHistory): EditorHistory {
  const [present, ...future] = history.future;
  if (!present) return history;
  return {
    ...history,
    future,
    past: [...history.past, history.present].slice(
      -MAX_EDITOR_HISTORY_REVISIONS,
    ),
    present,
  };
}
