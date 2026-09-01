import { kmsFourString10LedProfile } from '@led-studio/hardware-profiles';
import type {
  PaletteToken,
  Scene,
  SceneLayer,
} from '@led-studio/project-format';
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
const spatialScene: Scene = {
  ...scene,
  id: uuid(20_000),
  layers: Array.from({ length: 512 }, (_, index): SceneLayer =>
    index % 2 === 0
      ? {
          effect: {
            cycleLengthBeats: 2,
            direction: index % 4 === 0 ? 'forward' : 'reverse',
            maxBrightnessPercent: 100,
            minBrightnessPercent: 10,
            paletteTokenId: token.id,
            phaseOffsetBeats: index % 4,
            type: 'wave',
            waveform: 'sine',
            wavelengthLeds: 4,
          },
          enabled: true,
          endBeat: 4,
          id: uuid(index + 21_000),
          kind: 'effect',
          locked: false,
          name: `Wave ${index + 1}`,
          startBeat: 0,
          target: { groupId: 'all-leds', kind: 'profile-group' },
        }
      : {
          effect: {
            brightnessPercent: 80,
            decay: 'fade',
            densityPercent: 25,
            paletteTokenId: token.id,
            seed: index,
            stepLengthBeats: 0.25,
            type: 'sparkle',
          },
          enabled: true,
          endBeat: 4,
          id: uuid(index + 21_000),
          kind: 'effect',
          locked: false,
          name: `Sparkle ${index + 1}`,
          startBeat: 0,
          target: { groupId: 'all-leds', kind: 'profile-group' },
        },
  ),
  name: 'Spatial effects benchmark scene',
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

  const spatialEvaluator = compileSceneEvaluator(
    spatialScene,
    [token],
    kmsFourString10LedProfile,
  );
  let spatialPosition = 0;
  bench('evaluate 512 mixed Wave and Sparkle layers', () => {
    spatialPosition += 1 / 240;
    spatialEvaluator.getFrame(spatialPosition);
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
