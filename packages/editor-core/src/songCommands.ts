import {
  CueAdvanceSchema,
  PROJECT_LIMITS,
  ProjectEntityIdSchema,
  ProjectTimingSchema,
  SongCueSchema,
  SongLaunchQuantizationSchema,
  SongSchema,
  type Project,
  type Song,
  type SongCue,
} from '@led-studio/project-format';
import {
  assertCollectionCapacity,
  assertNewEntityId,
  assertNewEntityIds,
  createEntityId,
  EditorCommandError,
  normalizedName,
  parseCommandValue,
  uniqueName,
  type ProjectEntityIdFactory,
} from './commandSupport.js';
import { projectEntityIds } from './projectQueries.js';

export type SongEditorCommand =
  | { id: string; type: 'song-added' }
  | {
      changes: Partial<Pick<Song, 'launchQuantization' | 'name' | 'timing'>>;
      id: string;
      type: 'song-updated';
    }
  | {
      cueIds: string[];
      id: string;
      sourceId: string;
      type: 'song-duplicated';
    }
  | { id: string; type: 'song-deleted' }
  | { id: string; toIndex: number; type: 'song-moved' }
  | { id: string; sceneId: string; songId: string; type: 'song-cue-added' }
  | {
      changes: Partial<Pick<SongCue, 'advance' | 'name' | 'sceneId'>>;
      id: string;
      songId: string;
      type: 'song-cue-updated';
    }
  | {
      id: string;
      newId: string;
      songId: string;
      type: 'song-cue-duplicated';
    }
  | { id: string; songId: string; type: 'song-cue-deleted' }
  | { id: string; songId: string; toIndex: number; type: 'song-cue-moved' };

const songCommandTypes = new Set<SongEditorCommand['type']>([
  'song-added',
  'song-updated',
  'song-duplicated',
  'song-deleted',
  'song-moved',
  'song-cue-added',
  'song-cue-updated',
  'song-cue-duplicated',
  'song-cue-deleted',
  'song-cue-moved',
]);

export function isSongEditorCommand(command: {
  type: string;
}): command is SongEditorCommand {
  return songCommandTypes.has(command.type as SongEditorCommand['type']);
}

function songIndex(project: Project, id: string): number {
  const index = project.songs.findIndex((song) => song.id === id);
  if (index === -1) {
    throw new EditorCommandError(
      'missing-entity',
      `Song "${id}" does not exist.`,
    );
  }
  return index;
}

function cueIndex(song: Song, id: string): number {
  const index = song.cues.findIndex((cue) => cue.id === id);
  if (index === -1) {
    throw new EditorCommandError(
      'missing-entity',
      `Cue "${id}" does not exist.`,
    );
  }
  return index;
}

function sceneIndex(project: Project, id: string): number {
  const index = project.scenes.findIndex((scene) => scene.id === id);
  if (index === -1) {
    throw new EditorCommandError(
      'missing-entity',
      `Scene "${id}" does not exist.`,
    );
  }
  return index;
}

function assertUniqueSongName(
  project: Project,
  name: string,
  exceptId?: string,
): void {
  if (
    project.songs.some(
      (song) =>
        song.id !== exceptId &&
        normalizedName(song.name) === normalizedName(name),
    )
  ) {
    throw new EditorCommandError(
      'duplicate-name',
      `Song name "${name}" is already in use.`,
    );
  }
}

function assertUniqueCueName(
  song: Song,
  name: string,
  exceptId?: string,
): void {
  if (
    song.cues.some(
      (cue) =>
        cue.id !== exceptId &&
        normalizedName(cue.name) === normalizedName(name),
    )
  ) {
    throw new EditorCommandError(
      'duplicate-name',
      `Cue name "${name}" is already in use.`,
    );
  }
}

function updateSong(
  project: Project,
  id: string,
  updater: (song: Song) => Song,
): Project {
  const index = songIndex(project, id);
  const nextSong = updater(project.songs[index]);
  if (nextSong === project.songs[index]) return project;
  const songs = [...project.songs];
  songs[index] = nextSong;
  return { ...project, songs };
}

