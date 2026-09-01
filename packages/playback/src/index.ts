import type { HardwareProfile } from '@led-studio/hardware-profiles';
import type {
  BrightnessKeyframe,
  ColourKeyframeTrack,
  EffectLayer,
  KeyframeEasing,
  KeyframeLayer,
  PaletteToken,
  ProjectGroup,
  Scene,
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

const UINT32_RANGE = 0x1_0000_0000;

export function sparkleHash32(
  seed: number,
  stepIndex: number,
  ledAddress: number,
): number {
  let hash = 0x811c_9dc5;
  hash = Math.imul(hash ^ (seed >>> 0), 0x0100_0193) >>> 0;
  hash = Math.imul(hash ^ (stepIndex >>> 0), 0x0100_0193) >>> 0;
  hash = Math.imul(hash ^ (ledAddress >>> 0), 0x0100_0193) >>> 0;

  // FNV combines the persisted inputs cheaply; the MurmurHash3 finalizer gives
  // adjacent LED addresses the avalanche behavior a spatial effect needs.
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85eb_ca6b) >>> 0;
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2_ae35) >>> 0;
  hash ^= hash >>> 16;
  return hash >>> 0;
}

function unitPhase(value: number): number {
  return value - Math.floor(value);
}

function shapeWaveform(
  waveform: 'sine' | 'square' | 'triangle',
  phase: number,
): number {
  return waveform === 'sine'
    ? (1 - Math.cos(phase * Math.PI * 2)) / 2
    : waveform === 'triangle'
      ? phase < 0.5
        ? phase * 2
        : 2 - phase * 2
      : phase < 0.5
        ? 1
        : 0;
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
  let low = 1;
  let high = keyframes.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (keyframes[middle].beat < position) low = middle + 1;
    else high = middle;
  }
  const rightIndex = low;
  const right = keyframes[rightIndex];
  if (right.beat === position) return { left: right, progress: 0, right };
  const left = keyframes[rightIndex - 1];
  return {
    left,
    progress: (position - left.beat) / (right.beat - left.beat),
    right,
  };
}

export function applyKeyframeEasing(
  easing: KeyframeEasing,
  progress: number,
): number {
  const bounded = Math.max(0, Math.min(1, progress));
  switch (easing) {
    case 'ease-in':
      return bounded * bounded;
    case 'ease-out':
      return 1 - (1 - bounded) * (1 - bounded);
    case 'ease-in-out':
      return bounded < 0.5
        ? 2 * bounded * bounded
        : 1 - (-2 * bounded + 2) ** 2 / 2;
    case 'linear':
      return bounded;
  }
}

