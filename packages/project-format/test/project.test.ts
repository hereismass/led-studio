import { describe, expect, it } from 'vitest';
import {
  EffectSchema,
  PROJECT_LIMITS,
  ProjectSchema,
  ProjectFormatError,
  parseProject,
  parseProjectJson,
  serializeProject,
  type Project,
} from '../src/index.js';

function generatedId(index: number): string {
  return `90000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`;
}

const HOT_PINK_ID = '8b2c3d4e-5f60-4a71-8b92-c3d4e5f60718';
const ELECTRIC_GREEN_ID = '1a2b3c4d-5e6f-4789-8abc-def012345678';
const BLACK_ID = 'f0e1d2c3-b4a5-4678-9abc-def012345678';
const GROUP_ID = 'ad56c792-07e6-42d7-84fd-0b509289b4ab';
const PULSE_ID = 'bb93ef72-0987-4b53-9924-9a720215ce8a';
const CHASE_ID = '2ac65eaf-4c2c-482e-b525-1c6e941dd0c8';
const WAVE_ID = '5d4b6d3e-1f25-48c1-8c74-7cb8449ed41e';
const SPARKLE_ID = '6e5c7e4f-2a36-49d2-9d85-8dc955afe52f';
const KEYFRAME_LAYER_ID = 'c4793529-a645-4c18-8a4d-5e4f148ee493';
const BRIGHTNESS_KEY_1_ID = '11111111-1111-4111-8111-111111111111';
const BRIGHTNESS_KEY_2_ID = '22222222-2222-4222-8222-222222222222';
const COLOUR_KEY_1_ID = '33333333-3333-4333-8333-333333333333';
const COLOUR_KEY_2_ID = '44444444-4444-4444-8444-444444444444';

const validProject: Project = {
  schemaVersion: 2,
  name: 'KMS 4-String Bass Example',
  hardwareProfile: 'kms-4-string-10-led-v1',
  palette: [
    { id: HOT_PINK_ID, name: 'Hot Pink', value: '#FF2B9A' },
    {
      id: ELECTRIC_GREEN_ID,
      name: 'Electric Green',
      value: '#45FF72',
    },
    { id: BLACK_ID, name: 'Black', value: '#000000' },
  ],
  scenes: [],
  songs: [],
  groups: [],
  timing: {
    previewBpm: 120,
    timeSignature: { denominator: 4, numerator: 4 },
  },
};

