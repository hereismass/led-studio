import { message, open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';

export interface ProjectFileReference {
  fileName: string;
  path: string;
}

export interface OpenedProjectFile extends ProjectFileReference {
  contents: string;
}

export type UnsavedProjectDecision = 'cancel' | 'discard' | 'save';

export interface ProjectFileGateway {
  confirmUnsavedProject(name: string): Promise<UnsavedProjectDecision>;
  openProject(): Promise<OpenedProjectFile | null>;
  saveProject(path: string, contents: string): Promise<void>;
  saveProjectAs(
    suggestedName: string,
    contents: string,
  ): Promise<ProjectFileReference | null>;
}

function fileNameFromPath(path: string): string {
  return path.replaceAll('\\', '/').split('/').at(-1) || 'Opened project';
}

export function suggestedProjectFileName(projectName: string): string {
  const stem = projectName
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${stem || 'untitled-project'}.ledstudio`;
}

export async function openProject(): Promise<OpenedProjectFile | null> {
  const path = await open({
    directory: false,
    multiple: false,
    filters: [
      {
        name: 'LED Studio project',
        extensions: ['ledstudio', 'json'],
      },
    ],
  });

  if (path === null) {
    return null;
  }

  return {
    contents: await readTextFile(path),
    fileName: fileNameFromPath(path),
    path,
  };
}

export async function saveProject(
  path: string,
  contents: string,
): Promise<void> {
  await writeTextFile(path, contents);
}

export async function saveProjectAs(
  suggestedName: string,
  contents: string,
): Promise<ProjectFileReference | null> {
  const path = await save({
    defaultPath: suggestedProjectFileName(suggestedName),
    filters: [{ name: 'LED Studio project', extensions: ['ledstudio'] }],
    title: 'Save LED Studio project',
  });

  if (path === null) {
    return null;
  }

  await writeTextFile(path, contents);

  return {
    fileName: fileNameFromPath(path),
    path,
  };
}

export async function confirmUnsavedProject(
  name: string,
): Promise<UnsavedProjectDecision> {
  const response = await message(
    `Do you want to save changes to “${name}” before choosing another project?`,
    {
      buttons: { yes: 'Save', no: 'Discard', cancel: 'Cancel' },
      kind: 'warning',
      title: 'Unsaved project',
    },
  );

  if (response === 'Save') {
    return 'save';
  }

  if (response === 'Discard') {
    return 'discard';
  }

  return 'cancel';
}

export const nativeProjectFileGateway: ProjectFileGateway = {
  confirmUnsavedProject,
  openProject,
  saveProject,
  saveProjectAs,
};