export function createSongAddedCommand(
  project: Project,
  idFactory: ProjectEntityIdFactory = () => globalThis.crypto.randomUUID(),
): Extract<SongEditorCommand, { type: 'song-added' }> {
  return { id: createEntityId(project, idFactory), type: 'song-added' };
}

export function createSongDuplicatedCommand(
  project: Project,
  sourceId: string,
  idFactory: ProjectEntityIdFactory = () => globalThis.crypto.randomUUID(),
): Extract<SongEditorCommand, { type: 'song-duplicated' }> {
  const source = project.songs[songIndex(project, sourceId)];
  const reserved = projectEntityIds(project);
  const nextId = () => {
    let id = parseCommandValue(ProjectEntityIdSchema, idFactory());
    while (reserved.has(id)) {
      id = parseCommandValue(ProjectEntityIdSchema, idFactory());
    }
    reserved.add(id);
    return id;
  };
  return {
    cueIds: source.cues.map(nextId),
    id: nextId(),
    sourceId,
    type: 'song-duplicated',
  };
}

export function createSongCueAddedCommand(
  project: Project,
  songId: string,
  sceneId: string,
  idFactory: ProjectEntityIdFactory = () => globalThis.crypto.randomUUID(),
): Extract<SongEditorCommand, { type: 'song-cue-added' }> {
  songIndex(project, songId);
  sceneIndex(project, sceneId);
  return {
    id: createEntityId(project, idFactory),
    sceneId,
    songId,
    type: 'song-cue-added',
  };
}

export function createSongCueDuplicatedCommand(
  project: Project,
  songId: string,
  id: string,
  idFactory: ProjectEntityIdFactory = () => globalThis.crypto.randomUUID(),
): Extract<SongEditorCommand, { type: 'song-cue-duplicated' }> {
  cueIndex(project.songs[songIndex(project, songId)], id);
  return {
    id,
    newId: createEntityId(project, idFactory),
    songId,
    type: 'song-cue-duplicated',
  };
}