export function evaluateBrightnessTrack(
  keyframes: readonly BrightnessKeyframe[],
  positionBeats: number,
): number | null {
  const segment = surroundingKeyframes(keyframes, positionBeats);
  if (!segment) return null;
  const progress = applyKeyframeEasing(segment.left.easing, segment.progress);
  return (
    segment.left.brightnessPercent +
    (segment.right.brightnessPercent - segment.left.brightnessPercent) *
      progress
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
  return interpolateColour(
    left,
    right,
    applyKeyframeEasing(segment.left.easing, segment.progress),
  );
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
        effectSlots: string[][];
        keyframes: null;
        layer: EffectLayer;
        orderedLedAddresses: number[];
        orderedLedIds: string[];
      }
    | {
        colour: null;
        effectSlots: string[][];
        keyframes: {
          brightness: BrightnessKeyframe[];
          colour: ColourKeyframeTrack;
        };
        layer: KeyframeLayer;
        orderedLedAddresses: number[];
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
  const addressOrderedLeds = [...profile.leds].sort(
    (left, right) => left.address - right.address,
  );
  const baseFrame = addressOrderedLeds.map((led) => {
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
  const ledEffectPosition = new Map(
    profile.leds.map((led) => [led.id, led.effectPosition]),
  );
  const ledOrder = new Map(profile.leds.map((led, index) => [led.id, index]));
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
    targetLedIds.forEach((ledId) => {
      if (!profileLedIds.has(ledId)) {
        throw new Error(
          `Layer "${layer.name}" references unknown LED "${ledId}"`,
        );
      }
    });
    const orderedLedIds = [...targetLedIds].sort(
      (left, right) => ledOrder.get(left)! - ledOrder.get(right)!,
    );
    const effectSlotsByPosition = new Map<number, string[]>();
    orderedLedIds.forEach((ledId) => {
      const position = ledEffectPosition.get(ledId)!;
      const slot = effectSlotsByPosition.get(position);
      if (slot) slot.push(ledId);
      else effectSlotsByPosition.set(position, [ledId]);
    });
    const effectSlots = [...effectSlotsByPosition.entries()]
      .sort(([left], [right]) => left - right)
      .map(([, ledIds]) => ledIds);
    if (layer.kind === 'effect') {
      const colour = colours.get(layer.effect.paletteTokenId);
      if (!colour) {
        throw new Error(
          `Effect layer "${layer.name}" references unknown palette token "${layer.effect.paletteTokenId}"`,
        );
      }
      return {
        colour,
        effectSlots,
        keyframes: null,
        layer,
        orderedLedAddresses: orderedLedIds.map((ledId) =>
          ledAddress.get(ledId)!,
        ),
        orderedLedIds,
      };
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
      effectSlots: [],
      keyframes: {
        brightness: keyframesInActiveWindow(
          layer.tracks.brightness.keyframes,
          layer.startBeat,
          layer.endBeat,
        ),
        colour: {
          interpolation: layer.tracks.colour.interpolation,
          keyframes: keyframesInActiveWindow(
            layer.tracks.colour.keyframes,
            layer.startBeat,
            layer.endBeat,
          ),
        },
      },
      layer,
      orderedLedAddresses: orderedLedIds.map((ledId) => ledAddress.get(ledId)!),
      orderedLedIds,
    };
  });
  const dynamic = compiledLayers.some(
    ({ keyframes, layer }) =>
      layer.enabled &&
      (layer.kind === 'effect' ||
        keyframes!.brightness.length > 0 ||
        keyframes!.colour.keyframes.length > 0),
  );
  const continuous = compiledLayers.some(
    ({ keyframes, layer }) =>
      layer.enabled &&
      (layer.kind === 'keyframe'
        ? keyframes!.brightness.length > 0 ||
          keyframes!.colour.keyframes.length > 0
        : layer.effect.type === 'pulse' ||
          layer.effect.type === 'wave' ||
          (layer.effect.type === 'sparkle' && layer.effect.decay === 'fade')),
  );
  const evaluationLayers = [...compiledLayers].reverse();
  const baseFrameById = new Map(baseFrame.map((led) => [led.ledId, led]));
  let lastFrame: LedFrame | null = null;
  let lastPosition: number | null = null;
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
    const shaped = shapeWaveform(effect.waveform, phase);
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
    effectSlots: readonly (readonly string[])[],
    colour: string,
    position: number,
  ): void {
    if (layer.effect.type !== 'chase' || effectSlots.length === 0) return;
    const effect = layer.effect;
    const slots =
      effect.direction === 'reverse' ? [...effectSlots].reverse() : effectSlots;
    const elapsed = normalizeLoopPosition(
      position - layer.startBeat,
      effect.cycleLengthBeats,
    );
    const head = Math.min(
      slots.length - 1,
      Math.floor((elapsed / effect.cycleLengthBeats) * slots.length),
    );
    slots.forEach((ledIds, index) => {
      const distance = (head - index + slots.length) % slots.length;
      let brightnessPercent: number | null = null;
      if (distance < effect.widthPositions)
        brightnessPercent = effect.brightnessPercent;
      else if (distance < effect.widthPositions + effect.trailLengthPositions) {
        const trailIndex = distance - effect.widthPositions;
        brightnessPercent =
          (effect.brightnessPercent *
            (effect.trailLengthPositions - trailIndex)) /
          (effect.trailLengthPositions + 1);
      }
      if (brightnessPercent === null) return;
      ledIds.forEach((ledId) => {
        const current = frameById.get(ledId)!;
        frameById.set(ledId, { ...current, brightnessPercent, colour });
      });
    });
  }

  function applyWave(
    frameById: Map<string, EvaluatedLed>,
    layer: EffectLayer,
    effectSlots: readonly (readonly string[])[],
    colour: string,
    position: number,
  ): void {
    if (layer.effect.type !== 'wave') return;
    const effect = layer.effect;
    const temporalPhase =
      (position - layer.startBeat + effect.phaseOffsetBeats) /
      effect.cycleLengthBeats;
    const spatialDirection = effect.direction === 'forward' ? -1 : 1;
    effectSlots.forEach((ledIds, index) => {
      const phase = unitPhase(
        temporalPhase + spatialDirection * (index / effect.wavelengthPositions),
      );
      const shaped = shapeWaveform(effect.waveform, phase);
      const brightnessPercent =
        effect.minBrightnessPercent +
        (effect.maxBrightnessPercent - effect.minBrightnessPercent) * shaped;
      ledIds.forEach((ledId) => {
        const current = frameById.get(ledId)!;
        frameById.set(ledId, { ...current, brightnessPercent, colour });
      });
    });
  }

  function applySparkle(
    frameById: Map<string, EvaluatedLed>,
    layer: EffectLayer,
    ledIds: readonly string[],
    ledAddresses: readonly number[],
    colour: string,
    position: number,
  ): void {
    if (layer.effect.type !== 'sparkle') return;
    const effect = layer.effect;
    const elapsed = position - layer.startBeat;
    const stepIndex = Math.floor(elapsed / effect.stepLengthBeats);
    const stepProgress =
      (elapsed - stepIndex * effect.stepLengthBeats) / effect.stepLengthBeats;
    const brightnessPercent =
      effect.decay === 'fade'
        ? effect.brightnessPercent * (1 - stepProgress)
        : effect.brightnessPercent;
    const threshold = effect.densityPercent / 100;
    ledIds.forEach((ledId, index) => {
      const sample =
        sparkleHash32(effect.seed, stepIndex, ledAddresses[index]) /
        UINT32_RANGE;
      if (sample >= threshold) return;
      const current = frameById.get(ledId)!;
      frameById.set(ledId, { ...current, brightnessPercent, colour });
    });
  }

  function applyKeyframes(
    frameById: Map<string, EvaluatedLed>,
    layer: KeyframeLayer,
    keyframes: {
      brightness: BrightnessKeyframe[];
      colour: ColourKeyframeTrack;
    },
    ledIds: readonly string[],
    position: number,
  ): void {
    const brightness = evaluateBrightnessTrack(keyframes.brightness, position);
    const colour = evaluateColourTrack(keyframes.colour, colours, position);
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
    if (position === lastPosition && lastFrame) return lastFrame;
    const stateKey = continuous
      ? null
      : compiledLayers
          .map(({ effectSlots, layer }) => {
            if (
              !layer.enabled ||
              position < layer.startBeat ||
              position >= layer.endBeat
            )
              return '-';
            return layer.kind === 'effect' && layer.effect.type === 'chase'
              ? `c${Math.floor(
                  (normalizeLoopPosition(
                    position - layer.startBeat,
                    layer.effect.cycleLengthBeats,
                  ) /
                    layer.effect.cycleLengthBeats) *
                    effectSlots.length,
                )}`
              : layer.kind === 'effect' && layer.effect.type === 'sparkle'
                ? `s${Math.floor((position - layer.startBeat) / layer.effect.stepLengthBeats)}`
                : '-';
          })
          .join('|');
    if (stateKey !== null && stateKey === lastStateKey && lastFrame) {
      lastPosition = position;
      return lastFrame;
    }
    const frameById = new Map(baseFrameById);
    for (const compiled of evaluationLayers) {
      const {
        colour,
        effectSlots,
        keyframes,
        layer,
        orderedLedAddresses,
        orderedLedIds,
      } = compiled;
      if (
        !layer.enabled ||
        position < layer.startBeat ||
        position >= layer.endBeat
      )
        continue;
      if (layer.kind === 'keyframe') {
        applyKeyframes(frameById, layer, keyframes!, orderedLedIds, position);
      } else {
        switch (layer.effect.type) {
          case 'pulse':
            applyPulse(frameById, layer, orderedLedIds, colour!, position);
            break;
          case 'chase':
            applyChase(frameById, layer, effectSlots, colour!, position);
            break;
          case 'wave':
            applyWave(frameById, layer, effectSlots, colour!, position);
            break;
          case 'sparkle':
            applySparkle(
              frameById,
              layer,
              orderedLedIds,
              orderedLedAddresses,
              colour!,
              position,
            );
            break;
        }
      }
    }
    lastPosition = position;
    lastStateKey = stateKey;
    lastFrame = addressOrderedLeds.map((led) => frameById.get(led.id)!);
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
