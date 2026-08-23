import { describe, expect, it } from 'vitest';
import exampleProjectJson from '../../../examples/kms-4-string-31-inlay-v1.ledstudio.json';
import {
  ProjectSchema,
  createProject,
  parseProject,
  parseProjectJson,
} from '../src/index.js';

const validProject = exampleProjectJson;

describe('ProjectSchema', () => {
  it('accepts a version 1 project', () => {
    expect(parseProject(validProject)).toEqual(validProject);
  });

  it('requires schema version 1', () => {
    expect(
      ProjectSchema.safeParse({ ...validProject, schemaVersion: 2 }).success,
    ).toBe(false);
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

  it.each(['Hot-Pink', 'hot_pink', '-hot-pink', 'hot--pink'])(
    'rejects a palette name that is not lowercase kebab-case: %s',
    (name) => {
      expect(
        ProjectSchema.safeParse({
          ...validProject,
          palette: { [name]: '#FF2B9A' },
        }).success,
      ).toBe(false);
    },
  );

  it.each(['#FFF', 'FF2B9A', '#GG2B9A', '#FF2B9AAA'])(
    'rejects an invalid palette colour: %s',
    (colour) => {
      expect(
        ProjectSchema.safeParse({
          ...validProject,
          palette: { 'hot-pink': colour },
        }).success,
      ).toBe(false);
    },
  );

  it('rejects palette values that are not strings', () => {
    expect(
      ProjectSchema.safeParse({
        ...validProject,
        palette: { black: 0 },
      }).success,
    ).toBe(false);
  });

  it('rejects a palette that is not a record', () => {
    expect(
      ProjectSchema.safeParse({ ...validProject, palette: ['#000000'] })
        .success,
    ).toBe(false);
  });

  it('rejects fields outside the version 1 format', () => {
    expect(
      ProjectSchema.safeParse({ ...validProject, scenes: [] }).success,
    ).toBe(false);
  });
});

describe('project creation and JSON parsing', () => {
  it('creates a minimal project with an empty palette', () => {
    expect(
      createProject({
        name: 'Untitled Project',
        hardwareProfile: 'kms-4-string-31-inlay-v1',
      }),
    ).toEqual({
      schemaVersion: 1,
      name: 'Untitled Project',
      hardwareProfile: 'kms-4-string-31-inlay-v1',
      palette: {},
    });
  });

  it('parses and validates a project from JSON', () => {
    expect(parseProjectJson(JSON.stringify(validProject))).toEqual(
      validProject,
    );
  });

  it('rejects malformed JSON', () => {
    expect(() => parseProjectJson('{')).toThrow(SyntaxError);
  });

  it('rejects valid JSON that is not a project', () => {
    expect(() => parseProjectJson('{"schemaVersion":1}')).toThrow();
  });
});
