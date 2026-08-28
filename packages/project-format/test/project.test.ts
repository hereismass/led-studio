import { describe, expect, it } from 'vitest';
import {
  ProjectSchema,
  ProjectFormatError,
  parseProject,
  parseProjectJson,
  serializeProject,
  type Project,
} from '../src/index.js';

const HOT_PINK_ID = '8b2c3d4e-5f60-4a71-8b92-c3d4e5f60718';
const ELECTRIC_GREEN_ID = '1a2b3c4d-5e6f-4789-8abc-def012345678';
const BLACK_ID = 'f0e1d2c3-b4a5-4678-9abc-def012345678';
const GROUP_ID = 'ad56c792-07e6-42d7-84fd-0b509289b4ab';
const PULSE_ID = 'bb93ef72-0987-4b53-9924-9a720215ce8a';
const CHASE_ID = '2ac65eaf-4c2c-482e-b525-1c6e941dd0c8';

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
  sequence: [],
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
    const { name: _, ...projectWithoutName } = validProject;
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

  it('requires the reserved sequence collection to remain empty', () => {
    expect(
      ProjectSchema.safeParse({ ...validProject, sequence: [{}] }).success,
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

  it('accepts project groups and typed Pulse and Chase layers', () => {
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
              locked: false,
              name: 'Pulse',
              startBeat: 0,
              target: { groupId: GROUP_ID, kind: 'project-group' },
            },
            {
              effect: {
                brightnessPercent: 80,
                direction: 'reverse',
                paletteTokenId: ELECTRIC_GREEN_ID,
                stepLengthBeats: 0.25,
                trailLength: 2,
                type: 'chase',
                width: 1,
              },
              enabled: true,
              endBeat: 4,
              id: CHASE_ID,
              locked: true,
              name: 'Chase',
              startBeat: 1,
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
    expect(project.scenes[0].layers.map((layer) => layer.effect.type)).toEqual([
      'pulse',
      'chase',
    ]);
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
    const { timing: _, ...withoutTiming } = validProject;
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
