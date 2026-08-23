import { z } from 'zod';

export const PROJECT_SCHEMA_VERSION = 2 as const;

export const PaletteTokenIdSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    'Palette token IDs must be lowercase UUID v4 values',
  );

export const PaletteTokenNameSchema = z
  .string()
  .trim()
  .min(1, 'Palette token names cannot be empty');

export const HexColourSchema = z
  .string()
  .regex(
    /^#[0-9A-F]{6}$/,
    'Palette colours must be uppercase six-digit hex values',
  );

export const PaletteTokenSchema = z
  .object({
    id: PaletteTokenIdSchema,
    name: PaletteTokenNameSchema,
    value: HexColourSchema,
  })
  .strict();

const ReservedCollectionSchema = z
  .array(z.never())
  .max(0, 'This collection is reserved and must remain empty');

export const ProjectSchema = z
  .object({
    schemaVersion: z.literal(PROJECT_SCHEMA_VERSION),
    name: z.string().trim().min(1, 'Project name cannot be empty'),
    hardwareProfile: z
      .string()
      .trim()
      .min(1, 'Hardware profile cannot be empty'),
    palette: z.array(PaletteTokenSchema),
    scenes: ReservedCollectionSchema,
    sequence: ReservedCollectionSchema,
    groups: ReservedCollectionSchema,
  })
  .strict()
  .superRefine((project, context) => {
    const ids = new Set<string>();
    const names = new Set<string>();

    project.palette.forEach((token, index) => {
      if (ids.has(token.id)) {
        context.addIssue({
          code: 'custom',
          message: `Palette token ID "${token.id}" is already in use`,
          path: ['palette', index, 'id'],
        });
      }
      ids.add(token.id);

      const normalizedName = token.name.toLowerCase();
      if (names.has(normalizedName)) {
        context.addIssue({
          code: 'custom',
          message: `Palette token name "${token.name}" is already in use`,
          path: ['palette', index, 'name'],
        });
      }
      names.add(normalizedName);
    });
  });

export type PaletteToken = z.infer<typeof PaletteTokenSchema>;
export type Project = z.infer<typeof ProjectSchema>;

export type ProjectFormatErrorKind = 'invalid-json' | 'invalid-project';

export interface ProjectValidationIssue {
  message: string;
  path: (number | string)[];
}

export class ProjectFormatError extends Error {
  readonly issues: ProjectValidationIssue[];
  readonly kind: ProjectFormatErrorKind;

  constructor(
    kind: ProjectFormatErrorKind,
    message: string,
    issues: ProjectValidationIssue[] = [],
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'ProjectFormatError';
    this.kind = kind;
    this.issues = issues;
  }
}

export interface CreateProjectInput {
  name: string;
  hardwareProfile: string;
}

export function generatePaletteTokenId(): string {
  return globalThis.crypto.randomUUID();
}

function unsupportedVersionIssue(
  input: unknown,
): ProjectValidationIssue | null {
  if (
    typeof input !== 'object' ||
    input === null ||
    !('schemaVersion' in input)
  ) {
    return null;
  }

  const version = input.schemaVersion;
  if (version === PROJECT_SCHEMA_VERSION) {
    return null;
  }

  return {
    message: `Project format version ${String(version)} is not supported; this build supports version ${PROJECT_SCHEMA_VERSION}`,
    path: ['schemaVersion'],
  };
}

export function parseProject(input: unknown): Project {
  const versionIssue = unsupportedVersionIssue(input);
  if (versionIssue) {
    throw new ProjectFormatError('invalid-project', versionIssue.message, [
      versionIssue,
    ]);
  }

  const result = ProjectSchema.safeParse(input);

  if (!result.success) {
    throw new ProjectFormatError(
      'invalid-project',
      'The project does not match the supported project format.',
      result.error.issues.map((issue) => ({
        message: issue.message,
        path: issue.path.map((part) =>
          typeof part === 'symbol' ? String(part) : part,
        ),
      })),
      { cause: result.error },
    );
  }

  return result.data;
}

export function parseProjectJson(json: string): Project {
  let input: unknown;

  try {
    input = JSON.parse(json) as unknown;
  } catch (error) {
    throw new ProjectFormatError(
      'invalid-json',
      'The project file is not valid JSON.',
      [],
      { cause: error },
    );
  }

  return parseProject(input);
}

export function serializeProject(project: Project): string {
  return `${JSON.stringify(parseProject(project), null, 2)}\n`;
}

export function createProject({
  name,
  hardwareProfile,
}: CreateProjectInput): Project {
  return parseProject({
    schemaVersion: PROJECT_SCHEMA_VERSION,
    name,
    hardwareProfile,
    palette: [
      {
        id: generatePaletteTokenId(),
        name: 'White',
        value: '#FFFFFF',
      },
    ],
    scenes: [],
    sequence: [],
    groups: [],
  });
}
