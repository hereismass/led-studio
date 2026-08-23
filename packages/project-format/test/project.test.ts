import { describe, expect, it } from 'vitest';
import {
  ProjectSchema,
  ProjectFormatError,
  createProject,
  generatePaletteTokenId,
  parseProject,
  parseProjectJson,
  serializeProject,
  type Project,
} from '../src/index.js';

const HOT_PINK_ID = '8b2c3d4e-5f60-4a71-8b92-c3d4e5f60718';
const ELECTRIC_GREEN_ID = '1a2b3c4d-5e6f-4789-8abc-def012345678';
const BLACK_ID = 'f0e1d2c3-b4a5-4678-9abc-def012345678';

const validProject: Project = {
  schemaVersion: 2,
  name: 'KMS 4-String Bass Example',
  hardwareProfile: 'kms-4-string-31-inlay-v1',
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

  it.each(['sequence', 'groups'] as const)(
    'requires the reserved %s collection to remain empty',
    (collection) => {
      expect(
        ProjectSchema.safeParse({
          ...validProject,
          [collection]: [{}],
        }).success,
      ).toBe(false);
    },
  );

  it('accepts static scenes and validates their linked palette tokens', () => {
    const scene = {
      id: '6c21dc04-9a75-4f10-a7bb-9f17dc2fe32a',
      ledStates: {
        'fret-03-primary': {
          brightnessPercent: 75,
          paletteTokenId: HOT_PINK_ID,
        },
      },
      loopLengthBeats: 4.25,
      name: 'Marker Glow',
    };
    expect(parseProject({ ...validProject, scenes: [scene] }).scenes).toEqual([
      scene,
    ]);
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

describe('project creation and JSON parsing', () => {
  it('creates a minimal project with a white palette token', () => {
    const project = createProject({
      name: 'Untitled Project',
      hardwareProfile: 'kms-4-string-31-inlay-v1',
    });

    expect(project).toEqual({
      schemaVersion: 2,
      name: 'Untitled Project',
      hardwareProfile: 'kms-4-string-31-inlay-v1',
      palette: [
        {
          id: expect.stringMatching(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
          ),
          name: 'White',
          value: '#FFFFFF',
        },
      ],
      scenes: [],
      sequence: [],
      groups: [],
      timing: {
        previewBpm: 120,
        timeSignature: { denominator: 4, numerator: 4 },
      },
    });
  });

  it('generates opaque UUID v4 palette token IDs', () => {
    expect(generatePaletteTokenId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

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
