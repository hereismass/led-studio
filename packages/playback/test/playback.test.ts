import { kmsFourString10LedProfile } from '@led-studio/hardware-profiles';
import type { PaletteToken, Scene } from '@led-studio/project-format';
import { describe, expect, it } from 'vitest';
import {
  advanceLoopPosition,
  compileSceneEvaluator,
  evaluateBrightnessTrack,
  evaluateColourTrack,
  evaluateSceneFrame,
  normalizeLoopPosition,
} from '../src/index.js';

const WHITE_ID = '8b2c3d4e-5f60-4a71-8b92-c3d4e5f60718';
const PINK_ID = '1a2b3c4d-5e6f-4789-8abc-def012345678';
const GREEN_ID = 'f0e1d2c3-b4a5-4678-9abc-def012345678';
const palette: PaletteToken[] = [
  { id: WHITE_ID, name: 'White', value: '#FFFFFF' },
  { id: PINK_ID, name: 'Pink', value: '#FF2B9A' },
  { id: GREEN_ID, name: 'Green', value: '#45FF72' },
];
const scene: Scene = {
  id: '6c21dc04-9a75-4f10-a7bb-9f17dc2fe32a',
  layers: [],
  ledStates: {
    'fret-21-g-side': {
      brightnessPercent: 40,
      paletteTokenId: WHITE_ID,
    },
  },
  loopLengthBeats: 4,
  name: 'Scene 1',
};

describe('loop timing', () => {
  it('normalizes exact, repeated, and negative loop positions', () => {
    expect(normalizeLoopPosition(0, 4)).toBe(0);
    expect(normalizeLoopPosition(4, 4)).toBe(0);
    expect(normalizeLoopPosition(9.5, 4)).toBe(1.5);
    expect(normalizeLoopPosition(-0.25, 4)).toBe(3.75);
  });

  it('advances beats from elapsed milliseconds and wraps', () => {
    expect(advanceLoopPosition(0, 500, 120, 4)).toBe(1);
    expect(advanceLoopPosition(3.5, 750, 120, 4)).toBe(1);
  });

  it('rejects invalid timing inputs', () => {
    expect(() => normalizeLoopPosition(Number.NaN, 4)).toThrow(/finite/);
    expect(() => normalizeLoopPosition(0, 0)).toThrow(/positive/);
    expect(() => advanceLoopPosition(0, -1, 120, 4)).toThrow(/non-negative/);
    expect(() => advanceLoopPosition(0, 1, 0, 4)).toThrow(/positive/);
  });
});

