import { kmsFourString10LedProfile } from '@led-studio/hardware-profiles';
import type { PaletteToken, Scene } from '@led-studio/project-format';
import { describe, expect, it } from 'vitest';
import {
  advanceLoopPosition,
  evaluateSceneFrame,
  normalizeLoopPosition,
} from '../src/index.js';

const WHITE_ID = '8b2c3d4e-5f60-4a71-8b92-c3d4e5f60718';
const palette: PaletteToken[] = [
  { id: WHITE_ID, name: 'White', value: '#FFFFFF' },
];
const scene: Scene = {
  id: '6c21dc04-9a75-4f10-a7bb-9f17dc2fe32a',
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
    expect(
      evaluateSceneFrame(scene, palette, kmsFourString10LedProfile, 0),
    ).toEqual(
      evaluateSceneFrame(scene, palette, kmsFourString10LedProfile, 3.99),
    );
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
});
