import {
  kmsFourString10LedProfile,
  validateProjectHardwareReferences,
} from '@led-studio/hardware-profiles';
import { parseProject, type Project } from '@led-studio/project-format';
import { describe, expect, it } from 'vitest';
import {
  MAX_EDITOR_HISTORY_REVISIONS,
  applyEditorCommand,
  createDefaultProject,
  createEffectLayerAddedCommand,
  createEffectLayerDuplicatedCommand,
  createEditorHistory,
  createGroupAddedCommand,
  createGroupDuplicatedCommand,
  createPaletteTokenAddedCommand,
  createPaletteTokenDuplicatedCommand,
  createSceneAddedCommand,
  createSceneDuplicatedCommand,
  EditorCommandError,
  executeEditorCommand,
  paletteTokenUsageCount,
  projectGroupUsageCount,
  redoEditorHistory,
  undoEditorHistory,
  type ProjectEntityIdFactory,
} from '../src/index.js';

const HOT_PINK_ID = '8b2c3d4e-5f60-4a71-8b92-c3d4e5f60718';
const BLACK_ID = 'f0e1d2c3-b4a5-4678-9abc-def012345678';
const SCENE_ID = '6c21dc04-9a75-4f10-a7bb-9f17dc2fe32a';
const TOKEN_COPY_ID = 'da5f1c78-56bd-438e-bfde-220bf24fdf29';
const SCENE_COPY_ID = '87f41d2e-6075-49a8-a3ed-928586d3d73e';
const GROUP_ID = 'ad56c792-07e6-42d7-84fd-0b509289b4ab';
const GROUP_COPY_ID = 'bb93ef72-0987-4b53-9924-9a720215ce8a';
const LAYER_ID = '2ac65eaf-4c2c-482e-b525-1c6e941dd0c8';
const LAYER_COPY_ID = 'c4793529-a645-4c18-8a4d-5e4f148ee493';

function ids(...values: string[]): ProjectEntityIdFactory {
  let index = 0;
  return () => values[index++]!;
}

function projectWithPalette(): Project {
  return {
    schemaVersion: 2,
    name: 'Test Project',
    hardwareProfile: kmsFourString10LedProfile.id,
    palette: [
      { id: HOT_PINK_ID, name: 'Hot Pink', value: '#FF2B9A' },
      { id: BLACK_ID, name: 'Black', value: '#000000' },
    ],
    scenes: [],
    sequence: [],
    groups: [],
    timing: {
      previewBpm: 120,
      timeSignature: { denominator: 4, numerator: 4 },
    },
  };
}

function expectValid(project: Project): void {
  expect(parseProject(project)).toEqual(project);
  expect(() => validateProjectHardwareReferences(project)).not.toThrow();
}

describe('default project creation', () => {
  it('creates a valid white scene covering every profile LED', () => {
    const project = createDefaultProject(
      { name: 'Untitled Project', profile: kmsFourString10LedProfile },
      ids(HOT_PINK_ID, SCENE_ID),
    );

    expect(project.palette).toEqual([
      { id: HOT_PINK_ID, name: 'White', value: '#FFFFFF' },
    ]);
    expect(project.scenes[0]).toMatchObject({
      id: SCENE_ID,
      loopLengthBeats: 4,
      name: 'Scene 1',
    });
    expect(Object.keys(project.scenes[0].ledStates)).toEqual(
      kmsFourString10LedProfile.leds.map(({ id }) => id),
    );
    expect(
      Object.values(project.scenes[0].ledStates).every(
        (state) =>
          state.paletteTokenId === HOT_PINK_ID &&
          state.brightnessPercent === 100,
      ),
    ).toBe(true);
    expectValid(project);
  });
});

