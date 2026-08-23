import { invoke } from '@tauri-apps/api/core';
import { message } from '@tauri-apps/plugin-dialog';

export interface ProjectFileReference {
  fileName: string;
  handle: string;
}

export interface OpenedProjectFile extends ProjectFileReference {
  contents: string;
}

export interface ProjectStorageGateway {
  openProject(): Promise<OpenedProjectFile | null>;
  saveProject(file: ProjectFileReference, contents: string): Promise<void>;
  saveProjectAs(
    suggestedName: string,
    contents: string,
  ): Promise<ProjectFileReference | null>;
}

export type UnsavedChangesDecision = 'cancel' | 'discard' | 'save';
export type UnsavedChangesIntent = 'choose-another' | 'quit';

export interface UnsavedChangesGateway {
  confirmUnsavedChanges(
    name: string,
    intent: UnsavedChangesIntent,
  ): Promise<UnsavedChangesDecision>;
}

export async function openProject(): Promise<OpenedProjectFile | null> {
  return invoke<OpenedProjectFile | null>('open_project');
}

export async function saveProject(
  file: ProjectFileReference,
  contents: string,
): Promise<void> {
  await invoke('save_project', { contents, handle: file.handle });
}

export async function saveProjectAs(
  suggestedName: string,
  contents: string,
): Promise<ProjectFileReference | null> {
  return invoke<ProjectFileReference | null>('save_project_as', {
    contents,
    suggestedName,
  });
}

export async function confirmUnsavedChanges(
  name: string,
  intent: UnsavedChangesIntent,
): Promise<UnsavedChangesDecision> {
  const action =
    intent === 'quit' ? 'quitting LED Studio' : 'choosing another project';
  const response = await message(
    `Do you want to save changes to “${name}” before ${action}?`,
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

export const nativeProjectStorageGateway: ProjectStorageGateway = {
  openProject,
  saveProject,
  saveProjectAs,
};

export const nativeUnsavedChangesGateway: UnsavedChangesGateway = {
  confirmUnsavedChanges,
};
