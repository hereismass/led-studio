import { HardwareCompatibilityError } from '@led-studio/hardware-profiles';
import { ProjectFormatError } from '@led-studio/project-format';
import { asProjectFileError } from '@/platform/ports/projectFiles';

export function describeProjectError(error: unknown): string {
  if (error instanceof HardwareCompatibilityError) {
    return `This project is not compatible with this build. ${error.message}`;
  }
  if (!(error instanceof ProjectFormatError)) {
    return 'This is not a valid LED Studio project.';
  }
  if (error.kind === 'invalid-json') return 'This file is not valid JSON.';
  const issue = error.issues[0];
  if (!issue) return 'This is not a valid LED Studio project.';
  const path = issue.path.length > 0 ? issue.path.join('.') : 'project';
  return `This is not a valid LED Studio project. ${path}: ${issue.message}`;
}

export function describeStorageError(
  error: unknown,
  action: 'open' | 'save',
): string {
  const fileError = asProjectFileError(error);
  if (!fileError)
    return action === 'open'
      ? 'LED Studio could not read the selected file.'
      : 'LED Studio could not save this project.';
  if (fileError.code === 'file-too-large')
    return 'This project exceeds the 32 MiB file limit.';
  if (fileError.code === 'invalid-handle')
    return 'The original project file is no longer available. Use Save As to choose it again.';
  if (fileError.code === 'path-unavailable')
    return 'The selected file location is no longer available.';
  if (fileError.code === 'registry-unavailable')
    return 'LED Studio cannot access its open-file registry right now.';
  return action === 'open'
    ? 'LED Studio could not read the selected file.'
    : 'LED Studio could not write the selected file.';
}
