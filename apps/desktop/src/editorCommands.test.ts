import { createProject, type Project } from '@led-studio/project-format';
import { describe, expect, it } from 'vitest';
import {
  applyEditorCommand,
  EditorCommandError,
  paletteTokenUsageCount,
} from './editorCommands';

const HOT_PINK_ID = '8b2c3d4e-5f60-4a71-8b92-c3d4e5f60718';
const BLACK_ID = 'f0e1d2c3-b4a5-4678-9abc-def012345678';
const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function projectWithPalette(): Project {
  return {
    ...createProject({
      name: 'Test Project',
      hardwareProfile: 'kms-4-string-10-led-v1',
    }),
    palette: [
      { id: HOT_PINK_ID, name: 'Hot Pink', value: '#FF2B9A' },
      { id: BLACK_ID, name: 'Black', value: '#000000' },
    ],
    scenes: [],
  };
}

describe('editor commands', () => {
  it('renames the project without mutating the input', () => {
    const project = projectWithPalette();
    const renamed = applyEditorCommand(project, {
      name: '  Renamed Project  ',
      type: 'project-renamed',
    });

    expect(renamed.name).toBe('Renamed Project');
    expect(project.name).toBe('Test Project');
  });

  it('returns the same project for a semantic no-op', () => {
    const project = projectWithPalette();
    expect(
      applyEditorCommand(project, {
        id: HOT_PINK_ID,
        changes: { value: '#ff2b9a' },
        type: 'palette-token-updated',
      }),
    ).toBe(project);
  });

  it('adds collision-free default tokens at the end', () => {
    let project = projectWithPalette();
    project = applyEditorCommand(project, { type: 'palette-token-added' });
    project = applyEditorCommand(project, { type: 'palette-token-added' });

    const added = project.palette.slice(-2);
    expect(added).toMatchObject([
      { name: 'New Colour', value: '#FFFFFF' },
      { name: 'New Colour 2', value: '#FFFFFF' },
    ]);
    expect(added[0].id).toMatch(UUID_V4_PATTERN);
    expect(added[1].id).toMatch(UUID_V4_PATTERN);
    expect(added[0].id).not.toBe(added[1].id);
  });

  it('updates names and colours while retaining the stable ID', () => {
    const project = applyEditorCommand(projectWithPalette(), {
      id: HOT_PINK_ID,
      changes: { name: 'Magenta', value: '#aabbcc' },
      type: 'palette-token-updated',
    });

    expect(project.palette[0]).toEqual({
      id: HOT_PINK_ID,
      name: 'Magenta',
      value: '#AABBCC',
    });
  });

  it('rejects duplicate display names ignoring case', () => {
    expect(() =>
      applyEditorCommand(projectWithPalette(), {
        id: BLACK_ID,
        changes: { name: 'hot pink' },
        type: 'palette-token-updated',
      }),
    ).toThrow();
  });

  it('duplicates immediately after the source with a unique identity', () => {
    let project = projectWithPalette();
    project = applyEditorCommand(project, {
      id: HOT_PINK_ID,
      type: 'palette-token-duplicated',
    });
    project = applyEditorCommand(project, {
      id: HOT_PINK_ID,
      type: 'palette-token-duplicated',
    });

    expect(project.palette.slice(0, 3)).toMatchObject([
      { id: HOT_PINK_ID, name: 'Hot Pink', value: '#FF2B9A' },
      { name: 'Hot Pink Copy 2', value: '#FF2B9A' },
      { name: 'Hot Pink Copy', value: '#FF2B9A' },
    ]);
    expect(project.palette[1].id).toMatch(UUID_V4_PATTERN);
    expect(project.palette[2].id).toMatch(UUID_V4_PATTERN);
    expect(new Set(project.palette.map((token) => token.id)).size).toBe(4);
  });

  it('deletes a token without mutating the original project', () => {
    const original = projectWithPalette();
    const project = applyEditorCommand(original, {
      id: HOT_PINK_ID,
      type: 'palette-token-deleted',
    });

    expect(project.palette.map((token) => token.id)).toEqual([BLACK_ID]);
    expect(original.palette).toHaveLength(2);
  });

  it('creates, updates, duplicates, and deletes static scenes', () => {
    let project = applyEditorCommand(projectWithPalette(), {
      type: 'scene-added',
    });
    const sceneId = project.scenes[0].id;
    expect(project.scenes[0]).toMatchObject({
      ledStates: {},
      loopLengthBeats: 4,
      name: 'Scene 1',
    });
    expect(sceneId).toMatch(UUID_V4_PATTERN);

    project = applyEditorCommand(project, {
      changes: { loopLengthBeats: 3.25, name: 'Verse' },
      id: sceneId,
      type: 'scene-updated',
    });
    project = applyEditorCommand(project, {
      id: sceneId,
      type: 'scene-duplicated',
    });
    expect(project.scenes).toMatchObject([
      { loopLengthBeats: 3.25, name: 'Verse' },
      { loopLengthBeats: 3.25, name: 'Verse Copy' },
    ]);
    expect(project.scenes[1].id).not.toBe(sceneId);

    project = applyEditorCommand(project, {
      id: sceneId,
      type: 'scene-deleted',
    });
    expect(project.scenes.map(({ name }) => name)).toEqual(['Verse Copy']);
  });

  it('paints selected LEDs, preserves brightness, and represents off by absence', () => {
    let project = applyEditorCommand(projectWithPalette(), {
      type: 'scene-added',
    });
    const sceneId = project.scenes[0].id;
    project = applyEditorCommand(project, {
      ledIds: ['fret-03-e-side', 'fret-12-g-side'],
      paletteTokenId: HOT_PINK_ID,
      sceneId,
      type: 'scene-leds-painted',
    });
    expect(project.scenes[0].ledStates['fret-03-e-side']).toEqual({
      brightnessPercent: 100,
      paletteTokenId: HOT_PINK_ID,
    });

    project = applyEditorCommand(project, {
      brightnessPercent: 40,
      ledIds: ['fret-03-e-side'],
      sceneId,
      type: 'scene-led-brightness-set',
    });
    project = applyEditorCommand(project, {
      ledIds: ['fret-03-e-side'],
      paletteTokenId: BLACK_ID,
      sceneId,
      type: 'scene-leds-painted',
    });
    expect(project.scenes[0].ledStates['fret-03-e-side']).toEqual({
      brightnessPercent: 40,
      paletteTokenId: BLACK_ID,
    });

    project = applyEditorCommand(project, {
      ledIds: ['fret-03-e-side'],
      sceneId,
      type: 'scene-leds-turned-off',
    });
    expect(project.scenes[0].ledStates['fret-03-e-side']).toBeUndefined();
  });

  it('blocks deletion of palette tokens referenced by scenes', () => {
    let project = applyEditorCommand(projectWithPalette(), {
      type: 'scene-added',
    });
    project = applyEditorCommand(project, {
      ledIds: ['fret-12-e-side', 'fret-12-g-side'],
      paletteTokenId: HOT_PINK_ID,
      sceneId: project.scenes[0].id,
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
  });

  it('updates project preview timing', () => {
    const project = applyEditorCommand(projectWithPalette(), {
      changes: {
        previewBpm: 96,
        timeSignature: { denominator: 8, numerator: 6 },
      },
      type: 'project-timing-updated',
    });
    expect(project.timing).toEqual({
      previewBpm: 96,
      timeSignature: { denominator: 8, numerator: 6 },
    });
  });
});
