import { describe, expect, it } from 'vitest';
import type { Project } from '@led-studio/project-format';
import {
  initialProjectSessionState,
  isProjectDirty,
  projectSessionReducer,
  type ActiveProjectSession,
} from './projectSession';

const project: Project = {
  hardwareProfile: 'test-profile',
  name: 'Test project',
  palette: {},
  schemaVersion: 1,
};

function activeProject(
  overrides: Partial<ActiveProjectSession> = {},
): ActiveProjectSession {
  return {
    currentRevision: 0,
    project,
    savedRevision: 0,
    source: {
      file: { fileName: 'test.ledstudio', handle: 'project-file-1' },
      kind: 'file',
    },
    ...overrides,
  };
}

describe('project session reducer', () => {
  it('derives unsaved and revision-based dirty state', () => {
    expect(isProjectDirty(activeProject())).toBe(false);
    expect(isProjectDirty(activeProject({ savedRevision: null }))).toBe(true);
    expect(
      isProjectDirty(activeProject({ currentRevision: 2, savedRevision: 1 })),
    ).toBe(true);
  });

  it('increments the revision when the document is replaced', () => {
    const state = projectSessionReducer(
      { ...initialProjectSessionState, activeProject: activeProject() },
      {
        project: { ...project, name: 'Edited project' },
        type: 'project-replaced',
      },
    );

    expect(state.activeProject).toMatchObject({
      currentRevision: 1,
      project: { name: 'Edited project' },
      savedRevision: 0,
    });
    expect(isProjectDirty(state.activeProject!)).toBe(true);
  });

  it('keeps later edits dirty when an older saved revision completes', () => {
    const state = projectSessionReducer(
      {
        ...initialProjectSessionState,
        activeProject: activeProject({ currentRevision: 2, savedRevision: 0 }),
        operation: 'saving',
      },
      {
        file: { fileName: 'copy.ledstudio', handle: 'project-file-2' },
        revision: 1,
        type: 'save-succeeded',
      },
    );

    expect(state.activeProject).toMatchObject({
      currentRevision: 2,
      savedRevision: 1,
      source: {
        file: { fileName: 'copy.ledstudio', handle: 'project-file-2' },
        kind: 'file',
      },
    });
    expect(isProjectDirty(state.activeProject!)).toBe(true);
  });
});