export function applySongEditorCommand(
  project: Project,
  command: SongEditorCommand,
): Project {
  switch (command.type) {
    case 'song-added': {
      assertCollectionCapacity(
        project.songs.length,
        PROJECT_LIMITS.songs,
        'Projects',
      );
      const song = parseCommandValue(SongSchema, {
        cues: [],
        id: assertNewEntityId(project, command.id),
        launchQuantization: 'next-bar',
        name: uniqueName(
          project.songs.map(({ name }) => name),
          `Song ${project.songs.length + 1}`,
        ),
        timing: structuredClone(project.timing),
      });
      return { ...project, songs: [...project.songs, song] };
    }
    case 'song-updated':
      return updateSong(project, command.id, (song) => {
        const name = command.changes.name ?? song.name;
        const timing =
          command.changes.timing === undefined
            ? song.timing
            : parseCommandValue(ProjectTimingSchema, command.changes.timing);
        const launchQuantization =
          command.changes.launchQuantization === undefined
            ? song.launchQuantization
            : parseCommandValue(
                SongLaunchQuantizationSchema,
                command.changes.launchQuantization,
              );
        const next = parseCommandValue(SongSchema, {
          ...song,
          launchQuantization,
          name,
          timing,
        });
        assertUniqueSongName(project, next.name, song.id);
        return next.name === song.name &&
          next.timing.previewBpm === song.timing.previewBpm &&
          next.timing.timeSignature.numerator ===
            song.timing.timeSignature.numerator &&
          next.timing.timeSignature.denominator ===
            song.timing.timeSignature.denominator &&
          next.launchQuantization === song.launchQuantization
          ? song
          : next;
      });
    case 'song-duplicated': {
      assertCollectionCapacity(
        project.songs.length,
        PROJECT_LIMITS.songs,
        'Projects',
      );
      const sourcePosition = songIndex(project, command.sourceId);
      const source = project.songs[sourcePosition];
      if (command.cueIds.length !== source.cues.length) {
        throw new EditorCommandError(
          'invalid-command',
          'Song duplication requires one new ID per cue.',
        );
      }
      const ids = assertNewEntityIds(project, [command.id, ...command.cueIds]);
      const duplicate = parseCommandValue(SongSchema, {
        ...structuredClone(source),
        cues: source.cues.map((cue, index) => ({
          ...structuredClone(cue),
          id: ids[index + 1],
        })),
        id: ids[0],
        name: uniqueName(
          project.songs.map(({ name }) => name),
          `${source.name} Copy`,
        ),
      });
      const songs = [...project.songs];
      songs.splice(sourcePosition + 1, 0, duplicate);
      return { ...project, songs };
    }
    case 'song-deleted': {
      const index = songIndex(project, command.id);
      return {
        ...project,
        songs: project.songs.filter((_, position) => position !== index),
      };
    }
    case 'song-moved': {
      const index = songIndex(project, command.id);
      if (
        !Number.isInteger(command.toIndex) ||
        command.toIndex < 0 ||
        command.toIndex >= project.songs.length
      ) {
        throw new EditorCommandError(
          'invalid-command',
          'Song destination is outside the project.',
        );
      }
      if (index === command.toIndex) return project;
      const songs = [...project.songs];
      const [song] = songs.splice(index, 1);
      songs.splice(command.toIndex, 0, song);
      return { ...project, songs };
    }
    case 'song-cue-added':
      sceneIndex(project, command.sceneId);
      return updateSong(project, command.songId, (song) => {
        assertCollectionCapacity(
          song.cues.length,
          PROJECT_LIMITS.cuesPerSong,
          'Songs',
        );
        const scene = project.scenes[sceneIndex(project, command.sceneId)];
        const cue = parseCommandValue(SongCueSchema, {
          advance: { kind: 'manual' },
          id: assertNewEntityId(project, command.id),
          name: uniqueName(
            song.cues.map(({ name }) => name),
            scene.name,
          ),
          sceneId: scene.id,
        });
        return { ...song, cues: [...song.cues, cue] };
      });
    case 'song-cue-updated':
      return updateSong(project, command.songId, (song) => {
        const index = cueIndex(song, command.id);
        const cue = song.cues[index];
        if (command.changes.sceneId !== undefined)
          sceneIndex(project, command.changes.sceneId);
        const next = parseCommandValue(SongCueSchema, {
          ...cue,
          ...command.changes,
          advance:
            command.changes.advance === undefined
              ? cue.advance
              : parseCommandValue(CueAdvanceSchema, command.changes.advance),
        });
        assertUniqueCueName(song, next.name, cue.id);
        if (
          next.name === cue.name &&
          next.sceneId === cue.sceneId &&
          JSON.stringify(next.advance) === JSON.stringify(cue.advance)
        )
          return song;
        const cues = [...song.cues];
        cues[index] = next;
        return { ...song, cues };
      });
    case 'song-cue-duplicated':
      return updateSong(project, command.songId, (song) => {
        assertCollectionCapacity(
          song.cues.length,
          PROJECT_LIMITS.cuesPerSong,
          'Songs',
        );
        const index = cueIndex(song, command.id);
        const source = song.cues[index];
        const duplicate = parseCommandValue(SongCueSchema, {
          ...structuredClone(source),
          id: assertNewEntityId(project, command.newId),
          name: uniqueName(
            song.cues.map(({ name }) => name),
            `${source.name} Copy`,
          ),
        });
        const cues = [...song.cues];
        cues.splice(index + 1, 0, duplicate);
        return { ...song, cues };
      });
    case 'song-cue-deleted':
      return updateSong(project, command.songId, (song) => {
        const index = cueIndex(song, command.id);
        return {
          ...song,
          cues: song.cues.filter((_, position) => position !== index),
        };
      });
    case 'song-cue-moved':
      return updateSong(project, command.songId, (song) => {
        const index = cueIndex(song, command.id);
        if (
          !Number.isInteger(command.toIndex) ||
          command.toIndex < 0 ||
          command.toIndex >= song.cues.length
        ) {
          throw new EditorCommandError(
            'invalid-command',
            'Cue destination is outside the song.',
          );
        }
        if (index === command.toIndex) return song;
        const cues = [...song.cues];
        const [cue] = cues.splice(index, 1);
        cues.splice(command.toIndex, 0, cue);
        return { ...song, cues };
      });
  }
}