describe('editor commands', () => {
  it('uses command-owned IDs for deterministic add and duplicate selection', () => {
    let project = projectWithPalette();
    project = applyEditorCommand(
      project,
      createPaletteTokenAddedCommand(project, ids(TOKEN_COPY_ID)),
    );
    expect(project.palette.at(-1)).toMatchObject({
      id: TOKEN_COPY_ID,
      name: 'New Colour',
    });

    project = applyEditorCommand(
      project,
      createPaletteTokenDuplicatedCommand(
        project,
        HOT_PINK_ID,
        ids(SCENE_COPY_ID),
      ),
    );
    expect(project.palette[1]).toMatchObject({
      id: SCENE_COPY_ID,
      name: 'Hot Pink Copy',
    });
    expectValid(project);
  });

  it('creates, updates, duplicates, paints, and deletes scenes', () => {
    let project = applyEditorCommand(
      projectWithPalette(),
      createSceneAddedCommand(projectWithPalette(), ids(SCENE_ID)),
    );
    project = applyEditorCommand(project, {
      changes: { loopLengthBeats: 3.25, name: 'Verse' },
      id: SCENE_ID,
      type: 'scene-updated',
    });
    project = applyEditorCommand(project, {
      ledIds: ['fret-03-e-side', 'fret-12-g-side'],
      paletteTokenId: HOT_PINK_ID,
      sceneId: SCENE_ID,
      type: 'scene-leds-painted',
    });
    project = applyEditorCommand(project, {
      brightnessPercent: 40,
      ledIds: ['fret-03-e-side'],
      sceneId: SCENE_ID,
      type: 'scene-led-brightness-set',
    });
    project = applyEditorCommand(
      project,
      createSceneDuplicatedCommand(project, SCENE_ID, ids(SCENE_COPY_ID)),
    );

    expect(project.scenes).toMatchObject([
      { id: SCENE_ID, name: 'Verse' },
      { id: SCENE_COPY_ID, name: 'Verse Copy' },
    ]);
    expect(project.scenes[0].ledStates['fret-03-e-side']).toEqual({
      brightnessPercent: 40,
      paletteTokenId: HOT_PINK_ID,
    });

    project = applyEditorCommand(project, {
      ledIds: ['fret-03-e-side'],
      sceneId: SCENE_ID,
      type: 'scene-leds-turned-off',
    });
    project = applyEditorCommand(project, {
      id: SCENE_ID,
      type: 'scene-deleted',
    });
    expect(project.scenes.map(({ id }) => id)).toEqual([SCENE_COPY_ID]);
    expectValid(project);
  });

  it('preserves untouched branches and returns the original for no-ops', () => {
    const project = projectWithPalette();
    const renamed = applyEditorCommand(project, {
      name: 'Renamed',
      type: 'project-renamed',
    });
    expect(renamed.palette).toBe(project.palette);
    expect(renamed.scenes).toBe(project.scenes);
    expect(
      applyEditorCommand(project, {
        changes: { value: '#ff2b9a' },
        id: HOT_PINK_ID,
        type: 'palette-token-updated',
      }),
    ).toBe(project);
  });

  it('reports known command failures with typed errors', () => {
    let project = applyEditorCommand(projectWithPalette(), {
      id: SCENE_ID,
      type: 'scene-added',
    });
    project = applyEditorCommand(project, {
      ledIds: ['fret-12-e-side', 'fret-12-g-side'],
      paletteTokenId: HOT_PINK_ID,
      sceneId: SCENE_ID,
      type: 'scene-leds-painted',
    });

    expect(paletteTokenUsageCount(project, HOT_PINK_ID)).toBe(2);
    expect(() =>
      applyEditorCommand(project, {
        id: HOT_PINK_ID,
        type: 'palette-token-deleted',
      }),
    ).toThrow(
      expect.objectContaining<Partial<EditorCommandError>>({
        code: 'palette-token-in-use',
        referenceCount: 2,
      }),
    );
    expect(() =>
      applyEditorCommand(project, {
        id: SCENE_ID,
        type: 'scene-added',
      }),
    ).toThrow(
      expect.objectContaining<Partial<EditorCommandError>>({
        code: 'duplicate-entity-id',
      }),
    );
  });

  it('creates reusable groups and live linked effect layers', () => {
    let project = applyEditorCommand(projectWithPalette(), {
      id: SCENE_ID,
      type: 'scene-added',
    });
    project = applyEditorCommand(
      project,
      createGroupAddedCommand(
        project,
        ['fret-03-e-side', 'fret-21-g-side'],
        ids(GROUP_ID),
      ),
    );
    expect(project.groups[0].ledIds).toEqual([
      'fret-21-g-side',
      'fret-03-e-side',
    ]);

    project = applyEditorCommand(
      project,
      createEffectLayerAddedCommand(
        project,
        SCENE_ID,
        'pulse',
        { groupId: GROUP_ID, kind: 'project-group' },
        ids(LAYER_ID),
      ),
    );
    expect(project.scenes[0].layers[0]).toMatchObject({
      endBeat: 4,
      id: LAYER_ID,
      name: 'Pulse',
      startBeat: 0,
      target: { groupId: GROUP_ID, kind: 'project-group' },
    });
    expect(paletteTokenUsageCount(project, HOT_PINK_ID)).toBe(1);
    expect(projectGroupUsageCount(project, GROUP_ID)).toBe(1);
    expect(() =>
      applyEditorCommand(project, { id: GROUP_ID, type: 'group-deleted' }),
    ).toThrow(
      expect.objectContaining<Partial<EditorCommandError>>({
        code: 'entity-in-use',
        referenceCount: 1,
      }),
    );

    project = applyEditorCommand(project, {
      changes: { ledIds: ['fret-19-g-side'] },
      id: GROUP_ID,
      type: 'group-updated',
    });
    expect(project.scenes[0].layers[0].target).toEqual({
      groupId: GROUP_ID,
      kind: 'project-group',
    });
    expectValid(project);
  });

  it('updates, orders, duplicates, locks, and deletes effect layers', () => {
    let project = applyEditorCommand(projectWithPalette(), {
      id: SCENE_ID,
      type: 'scene-added',
    });
    project = applyEditorCommand(
      project,
      createEffectLayerAddedCommand(
        project,
        SCENE_ID,
        'chase',
        { groupId: 'all-leds', kind: 'profile-group' },
        ids(LAYER_ID),
      ),
    );
    project = applyEditorCommand(
      project,
      createEffectLayerDuplicatedCommand(
        project,
        SCENE_ID,
        LAYER_ID,
        ids(LAYER_COPY_ID),
      ),
    );
    expect(project.scenes[0].layers.map(({ id }) => id)).toEqual([
      LAYER_ID,
      LAYER_COPY_ID,
    ]);
    project = applyEditorCommand(project, {
      id: LAYER_COPY_ID,
      sceneId: SCENE_ID,
      toIndex: 0,
      type: 'effect-layer-moved',
    });
    expect(project.scenes[0].layers[0].id).toBe(LAYER_COPY_ID);
    project = applyEditorCommand(project, {
      changes: { endBeat: 3, locked: true, startBeat: 1 },
      id: LAYER_ID,
      sceneId: SCENE_ID,
      type: 'effect-layer-updated',
    });
    expect(() =>
      applyEditorCommand(project, {
        changes: { startBeat: 0 },
        id: LAYER_ID,
        sceneId: SCENE_ID,
        type: 'effect-layer-updated',
      }),
    ).toThrow(
      expect.objectContaining<Partial<EditorCommandError>>({
        code: 'locked-entity',
      }),
    );
    expect(() =>
      applyEditorCommand(project, {
        changes: { loopLengthBeats: 2.75 },
        id: SCENE_ID,
        type: 'scene-updated',
      }),
    ).toThrow(/Move or resize/);
    project = applyEditorCommand(project, {
      changes: { locked: false },
      id: LAYER_ID,
      sceneId: SCENE_ID,
      type: 'effect-layer-updated',
    });
    project = applyEditorCommand(project, {
      id: LAYER_ID,
      sceneId: SCENE_ID,
      type: 'effect-layer-deleted',
    });
    expect(project.scenes[0].layers).toHaveLength(1);
    expectValid(project);
  });

  it('duplicates project groups with deterministic IDs', () => {
    let project = applyEditorCommand(
      projectWithPalette(),
      createGroupAddedCommand(
        projectWithPalette(),
        ['fret-03-e-side'],
        ids(GROUP_ID),
      ),
    );
    project = applyEditorCommand(
      project,
      createGroupDuplicatedCommand(project, GROUP_ID, ids(GROUP_COPY_ID)),
    );
    expect(project.groups).toMatchObject([
      { id: GROUP_ID, name: 'New Group' },
      { id: GROUP_COPY_ID, name: 'New Group Copy' },
    ]);
    expectValid(project);
  });
});

