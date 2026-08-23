import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';

export interface SelectedProjectFile {
  contents: string;
  fileName: string;
}

function fileNameFromPath(path: string): string {
  return path.replaceAll('\\', '/').split('/').at(-1) || 'Opened project';
}

export async function selectProjectFile(): Promise<SelectedProjectFile | null> {
  const path = await open({
    directory: false,
    multiple: false,
    filters: [
      {
        name: 'LED Studio project',
        extensions: ['json'],
      },
    ],
  });

  if (path === null) {
    return null;
  }

  return {
    contents: await readTextFile(path),
    fileName: fileNameFromPath(path),
  };
}
