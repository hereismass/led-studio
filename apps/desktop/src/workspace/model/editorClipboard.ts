import type {
  KeyframeReference,
  PastedKeyframe,
} from '@led-studio/editor-core';
import type { HardwareProfile } from '@led-studio/hardware-profiles';
import type {
  KeyframeEasing,
  KeyframeLayer,
  PaletteToken,
  Project,
  Scene,
  SceneLayer,
} from '@led-studio/project-format';

interface CopiedColour {
  paletteTokenId: string;
  value: string;
}

type CopiedKeyframe =
  | {
      brightnessPercent: number;
      easing: KeyframeEasing;
      relativeBeat: number;
      track: 'brightness';
    }
  | {
      colour: CopiedColour;
      easing: KeyframeEasing;
      relativeBeat: number;
      track: 'colour';
    };

export type EditorClipboard =
  | { keyframes: CopiedKeyframe[]; kind: 'keyframes' }
  | {
      colours: CopiedColour[];
      kind: 'layer';
      layer: SceneLayer;
      resolvedLedIds: string[];
    };

export class EditorClipboardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EditorClipboardError';
  }
}

function colourDependency(
  palette: readonly PaletteToken[],
  paletteTokenId: string,
): CopiedColour {
  const token = palette.find(({ id }) => id === paletteTokenId);
  if (!token)
    throw new EditorClipboardError(
      `Colour "${paletteTokenId}" is unavailable and cannot be copied.`,
    );
  return { paletteTokenId, value: token.value };
}

function mappedPaletteTokenId(
  palette: readonly PaletteToken[],
  copied: CopiedColour,
): string {
  const exact = palette.find(({ id }) => id === copied.paletteTokenId);
  if (exact) return exact.id;
  const matchingValue = palette.find(({ value }) => value === copied.value);
  if (matchingValue) return matchingValue.id;
  throw new EditorClipboardError(
    `Add a ${copied.value} palette colour before pasting this content.`,
  );
}

export function copyKeyframes(
  project: Project,
  layer: KeyframeLayer,
  references: readonly KeyframeReference[],
): Extract<EditorClipboard, { kind: 'keyframes' }> {
  if (references.length === 0)
    throw new EditorClipboardError('Select at least one keyframe to copy.');
  const selected = references.map((reference) => {
    const keyframe = layer.tracks[reference.track].keyframes.find(
      ({ id }) => id === reference.id,
    );
    if (!keyframe)
      throw new EditorClipboardError(
        `Keyframe "${reference.id}" is unavailable.`,
      );
    return { keyframe, track: reference.track };
  });
  const earliestBeat = Math.min(
    ...selected.map(({ keyframe }) => keyframe.beat),
  );
  return {
    keyframes: selected.map(({ keyframe, track }): CopiedKeyframe =>
      track === 'brightness' && 'brightnessPercent' in keyframe
        ? {
            brightnessPercent: keyframe.brightnessPercent,
            easing: keyframe.easing,
            relativeBeat: keyframe.beat - earliestBeat,
            track,
          }
        : {
            colour: colourDependency(
              project.palette,
              (keyframe as { paletteTokenId: string }).paletteTokenId,
            ),
            easing: keyframe.easing,
            relativeBeat: keyframe.beat - earliestBeat,
            track: 'colour',
          },
    ),
    kind: 'keyframes',
  };
}

function resolveLayerLedIds(
  project: Project,
  profile: HardwareProfile,
  layer: SceneLayer,
): string[] {
  const target = layer.target;
  if (target.kind === 'leds') return [...target.ledIds];
  const group =
    target.kind === 'profile-group'
      ? profile.groups.find(({ id }) => id === target.groupId)
      : project.groups.find(({ id }) => id === target.groupId);
  if (!group)
    throw new EditorClipboardError(
      `Target group "${target.groupId}" is unavailable.`,
    );
  return [...group.ledIds];
}

