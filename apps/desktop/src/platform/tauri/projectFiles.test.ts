import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invokeMock, messageMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  messageMock: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ message: messageMock }));

import {
  confirmUnsavedChanges,
  openProject,
  releaseProject,
  saveProject,
  saveProjectAs,
} from './projectFiles';
import { asProjectFileError } from '@/platform/ports/projectFiles';

describe('project storage adapter', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    messageMock.mockReset();
  });

  it('opens projects through the native command', async () => {
    const opened = {
      contents: '{"schemaVersion":2}',
      fileName: 'show.ledstudio',
      handle: 'project-file-1',
    };
    invokeMock.mockResolvedValue(opened);

    await expect(openProject()).resolves.toEqual(opened);
    expect(invokeMock).toHaveBeenCalledWith('open_project');
  });

  it('saves through an opaque native file handle', async () => {
    invokeMock.mockResolvedValue(undefined);

    await saveProject(
      { fileName: 'show.ledstudio', handle: 'project-file-1' },
      '{"project":true}\n',
    );

    expect(invokeMock).toHaveBeenCalledWith('save_project', {
      contents: '{"project":true}\n',
      handle: 'project-file-1',
    });
  });

  it('releases an opaque native file handle', async () => {
    invokeMock.mockResolvedValue(undefined);

    await releaseProject({
      fileName: 'show.ledstudio',
      handle: 'project-file-1',
    });

    expect(invokeMock).toHaveBeenCalledWith('release_project_file', {
      handle: 'project-file-1',
    });
  });

  it('recognizes only structured native project-file errors', () => {
    expect(
      asProjectFileError({
        code: 'file-too-large',
        message: 'Project is too large',
      }),
    ).toEqual({
      code: 'file-too-large',
      message: 'Project is too large',
    });
    expect(asProjectFileError(new Error('Project is too large'))).toBeNull();
    expect(
      asProjectFileError({ code: 'unexpected', message: 'Unknown' }),
    ).toBeNull();
  });

  it('passes Save As selection and writing to Rust', async () => {
    const saved = {
      fileName: 'my-lighting-show.ledstudio',
      handle: 'project-file-2',
    };
    invokeMock.mockResolvedValue(saved);

    await expect(
      saveProjectAs('My Lighting Show', '{"project":true}\n'),
    ).resolves.toEqual(saved);
    expect(invokeMock).toHaveBeenCalledWith('save_project_as', {
      contents: '{"project":true}\n',
      suggestedName: 'My Lighting Show',
    });
  });

  it.each([
    ['Save', 'save'],
    ['Discard', 'discard'],
    ['Cancel', 'cancel'],
  ] as const)(
    'maps the %s unsaved-project decision',
    async (response, expected) => {
      messageMock.mockResolvedValue(response);

      await expect(
        confirmUnsavedChanges('My Show', 'choose-another'),
      ).resolves.toBe(expected);
    },
  );

  it.each([
    ['choose-another', 'choosing another project'],
    ['quit', 'quitting LED Studio'],
  ] as const)('uses intent-specific copy for %s', async (intent, wording) => {
    messageMock.mockResolvedValue('Cancel');

    await confirmUnsavedChanges('My Show', intent);

    expect(messageMock).toHaveBeenCalledWith(
      `Do you want to save changes to “My Show” before ${wording}?`,
      {
        buttons: { yes: 'Save', no: 'Discard', cancel: 'Cancel' },
        kind: 'warning',
        title: 'Unsaved project',
      },
    );
  });
});
