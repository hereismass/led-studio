import { kmsFourString10LedProfile } from '@led-studio/hardware-profiles';
import {
  PROJECT_LIMITS,
  type Project,
  type SceneLayer,
} from '@led-studio/project-format';
import { bench, describe } from 'vitest';
import {
  applyEditorCommand,
  createSceneDuplicatedCommand,
} from '../src/index.js';

function uuid(index: number): string {
  return `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`;
}

const paletteTokenId = uuid(1);
const sceneId = uuid(2);
const layers: SceneLayer[] = Array.from({ length: 512 }, (_, index) => ({
  effect: {
    cycleLengthBeats: 1,
    maxBrightnessPercent: 100,
    minBrightnessPercent: 0,
    paletteTokenId,
    phaseOffsetBeats: 0,
    type: 'pulse',
    waveform: 'sine',
  },
  enabled: true,
  endBeat: 4,
  id: uuid(index + 10),
  kind: 'effect',
  locked: false,
  name: `Layer ${index + 1}`,
  startBeat: 0,
  target: { groupId: 'all-leds', kind: 'profile-group' },
}));
const project: Project = {
  groups: [],
  hardwareProfile: kmsFourString10LedProfile.id,
  name: 'Benchmark',
  palette: [{ id: paletteTokenId, name: 'White', value: '#FFFFFF' }],
  scenes: [
    {
      id: sceneId,
      layers,
      ledStates: {},
      loopLengthBeats: 4,
      name: 'Scene',
    },
  ],
  schemaVersion: 2,
  songs: [],
  timing: {
    previewBpm: 120,
    timeSignature: { denominator: 4, numerator: 4 },
  },
};

describe('large editor commands', () => {
  let generatedId = 20_000;
  bench('prepare a 512-layer scene duplicate', () => {
    createSceneDuplicatedCommand(project, sceneId, () => uuid(generatedId++));
  });

  const duplicate = createSceneDuplicatedCommand(
    project,
    sceneId,
    (() => {
      let nextId = 40_000;
      return () => uuid(nextId++);
    })(),
  );
  bench('apply a 512-layer scene duplicate', () => {
    applyEditorCommand(project, duplicate);
  });

  const keyframeLayer: SceneLayer = {
    enabled: true,
    endBeat: 1024,
    id: uuid(30_000),
    kind: 'keyframe',
    locked: false,
    name: 'Dense automation',
    startBeat: 0,
    target: { groupId: 'all-leds', kind: 'profile-group' },
    tracks: {
      brightness: {
        keyframes: Array.from(
          { length: PROJECT_LIMITS.keyframesPerTrack },
          (_, index) => ({
            beat: index / 4,
            brightnessPercent: index % 101,
            easing: 'linear',
            id: uuid(50_000 + index),
          }),
        ),
      },
      colour: { interpolation: 'step', keyframes: [] },
    },
  };
  const keyframeProject: Project = {
    ...project,
    scenes: [
      {
        ...project.scenes[0],
        layers: [keyframeLayer],
        loopLengthBeats: 1024,
      },
    ],
  };
  const moves =
    keyframeLayer.kind === 'keyframe'
      ? keyframeLayer.tracks.brightness.keyframes.map((keyframe, index) => ({
          beat:
            index === PROJECT_LIMITS.keyframesPerTrack - 1
              ? 0
              : keyframe.beat + 0.25,
          id: keyframe.id,
          track: 'brightness' as const,
        }))
      : [];
  bench('move 4096 selected keyframes atomically', () => {
    applyEditorCommand(keyframeProject, {
      keyframes: moves,
      layerId: keyframeLayer.id,
      sceneId,
      type: 'keyframes-moved',
    });
  });
});
