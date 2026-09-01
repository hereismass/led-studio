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
