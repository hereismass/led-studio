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
  releaseProject(file: ProjectFileReference): Promise<void>;
  saveProject(file: ProjectFileReference, contents: string): Promise<void>;
  saveProjectAs(
    suggestedName: string,
    contents: string,
  ): Promise<ProjectFileReference | null>;
}

export type ProjectFileErrorCode =
  | 'file-too-large'
  | 'invalid-handle'
  | 'path-unavailable'
  | 'read-failed'
  | 'registry-unavailable'
  | 'write-failed';

export interface ProjectFileError {
  code: ProjectFileErrorCode;
  message: string;
}

export function asProjectFileError(error: unknown): ProjectFileError | null {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('code' in error) ||
    !('message' in error) ||
    typeof error.code !== 'string' ||
    typeof error.message !== 'string'
  )
    return null;
  const codes: ProjectFileErrorCode[] = [
    'file-too-large',
    'invalid-handle',
    'path-unavailable',
    'read-failed',
    'registry-unavailable',
    'write-failed',
  ];
  return codes.includes(error.code as ProjectFileErrorCode)
    ? { code: error.code as ProjectFileErrorCode, message: error.message }
    : null;
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

export async function releaseProject(
  file: ProjectFileReference,
): Promise<void> {
  await invoke('release_project_file', { handle: file.handle });
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
  releaseProject,
  saveProject,
  saveProjectAs,
};

export const nativeUnsavedChangesGateway: UnsavedChangesGateway = {
  confirmUnsavedChanges,
};
