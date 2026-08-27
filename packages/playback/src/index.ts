import type { HardwareProfile } from '@led-studio/hardware-profiles';
import type {
  EffectLayer,
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
  const compiledLayers = scene.layers.map((layer) => {
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
        `Effect layer "${layer.name}" references unknown ${groupTarget.kind === 'profile-group' ? 'profile' : 'project'} group "${groupTarget.groupId}"`,
      );
    }
    const orderedLedIds = [...targetLedIds].sort(
      (left, right) => ledAddress.get(left)! - ledAddress.get(right)!,
    );
    orderedLedIds.forEach((ledId) => {
      if (!profileLedIds.has(ledId)) {
        throw new Error(
          `Effect layer "${layer.name}" references unknown LED "${ledId}"`,
        );
      }
    });
    const colour = colours.get(layer.effect.paletteTokenId);
    if (!colour) {
      throw new Error(
        `Effect layer "${layer.name}" references unknown palette token "${layer.effect.paletteTokenId}"`,
      );
    }
    return { colour, layer, orderedLedIds };
  });
  const dynamic = compiledLayers.some(({ layer }) => layer.enabled);
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
        return layer.effect.type === 'pulse'
          ? `p${position}`
          : `c${Math.floor((position - layer.startBeat) / layer.effect.stepLengthBeats)}`;
      })
      .join('|');
    if (stateKey === lastStateKey && lastFrame) return lastFrame;
    const frameById = new Map(baseFrame.map((led) => [led.ledId, led]));
    for (const compiled of [...compiledLayers].reverse()) {
      const { colour, layer, orderedLedIds } = compiled;
      if (
        !layer.enabled ||
        position < layer.startBeat ||
        position >= layer.endBeat
      )
        continue;
      if (layer.effect.type === 'pulse')
        applyPulse(frameById, layer, orderedLedIds, colour, position);
      else applyChase(frameById, layer, orderedLedIds, colour, position);
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
