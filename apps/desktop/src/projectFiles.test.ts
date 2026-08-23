import { beforeEach, describe, expect, it, vi } from 'vitest';

const { messageMock, openMock, readTextFileMock, saveMock, writeTextFileMock } =
  vi.hoisted(() => ({
    messageMock: vi.fn(),
    openMock: vi.fn(),
    readTextFileMock: vi.fn(),
    saveMock: vi.fn(),
    writeTextFileMock: vi.fn(),
  }));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  message: messageMock,
  open: openMock,
  save: saveMock,
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: readTextFileMock,
  writeTextFile: writeTextFileMock,
}));

import {
  confirmUnsavedProject,
  openProject,
  saveProject,
  saveProjectAs,
  suggestedProjectFileName,
} from './projectFiles';

describe('project file gateway', () => {
  beforeEach(() => {
    messageMock.mockReset();
    openMock.mockReset();
    readTextFileMock.mockReset();
    saveMock.mockReset();
    writeTextFileMock.mockReset();
  });

  it('opens LED Studio and JSON files and retains the full path', async () => {
    openMock.mockResolvedValue('/projects/my-show.ledstudio');
    readTextFileMock.mockResolvedValue('{"schemaVersion":1}');

    await expect(openProject()).resolves.toEqual({
      contents: '{"schemaVersion":1}',
      fileName: 'my-show.ledstudio',
      path: '/projects/my-show.ledstudio',
    });
    expect(openMock).toHaveBeenCalledWith({
      directory: false,
      multiple: false,
      filters: [
        { name: 'LED Studio project', extensions: ['ledstudio', 'json'] },
      ],
    });
    expect(readTextFileMock).toHaveBeenCalledWith(
      '/projects/my-show.ledstudio',
    );
  });

  it('does not read a file when opening is cancelled', async () => {
    openMock.mockResolvedValue(null);

    await expect(openProject()).resolves.toBeNull();
    expect(readTextFileMock).not.toHaveBeenCalled();
  });

  it('writes directly to an existing project path', async () => {
    writeTextFileMock.mockResolvedValue(undefined);

    await saveProject('/projects/show.ledstudio', '{"project":true}\n');

    expect(writeTextFileMock).toHaveBeenCalledWith(
      '/projects/show.ledstudio',
      '{"project":true}\n',
    );
  });

  it('suggests a .ledstudio filename and writes a Save As selection', async () => {
    saveMock.mockResolvedValue('/projects/my-lighting-show.ledstudio');
    writeTextFileMock.mockResolvedValue(undefined);

    await expect(
      saveProjectAs('My Lighting Show', '{"project":true}\n'),
    ).resolves.toEqual({
      fileName: 'my-lighting-show.ledstudio',
      path: '/projects/my-lighting-show.ledstudio',
    });
    expect(saveMock).toHaveBeenCalledWith({
      defaultPath: 'my-lighting-show.ledstudio',
      filters: [{ name: 'LED Studio project', extensions: ['ledstudio'] }],
      title: 'Save LED Studio project',
    });
    expect(writeTextFileMock).toHaveBeenCalledWith(
      '/projects/my-lighting-show.ledstudio',
      '{"project":true}\n',
    );
  });

  it('does not write when Save As is cancelled', async () => {
    saveMock.mockResolvedValue(null);

    await expect(saveProjectAs('My Show', '{}\n')).resolves.toBeNull();
    expect(writeTextFileMock).not.toHaveBeenCalled();
  });

  it.each([
    ['My Lighting Show', 'my-lighting-show.ledstudio'],
    ['  already---spaced  ', 'already-spaced.ledstudio'],
    ['🎸', 'untitled-project.ledstudio'],
  ])('suggests a safe filename for %j', (name, expected) => {
    expect(suggestedProjectFileName(name)).toBe(expected);
  });

  it.each([
    ['Save', 'save'],
    ['Discard', 'discard'],
    ['Cancel', 'cancel'],
  ] as const)(
    'maps the %s unsaved-project decision',
    async (response, expected) => {
      messageMock.mockResolvedValue(response);

      await expect(confirmUnsavedProject('My Show')).resolves.toBe(expected);
      expect(messageMock).toHaveBeenCalledWith(
        'Do you want to save changes to “My Show” before choosing another project?',
        {
          buttons: { yes: 'Save', no: 'Discard', cancel: 'Cancel' },
          kind: 'warning',
          title: 'Unsaved project',
        },
      );
    },
  );

  it('extracts filenames from Windows-style paths', async () => {
    openMock.mockResolvedValue('C:\\projects\\show.ledstudio');
    readTextFileMock.mockResolvedValue('{}');

    await expect(openProject()).resolves.toMatchObject({
      fileName: 'show.ledstudio',
    });
  });
});
