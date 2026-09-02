import {
  PROJECT_LIMITS,
  ProjectEntityIdSchema,
  type Project,
} from '@led-studio/project-format';
import { projectEntityIds } from './projectQueries.js';

export type EditorCommandErrorCode =
  | 'duplicate-entity-id'
  | 'duplicate-name'
  | 'invalid-command'
  | 'missing-entity'
  | 'entity-in-use'
  | 'locked-entity'
  | 'palette-token-in-use'
  | 'unknown-hardware-profile';

export class EditorCommandError extends Error {
  constructor(
    readonly code: EditorCommandErrorCode,
    message: string,
    readonly referenceCount?: number,
  ) {
    super(message);
    this.name = 'EditorCommandError';
  }
}

export type ProjectEntityIdFactory = () => string;

interface CommandValueSchema<T> {
  safeParse(
    input: unknown,
  ):
    | { data: T; success: true }
    | { error: { issues: readonly { message: string }[] }; success: false };
}

export function parseCommandValue<T>(
  schema: CommandValueSchema<T>,
  input: unknown,
): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw new EditorCommandError(
    'invalid-command',
    result.error.issues[0]?.message ?? 'The edit is not valid.',
  );
}

export function normalizedName(name: string): string {
  return name.trim().toLowerCase();
}

export function uniqueName(
  existingNames: string[],
  preferredName: string,
): string {
  const baseName = preferredName.trim();
  const normalizedNames = new Set(existingNames.map(normalizedName));
  if (!normalizedNames.has(normalizedName(baseName))) return baseName;

  let suffix = 2;
  while (normalizedNames.has(normalizedName(`${baseName} ${suffix}`))) {
    suffix += 1;
  }
  return `${baseName} ${suffix}`;
}

export function createEntityId(
  project: Project,
  idFactory: ProjectEntityIdFactory,
): string {
  const existingIds = projectEntityIds(project);
  let id = ProjectEntityIdSchema.parse(idFactory());
  while (existingIds.has(id)) id = ProjectEntityIdSchema.parse(idFactory());
  return id;
}

export function assertNewEntityId(project: Project, id: string): string {
  return assertNewEntityIds(project, [id])[0];
}

export function assertNewEntityIds(
  project: Project,
  ids: readonly string[],
): string[] {
  const reserved = projectEntityIds(project);
  if (reserved.size + ids.length > PROJECT_LIMITS.totalEntities) {
    throw new EditorCommandError(
      'invalid-command',
      `Projects cannot contain more than ${PROJECT_LIMITS.totalEntities} total entities.`,
    );
  }
  return ids.map((id) => {
    const parsedId = parseCommandValue(ProjectEntityIdSchema, id);
    if (reserved.has(parsedId)) {
      throw new EditorCommandError(
        'duplicate-entity-id',
        `Entity ID "${parsedId}" is already in use.`,
      );
    }
    reserved.add(parsedId);
    return parsedId;
  });
}

export function assertCollectionCapacity(
  current: number,
  maximum: number,
  subject: string,
): void {
  if (current >= maximum) {
    throw new EditorCommandError(
      'invalid-command',
      `${subject} cannot contain more than ${maximum} items.`,
    );
  }
}
