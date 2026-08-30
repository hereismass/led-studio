import type { HardwareProfile } from '@led-studio/hardware-profiles';
import type {
  BrightnessKeyframe,
  ColourKeyframe,
  ColourKeyframeTrack,
  EffectLayer,
  KeyframeLayer,
  PaletteToken,
  ProjectGroup,
  Scene,
  SceneLayer,
} from '@led-studio/project-format';

export interface EvaluatedLed {
  address: number;
  brightnessPercent: number;
  colour: string | null;
  ledId: string;
}

export type LedFrame = readonly EvaluatedLed[];

export interface SceneEvaluator {
  readonly frame: LedFrame;
  readonly isDynamic: boolean;
  getFrame(positionBeats: number): LedFrame;
}

export function keyframesInActiveWindow<T extends { beat: number }>(
  keyframes: readonly T[],
  startBeat: number,
  endBeat: number,
): T[] {
  return keyframes.filter(({ beat }) => beat >= startBeat && beat <= endBeat);
}

function surroundingKeyframes<T extends { beat: number }>(
  keyframes: readonly T[],
  position: number,
): { left: T; right: T; progress: number } | null {
  if (keyframes.length === 0) return null;
  const first = keyframes[0];
  const last = keyframes[keyframes.length - 1];
  if (position <= first.beat) return { left: first, progress: 0, right: first };
  if (position >= last.beat) return { left: last, progress: 0, right: last };
  const rightIndex = keyframes.findIndex(({ beat }) => beat >= position);
  const right = keyframes[rightIndex];
  if (right.beat === position) return { left: right, progress: 0, right };
  const left = keyframes[rightIndex - 1];
  return {
    left,
    progress: (position - left.beat) / (right.beat - left.beat),
    right,
  };
}

export function evaluateBrightnessTrack(
  keyframes: readonly BrightnessKeyframe[],
  positionBeats: number,
): number | null {
  const segment = surroundingKeyframes(keyframes, positionBeats);
  if (!segment) return null;
  return (
    segment.left.brightnessPercent +
    (segment.right.brightnessPercent - segment.left.brightnessPercent) *
      segment.progress
  );
}

function colourChannels(value: string): [number, number, number] {
  return [
    Number.parseInt(value.slice(1, 3), 16),
    Number.parseInt(value.slice(3, 5), 16),
    Number.parseInt(value.slice(5, 7), 16),
  ];
}

function interpolateColour(left: string, right: string, progress: number) {
  const leftChannels = colourChannels(left);
  const rightChannels = colourChannels(right);
  return `#${leftChannels
    .map((channel, index) =>
      Math.round(channel + (rightChannels[index] - channel) * progress)
        .toString(16)
        .padStart(2, '0')
        .toUpperCase(),
    )
    .join('')}`;
}

export function evaluateColourTrack(
  track: ColourKeyframeTrack,
  colours: ReadonlyMap<string, string>,
  positionBeats: number,
): string | null {
  const segment = surroundingKeyframes(track.keyframes, positionBeats);
  if (!segment) return null;
  const left = colours.get(segment.left.paletteTokenId);
  const right = colours.get(segment.right.paletteTokenId);
  if (!left || !right) {
    const missing = !left
      ? segment.left.paletteTokenId
      : segment.right.paletteTokenId;
    throw new Error(
      `Colour keyframe references unknown palette token "${missing}"`,
    );
  }
  if (
    track.interpolation === 'step' ||
    segment.left === segment.right ||
    segment.progress === 0
  )
    return left;
  return interpolateColour(left, right, segment.progress);
}

function requireFinitePositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a finite positive number`);
  }
}

export function normalizeLoopPosition(
  positionBeats: number,
  loopLengthBeats: number,
): number {
  if (!Number.isFinite(positionBeats)) {
    throw new RangeError('Position must be finite');
  }
  requireFinitePositive(loopLengthBeats, 'Loop length');
  return (
    ((positionBeats % loopLengthBeats) + loopLengthBeats) % loopLengthBeats
  );
}

export function advanceLoopPosition(
  positionBeats: number,
  elapsedMilliseconds: number,
  beatsPerMinute: number,
  loopLengthBeats: number,
): number {
  if (!Number.isFinite(elapsedMilliseconds) || elapsedMilliseconds < 0) {
    throw new RangeError('Elapsed time must be finite and non-negative');
  }
  requireFinitePositive(beatsPerMinute, 'Tempo');
  return normalizeLoopPosition(
    positionBeats + (elapsedMilliseconds * beatsPerMinute) / 60_000,
    loopLengthBeats,
  );
}

export function compileSceneEvaluator(
  scene: Scene,
  palette: readonly PaletteToken[],
  profile: HardwareProfile,
  projectGroups: readonly ProjectGroup[] = [],
): SceneEvaluator {
  type CompiledLayer =
    | {
        colour: string;
        keyframes: null;
        layer: EffectLayer;
        orderedLedIds: string[];
      }
    | {
        colour: null;
        keyframes: {
          brightness: BrightnessKeyframe[];
          colour: ColourKeyframe[];
        };
        layer: KeyframeLayer;
        orderedLedIds: string[];
      };

  const profileLedIds = new Set(profile.leds.map((led) => led.id));
  for (const ledId of Object.keys(scene.ledStates)) {
    if (!profileLedIds.has(ledId)) {
      throw new Error(
        `Scene "${scene.name}" references unknown LED "${ledId}"`,
      );
    }
  }

  const colours = new Map(palette.map((token) => [token.id, token.value]));
  const baseFrame = profile.leds.map((led) => {
    const state = scene.ledStates[led.id];
    if (!state) {
      return {
        address: led.address,
        brightnessPercent: 0,
        colour: null,
        ledId: led.id,
      };
    }

    const colour = colours.get(state.paletteTokenId);
    if (!colour) {
      throw new Error(
        `Scene "${scene.name}" references unknown palette token "${state.paletteTokenId}"`,
      );
    }

    return {
      address: led.address,
      brightnessPercent: state.brightnessPercent,
      colour,
      ledId: led.id,
    };
  });

  const profileGroups = new Map(
    profile.groups.map((group) => [group.id, group.ledIds]),
  );
  const groups = new Map(
    projectGroups.map((group) => [group.id, group.ledIds]),
  );
  const ledAddress = new Map(profile.leds.map((led) => [led.id, led.address]));
  const compiledLayers: CompiledLayer[] = scene.layers.map((layer) => {
    const target = layer.target;
    const targetLedIds =
      target.kind === 'leds'
        ? target.ledIds
        : target.kind === 'profile-group'
          ? profileGroups.get(target.groupId)
          : groups.get(target.groupId);
    if (!targetLedIds) {
      const groupTarget = target as Exclude<typeof target, { kind: 'leds' }>;
      throw new Error(
        `Layer "${layer.name}" references unknown ${groupTarget.kind === 'profile-group' ? 'profile' : 'project'} group "${groupTarget.groupId}"`,
      );
    }
    const orderedLedIds = [...targetLedIds].sort(
      (left, right) => ledAddress.get(left)! - ledAddress.get(right)!,
    );
    orderedLedIds.forEach((ledId) => {
      if (!profileLedIds.has(ledId)) {
        throw new Error(
          `Layer "${layer.name}" references unknown LED "${ledId}"`,
        );
      }
    });
    if (layer.kind === 'effect') {
      const colour = colours.get(layer.effect.paletteTokenId);
      if (!colour) {
        throw new Error(
          `Effect layer "${layer.name}" references unknown palette token "${layer.effect.paletteTokenId}"`,
        );
      }
      return { colour, keyframes: null, layer, orderedLedIds };
    }
    layer.tracks.colour.keyframes.forEach((keyframe) => {
      if (!colours.has(keyframe.paletteTokenId)) {
        throw new Error(
          `Colour keyframe references unknown palette token "${keyframe.paletteTokenId}"`,
        );
      }
    });
    return {
      colour: null,
      keyframes: {
        brightness: keyframesInActiveWindow(
          layer.tracks.brightness.keyframes,
          layer.startBeat,
          layer.endBeat,
        ),
        colour: keyframesInActiveWindow(
          layer.tracks.colour.keyframes,
          layer.startBeat,
          layer.endBeat,
        ),
      },
      layer,
      orderedLedIds,
    };
  });
  const dynamic = compiledLayers.some(
    ({ keyframes, layer }) =>
      layer.enabled &&
      (layer.kind === 'effect' ||
        keyframes!.brightness.length > 0 ||
        keyframes!.colour.length > 0),
  );
  let lastFrame: LedFrame | null = null;
  let lastStateKey: string | null = null;

  function applyPulse(
    frameById: Map<string, EvaluatedLed>,
    layer: EffectLayer,
    ledIds: readonly string[],
    colour: string,
    position: number,
  ): void {
    if (layer.effect.type !== 'pulse') return;
    const effect = layer.effect;
    const phase =
      normalizeLoopPosition(
        position - layer.startBeat + effect.phaseOffsetBeats,
        effect.cycleLengthBeats,
      ) / effect.cycleLengthBeats;
    const shaped =
      effect.waveform === 'sine'
        ? (1 - Math.cos(phase * Math.PI * 2)) / 2
        : effect.waveform === 'triangle'
          ? phase < 0.5
            ? phase * 2
            : 2 - phase * 2
          : phase < 0.5
            ? 1
            : 0;
    const brightnessPercent =
      effect.minBrightnessPercent +
      (effect.maxBrightnessPercent - effect.minBrightnessPercent) * shaped;
    ledIds.forEach((ledId) => {
      const current = frameById.get(ledId)!;
      frameById.set(ledId, { ...current, brightnessPercent, colour });
    });
  }

  function applyChase(
    frameById: Map<string, EvaluatedLed>,
    layer: EffectLayer,
    orderedLedIds: readonly string[],
    colour: string,
    position: number,
  ): void {
    if (layer.effect.type !== 'chase' || orderedLedIds.length === 0) return;
    const effect = layer.effect;
    const ledIds =
      effect.direction === 'forward'
        ? orderedLedIds
        : [...orderedLedIds].reverse();
    const head =
      Math.floor((position - layer.startBeat) / effect.stepLengthBeats) %
      ledIds.length;
    ledIds.forEach((ledId, index) => {
      const distance = (head - index + ledIds.length) % ledIds.length;
      let brightnessPercent: number | null = null;
      if (distance < effect.width) brightnessPercent = effect.brightnessPercent;
      else if (distance < effect.width + effect.trailLength) {
        const trailIndex = distance - effect.width;
        brightnessPercent =
          (effect.brightnessPercent * (effect.trailLength - trailIndex)) /
          (effect.trailLength + 1);
      }
      if (brightnessPercent === null) return;
      const current = frameById.get(ledId)!;
      frameById.set(ledId, { ...current, brightnessPercent, colour });
    });
  }

  function applyKeyframes(
    frameById: Map<string, EvaluatedLed>,
    layer: KeyframeLayer,
    keyframes: {
      brightness: BrightnessKeyframe[];
      colour: ColourKeyframe[];
    },
    ledIds: readonly string[],
    position: number,
  ): void {
    const brightness = evaluateBrightnessTrack(keyframes.brightness, position);
    const colour = evaluateColourTrack(
      { ...layer.tracks.colour, keyframes: keyframes.colour },
      colours,
      position,
    );
    if (brightness === null && colour === null) return;
    ledIds.forEach((ledId) => {
      const current = frameById.get(ledId)!;
      frameById.set(ledId, {
        ...current,
        ...(brightness === null ? {} : { brightnessPercent: brightness }),
        ...(colour === null ? {} : { colour }),
      });
    });
  }

  function getFrame(positionBeats: number): LedFrame {
    const position = normalizeLoopPosition(
      positionBeats,
      scene.loopLengthBeats,
    );
    if (!dynamic) return baseFrame;
    const stateKey = compiledLayers
      .map(({ layer }) => {
        if (
          !layer.enabled ||
          position < layer.startBeat ||
          position >= layer.endBeat
        )
          return '-';
        if (layer.kind === 'keyframe') return `k${position}`;
        return layer.effect.type === 'pulse'
          ? `p${position}`
          : `c${Math.floor((position - layer.startBeat) / layer.effect.stepLengthBeats)}`;
      })
      .join('|');
    if (stateKey === lastStateKey && lastFrame) return lastFrame;
    const frameById = new Map(baseFrame.map((led) => [led.ledId, led]));
    for (const compiled of [...compiledLayers].reverse()) {
      const { colour, keyframes, layer, orderedLedIds } = compiled;
      if (
        !layer.enabled ||
        position < layer.startBeat ||
        position >= layer.endBeat
      )
        continue;
      if (layer.kind === 'keyframe') {
        applyKeyframes(frameById, layer, keyframes!, orderedLedIds, position);
      } else if (layer.effect.type === 'pulse')
        applyPulse(frameById, layer, orderedLedIds, colour!, position);
      else applyChase(frameById, layer, orderedLedIds, colour!, position);
    }
    lastStateKey = stateKey;
    lastFrame = profile.leds.map((led) => frameById.get(led.id)!);
    return lastFrame;
  }

  const frame = getFrame(0);
  return { frame, getFrame, isDynamic: dynamic };
}

export function evaluateSceneFrame(
  scene: Scene,
  palette: readonly PaletteToken[],
  profile: HardwareProfile,
  positionBeats: number,
  projectGroups: readonly ProjectGroup[] = [],
): LedFrame {
  return compileSceneEvaluator(scene, palette, profile, projectGroups).getFrame(
    positionBeats,
  );
}
