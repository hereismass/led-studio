import type { Project } from '@led-studio/project-format';

export function projectEntityIds(project: Project): Set<string> {
  return new Set([
    ...project.palette.map((token) => token.id),
    ...project.groups.map((group) => group.id),
    ...project.scenes.map((scene) => scene.id),
    ...project.songs.map((song) => song.id),
    ...project.songs.flatMap((song) => song.cues.map((cue) => cue.id)),
    ...project.scenes.flatMap((scene) => scene.layers.map((layer) => layer.id)),
    ...project.scenes.flatMap((scene) =>
      scene.layers.flatMap((layer) =>
        layer.kind === 'keyframe'
          ? [
              ...layer.tracks.brightness.keyframes.map(({ id }) => id),
              ...layer.tracks.colour.keyframes.map(({ id }) => id),
            ]
          : [],
      ),
    ),
  ]);
}

export function sceneCueUsageCount(project: Project, id: string): number {
  return project.songs.reduce(
    (total, song) =>
      total + song.cues.filter((cue) => cue.sceneId === id).length,
    0,
  );
}

export function paletteTokenUsageCount(project: Project, id: string): number {
  return project.scenes.reduce(
    (total, scene) =>
      total +
      Object.values(scene.ledStates).filter(
        (state) => state.paletteTokenId === id,
      ).length +
      scene.layers.reduce(
        (layerTotal, layer) =>
          layerTotal +
          (layer.kind === 'effect' && layer.effect.paletteTokenId === id
            ? 1
            : 0) +
          (layer.kind === 'keyframe'
            ? layer.tracks.colour.keyframes.filter(
                (keyframe) => keyframe.paletteTokenId === id,
              ).length
            : 0),
        0,
      ),
    0,
  );
}

export function projectGroupUsageCount(project: Project, id: string): number {
  return project.scenes.reduce(
    (total, scene) =>
      total +
      scene.layers.filter(
        (layer) =>
          layer.target.kind === 'project-group' && layer.target.groupId === id,
      ).length,
    0,
  );
}