describe('scene evaluation', () => {
  it('resolves lit and off LEDs in physical address order', () => {
    const frame = evaluateSceneFrame(
      scene,
      palette,
      kmsFourString10LedProfile,
      2.5,
    );

    expect(frame).toHaveLength(10);
    expect(frame.map((led) => led.address)).toEqual(
      Array.from({ length: 10 }, (_, address) => address),
    );
    expect(frame[0]).toEqual({
      address: 0,
      brightnessPercent: 40,
      colour: '#FFFFFF',
      ledId: 'fret-21-g-side',
    });
    expect(frame[1]).toEqual({
      address: 1,
      brightnessPercent: 0,
      colour: null,
      ledId: 'fret-19-g-side',
    });
  });

  it('produces the same static frame at every loop position', () => {
    const evaluator = compileSceneEvaluator(
      scene,
      palette,
      kmsFourString10LedProfile,
    );
    expect(evaluator.getFrame(0)).toBe(evaluator.frame);
    expect(evaluator.getFrame(3.99)).toBe(evaluator.frame);
  });

  it('keeps the linked colour while a static LED is at zero brightness', () => {
    const frame = evaluateSceneFrame(
      {
        ...scene,
        ledStates: {
          'fret-21-g-side': {
            brightnessPercent: 0,
            paletteTokenId: WHITE_ID,
          },
        },
      },
      palette,
      kmsFourString10LedProfile,
      0,
    );

    expect(frame[0]).toMatchObject({
      brightnessPercent: 0,
      colour: '#FFFFFF',
    });
  });

  it('rejects unknown LED and palette references', () => {
    expect(() =>
      evaluateSceneFrame(
        { ...scene, ledStates: { missing: scene.ledStates['fret-21-g-side'] } },
        palette,
        kmsFourString10LedProfile,
        0,
      ),
    ).toThrow(/unknown LED/);
    expect(() =>
      evaluateSceneFrame(scene, [], kmsFourString10LedProfile, 0),
    ).toThrow(/unknown palette token/);
  });

  it('evaluates Pulse waveforms, phase, active ranges, and zero overrides', () => {
    const pulseScene: Scene = {
      ...scene,
      layers: [
        {
          effect: {
            cycleLengthBeats: 1,
            maxBrightnessPercent: 100,
            minBrightnessPercent: 0,
            paletteTokenId: PINK_ID,
            phaseOffsetBeats: 0,
            type: 'pulse',
            waveform: 'sine',
          },
          enabled: true,
          endBeat: 2,
          id: 'bb93ef72-0987-4b53-9924-9a720215ce8a',
          kind: 'effect',
          locked: false,
          name: 'Pulse',
          startBeat: 0,
          target: { kind: 'leds', ledIds: ['fret-21-g-side'] },
        },
      ],
    };
    const evaluator = compileSceneEvaluator(
      pulseScene,
      palette,
      kmsFourString10LedProfile,
    );
    expect(evaluator.getFrame(0)[0]).toMatchObject({
      brightnessPercent: 0,
      colour: '#FF2B9A',
    });
    expect(evaluator.getFrame(0.5)[0]).toMatchObject({
      brightnessPercent: 100,
      colour: '#FF2B9A',
    });
    expect(evaluator.getFrame(2)[0]).toMatchObject({
      brightnessPercent: 40,
      colour: '#FFFFFF',
    });
    expect(evaluator.getFrame(0.5)).toBe(evaluator.getFrame(0.5));
  });

  it('evaluates Chase address order, direction, width, fading trail, and wrap', () => {
    const chaseScene: Scene = {
      ...scene,
      layers: [
        {
          effect: {
            brightnessPercent: 90,
            direction: 'forward',
            paletteTokenId: GREEN_ID,
            stepLengthBeats: 0.25,
            trailLength: 2,
            type: 'chase',
            width: 1,
          },
          enabled: true,
          endBeat: 4,
          id: '2ac65eaf-4c2c-482e-b525-1c6e941dd0c8',
          kind: 'effect',
          locked: false,
          name: 'Chase',
          startBeat: 0,
          target: {
            kind: 'leds',
            ledIds: ['fret-17-g-side', 'fret-21-g-side', 'fret-19-g-side'],
          },
        },
      ],
    };
    const atStart = evaluateSceneFrame(
      chaseScene,
      palette,
      kmsFourString10LedProfile,
      0,
    );
    expect(
      atStart.slice(0, 3).map(({ brightnessPercent }) => brightnessPercent),
    ).toEqual([90, 30, 60]);
    const chaseEvaluator = compileSceneEvaluator(
      chaseScene,
      palette,
      kmsFourString10LedProfile,
    );
    expect(chaseEvaluator.getFrame(0.01)).toBe(chaseEvaluator.getFrame(0.24));
    const next = evaluateSceneFrame(
      chaseScene,
      palette,
      kmsFourString10LedProfile,
      0.25,
    );
    expect(
      next.slice(0, 3).map(({ brightnessPercent }) => brightnessPercent),
    ).toEqual([60, 90, 30]);
    const chaseLayer = chaseScene.layers[0];
    if (chaseLayer.kind !== 'effect' || chaseLayer.effect.type !== 'chase')
      throw new Error('Expected Chase');
    const reverse = evaluateSceneFrame(
      {
        ...chaseScene,
        layers: [
          {
            ...chaseLayer,
            effect: { ...chaseLayer.effect, direction: 'reverse' },
          },
        ],
      },
      palette,
      kmsFourString10LedProfile,
      0,
    );
    expect(reverse[2]).toMatchObject({
      brightnessPercent: 90,
      colour: '#45FF72',
    });
  });

  it('resolves linked groups and gives the topmost enabled layer precedence', () => {
    const layered: Scene = {
      ...scene,
      layers: [
        {
          effect: {
            cycleLengthBeats: 1,
            maxBrightnessPercent: 50,
            minBrightnessPercent: 50,
            paletteTokenId: PINK_ID,
            phaseOffsetBeats: 0,
            type: 'pulse',
            waveform: 'square',
          },
          enabled: true,
          endBeat: 4,
          id: 'bb93ef72-0987-4b53-9924-9a720215ce8a',
          kind: 'effect',
          locked: false,
          name: 'Top pulse',
          startBeat: 0,
          target: {
            groupId: 'ad56c792-07e6-42d7-84fd-0b509289b4ab',
            kind: 'project-group',
          },
        },
        {
          effect: {
            brightnessPercent: 100,
            direction: 'forward',
            paletteTokenId: GREEN_ID,
            stepLengthBeats: 0.25,
            trailLength: 0,
            type: 'chase',
            width: 1,
          },
          enabled: true,
          endBeat: 4,
          id: '2ac65eaf-4c2c-482e-b525-1c6e941dd0c8',
          kind: 'effect',
          locked: false,
          name: 'Bottom chase',
          startBeat: 0,
          target: { groupId: 'all-leds', kind: 'profile-group' },
        },
      ],
    };
    const frame = evaluateSceneFrame(
      layered,
      palette,
      kmsFourString10LedProfile,
      0,
      [
        {
          id: 'ad56c792-07e6-42d7-84fd-0b509289b4ab',
          ledIds: ['fret-21-g-side'],
          name: 'First LED',
        },
      ],
    );
    expect(frame[0]).toMatchObject({
      brightnessPercent: 50,
      colour: '#FF2B9A',
    });
  });

  it('interpolates brightness and supports smooth or stepped colours', () => {
    expect(
      evaluateBrightnessTrack(
        [
          {
            beat: 0,
            brightnessPercent: 0,
            id: '11111111-1111-4111-8111-111111111111',
          },
          {
            beat: 2,
            brightnessPercent: 100,
            id: '22222222-2222-4222-8222-222222222222',
          },
        ],
        1,
      ),
    ).toBe(50);
    const colours = new Map(palette.map((token) => [token.id, token.value]));
    const keyframes = [
      {
        beat: 0,
        id: '33333333-3333-4333-8333-333333333333',
        paletteTokenId: PINK_ID,
      },
      {
        beat: 2,
        id: '44444444-4444-4444-8444-444444444444',
        paletteTokenId: GREEN_ID,
      },
    ];
    expect(
      evaluateColourTrack(
        { interpolation: 'linear-rgb', keyframes },
        colours,
        1,
      ),
    ).toBe('#A29586');
    expect(
      evaluateColourTrack({ interpolation: 'step', keyframes }, colours, 1),
    ).toBe('#FF2B9A');
  });

  it('applies independent keyframe properties over lower layers only inside the active window', () => {
    const hybrid: Scene = {
      ...scene,
      layers: [
        {
          enabled: true,
          endBeat: 3,
          id: 'c4793529-a645-4c18-8a4d-5e4f148ee493',
          kind: 'keyframe',
          locked: false,
          name: 'Brightness keys',
          startBeat: 1,
          target: { kind: 'leds', ledIds: ['fret-21-g-side'] },
          tracks: {
            brightness: {
              keyframes: [
                {
                  beat: 0,
                  brightnessPercent: 50,
                  id: '11111111-1111-4111-8111-111111111111',
                },
                {
                  beat: 2,
                  brightnessPercent: 100,
                  id: '22222222-2222-4222-8222-222222222222',
                },
              ],
            },
            colour: { interpolation: 'linear-rgb', keyframes: [] },
          },
        },
        {
          effect: {
            cycleLengthBeats: 1,
            maxBrightnessPercent: 50,
            minBrightnessPercent: 50,
            paletteTokenId: PINK_ID,
            phaseOffsetBeats: 0,
            type: 'pulse',
            waveform: 'square',
          },
          enabled: true,
          endBeat: 4,
          id: 'bb93ef72-0987-4b53-9924-9a720215ce8a',
          kind: 'effect',
          locked: false,
          name: 'Pink base',
          startBeat: 0,
          target: { kind: 'leds', ledIds: ['fret-21-g-side'] },
        },
      ],
    };

    expect(
      evaluateSceneFrame(hybrid, palette, kmsFourString10LedProfile, 0.5)[0],
    ).toMatchObject({ brightnessPercent: 50, colour: '#FF2B9A' });
    expect(
      evaluateSceneFrame(hybrid, palette, kmsFourString10LedProfile, 1)[0],
    ).toMatchObject({ brightnessPercent: 75, colour: '#FF2B9A' });
    expect(
      evaluateSceneFrame(hybrid, palette, kmsFourString10LedProfile, 3)[0],
    ).toMatchObject({ brightnessPercent: 50, colour: '#FF2B9A' });
  });
});
