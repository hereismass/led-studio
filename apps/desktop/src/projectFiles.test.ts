import { beforeEach, describe, expect, it, vi } from 'vitest';

const { openMock, readTextFileMock } = vi.hoisted(() => ({
  openMock: vi.fn(),
  readTextFileMock: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: openMock,
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: readTextFileMock,
}));

import { selectProjectFile } from './projectFiles';

describe('selectProjectFile', () => {
  beforeEach(() => {
    openMock.mockReset();
    readTextFileMock.mockReset();
  });

  it('opens one JSON file and returns its name and contents', async () => {
    openMock.mockResolvedValue('/projects/my-show.ledstudio.json');
    readTextFileMock.mockResolvedValue('{"schemaVersion":1}');

    await expect(selectProjectFile()).resolves.toEqual({
      contents: '{"schemaVersion":1}',
      fileName: 'my-show.ledstudio.json',
    });
    expect(openMock).toHaveBeenCalledWith({
      directory: false,
      multiple: false,
      filters: [{ name: 'LED Studio project', extensions: ['json'] }],
    });
    expect(readTextFileMock).toHaveBeenCalledWith(
      '/projects/my-show.ledstudio.json',
    );
  });

  it('does not read a file when selection is cancelled', async () => {
    openMock.mockResolvedValue(null);

    await expect(selectProjectFile()).resolves.toBeNull();
    expect(readTextFileMock).not.toHaveBeenCalled();
  });

  it('extracts a filename from Windows-style paths', async () => {
    openMock.mockResolvedValue('C:\\projects\\show.json');
    readTextFileMock.mockResolvedValue('{}');

    await expect(selectProjectFile()).resolves.toMatchObject({
      fileName: 'show.json',
    });
  });
});
