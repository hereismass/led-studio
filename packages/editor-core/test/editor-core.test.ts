import {
  kmsFourString10LedProfile,
  validateProjectHardwareReferences,
} from '@led-studio/hardware-profiles';
import {
  parseProject,
  PROJECT_LIMITS,
  type Project,
} from '@led-studio/project-format';
import { describe, expect, it } from 'vitest';
import {
  EFFECT_LAYER_PRESETS,
  MAX_EDITOR_HISTORY_REVISIONS,
  applyEditorCommand,
  createDefaultProject,
  createKeyframeAddedCommand,
  createKeyframeDuplicatedCommand,
  createSceneLayerAddedCommand,
  createSceneLayerDuplicatedCommand,
  createEditorHistory,
  createGroupAddedCommand,
  createGroupDuplicatedCommand,
  createPaletteTokenAddedCommand,
  createPaletteTokenDuplicatedCommand,
  createSceneAddedCommand,
  createSceneDuplicatedCommand,
  EditorCommandError,
  executeEditorCommand,
  nextAvailableKeyframeBeat,
  paletteTokenUsageCount,
  projectGroupUsageCount,
  redoEditorHistory,
  undoEditorHistory,
  type ProjectEntityIdFactory,
  type SceneLayerTemplateId,
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
const BRIGHTNESS_KEY_ID = '11111111-1111-4111-8111-111111111111';
const BRIGHTNESS_KEY_2_ID = '22222222-2222-4222-8222-222222222222';
const COLOUR_KEY_ID = '33333333-3333-4333-8333-333333333333';
const KEY_COPY_ID = '44444444-4444-4444-8444-444444444444';

function ids(...values: string[]): ProjectEntityIdFactory {
  let index = 0;
  return () => values[index++]!;
}

function generatedId(index: number): string {
  return `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`;
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
      brightnessPercent: 0,
      ledIds: ['fret-03-e-side'],
      sceneId: SCENE_ID,
      type: 'scene-led-brightness-set',
    });
    expect(project.scenes[0].ledStates['fret-03-e-side']).toEqual({
      brightnessPercent: 0,
      paletteTokenId: HOT_PINK_ID,
    });
    expectValid(project);

    project = applyEditorCommand(project, {
      ledIds: ['fret-03-e-side'],
      sceneId: SCENE_ID,
      type: 'scene-leds-turned-off',
    });
    expect(project.scenes[0].ledStates['fret-03-e-side']).toBeUndefined();
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
      createSceneLayerAddedCommand(
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

  it('creates Wave, Sparkle, and curated preset layers with editable values', () => {
    let project = applyEditorCommand(projectWithPalette(), {
      id: SCENE_ID,
      type: 'scene-added',
    });
    const templates: SceneLayerTemplateId[] = [
      'wave',
      'sparkle',
      ...EFFECT_LAYER_PRESETS.map(({ id }) => id),
    ];

    templates.forEach((template, index) => {
      project = applyEditorCommand(
        project,
        createSceneLayerAddedCommand(
          project,
          SCENE_ID,
          template,
          { groupId: 'all-leds', kind: 'profile-group' },
          ids(generatedId(1_000 + index)),
        ),
      );
    });

    expect(
      project.scenes[0].layers.map((layer) => ({
        name: layer.name,
        type: layer.kind === 'effect' ? layer.effect.type : layer.kind,
      })),
    ).toEqual([
      { name: 'Wave', type: 'wave' },
      { name: 'Sparkle', type: 'sparkle' },
      { name: 'Slow Breath', type: 'pulse' },
      { name: 'Comet', type: 'chase' },
      { name: 'Rolling Wave', type: 'wave' },
      { name: 'Soft Twinkle', type: 'sparkle' },
    ]);

    const sparkle = project.scenes[0].layers[1];
    if (sparkle.kind !== 'effect' || sparkle.effect.type !== 'sparkle')
      throw new Error('Expected Sparkle');
    expect(sparkle.effect).toMatchObject({
      brightnessPercent: 100,
      decay: 'fade',
      densityPercent: 30,
      seed: 1_001,
      stepLengthBeats: 0.25,
    });
    const twinkle = project.scenes[0].layers[5];
    if (twinkle.kind !== 'effect' || twinkle.effect.type !== 'sparkle')
      throw new Error('Expected Soft Twinkle');
    expect(twinkle.effect).toMatchObject({
      brightnessPercent: 65,
      densityPercent: 20,
      stepLengthBeats: 0.5,
    });

    const unchanged = applyEditorCommand(project, {
      changes: { effect: twinkle.effect },
      id: twinkle.id,
      sceneId: SCENE_ID,
      type: 'scene-layer-updated',
    });
    expect(unchanged).toBe(project);

    project = applyEditorCommand(
      project,
      createSceneLayerDuplicatedCommand(
        project,
        SCENE_ID,
        sparkle.id,
        ids(generatedId(2_000)),
      ),
    );
    const sparkleCopy = project.scenes[0].layers[2];
    if (sparkleCopy.kind !== 'effect' || sparkleCopy.effect.type !== 'sparkle')
      throw new Error('Expected duplicated Sparkle');
    expect(sparkleCopy.effect.seed).toBe(sparkle.effect.seed);
    expectValid(project);
  });

  it('updates, orders, duplicates, locks, and deletes effect layers', () => {
    let project = applyEditorCommand(projectWithPalette(), {
      id: SCENE_ID,
      type: 'scene-added',
    });
    project = applyEditorCommand(
      project,
      createSceneLayerAddedCommand(
        project,
        SCENE_ID,
        'chase',
        { groupId: 'all-leds', kind: 'profile-group' },
        ids(LAYER_ID),
      ),
    );
    project = applyEditorCommand(
      project,
      createSceneLayerDuplicatedCommand(
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
      type: 'scene-layer-moved',
    });
    expect(project.scenes[0].layers[0].id).toBe(LAYER_COPY_ID);
    project = applyEditorCommand(project, {
      changes: { endBeat: 3, locked: true, startBeat: 1 },
      id: LAYER_ID,
      sceneId: SCENE_ID,
      type: 'scene-layer-updated',
    });
    expect(() =>
      applyEditorCommand(project, {
        changes: { startBeat: 0 },
        id: LAYER_ID,
        sceneId: SCENE_ID,
        type: 'scene-layer-updated',
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
    ).toThrow(/Adjust it first/);
    project = applyEditorCommand(project, {
      changes: { locked: false },
      id: LAYER_ID,
      sceneId: SCENE_ID,
      type: 'scene-layer-updated',
    });
    project = applyEditorCommand(project, {
      id: LAYER_ID,
      sceneId: SCENE_ID,
      type: 'scene-layer-deleted',
    });
    expect(project.scenes[0].layers).toHaveLength(1);
    expectValid(project);
  });

  it('authors, crops, locks, duplicates, and deletes keyframe layers and keys', () => {
    let project = applyEditorCommand(projectWithPalette(), {
      id: SCENE_ID,
      type: 'scene-added',
    });
    project = applyEditorCommand(
      project,
      createSceneLayerAddedCommand(
        project,
        SCENE_ID,
        'keyframe',
        { groupId: 'all-leds', kind: 'profile-group' },
        ids(LAYER_ID),
      ),
    );
    let layer = project.scenes[0].layers[0];
    expect(layer).toMatchObject({
      endBeat: 4,
      kind: 'keyframe',
      name: 'Keyframes',
      startBeat: 0,
    });
    if (layer.kind !== 'keyframe') throw new Error('Expected keyframe layer');
    expect(layer.tracks.brightness.keyframes).toEqual([]);

    project = applyEditorCommand(
      project,
      createKeyframeAddedCommand(
        project,
        SCENE_ID,
        LAYER_ID,
        1,
        { brightnessPercent: 80, track: 'brightness' },
        ids(BRIGHTNESS_KEY_ID),
      ),
    );
    project = applyEditorCommand(
      project,
      createKeyframeAddedCommand(
        project,
        SCENE_ID,
        LAYER_ID,
        0.5,
        { brightnessPercent: 20, track: 'brightness' },
        ids(BRIGHTNESS_KEY_2_ID),
      ),
    );
    project = applyEditorCommand(
      project,
      createKeyframeAddedCommand(
        project,
        SCENE_ID,
        LAYER_ID,
        1,
        { paletteTokenId: HOT_PINK_ID, track: 'colour' },
        ids(COLOUR_KEY_ID),
      ),
    );
    layer = project.scenes[0].layers[0];
    if (layer.kind !== 'keyframe') throw new Error('Expected keyframe layer');
    expect(layer.tracks.brightness.keyframes.map(({ beat }) => beat)).toEqual([
      0.5, 1,
    ]);
    expect(
      layer.tracks.brightness.keyframes.map(({ easing }) => easing),
    ).toEqual(['linear', 'linear']);
    expect(paletteTokenUsageCount(project, HOT_PINK_ID)).toBe(1);
    expect(() =>
      applyEditorCommand(project, {
        changes: { beat: 0.5 },
        id: BRIGHTNESS_KEY_ID,
        layerId: LAYER_ID,
        sceneId: SCENE_ID,
        track: 'brightness',
        type: 'keyframe-updated',
      }),
    ).toThrow(/already exists/);

    project = applyEditorCommand(project, {
      changes: {
        beat: 1.25,
        brightnessPercent: 90,
        easing: 'ease-in',
      },
      id: BRIGHTNESS_KEY_ID,
      layerId: LAYER_ID,
      sceneId: SCENE_ID,
      track: 'brightness',
      type: 'keyframe-updated',
    });
    project = applyEditorCommand(project, {
      changes: { endBeat: 3, startBeat: 1.5 },
      id: LAYER_ID,
      sceneId: SCENE_ID,
      type: 'scene-layer-updated',
    });
    layer = project.scenes[0].layers[0];
    if (layer.kind !== 'keyframe') throw new Error('Expected keyframe layer');
    expect(layer.tracks.brightness.keyframes.map(({ beat }) => beat)).toEqual([
      0.5, 1.25,
    ]);
    expect(nextAvailableKeyframeBeat(layer, 'brightness', 1.25, 4)).toBe(1.5);

    project = applyEditorCommand(
      project,
      createKeyframeDuplicatedCommand(
        project,
        SCENE_ID,
        LAYER_ID,
        'brightness',
        BRIGHTNESS_KEY_ID,
        ids(KEY_COPY_ID),
      ),
    );
    layer = project.scenes[0].layers[0];
    if (layer.kind !== 'keyframe') throw new Error('Expected keyframe layer');
    expect(layer.tracks.brightness.keyframes.at(-1)).toMatchObject({
      beat: 1.5,
      brightnessPercent: 90,
      easing: 'ease-in',
      id: KEY_COPY_ID,
    });

    project = applyEditorCommand(project, {
      changes: { locked: true },
      id: LAYER_ID,
      sceneId: SCENE_ID,
      type: 'scene-layer-updated',
    });
    expect(() =>
      applyEditorCommand(project, {
        id: KEY_COPY_ID,
        layerId: LAYER_ID,
        sceneId: SCENE_ID,
        track: 'brightness',
        type: 'keyframe-deleted',
      }),
    ).toThrow(
      expect.objectContaining<Partial<EditorCommandError>>({
        code: 'locked-entity',
      }),
    );
    project = applyEditorCommand(project, {
      changes: { locked: false },
      id: LAYER_ID,
      sceneId: SCENE_ID,
      type: 'scene-layer-updated',
    });
    project = applyEditorCommand(project, {
      id: KEY_COPY_ID,
      layerId: LAYER_ID,
      sceneId: SCENE_ID,
      track: 'brightness',
      type: 'keyframe-deleted',
    });
    expectValid(project);
  });

  it('remaps nested keyframe IDs when duplicating layers and scenes', () => {
    let project = applyEditorCommand(projectWithPalette(), {
      id: SCENE_ID,
      type: 'scene-added',
    });
    project = applyEditorCommand(
      project,
      createSceneLayerAddedCommand(
        project,
        SCENE_ID,
        'keyframe',
        { groupId: 'all-leds', kind: 'profile-group' },
        ids(LAYER_ID),
      ),
    );
    project = applyEditorCommand(
      project,
      createKeyframeAddedCommand(
        project,
        SCENE_ID,
        LAYER_ID,
        0,
        { brightnessPercent: 50, track: 'brightness' },
        ids(BRIGHTNESS_KEY_ID),
      ),
    );
    project = applyEditorCommand(
      project,
      createSceneLayerDuplicatedCommand(
        project,
        SCENE_ID,
        LAYER_ID,
        ids(BRIGHTNESS_KEY_2_ID, LAYER_COPY_ID),
      ),
    );
    const layerCopy = project.scenes[0].layers[1];
    if (layerCopy.kind !== 'keyframe')
      throw new Error('Expected keyframe layer');
    expect(layerCopy.tracks.brightness.keyframes[0].id).toBe(
      BRIGHTNESS_KEY_2_ID,
    );

    const duplicate = createSceneDuplicatedCommand(
      project,
      SCENE_ID,
      ids(
        SCENE_COPY_ID,
        '55555555-5555-4555-8555-555555555555',
        '66666666-6666-4666-8666-666666666666',
        '77777777-7777-4777-8777-777777777777',
        '88888888-8888-4888-8888-888888888888',
      ),
    );
    project = applyEditorCommand(project, duplicate);
    const copiedIds = project.scenes[1].layers.flatMap((candidate) => [
      candidate.id,
      ...(candidate.kind === 'keyframe'
        ? candidate.tracks.brightness.keyframes.map(({ id }) => id)
        : []),
    ]);
    expect(new Set(copiedIds).size).toBe(copiedIds.length);
    expect(copiedIds).not.toContain(LAYER_ID);
    expect(copiedIds).not.toContain(BRIGHTNESS_KEY_ID);
    expectValid(project);
  });

  it('moves, pastes, and deletes keyframe selections atomically', () => {
    let project = applyEditorCommand(projectWithPalette(), {
      id: SCENE_ID,
      type: 'scene-added',
    });
    project = applyEditorCommand(
      project,
      createSceneLayerAddedCommand(
        project,
        SCENE_ID,
        'keyframe',
        { groupId: 'all-leds', kind: 'profile-group' },
        ids(LAYER_ID),
      ),
    );
    project = applyEditorCommand(
      project,
      createKeyframeAddedCommand(
        project,
        SCENE_ID,
        LAYER_ID,
        0.5,
        { brightnessPercent: 10, track: 'brightness' },
        ids(BRIGHTNESS_KEY_ID),
      ),
    );
    project = applyEditorCommand(
      project,
      createKeyframeAddedCommand(
        project,
        SCENE_ID,
        LAYER_ID,
        1,
        { brightnessPercent: 90, track: 'brightness' },
        ids(BRIGHTNESS_KEY_2_ID),
      ),
    );
    project = applyEditorCommand(
      project,
      createKeyframeAddedCommand(
        project,
        SCENE_ID,
        LAYER_ID,
        1,
        { paletteTokenId: HOT_PINK_ID, track: 'colour' },
        ids(COLOUR_KEY_ID),
      ),
    );

    project = applyEditorCommand(project, {
      easing: 'ease-in-out',
      keyframes: [
        { id: BRIGHTNESS_KEY_ID, track: 'brightness' },
        { id: COLOUR_KEY_ID, track: 'colour' },
      ],
      layerId: LAYER_ID,
      sceneId: SCENE_ID,
      type: 'keyframes-easing-set',
    });
    const easedLayer = project.scenes[0].layers[0];
    if (easedLayer.kind !== 'keyframe')
      throw new Error('Expected keyframe layer');
    expect(easedLayer.tracks.brightness.keyframes[0].easing).toBe(
      'ease-in-out',
    );
    expect(easedLayer.tracks.colour.keyframes[0].easing).toBe('ease-in-out');
    expect(
      applyEditorCommand(project, {
        easing: 'ease-in-out',
        keyframes: [
          { id: BRIGHTNESS_KEY_ID, track: 'brightness' },
          { id: COLOUR_KEY_ID, track: 'colour' },
        ],
        layerId: LAYER_ID,
        sceneId: SCENE_ID,
        type: 'keyframes-easing-set',
      }),
    ).toBe(project);

    const beforeRejectedMove = project;
    expect(() =>
      applyEditorCommand(project, {
        keyframes: [
          { beat: 0.5, id: BRIGHTNESS_KEY_2_ID, track: 'brightness' },
          { beat: 1.5, id: COLOUR_KEY_ID, track: 'colour' },
        ],
        layerId: LAYER_ID,
        sceneId: SCENE_ID,
        type: 'keyframes-moved',
      }),
    ).toThrow(/destination beat/);
    expect(project).toBe(beforeRejectedMove);

    project = applyEditorCommand(project, {
      keyframes: [
        { beat: 1.25, id: BRIGHTNESS_KEY_2_ID, track: 'brightness' },
        { beat: 1.5, id: COLOUR_KEY_ID, track: 'colour' },
      ],
      layerId: LAYER_ID,
      sceneId: SCENE_ID,
      type: 'keyframes-moved',
    });
    project = applyEditorCommand(project, {
      keyframes: [
        {
          beat: 2,
          brightnessPercent: 50,
          easing: 'linear',
          id: '55555555-5555-4555-8555-555555555555',
          track: 'brightness',
        },
        {
          beat: 2,
          easing: 'linear',
          id: '66666666-6666-4666-8666-666666666666',
          paletteTokenId: BLACK_ID,
          track: 'colour',
        },
      ],
      layerId: LAYER_ID,
      sceneId: SCENE_ID,
      type: 'keyframes-pasted',
    });
    project = applyEditorCommand(project, {
      keyframes: [
        { id: BRIGHTNESS_KEY_2_ID, track: 'brightness' },
        { id: COLOUR_KEY_ID, track: 'colour' },
      ],
      layerId: LAYER_ID,
      sceneId: SCENE_ID,
      type: 'keyframes-deleted',
    });

    const layer = project.scenes[0].layers[0];
    if (layer.kind !== 'keyframe') throw new Error('Expected keyframe layer');
    expect(layer.tracks.brightness.keyframes).toMatchObject([
      { beat: 0.5, id: BRIGHTNESS_KEY_ID },
      { beat: 2, id: '55555555-5555-4555-8555-555555555555' },
    ]);
    expect(layer.tracks.colour.keyframes).toMatchObject([
      { beat: 2, id: '66666666-6666-4666-8666-666666666666' },
    ]);
    expectValid(project);
  });

  it('pastes a validated layer at the requested position with a unique name', () => {
    let project = applyEditorCommand(projectWithPalette(), {
      id: SCENE_ID,
      type: 'scene-added',
    });
    project = applyEditorCommand(
      project,
      createSceneLayerAddedCommand(
        project,
        SCENE_ID,
        'pulse',
        { groupId: 'all-leds', kind: 'profile-group' },
        ids(LAYER_ID),
      ),
    );
    const source = structuredClone(project.scenes[0].layers[0]);
    source.id = LAYER_COPY_ID;
    source.locked = true;
    project = applyEditorCommand(project, {
      layer: source,
      sceneId: SCENE_ID,
      toIndex: 0,
      type: 'scene-layer-pasted',
    });
    expect(project.scenes[0].layers).toMatchObject([
      { id: LAYER_COPY_ID, locked: false, name: 'Pulse 2' },
      { id: LAYER_ID, name: 'Pulse' },
    ]);
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

  it('rejects editor commands that would exceed collection limits', () => {
    const paletteAtLimit: Project = {
      ...projectWithPalette(),
      palette: Array.from(
        { length: PROJECT_LIMITS.paletteTokens },
        (_, index) => ({
          id: generatedId(index + 1),
          name: `Colour ${index + 1}`,
          value: '#FFFFFF',
        }),
      ),
    };
    expect(() =>
      applyEditorCommand(paletteAtLimit, {
        id: generatedId(10_000),
        type: 'palette-token-added',
      }),
    ).toThrow(/cannot contain more than 256/);

    const project = projectWithPalette();
    project.scenes = [
      {
        id: SCENE_ID,
        layers: Array.from(
          { length: PROJECT_LIMITS.layersPerScene },
          (_, index) => ({
            effect: {
              cycleLengthBeats: 1,
              maxBrightnessPercent: 100,
              minBrightnessPercent: 0,
              paletteTokenId: HOT_PINK_ID,
              phaseOffsetBeats: 0,
              type: 'pulse' as const,
              waveform: 'sine' as const,
            },
            enabled: true,
            endBeat: 4,
            id: generatedId(index + 20_000),
            kind: 'effect' as const,
            locked: false,
            name: `Layer ${index + 1}`,
            startBeat: 0,
            target: { groupId: 'all-leds', kind: 'profile-group' as const },
          }),
        ),
        ledStates: {},
        loopLengthBeats: 4,
        name: 'Full scene',
      },
    ];
    expect(() =>
      applyEditorCommand(project, {
        id: generatedId(30_000),
        layerType: 'pulse',
        sceneId: SCENE_ID,
        target: { groupId: 'all-leds', kind: 'profile-group' },
        type: 'scene-layer-added',
      }),
    ).toThrow(/cannot contain more than 512/);
  });

  it('validates all duplicate IDs as one collision-safe batch', () => {
    const project = projectWithPalette();
    project.scenes = [
      {
        id: SCENE_ID,
        layers: [
          {
            effect: {
              cycleLengthBeats: 1,
              maxBrightnessPercent: 100,
              minBrightnessPercent: 0,
              paletteTokenId: HOT_PINK_ID,
              phaseOffsetBeats: 0,
              type: 'pulse',
              waveform: 'sine',
            },
            enabled: true,
            endBeat: 4,
            id: LAYER_ID,
            kind: 'effect',
            locked: false,
            name: 'Pulse',
            startBeat: 0,
            target: { groupId: 'all-leds', kind: 'profile-group' },
          },
        ],
        ledStates: {},
        loopLengthBeats: 4,
        name: 'Scene',
      },
    ];

    expect(() =>
      applyEditorCommand(project, {
        id: SCENE_COPY_ID,
        keyframeIds: [[]],
        layerIds: [SCENE_COPY_ID],
        sourceId: SCENE_ID,
        type: 'scene-duplicated',
      }),
    ).toThrowError(expect.objectContaining({ code: 'duplicate-entity-id' }));
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
