import { z } from 'zod';

export const PROJECT_SCHEMA_VERSION = 1 as const;

export const PaletteNameSchema = z
  .string()
  .regex(
    /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/,
    'Palette names must use lowercase kebab-case',
  );

export const HexColourSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Palette colours must be six-digit hex values');

export const ProjectSchema = z
  .object({
    schemaVersion: z.literal(PROJECT_SCHEMA_VERSION),
    name: z.string().trim().min(1, 'Project name cannot be empty'),
    hardwareProfile: z
      .string()
      .trim()
      .min(1, 'Hardware profile cannot be empty'),
    palette: z.record(PaletteNameSchema, HexColourSchema),
  })
  .strict();

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

export function parseProject(input: unknown): Project {
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
    palette: {},
  });
}