describe('bounded grouped history', () => {
  it('coalesces one interaction into one undo step and restores it with redo', () => {
    let history = createEditorHistory(projectWithPalette());
    for (let value = 121; value <= 140; value += 1) {
      history = executeEditorCommand(
        history,
        {
          changes: { previewBpm: value },
          type: 'project-timing-updated',
        },
        { historyGroupId: 'tempo-drag' },
      ).history;
    }

    expect(history.past).toHaveLength(1);
    expect(history.present.project.timing.previewBpm).toBe(140);
    const undone = undoEditorHistory(history);
    expect(undone.present.project.timing.previewBpm).toBe(120);
    expect(redoEditorHistory(undone).present.project.timing.previewBpm).toBe(
      140,
    );
  });

  it('keeps separate interaction groups as separate undo steps', () => {
    let history = createEditorHistory(projectWithPalette());
    for (const [value, historyGroupId] of [
      [121, 'first'],
      [122, 'second'],
    ] as const) {
      history = executeEditorCommand(
        history,
        {
          changes: { previewBpm: value },
          type: 'project-timing-updated',
        },
        { historyGroupId },
      ).history;
    }
    expect(history.past).toHaveLength(2);
  });

  it('caps retained undo revisions', () => {
    let history = createEditorHistory(projectWithPalette());
    for (let index = 0; index < MAX_EDITOR_HISTORY_REVISIONS + 20; index += 1) {
      history = executeEditorCommand(history, {
        name: `Project ${index}`,
        type: 'project-renamed',
      }).history;
    }
    expect(history.past).toHaveLength(MAX_EDITOR_HISTORY_REVISIONS);
  });
});