describe('ProjectSchema', () => {
  it('accepts a version 2 project', () => {
    expect(parseProject(validProject)).toEqual(validProject);
  });

  it('rejects version 1 with a clear unsupported-version issue', () => {
    expect(() => parseProject({ ...validProject, schemaVersion: 1 })).toThrow(
      expect.objectContaining({
        issues: [
          expect.objectContaining({
            message: expect.stringContaining('version 1 is not supported'),
            path: ['schemaVersion'],
          }),
        ],
      }),
    );
  });

  it('requires a project name', () => {
    const projectWithoutName: Partial<typeof validProject> = {
      ...validProject,
    };
    delete projectWithoutName.name;
    expect(ProjectSchema.safeParse(projectWithoutName).success).toBe(false);
  });

  it.each(['', '   '])('rejects an empty project name: %j', (value) => {
    expect(
      ProjectSchema.safeParse({ ...validProject, name: value }).success,
    ).toBe(false);
  });

  it('trims surrounding whitespace from project names', () => {
    expect(
      parseProject({ ...validProject, name: '  Example Project  ' }).name,
    ).toBe('Example Project');
  });

  it.each(['', '   '])('rejects an empty hardware profile: %j', (value) => {
    expect(
      ProjectSchema.safeParse({ ...validProject, hardwareProfile: value })
        .success,
    ).toBe(false);
  });

  it.each([
    'hot-pink',
    '8B2C3D4E-5F60-4A71-8B92-C3D4E5F60718',
    '8b2c3d4e-5f60-3a71-8b92-c3d4e5f60718',
    '8b2c3d4e-5f60-4a71-7b92-c3d4e5f60718',
  ])('rejects a token ID that is not a lowercase UUID v4: %s', (id) => {
    expect(
      ProjectSchema.safeParse({
        ...validProject,
        palette: [{ id, name: 'Hot Pink', value: '#FF2B9A' }],
      }).success,
    ).toBe(false);
  });

  it.each(['#FFF', 'FF2B9A', '#ff2b9a', '#GG2B9A', '#FF2B9AAA'])(
    'rejects an invalid palette colour: %s',
    (value) => {
      expect(
        ProjectSchema.safeParse({
          ...validProject,
          palette: [{ id: HOT_PINK_ID, name: 'Hot Pink', value }],
        }).success,
      ).toBe(false);
    },
  );

  it('rejects duplicate token IDs', () => {
    expect(
      ProjectSchema.safeParse({
        ...validProject,
        palette: [validProject.palette[0], validProject.palette[0]],
      }).success,
    ).toBe(false);
  });

  it('rejects display names that only differ by case or whitespace', () => {
    expect(
      ProjectSchema.safeParse({
        ...validProject,
        palette: [
          validProject.palette[0],
          {
            id: 'da5f1c78-56bd-438e-bfde-220bf24fdf29',
            name: ' hot pink ',
            value: '#000000',
          },
        ],
      }).success,
    ).toBe(false);
  });

  it('accepts songs with shared-scene cues and validates references', () => {
    const scene = {
      id: '6c21dc04-9a75-4f10-a7bb-9f17dc2fe32a',
      layers: [],
      ledStates: {},
      loopLengthBeats: 4,
      name: 'Shared Scene',
    };
    const song = {
      cues: [
        {
          advance: { kind: 'after-loops', loopCount: 4 },
          id: '710c1ddd-baea-45e7-9725-f5b63b9869b0',
          name: 'Intro',
          sceneId: scene.id,
        },
      ],
      id: '68aa8c7d-ff65-4dbf-ac48-a9d960862a67',
      launchQuantization: 'next-bar',
      name: 'Song 1',
      timing: validProject.timing,
    };
    expect(
      parseProject({ ...validProject, scenes: [scene], songs: [song] }).songs,
    ).toEqual([song]);
    expect(
      ProjectSchema.safeParse({
        ...validProject,
        scenes: [scene],
        songs: [
          {
            ...song,
            cues: [{ ...song.cues[0], sceneId: generatedId(999) }],
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      ProjectSchema.safeParse({
        ...validProject,
        scenes: [scene],
        songs: [
          {
            ...song,
            cues: [song.cues[0], { ...song.cues[0], name: ' intro ' }],
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      ProjectSchema.safeParse({
        ...validProject,
        scenes: [scene],
        songs: [
          {
            ...song,
            launchQuantization: 'next-sixteenth',
            cues: [
              {
                ...song.cues[0],
                advance: { kind: 'after-loops', loopCount: 0 },
              },
            ],
          },
        ],
      }).success,
    ).toBe(false);
  });

  it('accepts static scenes and validates their linked palette tokens', () => {
    const scene = {
      id: '6c21dc04-9a75-4f10-a7bb-9f17dc2fe32a',
      ledStates: {
        'fret-03-e-side': {
          brightnessPercent: 0,
          paletteTokenId: HOT_PINK_ID,
        },
      },
      loopLengthBeats: 4.25,
      name: 'Marker Glow',
    };
    expect(parseProject({ ...validProject, scenes: [scene] }).scenes).toEqual([
      { ...scene, layers: [] },
    ]);
    expect(
      ProjectSchema.safeParse({
        ...validProject,
        scenes: [
          {
            ...scene,
            ledStates: {
              'fret-03-e-side': {
                brightnessPercent: -1,
                paletteTokenId: HOT_PINK_ID,
              },
            },
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      ProjectSchema.safeParse({
        ...validProject,
        scenes: [
          {
            ...scene,
            ledStates: {
              x: { brightnessPercent: 100, paletteTokenId: BLACK_ID.slice(1) },
            },
          },
        ],
      }).success,
    ).toBe(false);
  });

  it('accepts project groups and every typed effect layer', () => {
    const project = parseProject({
      ...validProject,
      groups: [
        {
          id: GROUP_ID,
          ledIds: ['fret-21-g-side', 'fret-19-g-side'],
          name: 'Upper markers',
        },
      ],
      scenes: [
        {
          id: '6c21dc04-9a75-4f10-a7bb-9f17dc2fe32a',
          layers: [
            {
              effect: {
                cycleLengthBeats: 1,
                maxBrightnessPercent: 100,
                minBrightnessPercent: 0,
                paletteTokenId: HOT_PINK_ID,
                phaseOffsetBeats: 0.25,
                type: 'pulse',
                waveform: 'sine',
              },
              enabled: true,
              endBeat: 2,
              id: PULSE_ID,
              kind: 'effect',
              locked: false,
              name: 'Pulse',
              startBeat: 0,
              target: { groupId: GROUP_ID, kind: 'project-group' },
            },
            {
              effect: {
                brightnessPercent: 80,
                cycleLengthBeats: 4,
                direction: 'reverse',
                paletteTokenId: ELECTRIC_GREEN_ID,
                trailLengthPositions: 2,
                type: 'chase',
                widthPositions: 1,
              },
              enabled: true,
              endBeat: 4,
              id: CHASE_ID,
              kind: 'effect',
              locked: true,
              name: 'Chase',
              startBeat: 1,
              target: { groupId: 'all-leds', kind: 'profile-group' },
            },
            {
              effect: {
                cycleLengthBeats: 2,
                direction: 'forward',
                maxBrightnessPercent: 100,
                minBrightnessPercent: 10,
                paletteTokenId: HOT_PINK_ID,
                phaseOffsetBeats: 0,
                type: 'wave',
                waveform: 'triangle',
                wavelengthPositions: 4,
              },
              enabled: true,
              endBeat: 4,
              id: WAVE_ID,
              kind: 'effect',
              locked: false,
              name: 'Wave',
              startBeat: 0,
              target: { groupId: 'all-leds', kind: 'profile-group' },
            },
            {
              effect: {
                brightnessPercent: 65,
                decay: 'fade',
                densityPercent: 20,
                paletteTokenId: ELECTRIC_GREEN_ID,
                seed: 42,
                stepLengthBeats: 0.5,
                type: 'sparkle',
              },
              enabled: true,
              endBeat: 4,
              id: SPARKLE_ID,
              kind: 'effect',
              locked: false,
              name: 'Sparkle',
              startBeat: 0,
              target: { groupId: 'all-leds', kind: 'profile-group' },
            },
          ],
          ledStates: {},
          loopLengthBeats: 4,
          name: 'Animated',
        },
      ],
    });
    expect(project.groups[0].name).toBe('Upper markers');
    expect(
      project.scenes[0].layers.map((layer) =>
        layer.kind === 'effect' ? layer.effect.type : layer.kind,
      ),
    ).toEqual(['pulse', 'chase', 'wave', 'sparkle']);
  });

  it('rejects invalid Chase, Wave, and Sparkle parameters', () => {
    const chase = {
      brightnessPercent: 100,
      cycleLengthBeats: 4,
      direction: 'forward',
      paletteTokenId: HOT_PINK_ID,
      trailLengthPositions: 2,
      type: 'chase',
      widthPositions: 1,
    } as const;
    const wave = {
      cycleLengthBeats: 2,
      direction: 'forward',
      maxBrightnessPercent: 80,
      minBrightnessPercent: 10,
      paletteTokenId: HOT_PINK_ID,
      phaseOffsetBeats: 0,
      type: 'wave',
      waveform: 'sine',
      wavelengthPositions: 4,
    } as const;
    const sparkle = {
      brightnessPercent: 100,
      decay: 'fade',
      densityPercent: 25,
      paletteTokenId: HOT_PINK_ID,
      seed: 42,
      stepLengthBeats: 0.25,
      type: 'sparkle',
    } as const;

    expect(
      EffectSchema.safeParse({
        ...wave,
        maxBrightnessPercent: 20,
        minBrightnessPercent: 21,
      }).success,
    ).toBe(false);
    expect(
      EffectSchema.safeParse({ ...wave, wavelengthPositions: 0 }).success,
    ).toBe(false);
    expect(
      EffectSchema.safeParse({ ...wave, cycleLengthBeats: 0.3 }).success,
    ).toBe(false);
    expect(
      EffectSchema.safeParse({ ...chase, cycleLengthBeats: 0.3 }).success,
    ).toBe(false);
    expect(
      EffectSchema.safeParse({
        ...chase,
        cycleLengthBeats: undefined,
        stepLengthBeats: 0.25,
      }).success,
    ).toBe(false);
    expect(
      EffectSchema.safeParse({ ...sparkle, densityPercent: 101 }).success,
    ).toBe(false);
    expect(
      EffectSchema.safeParse({ ...sparkle, seed: 0x1_0000_0000 }).success,
    ).toBe(false);
    expect(EffectSchema.safeParse({ ...sparkle, decay: 'glow' }).success).toBe(
      false,
    );
  });

  it('accepts independently animated brightness and colour keyframe tracks', () => {
    const project = parseProject({
      ...validProject,
      scenes: [
        {
          id: '6c21dc04-9a75-4f10-a7bb-9f17dc2fe32a',
          layers: [
            {
              enabled: true,
              endBeat: 3,
              id: KEYFRAME_LAYER_ID,
              kind: 'keyframe',
              locked: false,
              name: 'Marker animation',
              startBeat: 0.5,
              target: { groupId: 'all-leds', kind: 'profile-group' },
              tracks: {
                brightness: {
                  keyframes: [
                    {
                      beat: 0,
                      brightnessPercent: 25,
                      id: BRIGHTNESS_KEY_1_ID,
                    },
                    {
                      beat: 2,
                      brightnessPercent: 75,
                      easing: 'ease-in-out',
                      id: BRIGHTNESS_KEY_2_ID,
                    },
                  ],
                },
                colour: {
                  interpolation: 'linear-rgb',
                  keyframes: [
                    {
                      beat: 1,
                      easing: 'ease-out',
                      id: COLOUR_KEY_1_ID,
                      paletteTokenId: HOT_PINK_ID,
                    },
                    {
                      beat: 3,
                      id: COLOUR_KEY_2_ID,
                      paletteTokenId: ELECTRIC_GREEN_ID,
                    },
                  ],
                },
              },
            },
          ],
          ledStates: {},
          loopLengthBeats: 4,
          name: 'Keyframed',
        },
      ],
    });

    const layer = project.scenes[0].layers[0];
    expect(layer.kind).toBe('keyframe');
    if (layer.kind !== 'keyframe') throw new Error('Expected keyframe layer');
    expect(layer.tracks.brightness.keyframes).toHaveLength(2);
    expect(
      layer.tracks.brightness.keyframes.map(({ easing }) => easing),
    ).toEqual(['linear', 'ease-in-out']);
    expect(layer.tracks.colour.keyframes.map(({ easing }) => easing)).toEqual([
      'ease-out',
      'linear',
    ]);
    expect(layer.tracks.colour.interpolation).toBe('linear-rgb');
  });

  it('rejects invalid keyframe ordering, IDs, bounds, and palette references', () => {
    const layer = {
      enabled: true,
      endBeat: 4,
      id: KEYFRAME_LAYER_ID,
      kind: 'keyframe',
      locked: false,
      name: 'Keyframes',
      startBeat: 0,
      target: { groupId: 'all-leds', kind: 'profile-group' },
      tracks: {
        brightness: {
          keyframes: [
            {
              beat: 2,
              brightnessPercent: 25,
              id: BRIGHTNESS_KEY_1_ID,
            },
            {
              beat: 1,
              brightnessPercent: 75,
              id: BRIGHTNESS_KEY_2_ID,
            },
          ],
        },
        colour: {
          interpolation: 'step',
          keyframes: [
            {
              beat: 1,
              id: COLOUR_KEY_1_ID,
              paletteTokenId: HOT_PINK_ID,
            },
          ],
        },
      },
    };
    const withLayer = (candidate: typeof layer) => ({
      ...validProject,
      scenes: [
        {
          id: '6c21dc04-9a75-4f10-a7bb-9f17dc2fe32a',
          layers: [candidate],
          ledStates: {},
          loopLengthBeats: 4,
          name: 'Keyframed',
        },
      ],
    });

    expect(ProjectSchema.safeParse(withLayer(layer)).success).toBe(false);

    const invalidEasing = structuredClone(layer);
    Object.assign(invalidEasing.tracks.brightness.keyframes[0], {
      easing: 'spring',
    });
    invalidEasing.tracks.brightness.keyframes.reverse();
    expect(ProjectSchema.safeParse(withLayer(invalidEasing)).success).toBe(
      false,
    );

    const duplicateId = structuredClone(layer);
    duplicateId.tracks.brightness.keyframes.reverse();
    duplicateId.tracks.colour.keyframes[0].id = BRIGHTNESS_KEY_1_ID;
    expect(ProjectSchema.safeParse(withLayer(duplicateId)).success).toBe(false);

    const beyondLoop = structuredClone(layer);
    beyondLoop.tracks.brightness.keyframes.reverse();
    beyondLoop.tracks.brightness.keyframes[1].beat = 4.25;
    expect(ProjectSchema.safeParse(withLayer(beyondLoop)).success).toBe(false);

    const unknownColour = structuredClone(layer);
    unknownColour.tracks.brightness.keyframes.reverse();
    unknownColour.tracks.colour.keyframes[0].paletteTokenId =
      '55555555-5555-4555-8555-555555555555';
    expect(ProjectSchema.safeParse(withLayer(unknownColour)).success).toBe(
      false,
    );
  });

  it('rejects invalid group, target, reference, and layer timing data', () => {
    const baseScene = {
      id: '6c21dc04-9a75-4f10-a7bb-9f17dc2fe32a',
      ledStates: {},
      loopLengthBeats: 4,
      name: 'Animated',
    };
    const pulse = {
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
      endBeat: 4.25,
      id: PULSE_ID,
      kind: 'effect',
      locked: false,
      name: 'Pulse',
      startBeat: 0.1,
      target: { groupId: GROUP_ID, kind: 'project-group' },
    };
    expect(
      ProjectSchema.safeParse({
        ...validProject,
        groups: [{ id: GROUP_ID, ledIds: ['a', 'a'], name: 'Group' }],
        scenes: [{ ...baseScene, layers: [pulse] }],
      }).success,
    ).toBe(false);
    expect(
      ProjectSchema.safeParse({
        ...validProject,
        scenes: [
          {
            ...baseScene,
            layers: [
              {
                ...pulse,
                endBeat: 4,
                startBeat: 0,
                target: { groupId: GROUP_ID, kind: 'project-group' },
              },
            ],
          },
        ],
      }).success,
    ).toBe(false);
  });

  it('rejects duplicate group names', () => {
    expect(
      ProjectSchema.safeParse({
        ...validProject,
        groups: [
          { id: GROUP_ID, ledIds: ['a'], name: 'Markers' },
          { id: CHASE_ID, ledIds: ['b'], name: ' markers ' },
        ],
      }).success,
    ).toBe(false);
  });

  it.each([0, -1, 1.1])('rejects invalid scene loop length %s', (value) => {
    expect(
      ProjectSchema.safeParse({
        ...validProject,
        scenes: [
          {
            id: '6c21dc04-9a75-4f10-a7bb-9f17dc2fe32a',
            ledStates: {},
            loopLengthBeats: value,
            name: 'Scene',
          },
        ],
      }).success,
    ).toBe(false);
  });

  it('rejects duplicate scene names ignoring case and whitespace', () => {
    const scene = {
      id: '6c21dc04-9a75-4f10-a7bb-9f17dc2fe32a',
      ledStates: {},
      loopLengthBeats: 4,
      name: 'Scene',
    };
    expect(
      ProjectSchema.safeParse({
        ...validProject,
        scenes: [
          scene,
          {
            ...scene,
            id: 'da5f1c78-56bd-438e-bfde-220bf24fdf29',
            name: ' scene ',
          },
        ],
      }).success,
    ).toBe(false);
  });

  it('defaults timing for earlier version 2 documents', () => {
    const withoutTiming: Partial<typeof validProject> = { ...validProject };
    delete withoutTiming.timing;
    expect(parseProject(withoutTiming).timing).toEqual({
      previewBpm: 120,
      timeSignature: { denominator: 4, numerator: 4 },
    });
  });

  it('validates tempo and time signatures', () => {
    expect(
      ProjectSchema.safeParse({
        ...validProject,
        timing: { ...validProject.timing, previewBpm: 19 },
      }).success,
    ).toBe(false);
    expect(
      ProjectSchema.safeParse({
        ...validProject,
        timing: {
          previewBpm: 120,
          timeSignature: { denominator: 3, numerator: 4 },
        },
      }).success,
    ).toBe(false);
  });

  it('enforces generous project collection and loop limits', () => {
    expect(
      ProjectSchema.safeParse({
        ...validProject,
        palette: Array.from(
          { length: PROJECT_LIMITS.paletteTokens + 1 },
          (_, index) => ({
            id: generatedId(index),
            name: `Colour ${index}`,
            value: '#FFFFFF',
          }),
        ),
      }).success,
    ).toBe(false);
    expect(
      ProjectSchema.safeParse({
        ...validProject,
        scenes: Array.from(
          { length: PROJECT_LIMITS.scenes + 1 },
          (_, index) => ({
            id: generatedId(index),
            layers: [],
            ledStates: {},
            loopLengthBeats: 4,
            name: `Scene ${index}`,
          }),
        ),
      }).success,
    ).toBe(false);
    expect(
      ProjectSchema.safeParse({
        ...validProject,
        scenes: [
          {
            id: generatedId(1),
            layers: [],
            ledStates: {},
            loopLengthBeats: PROJECT_LIMITS.loopLengthBeats + 0.25,
            name: 'Too long',
          },
        ],
      }).success,
    ).toBe(false);
  });

  it('limits keyframes per track and total project entities', () => {
    let nextId = 100;
    const createKeyframes = () =>
      Array.from({ length: PROJECT_LIMITS.keyframesPerTrack }, (_, index) => ({
        beat: index / 4,
        brightnessPercent: index % 101,
        id: generatedId(nextId++),
      }));
    const createLayer = (index: number) => ({
      enabled: true,
      endBeat: 1024,
      id: generatedId(nextId++),
      kind: 'keyframe' as const,
      locked: false,
      name: `Layer ${index}`,
      startBeat: 0,
      target: { kind: 'leds' as const, ledIds: ['led-1'] },
      tracks: {
        brightness: { keyframes: createKeyframes() },
        colour: { interpolation: 'step' as const, keyframes: [] },
      },
    });
    const oversizedTrack = createLayer(0);
    oversizedTrack.tracks.brightness.keyframes.push({
      beat: 1024,
      brightnessPercent: 100,
      id: generatedId(nextId++),
    });
    expect(
      ProjectSchema.safeParse({
        ...validProject,
        scenes: [
          {
            id: generatedId(nextId++),
            layers: [oversizedTrack],
            ledStates: {},
            loopLengthBeats: 1024,
            name: 'Oversized track',
          },
        ],
      }).success,
    ).toBe(false);

    const layers = Array.from({ length: 13 }, (_, index) => createLayer(index));
    const result = ProjectSchema.safeParse({
      ...validProject,
      scenes: [
        {
          id: generatedId(nextId++),
          layers,
          ledStates: {},
          loopLengthBeats: 1024,
          name: 'Oversized project',
        },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: expect.stringContaining('total entities'),
          }),
        ]),
      );
  });

  it('rejects fields outside the version 2 format', () => {
    expect(
      ProjectSchema.safeParse({ ...validProject, tempo: 120 }).success,
    ).toBe(false);
  });
});

describe('JSON parsing', () => {
  it('parses and validates a project from JSON', () => {
    expect(parseProjectJson(JSON.stringify(validProject))).toEqual(
      validProject,
    );
  });

  it('rejects malformed JSON', () => {
    expect(() => parseProjectJson('{')).toThrow(
      expect.objectContaining({ kind: 'invalid-json' }),
    );
  });

  it('rejects valid JSON that is not a project', () => {
    expect(() => parseProjectJson('{"schemaVersion":2}')).toThrow(
      expect.objectContaining({
        issues: expect.arrayContaining([
          expect.objectContaining({ path: ['name'] }),
        ]),
        kind: 'invalid-project',
      }),
    );
  });

  it('exposes a stable error type without leaking Zod errors', () => {
    try {
      parseProject({ ...validProject, name: '' });
      throw new Error('Expected parsing to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(ProjectFormatError);
      expect(error).toMatchObject({
        kind: 'invalid-project',
        name: 'ProjectFormatError',
      });
    }
  });

  it('serializes a validated project as formatted JSON', () => {
    expect(serializeProject(validProject)).toBe(
      `${JSON.stringify(validProject, null, 2)}\n`,
    );
  });

  it('validates a project again before serialization', () => {
    expect(() => serializeProject({ ...validProject, name: '' })).toThrow();
  });
});
