import { createProject, type Project } from '@led-studio/project-format';
import { describe, expect, it } from 'vitest';
import { applyEditorCommand } from './editorCommands';

const HOT_PINK_ID = '8b2c3d4e-5f60-4a71-8b92-c3d4e5f60718';
const BLACK_ID = 'f0e1d2c3-b4a5-4678-9abc-def012345678';
const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function projectWithPalette(): Project {
  return {
    ...createProject({ name: 'Test Project', hardwareProfile: 'test-profile' }),
    palette: [
      { id: HOT_PINK_ID, name: 'Hot Pink', value: '#FF2B9A' },
      { id: BLACK_ID, name: 'Black', value: '#000000' },
    ],
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
});
