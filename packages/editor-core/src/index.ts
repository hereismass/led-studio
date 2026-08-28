import {
  getHardwareProfile,
  type HardwareProfile,
} from '@led-studio/hardware-profiles';
import {
  DEFAULT_PROJECT_TIMING,
  HexColourSchema,
  EffectLayerNameSchema,
  EffectLayerSchema,
  EffectSchema,
  EffectTargetSchema,
  PaletteTokenNameSchema,
  PaletteTokenSchema,
  PROJECT_SCHEMA_VERSION,
  ProjectEntityIdSchema,
  ProjectGroupNameSchema,
  ProjectGroupSchema,
  ProjectNameSchema,
  ProjectTimingSchema,
  SceneBrightnessPercentSchema,
  SceneLoopLengthSchema,
  SceneNameSchema,
  parseProject,
  type PaletteToken,
  type Effect,
  type EffectLayer,
  type EffectTarget,
  type Project,
  type ProjectGroup,
  type ProjectTiming,
  type Scene,
} from '@led-studio/project-format';

export const MAX_EDITOR_HISTORY_REVISIONS = 200;

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
      effectType: Effect['type'];
      id: string;
      sceneId: string;
      target: EffectTarget;
      type: 'effect-layer-added';
    }
  | {
      changes: Partial<Omit<EffectLayer, 'id'>>;
      id: string;
      sceneId: string;
      type: 'effect-layer-updated';
    }
  | {
      id: string;
      newId: string;
      sceneId: string;
      type: 'effect-layer-duplicated';
    }
  | { id: string; sceneId: string; type: 'effect-layer-deleted' }
  | {
      id: string;
      sceneId: string;
      toIndex: number;
      type: 'effect-layer-moved';
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
      `Effect layer "${id}" does not exist.`,
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
      `Effect layer name "${name}" is already in use.`,
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

function assertTarget(project: Project, target: EffectTarget): EffectTarget {
  const parsed = parseCommandValue(EffectTargetSchema, target);
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
      scene.layers.filter((layer) => layer.effect.paletteTokenId === id).length,
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

export function createEffectLayerAddedCommand(
  project: Project,
  sceneId: string,
  effectType: Effect['type'],
  target: EffectTarget,
  idFactory: ProjectEntityIdFactory = generateProjectEntityId,
): Extract<EditorCommand, { type: 'effect-layer-added' }> {
  sceneIndex(project, sceneId);
  return {
    effectType,
    id: createEntityId(project, idFactory),
    sceneId,
    target: assertTarget(project, target),
    type: 'effect-layer-added',
  };
}

export function createEffectLayerDuplicatedCommand(
  project: Project,
  sceneId: string,
  id: string,
  idFactory: ProjectEntityIdFactory = generateProjectEntityId,
): Extract<EditorCommand, { type: 'effect-layer-duplicated' }> {
  layerIndex(project.scenes[sceneIndex(project, sceneId)], id);
  return {
    id,
    newId: createEntityId(project, idFactory),
    sceneId,
    type: 'effect-layer-duplicated',
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
      if (command.layerIds.length !== source.layers.length) {
        throw new EditorCommandError(
          'invalid-command',
          'Scene duplication requires one new ID per effect layer.',
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
      const duplicate: Scene = {
        ...structuredClone(source),
        id: duplicateId,
        layers: source.layers.map((layer, index) => ({
          ...structuredClone(layer),
          id: layerIds[index],
        })),
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
        if (scene.layers.some((layer) => layer.endBeat > loopLengthBeats)) {
          throw new EditorCommandError(
            'invalid-command',
            'Scene loop cannot end before an effect layer. Move or resize the layer first.',
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
          `This group is targeted by ${referenceCount} effect ${referenceCount === 1 ? 'layer' : 'layers'}.`,
          referenceCount,
        );
      }
      return {
        ...project,
        groups: project.groups.filter((_, position) => position !== index),
      };
    }
    case 'effect-layer-added': {
      if (project.palette.length === 0) {
        throw new EditorCommandError(
          'invalid-command',
          'Add a palette colour before creating an effect layer.',
        );
      }
      const scene = project.scenes[sceneIndex(project, command.sceneId)];
      const effect: Effect =
        command.effectType === 'pulse'
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
            };
      const layer = parseCommandValue(EffectLayerSchema, {
        effect,
        enabled: true,
        endBeat: scene.loopLengthBeats,
        id: assertNewEntityId(project, command.id),
        locked: false,
        name: uniqueName(
          scene.layers.map(({ name }) => name),
          command.effectType === 'pulse' ? 'Pulse' : 'Chase',
        ),
        startBeat: 0,
        target: assertTarget(project, command.target),
      });
      return updateScene(project, scene.id, (current) => ({
        ...current,
        layers: [...current.layers, layer],
      }));
    }
    case 'effect-layer-updated': {
      return updateScene(project, command.sceneId, (scene) => {
        const index = layerIndex(scene, command.id);
        const current = scene.layers[index];
        if (current.locked) {
          const keys = Object.keys(command.changes);
          if (keys.some((key) => key !== 'enabled' && key !== 'locked')) {
            throw new EditorCommandError(
              'locked-entity',
              `Effect layer "${current.name}" is locked.`,
            );
          }
        }
        const changes = { ...command.changes };
        if (changes.name !== undefined)
          changes.name = parseCommandValue(EffectLayerNameSchema, changes.name);
        if (changes.effect !== undefined)
          changes.effect = parseCommandValue(EffectSchema, changes.effect);
        if (changes.target !== undefined)
          changes.target = assertTarget(project, changes.target);
        const next = parseCommandValue(EffectLayerSchema, {
          ...current,
          ...changes,
        });
        if (next.endBeat > scene.loopLengthBeats) {
          throw new EditorCommandError(
            'invalid-command',
            'Effect layer must end within the scene loop.',
          );
        }
        assertUniqueLayerName(scene, next.name, current.id);
        if (JSON.stringify(next) === JSON.stringify(current)) return scene;
        const layers = [...scene.layers];
        layers[index] = next;
        return { ...scene, layers };
      });
    }
    case 'effect-layer-duplicated': {
      return updateScene(project, command.sceneId, (scene) => {
        const index = layerIndex(scene, command.id);
        const source = scene.layers[index];
        const duplicate = parseCommandValue(EffectLayerSchema, {
          ...structuredClone(source),
          id: assertNewEntityId(project, command.newId),
          locked: false,
          name: uniqueName(
            scene.layers.map(({ name }) => name),
            `${source.name} Copy`,
          ),
        });
        const layers = [...scene.layers];
        layers.splice(index + 1, 0, duplicate);
        return { ...scene, layers };
      });
    }
    case 'effect-layer-deleted': {
      return updateScene(project, command.sceneId, (scene) => {
        const index = layerIndex(scene, command.id);
        if (scene.layers[index].locked) {
          throw new EditorCommandError(
            'locked-entity',
            `Effect layer "${scene.layers[index].name}" is locked.`,
          );
        }
        return {
          ...scene,
          layers: scene.layers.filter((_, position) => position !== index),
        };
      });
    }
    case 'effect-layer-moved': {
      return updateScene(project, command.sceneId, (scene) => {
        const index = layerIndex(scene, command.id);
        if (scene.layers[index].locked) {
          throw new EditorCommandError(
            'locked-entity',
            `Effect layer "${scene.layers[index].name}" is locked.`,
          );
        }
        if (!Number.isInteger(command.toIndex)) {
          throw new EditorCommandError(
            'invalid-command',
            'Effect layer position must be an integer.',
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