export function copyLayer(
  project: Project,
  profile: HardwareProfile,
  layer: SceneLayer,
): Extract<EditorClipboard, { kind: 'layer' }> {
  const tokenIds =
    layer.kind === 'effect'
      ? [layer.effect.paletteTokenId]
      : layer.tracks.colour.keyframes.map(
          ({ paletteTokenId }) => paletteTokenId,
        );
  return {
    colours: [...new Set(tokenIds)].map((id) =>
      colourDependency(project.palette, id),
    ),
    kind: 'layer',
    layer: structuredClone(layer),
    resolvedLedIds: resolveLayerLedIds(project, profile, layer),
  };
}

export function pastedKeyframes(
  project: Project,
  clipboard: Extract<EditorClipboard, { kind: 'keyframes' }>,
  anchorBeat: number,
): PastedKeyframe[] {
  return clipboard.keyframes.map((keyframe): PastedKeyframe => {
    const common = {
      beat: anchorBeat + keyframe.relativeBeat,
      id: crypto.randomUUID(),
    };
    return keyframe.track === 'brightness'
      ? {
          ...common,
          brightnessPercent: keyframe.brightnessPercent,
          easing: keyframe.easing,
          track: keyframe.track,
        }
      : {
          ...common,
          easing: keyframe.easing,
          paletteTokenId: mappedPaletteTokenId(
            project.palette,
            keyframe.colour,
          ),
          track: keyframe.track,
        };
  });
}

export function pastedLayer(
  project: Project,
  profile: HardwareProfile,
  scene: Scene,
  clipboard: Extract<EditorClipboard, { kind: 'layer' }>,
  anchorBeat: number,
): SceneLayer {
  const source = structuredClone(clipboard.layer);
  const delta = anchorBeat - source.startBeat;
  const profileLedIds = new Set(profile.leds.map(({ id }) => id));
  const missingLed = clipboard.resolvedLedIds.find(
    (id) => !profileLedIds.has(id),
  );
  if (missingLed)
    throw new EditorClipboardError(
      `LED "${missingLed}" is unavailable in the destination hardware profile.`,
    );
  const sourceTarget = source.target;
  const targetExists =
    sourceTarget.kind === 'profile-group'
      ? profile.groups.some(({ id }) => id === sourceTarget.groupId)
      : sourceTarget.kind === 'project-group'
        ? project.groups.some(({ id }) => id === sourceTarget.groupId)
        : true;
  const target = targetExists
    ? sourceTarget
    : { kind: 'leds' as const, ledIds: clipboard.resolvedLedIds };
  const colourMap = new Map(
    clipboard.colours.map((colour) => [
      colour.paletteTokenId,
      mappedPaletteTokenId(project.palette, colour),
    ]),
  );
  let layer: SceneLayer = {
    ...source,
    endBeat: source.endBeat + delta,
    id: crypto.randomUUID(),
    locked: false,
    startBeat: anchorBeat,
    target,
  };
  if (layer.kind === 'effect') {
    layer = {
      ...layer,
      effect: {
        ...layer.effect,
        paletteTokenId: colourMap.get(layer.effect.paletteTokenId)!,
      },
    };
  } else {
    layer = {
      ...layer,
      tracks: {
        brightness: {
          keyframes: layer.tracks.brightness.keyframes.map((keyframe) => ({
            ...keyframe,
            beat: keyframe.beat + delta,
            id: crypto.randomUUID(),
          })),
        },
        colour: {
          ...layer.tracks.colour,
          keyframes: layer.tracks.colour.keyframes.map((keyframe) => ({
            ...keyframe,
            beat: keyframe.beat + delta,
            id: crypto.randomUUID(),
            paletteTokenId: colourMap.get(keyframe.paletteTokenId)!,
          })),
        },
      },
    };
  }
  const storedBeats =
    layer.kind === 'keyframe'
      ? [
          ...layer.tracks.brightness.keyframes.map(({ beat }) => beat),
          ...layer.tracks.colour.keyframes.map(({ beat }) => beat),
        ]
      : [];
  if (
    layer.endBeat > scene.loopLengthBeats ||
    storedBeats.some((beat) => beat < 0 || beat > scene.loopLengthBeats)
  )
    throw new EditorClipboardError(
      'Pasted layer and its stored keys must fit within the scene loop.',
    );
  return layer;
}
