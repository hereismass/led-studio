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

export interface CreateProjectInput {
  name: string;
  hardwareProfile: string;
}

export function parseProject(input: unknown): Project {
  return ProjectSchema.parse(input);
}

export function parseProjectJson(json: string): Project {
  return parseProject(JSON.parse(json) as unknown);
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
