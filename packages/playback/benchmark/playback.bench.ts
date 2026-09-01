import { kmsFourString10LedProfile } from '@led-studio/hardware-profiles';
import type { PaletteToken, Scene } from '@led-studio/project-format';
import { bench, describe } from 'vitest';
import { compileSceneEvaluator } from '../src/index.js';

function uuid(index: number): string {
  return `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`;
}

const token: PaletteToken = {
  id: uuid(1),
  name: 'White',
  value: '#FFFFFF',
};
const scene: Scene = {
  id: uuid(2),
  layers: Array.from({ length: 512 }, (_, index) => ({
    effect: {
      cycleLengthBeats: 1,
      maxBrightnessPercent: 100,
      minBrightnessPercent: 0,
      paletteTokenId: token.id,
      phaseOffsetBeats: index % 4,
      type: 'pulse' as const,
      waveform: 'sine' as const,
    },
    enabled: true,
    endBeat: 4,
    id: uuid(index + 10),
    kind: 'effect' as const,
    locked: false,
    name: `Pulse ${index + 1}`,
    startBeat: 0,
    target: { groupId: 'all-leds', kind: 'profile-group' as const },
  })),
  ledStates: {},
  loopLengthBeats: 4,
  name: 'Benchmark scene',
};
const keyframeScene: Scene = {
  ...scene,
  id: uuid(600),
  layers: [
    {
      enabled: true,
      endBeat: 4096,
      id: uuid(601),
      kind: 'keyframe',
      locked: false,
      name: 'Large keyframe track',
      startBeat: 0,
      target: { groupId: 'all-leds', kind: 'profile-group' },
      tracks: {
        brightness: {
          keyframes: Array.from({ length: 4096 }, (_, index) => ({
            beat: index,
            brightnessPercent: index % 101,
            easing: 'linear',
            id: uuid(index + 10_000),
          })),
        },
        colour: { interpolation: 'linear-rgb', keyframes: [] },
      },
    },
  ],
  loopLengthBeats: 4096,
  name: 'Keyframe benchmark scene',
};

describe('large scene playback', () => {
  bench('compile 512 animated layers', () => {
    compileSceneEvaluator(scene, [token], kmsFourString10LedProfile);
  });

  const evaluator = compileSceneEvaluator(
    scene,
    [token],
    kmsFourString10LedProfile,
  );
  let position = 0;
  bench('evaluate the next frame across 512 layers', () => {
    position += 1 / 240;
    evaluator.getFrame(position);
  });

  const keyframeEvaluator = compileSceneEvaluator(
    keyframeScene,
    [token],
    kmsFourString10LedProfile,
  );
  let keyframePosition = 0;
  bench('evaluate a track with 4096 ordered keys', () => {
    keyframePosition = (keyframePosition + 1.25) % 4096;
    keyframeEvaluator.getFrame(keyframePosition);
  });
});
