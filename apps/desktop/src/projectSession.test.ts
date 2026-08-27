import { createProject } from '@led-studio/project-format';
import { describe, expect, it } from 'vitest';
import {
  createActiveProjectSession,
  initialProjectSessionState,
  isProjectDirty,
  projectSessionReducer,
  type ActiveProjectSession,
  type ProjectSessionState,
} from './projectSession';

const project = createProject({
  hardwareProfile: 'kms-4-string-10-led-v1',
  name: 'Test project',
});

function activeProject(savedRevision: number | null = 0): ActiveProjectSession {
  return createActiveProjectSession(
    project,
    {
      file: { fileName: 'test.ledstudio', handle: 'project-file-1' },
      kind: 'file',
    },
    savedRevision,
  );
}

function stateWith(activeProject: ActiveProjectSession): ProjectSessionState {
  return { ...initialProjectSessionState, activeProject };
}

function rename(state: ProjectSessionState, name: string): ProjectSessionState {
  return projectSessionReducer(state, {
    command: { name, type: 'project-renamed' },
    type: 'editor-command-executed',
  });
}

describe('project session reducer', () => {
  it('derives unsaved and revision-based dirty state', () => {
    expect(isProjectDirty(activeProject())).toBe(false);
    expect(isProjectDirty(activeProject(null))).toBe(true);

    const edited = rename(stateWith(activeProject()), 'Edited project');
    expect(isProjectDirty(edited.activeProject!)).toBe(true);
  });

  it('adds one history revision for a command and ignores no-ops', () => {
    const original = stateWith(activeProject());
    const edited = rename(original, 'Edited project');
    const noOp = rename(edited, 'Edited project');

    expect(edited.activeProject).toMatchObject({
      nextRevision: 2,
      past: [{ revision: 0 }],
      present: { project: { name: 'Edited project' }, revision: 1 },
      savedRevision: 0,
    });
    expect(noOp).toBe(edited);
  });

  it('undoes to the saved revision and redoes the edit', () => {
    const edited = rename(stateWith(activeProject()), 'Edited project');
    const undone = projectSessionReducer(edited, { type: 'undo-requested' });
    const redone = projectSessionReducer(undone, { type: 'redo-requested' });

    expect(undone.activeProject?.present).toMatchObject({
      project: { name: 'Test project' },
      revision: 0,
    });
    expect(isProjectDirty(undone.activeProject!)).toBe(false);
    expect(redone.activeProject?.present).toMatchObject({
      project: { name: 'Edited project' },
      revision: 1,
    });
    expect(isProjectDirty(redone.activeProject!)).toBe(true);
  });

  it('recognizes a saved revision reached again through redo', () => {
    const edited = rename(stateWith(activeProject()), 'Edited project');
    const saved = projectSessionReducer(
      { ...edited, operation: 'saving' },
      {
        file: { fileName: 'test.ledstudio', handle: 'project-file-1' },
        revision: 1,
        type: 'save-succeeded',
      },
    );
    const undone = projectSessionReducer(saved, { type: 'undo-requested' });
    const redone = projectSessionReducer(undone, { type: 'redo-requested' });

    expect(isProjectDirty(saved.activeProject!)).toBe(false);
    expect(isProjectDirty(undone.activeProject!)).toBe(true);
    expect(isProjectDirty(redone.activeProject!)).toBe(false);
  });

  it('truncates redo history and keeps revision IDs monotonic after branching', () => {
    let state = rename(stateWith(activeProject()), 'First edit');
    state = rename(state, 'Second edit');
    state = projectSessionReducer(state, { type: 'undo-requested' });
    state = rename(state, 'Branched edit');

    expect(state.activeProject).toMatchObject({
      future: [],
      nextRevision: 4,
      present: { project: { name: 'Branched edit' }, revision: 3 },
    });
    expect(projectSessionReducer(state, { type: 'redo-requested' })).toBe(
      state,
    );
  });

  it('keeps later edits dirty when an older saved revision completes', () => {
    let state = rename(stateWith(activeProject()), 'First edit');
    state = rename(state, 'Later edit');
    state = projectSessionReducer(
      { ...state, operation: 'saving' },
      {
        file: { fileName: 'copy.ledstudio', handle: 'project-file-2' },
        revision: 1,
        type: 'save-succeeded',
      },
    );

    expect(state.activeProject).toMatchObject({
      present: { revision: 2 },
      savedRevision: 1,
      source: {
        file: { fileName: 'copy.ledstudio', handle: 'project-file-2' },
        kind: 'file',
      },
    });
    expect(isProjectDirty(state.activeProject!)).toBe(true);
  });

  it('replaces all history when another project is activated', () => {
    const edited = rename(stateWith(activeProject()), 'Edited project');
    const replacement = createActiveProjectSession(
      createProject({
        name: 'Replacement',
        hardwareProfile: 'kms-4-string-10-led-v1',
      }),
      { kind: 'new' },
      null,
    );
    const activated = projectSessionReducer(edited, {
      activeProject: replacement,
      type: 'project-activated',
    });

    expect(activated.activeProject).toEqual(replacement);
    expect(activated.activeProject?.past).toEqual([]);
    expect(activated.activeProject?.future).toEqual([]);
  });
});
