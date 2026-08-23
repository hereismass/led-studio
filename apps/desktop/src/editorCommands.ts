import { validateProjectHardwareReferences } from '@led-studio/hardware-profiles';
import {
  generateProjectEntityId,
  parseProject,
  type PaletteToken,
  type Project,
  type ProjectTiming,
  type Scene,
} from '@led-studio/project-format';

export type EditorCommand =
  | { name: string; type: 'project-renamed' }
  | { changes: Partial<ProjectTiming>; type: 'project-timing-updated' }
  | { type: 'palette-token-added' }
  | {
      id: string;
      changes: Partial<Pick<PaletteToken, 'name' | 'value'>>;
      type: 'palette-token-updated';
    }
  | { id: string; type: 'palette-token-duplicated' }
  | { id: string; type: 'palette-token-deleted' }
  | { type: 'scene-added' }
  | { id: string; type: 'scene-duplicated' }
  | { id: string; type: 'scene-deleted' }
  | {
      id: string;
      changes: Partial<Pick<Scene, 'loopLengthBeats' | 'name'>>;
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
  | { ledIds: string[]; sceneId: string; type: 'scene-leds-turned-off' };

export class EditorCommandError extends Error {
  readonly code = 'palette-token-in-use' as const;

  constructor(readonly referenceCount: number) {
    super(
      `This colour is used by ${referenceCount} scene ${referenceCount === 1 ? 'LED' : 'LEDs'}.`,
    );
    this.name = 'EditorCommandError';
  }
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

function createEntityId(project: Project): string {
  const existingIds = new Set([
    ...project.palette.map((token) => token.id),
    ...project.scenes.map((scene) => scene.id),
  ]);
  let id = generateProjectEntityId();
  while (existingIds.has(id)) id = generateProjectEntityId();
  return id;
}

function tokenIndex(project: Project, id: string): number {
  const index = project.palette.findIndex((token) => token.id === id);
  if (index === -1) throw new Error(`Palette token "${id}" does not exist`);
  return index;
}

function sceneIndex(project: Project, id: string): number {
  const index = project.scenes.findIndex((scene) => scene.id === id);
  if (index === -1) throw new Error(`Scene "${id}" does not exist`);
  return index;
}

function validatedProject(input: unknown): Project {
  const project = parseProject(input);
  validateProjectHardwareReferences(project);
  return project;
}

export function paletteTokenUsageCount(project: Project, id: string): number {
  return project.scenes.reduce(
    (total, scene) =>
      total +
      Object.values(scene.ledStates).filter(
        (state) => state.paletteTokenId === id,
      ).length,
    0,
  );
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
  return validatedProject({ ...project, scenes });
}

export function applyEditorCommand(
  project: Project,
  command: EditorCommand,
): Project {
  switch (command.type) {
    case 'project-renamed': {
      const name = command.name.trim();
      return name === project.name
        ? project
        : validatedProject({ ...project, name });
    }
    case 'project-timing-updated': {
      const timing = { ...project.timing, ...command.changes };
      if (
        timing.previewBpm === project.timing.previewBpm &&
        timing.timeSignature.numerator ===
          project.timing.timeSignature.numerator &&
        timing.timeSignature.denominator ===
          project.timing.timeSignature.denominator
      )
        return project;
      return validatedProject({ ...project, timing });
    }
    case 'palette-token-added': {
      const token: PaletteToken = {
        id: createEntityId(project),
        name: uniqueName(
          project.palette.map(({ name }) => name),
          'New Colour',
        ),
        value: '#FFFFFF',
      };
      return validatedProject({
        ...project,
        palette: [...project.palette, token],
      });
    }
    case 'palette-token-updated': {
      const index = tokenIndex(project, command.id);
      const current = project.palette[index];
      const next: PaletteToken = {
        ...current,
        ...command.changes,
        ...(command.changes.name === undefined
          ? null
          : { name: command.changes.name.trim() }),
        ...(command.changes.value === undefined
          ? null
          : { value: command.changes.value.toUpperCase() }),
      };
      if (next.name === current.name && next.value === current.value)
        return project;
      const palette = [...project.palette];
      palette[index] = next;
      return validatedProject({ ...project, palette });
    }
    case 'palette-token-duplicated': {
      const index = tokenIndex(project, command.id);
      const source = project.palette[index];
      const duplicate: PaletteToken = {
        id: createEntityId(project),
        name: uniqueName(
          project.palette.map(({ name }) => name),
          `${source.name} Copy`,
        ),
        value: source.value,
      };
      const palette = [...project.palette];
      palette.splice(index + 1, 0, duplicate);
      return validatedProject({ ...project, palette });
    }
    case 'palette-token-deleted': {
      const index = tokenIndex(project, command.id);
      const referenceCount = paletteTokenUsageCount(project, command.id);
      if (referenceCount > 0) throw new EditorCommandError(referenceCount);
      return validatedProject({
        ...project,
        palette: project.palette.filter((_, position) => position !== index),
      });
    }
    case 'scene-added': {
      const scene: Scene = {
        id: createEntityId(project),
        ledStates: {},
        loopLengthBeats: 4,
        name: uniqueName(
          project.scenes.map(({ name }) => name),
          `Scene ${project.scenes.length + 1}`,
        ),
      };
      return validatedProject({
        ...project,
        scenes: [...project.scenes, scene],
      });
    }
    case 'scene-duplicated': {
      const index = sceneIndex(project, command.id);
      const source = project.scenes[index];
      const duplicate: Scene = {
        ...structuredClone(source),
        id: createEntityId(project),
        name: uniqueName(
          project.scenes.map(({ name }) => name),
          `${source.name} Copy`,
        ),
      };
      const scenes = [...project.scenes];
      scenes.splice(index + 1, 0, duplicate);
      return validatedProject({ ...project, scenes });
    }
    case 'scene-deleted': {
      const index = sceneIndex(project, command.id);
      return validatedProject({
        ...project,
        scenes: project.scenes.filter((_, position) => position !== index),
      });
    }
    case 'scene-updated':
      return updateScene(project, command.id, (scene) => {
        const next = {
          ...scene,
          ...command.changes,
          ...(command.changes.name === undefined
            ? null
            : { name: command.changes.name.trim() }),
        };
        return next.name === scene.name &&
          next.loopLengthBeats === scene.loopLengthBeats
          ? scene
          : next;
      });
    case 'scene-leds-painted': {
      tokenIndex(project, command.paletteTokenId);
      return updateScene(project, command.sceneId, (scene) => {
        if (command.ledIds.length === 0) return scene;
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
    case 'scene-led-brightness-set':
      return updateScene(project, command.sceneId, (scene) => {
        const ledStates = { ...scene.ledStates };
        command.ledIds.forEach((ledId) => {
          if (!ledStates[ledId]) return;
          if (command.brightnessPercent === 0) delete ledStates[ledId];
          else
            ledStates[ledId] = {
              ...ledStates[ledId],
              brightnessPercent: command.brightnessPercent,
            };
        });
        return { ...scene, ledStates };
      });
    case 'scene-leds-turned-off':
      return updateScene(project, command.sceneId, (scene) => {
        const ledStates = { ...scene.ledStates };
        command.ledIds.forEach((ledId) => delete ledStates[ledId]);
        return { ...scene, ledStates };
      });
  }
}
