import type { HardwareProfile } from '@led-studio/hardware-profiles';
import type { PaletteToken, Scene } from '@led-studio/project-format';

export interface EvaluatedLed {
  address: number;
  brightnessPercent: number;
  colour: string | null;
  ledId: string;
}

export type LedFrame = readonly EvaluatedLed[];

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

export function evaluateSceneFrame(
  scene: Scene,
  palette: readonly PaletteToken[],
  profile: HardwareProfile,
  positionBeats: number,
): LedFrame {
  normalizeLoopPosition(positionBeats, scene.loopLengthBeats);

  const profileLedIds = new Set(profile.leds.map((led) => led.id));
  for (const ledId of Object.keys(scene.ledStates)) {
    if (!profileLedIds.has(ledId)) {
      throw new Error(
        `Scene "${scene.name}" references unknown LED "${ledId}"`,
      );
    }
  }

  const colours = new Map(palette.map((token) => [token.id, token.value]));
  return profile.leds.map((led) => {
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
}
