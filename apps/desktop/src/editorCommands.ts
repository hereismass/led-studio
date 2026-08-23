import {
  generatePaletteTokenId,
  parseProject,
  type PaletteToken,
  type Project,
} from '@led-studio/project-format';

export type EditorCommand =
  | { name: string; type: 'project-renamed' }
  | { type: 'palette-token-added' }
  | {
      id: string;
      changes: Partial<Pick<PaletteToken, 'name' | 'value'>>;
      type: 'palette-token-updated';
    }
  | { id: string; type: 'palette-token-duplicated' }
  | { id: string; type: 'palette-token-deleted' };

function normalizedName(name: string): string {
  return name.trim().toLowerCase();
}

function uniqueTokenName(
  tokens: PaletteToken[],
  preferredName: string,
): string {
  const baseName = preferredName.trim();
  const existingNames = new Set(
    tokens.map((token) => normalizedName(token.name)),
  );

  if (!existingNames.has(normalizedName(baseName))) {
    return baseName;
  }

  let suffix = 2;
  while (existingNames.has(normalizedName(`${baseName} ${suffix}`))) {
    suffix += 1;
  }

  return `${baseName} ${suffix}`;
}

function createPaletteTokenId(tokens: PaletteToken[]): string {
  const existingIds = new Set(tokens.map((token) => token.id));
  let id = generatePaletteTokenId();

  while (existingIds.has(id)) {
    id = generatePaletteTokenId();
  }

  return id;
}

function tokenIndex(project: Project, id: string): number {
  const index = project.palette.findIndex((token) => token.id === id);
  if (index === -1) {
    throw new Error(`Palette token "${id}" does not exist`);
  }
  return index;
}

export function applyEditorCommand(
  project: Project,
  command: EditorCommand,
): Project {
  switch (command.type) {
    case 'project-renamed': {
      const name = command.name.trim();
      if (name === project.name) return project;
      return parseProject({ ...project, name });
    }

    case 'palette-token-added': {
      const name = uniqueTokenName(project.palette, 'New Colour');
      const token: PaletteToken = {
        id: createPaletteTokenId(project.palette),
        name,
        value: '#FFFFFF',
      };
      return parseProject({
        ...project,
        palette: [...project.palette, token],
      });
    }

    case 'palette-token-updated': {
      const index = tokenIndex(project, command.id);
      const current = project.palette[index];
      const next: PaletteToken = {
        ...current,
        ...command.changes,
        ...(command.changes.name === undefined
          ? null
          : { name: command.changes.name.trim() }),
        ...(command.changes.value === undefined
          ? null
          : { value: command.changes.value.toUpperCase() }),
      };

      if (next.name === current.name && next.value === current.value) {
        return project;
      }

      const palette = [...project.palette];
      palette[index] = next;
      return parseProject({ ...project, palette });
    }

    case 'palette-token-duplicated': {
      const index = tokenIndex(project, command.id);
      const source = project.palette[index];
      const name = uniqueTokenName(project.palette, `${source.name} Copy`);
      const duplicate: PaletteToken = {
        id: createPaletteTokenId(project.palette),
        name,
        value: source.value,
      };
      const palette = [...project.palette];
      palette.splice(index + 1, 0, duplicate);
      return parseProject({ ...project, palette });
    }

    case 'palette-token-deleted': {
      const index = tokenIndex(project, command.id);
      return parseProject({
        ...project,
        palette: project.palette.filter(
          (_, tokenPosition) => tokenPosition !== index,
        ),
      });
    }
  }
}
