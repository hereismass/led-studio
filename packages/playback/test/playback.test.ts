import { kmsFourString10LedProfile } from '@led-studio/hardware-profiles';
import type { PaletteToken, Scene, Song } from '@led-studio/project-format';
import { describe, expect, it } from 'vitest';
import {
  advanceLoopPosition,
  advanceSongPlaybackState,
  applyKeyframeEasing,
  compileSongPlayback,
  compileSceneEvaluator,
  createSongPlaybackState,
  evaluateBrightnessTrack,
  evaluateColourTrack,
  evaluateSceneFrame,
  keyframesInActiveWindow,
  launchSongCue,
  normalizeLoopPosition,
  sparkleHash32,
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

describe('song playback', () => {
  const secondScene: Scene = {
    ...scene,
    id: '87f41d2e-6075-49a8-a3ed-928586d3d73e',
    loopLengthBeats: 2,
    name: 'Scene 2',
  };
  const song: Song = {
    cues: [
      {
        advance: { kind: 'after-loops', loopCount: 2 },
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Intro',
        sceneId: scene.id,
      },
      {
        advance: { kind: 'after-loops', loopCount: 1 },
        id: '22222222-2222-4222-8222-222222222222',
        name: 'Outro',
        sceneId: secondScene.id,
      },
    ],
    id: '33333333-3333-4333-8333-333333333333',
    launchQuantization: 'next-bar',
    name: 'Song 1',
    timing: {
      previewBpm: 120,
      timeSignature: { denominator: 4, numerator: 4 },
    },
  };

  it('advances automatic cues after their configured scene loops', () => {
    const compiled = compileSongPlayback(song, [scene, secondScene]);
    const initial = createSongPlaybackState(song);
    const beforeBoundary = compiled.advance(initial, 7.5);
    expect(beforeBoundary).toMatchObject({
      activeCueId: song.cues[0].id,
      completedLoops: 1,
      cuePositionBeats: 3.5,
    });

    const advanced = compiled.advance(beforeBoundary, 1);
    expect(advanced).toMatchObject({
      activeCueId: song.cues[1].id,
      completedLoops: 0,
      cuePositionBeats: 0.5,
    });
  });

  it('keeps looping and marks a completed final automatic cue as held', () => {
    const final = launchSongCue(
      song,
      createSongPlaybackState(song),
      song.cues[1].id,
    );
    expect(
      advanceSongPlaybackState(song, [scene, secondScene], final, 4.5),
    ).toMatchObject({
      activeCueId: song.cues[1].id,
      completedLoops: 2,
      cuePositionBeats: 0.5,
      finalCueHeld: true,
    });
  });

  it('launches a requested cue deterministically', () => {
    const state = advanceSongPlaybackState(
      song,
      [scene, secondScene],
      createSongPlaybackState(song),
      3,
    );
    expect(launchSongCue(song, state, song.cues[1].id)).toEqual({
      activeCueId: song.cues[1].id,
      completedLoops: 0,
      cuePositionBeats: 0,
      finalCueHeld: false,
    });
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

  it('evaluates Chase over grouped effect positions with a clean full loop', () => {
    const chaseScene: Scene = {
      ...scene,
      layers: [
        {
          effect: {
            brightnessPercent: 90,
            cycleLengthBeats: 4,
            direction: 'forward',
            paletteTokenId: GREEN_ID,
            trailLengthPositions: 0,
            type: 'chase',
            widthPositions: 1,
          },
          enabled: true,
          endBeat: 4,
          id: '2ac65eaf-4c2c-482e-b525-1c6e941dd0c8',
          kind: 'effect',
          locked: false,
          name: 'Chase',
          startBeat: 0,
          target: { groupId: 'all-leds', kind: 'profile-group' },
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
      atStart.find(({ ledId }) => ledId === 'fret-03-e-side'),
    ).toMatchObject({ brightnessPercent: 90, colour: '#45FF72' });
    const chaseEvaluator = compileSceneEvaluator(
      chaseScene,
      palette,
      kmsFourString10LedProfile,
    );
    expect(chaseEvaluator.getFrame(0.01)).toBe(chaseEvaluator.getFrame(0.4));
    const next = evaluateSceneFrame(
      chaseScene,
      palette,
      kmsFourString10LedProfile,
      4 / 9 + 0.000_001,
    );
    expect(next.find(({ ledId }) => ledId === 'fret-05-e-side')).toMatchObject({
      brightnessPercent: 90,
      colour: '#45FF72',
    });
    const atTwelfthFret = evaluateSceneFrame(
      chaseScene,
      palette,
      kmsFourString10LedProfile,
      16 / 9 + 0.000_001,
    );
    expect(
      atTwelfthFret
        .filter(({ ledId }) => ledId.startsWith('fret-12-'))
        .map(({ brightnessPercent }) => brightnessPercent),
    ).toEqual([90, 90]);
    expect(chaseEvaluator.getFrame(4)).toEqual(chaseEvaluator.getFrame(0));
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
    expect(
      reverse.find(({ ledId }) => ledId === 'fret-21-g-side'),
    ).toMatchObject({
      brightnessPercent: 90,
      colour: '#45FF72',
    });

    const withTrail = evaluateSceneFrame(
      {
        ...chaseScene,
        layers: [
          {
            ...chaseLayer,
            effect: { ...chaseLayer.effect, trailLengthPositions: 2 },
          },
        ],
      },
      palette,
      kmsFourString10LedProfile,
      0,
    );
    expect(
      withTrail.find(({ ledId }) => ledId === 'fret-21-g-side')
        ?.brightnessPercent,
    ).toBe(60);
    expect(
      withTrail.find(({ ledId }) => ledId === 'fret-19-g-side')
        ?.brightnessPercent,
    ).toBe(30);
  });

  it('evaluates Wave over grouped positions with direction and loop timing', () => {
    const waveScene: Scene = {
      ...scene,
      layers: [
        {
          effect: {
            cycleLengthBeats: 4,
            direction: 'forward',
            maxBrightnessPercent: 100,
            minBrightnessPercent: 0,
            paletteTokenId: PINK_ID,
            phaseOffsetBeats: 0,
            type: 'wave',
            waveform: 'sine',
            wavelengthPositions: 4,
          },
          enabled: true,
          endBeat: 4,
          id: '5d4b6d3e-1f25-48c1-8c74-7cb8449ed41e',
          kind: 'effect',
          locked: false,
          name: 'Wave',
          startBeat: 0,
          target: { groupId: 'all-leds', kind: 'profile-group' },
        },
      ],
    };
    const atStart = evaluateSceneFrame(
      waveScene,
      palette,
      kmsFourString10LedProfile,
      0,
    );
    const twelfthBrightness = atStart
      .filter(({ ledId }) => ledId.startsWith('fret-12-'))
      .map(({ brightnessPercent }) => brightnessPercent);
    expect(twelfthBrightness[0]).toBeCloseTo(twelfthBrightness[1]);
    expect(
      evaluateSceneFrame(waveScene, palette, kmsFourString10LedProfile, 4),
    ).toEqual(atStart);
    const forward = evaluateSceneFrame(
      waveScene,
      palette,
      kmsFourString10LedProfile,
      1,
    );
    expect(
      forward.find(({ ledId }) => ledId === 'fret-05-e-side')
        ?.brightnessPercent,
    ).toBeCloseTo(0);

    const waveLayer = waveScene.layers[0];
    if (waveLayer.kind !== 'effect' || waveLayer.effect.type !== 'wave')
      throw new Error('Expected Wave');
    const reverse = evaluateSceneFrame(
      {
        ...waveScene,
        layers: [
          {
            ...waveLayer,
            effect: { ...waveLayer.effect, direction: 'reverse' },
          },
        ],
      },
      palette,
      kmsFourString10LedProfile,
      1,
    );
    expect(
      reverse.find(({ ledId }) => ledId === 'fret-05-e-side')
        ?.brightnessPercent,
    ).toBeCloseTo(100);

    const singleTwelfth = evaluateSceneFrame(
      {
        ...waveScene,
        layers: [
          {
            ...waveLayer,
            target: { kind: 'leds', ledIds: ['fret-12-e-side'] },
          },
        ],
      },
      palette,
      kmsFourString10LedProfile,
      1,
    );
    expect(
      singleTwelfth.find(({ ledId }) => ledId === 'fret-12-e-side')?.colour,
    ).toBe('#FF2B9A');
    expect(
      singleTwelfth.find(({ ledId }) => ledId === 'fret-12-g-side')
        ?.brightnessPercent,
    ).toBe(0);
  });

  it('evaluates deterministic Sparkle steps, pass-through, and fade decay', () => {
    expect([
      sparkleHash32(42, 0, 0),
      sparkleHash32(42, 0, 1),
      sparkleHash32(42, 1, 0),
      sparkleHash32(43, 0, 0),
    ]).toEqual([2939521297, 3729765615, 2585184744, 2228993446]);

    const sparkleScene: Scene = {
      ...scene,
      layers: [
        {
          effect: {
            brightnessPercent: 80,
            decay: 'hold',
            densityPercent: 100,
            paletteTokenId: PINK_ID,
            seed: 42,
            stepLengthBeats: 0.25,
            type: 'sparkle',
          },
          enabled: true,
          endBeat: 2,
          id: '6e5c7e4f-2a36-49d2-9d85-8dc955afe52f',
          kind: 'effect',
          locked: false,
          name: 'Sparkle',
          startBeat: 0,
          target: {
            kind: 'leds',
            ledIds: ['fret-21-g-side', 'fret-19-g-side'],
          },
        },
      ],
    };
    const holdEvaluator = compileSceneEvaluator(
      sparkleScene,
      palette,
      kmsFourString10LedProfile,
    );
    expect(holdEvaluator.getFrame(0.01)).toBe(holdEvaluator.getFrame(0.24));
    expect(holdEvaluator.getFrame(0)[0]).toMatchObject({
      brightnessPercent: 80,
      colour: '#FF2B9A',
    });

    const sparkleLayer = sparkleScene.layers[0];
    if (
      sparkleLayer.kind !== 'effect' ||
      sparkleLayer.effect.type !== 'sparkle'
    )
      throw new Error('Expected Sparkle');
    const fadeEvaluator = compileSceneEvaluator(
      {
        ...sparkleScene,
        layers: [
          {
            ...sparkleLayer,
            effect: { ...sparkleLayer.effect, decay: 'fade' },
          },
        ],
      },
      palette,
      kmsFourString10LedProfile,
    );
    expect(fadeEvaluator.getFrame(0.125)[0].brightnessPercent).toBe(40);

    const passThrough = evaluateSceneFrame(
      {
        ...sparkleScene,
        layers: [
          {
            ...sparkleLayer,
            effect: { ...sparkleLayer.effect, densityPercent: 0 },
          },
        ],
      },
      palette,
      kmsFourString10LedProfile,
      0,
    );
    expect(passThrough[0]).toMatchObject({
      brightnessPercent: 40,
      colour: '#FFFFFF',
    });
    expect(passThrough[1]).toMatchObject({
      brightnessPercent: 0,
      colour: null,
    });
  });

  it('decorrelates Sparkle density across adjacent physical addresses', () => {
    const activeCounts = Array.from(
      { length: 4096 },
      (_, stepIndex) =>
        Array.from({ length: 10 }, (_, ledAddress) =>
          sparkleHash32(20260901, stepIndex, ledAddress),
        ).filter((sample) => sample / 0x1_0000_0000 < 0.2).length,
    );
    const meanActiveCount =
      activeCounts.reduce((total, count) => total + count, 0) /
      activeCounts.length;

    expect(meanActiveCount).toBeGreaterThan(1.8);
    expect(meanActiveCount).toBeLessThan(2.2);
    expect(activeCounts.filter((count) => count === 0).length).toBeLessThan(
      700,
    );
    expect(activeCounts.filter((count) => count === 10)).toHaveLength(0);
    expect(new Set(activeCounts).size).toBeGreaterThan(4);
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
            cycleLengthBeats: 4,
            direction: 'forward',
            paletteTokenId: GREEN_ID,
            trailLengthPositions: 0,
            type: 'chase',
            widthPositions: 1,
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
            easing: 'linear',
            id: '11111111-1111-4111-8111-111111111111',
          },
          {
            beat: 2,
            brightnessPercent: 100,
            easing: 'linear',
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
        easing: 'linear' as const,
        id: '33333333-3333-4333-8333-333333333333',
        paletteTokenId: PINK_ID,
      },
      {
        beat: 2,
        easing: 'linear' as const,
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
    expect(
      evaluateColourTrack({ interpolation: 'step', keyframes }, colours, 2),
    ).toBe('#45FF72');
  });

  it.each([
    ['linear', 0.25, 25],
    ['ease-in', 0.25, 6.25],
    ['ease-out', 0.25, 43.75],
    ['ease-in-out', 0.25, 12.5],
  ] as const)(
    'applies %s easing to brightness progress',
    (easing, position, expected) => {
      expect(
        evaluateBrightnessTrack(
          [
            {
              beat: 0,
              brightnessPercent: 0,
              easing,
              id: '77777777-7777-4777-8777-777777777777',
            },
            {
              beat: 1,
              brightnessPercent: 100,
              easing: 'linear',
              id: '88888888-8888-4888-8888-888888888888',
            },
          ],
          position,
        ),
      ).toBe(expected);
    },
  );

  it('uses the outgoing colour key easing while Step remains discrete', () => {
    const colours = new Map(palette.map((token) => [token.id, token.value]));
    const keyframes = [
      {
        beat: 0,
        easing: 'ease-in' as const,
        id: '77777777-7777-4777-8777-777777777777',
        paletteTokenId: PINK_ID,
      },
      {
        beat: 1,
        easing: 'linear' as const,
        id: '88888888-8888-4888-8888-888888888888',
        paletteTokenId: GREEN_ID,
      },
    ];
    expect(
      evaluateColourTrack(
        { interpolation: 'linear-rgb', keyframes },
        colours,
        0.5,
      ),
    ).toBe('#D16090');
    expect(
      evaluateColourTrack({ interpolation: 'step', keyframes }, colours, 0.5),
    ).toBe('#FF2B9A');
  });

  it('bounds easing progress and preserves exact endpoints', () => {
    expect(applyKeyframeEasing('ease-in', -1)).toBe(0);
    expect(applyKeyframeEasing('ease-out', 2)).toBe(1);
    expect(applyKeyframeEasing('ease-in-out', 0.5)).toBe(0.5);
  });

  it('uses terminal keys as inclusive interpolation endpoints', () => {
    const brightnessKeyframes = [
      {
        beat: 0,
        brightnessPercent: 0,
        easing: 'linear' as const,
        id: '11111111-1111-4111-8111-111111111111',
      },
      {
        beat: 2,
        brightnessPercent: 100,
        easing: 'linear' as const,
        id: '22222222-2222-4222-8222-222222222222',
      },
      {
        beat: 4,
        brightnessPercent: 0,
        easing: 'linear' as const,
        id: '33333333-3333-4333-8333-333333333333',
      },
    ];
    expect(keyframesInActiveWindow(brightnessKeyframes, 0, 4)).toEqual(
      brightnessKeyframes,
    );
    expect(keyframesInActiveWindow(brightnessKeyframes, 1, 3)).toEqual([
      brightnessKeyframes[1],
    ]);
    expect(evaluateBrightnessTrack(brightnessKeyframes, 3)).toBe(50);
    expect(evaluateBrightnessTrack(brightnessKeyframes, 4)).toBe(0);

    const colours = new Map(palette.map((token) => [token.id, token.value]));
    expect(
      evaluateColourTrack(
        {
          interpolation: 'linear-rgb',
          keyframes: [
            {
              beat: 0,
              easing: 'linear',
              id: '44444444-4444-4444-8444-444444444444',
              paletteTokenId: GREEN_ID,
            },
            {
              beat: 2,
              easing: 'linear',
              id: '55555555-5555-4555-8555-555555555555',
              paletteTokenId: PINK_ID,
            },
            {
              beat: 4,
              easing: 'linear',
              id: '66666666-6666-4666-8666-666666666666',
              paletteTokenId: GREEN_ID,
            },
          ],
        },
        colours,
        3,
      ),
    ).toBe('#A29586');
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
                  easing: 'linear',
                  id: '11111111-1111-4111-8111-111111111111',
                },
                {
                  beat: 2,
                  brightnessPercent: 100,
                  easing: 'linear',
                  id: '22222222-2222-4222-8222-222222222222',
                },
                {
                  beat: 3,
                  brightnessPercent: 0,
                  easing: 'linear',
                  id: '33333333-3333-4333-8333-333333333333',
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
    ).toMatchObject({ brightnessPercent: 100, colour: '#FF2B9A' });
    expect(
      evaluateSceneFrame(hybrid, palette, kmsFourString10LedProfile, 2.5)[0],
    ).toMatchObject({ brightnessPercent: 50, colour: '#FF2B9A' });
    expect(
      evaluateSceneFrame(hybrid, palette, kmsFourString10LedProfile, 3)[0],
    ).toMatchObject({ brightnessPercent: 50, colour: '#FF2B9A' });
  });
});
