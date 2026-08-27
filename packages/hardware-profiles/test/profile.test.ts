import { describe, expect, it } from 'vitest';
import {
  HardwareProfileSchema,
  KMS_E_SIDE_FRETS,
  KMS_G_SIDE_FRETS,
  getHardwareProfile,
  kmsFourString10LedProfile,
  listHardwareProfiles,
  validateProjectHardwareReferences,
} from '../src/index.js';

describe('KMS 10-LED profile', () => {
  it('registers one valid profile with 10 contiguous addresses', () => {
    expect(listHardwareProfiles()).toEqual([kmsFourString10LedProfile]);
    expect(getHardwareProfile(kmsFourString10LedProfile.id)).toBe(
      kmsFourString10LedProfile,
    );
    expect(kmsFourString10LedProfile.leds).toHaveLength(10);
    expect(kmsFourString10LedProfile.leds.map((led) => led.address)).toEqual(
      Array.from({ length: 10 }, (_, address) => address),
    );
  });

  it('follows the physical chain from the body to the neck', () => {
    expect(
      kmsFourString10LedProfile.leds.map(({ address, id }) => [address, id]),
    ).toEqual([
      [0, 'fret-21-g-side'],
      [1, 'fret-19-g-side'],
      [2, 'fret-17-g-side'],
      [3, 'fret-15-g-side'],
      [4, 'fret-12-g-side'],
      [5, 'fret-12-e-side'],
      [6, 'fret-09-e-side'],
      [7, 'fret-07-e-side'],
      [8, 'fret-05-e-side'],
      [9, 'fret-03-e-side'],
    ]);
  });

  it('uses physical nut-right spacing and places LEDs outside the E and G strings', () => {
    const { fretBoundaries } = kmsFourString10LedProfile.layout;
    expect(fretBoundaries[0]).toBeCloseTo(1);
    expect(fretBoundaries.at(-1)).toBeCloseTo(0);
    expect(fretBoundaries[0] - fretBoundaries[1]).toBeGreaterThan(
      fretBoundaries[21] - fretBoundaries[22],
    );

    const eSideLeds = kmsFourString10LedProfile.leds.filter(
      (led) => led.lane === 'e-side',
    );
    const gSideLeds = kmsFourString10LedProfile.leds.filter(
      (led) => led.lane === 'g-side',
    );
    expect(eSideLeds.map((led) => led.fret).sort((a, b) => a! - b!)).toEqual([
      ...KMS_E_SIDE_FRETS,
    ]);
    expect(gSideLeds.map((led) => led.fret).sort((a, b) => a! - b!)).toEqual([
      ...KMS_G_SIDE_FRETS,
    ]);
    expect(eSideLeds.every((led) => led.position.y === 0.1)).toBe(true);
    expect(gSideLeds.every((led) => led.position.y === 0.9)).toBe(true);
    expect(
      kmsFourString10LedProfile.leds.filter((led) => led.fret === 12),
    ).toHaveLength(2);
  });

  it('provides complete all, E-side, and G-side selection groups', () => {
    expect(
      kmsFourString10LedProfile.groups.map((group) => [
        group.id,
        group.ledIds.length,
      ]),
    ).toEqual([
      ['all-leds', 10],
      ['e-side-leds', KMS_E_SIDE_FRETS.length],
      ['g-side-leds', KMS_G_SIDE_FRETS.length],
    ]);
  });

  it('rejects duplicate or incomplete address maps', () => {
    const invalid = structuredClone(kmsFourString10LedProfile);
    invalid.leds[1].address = 0;
    expect(HardwareProfileSchema.safeParse(invalid).success).toBe(false);
  });
});

describe('project hardware compatibility', () => {
  it('rejects unknown profile and LED references', () => {
    expect(() =>
      validateProjectHardwareReferences({
        hardwareProfile: 'missing',
        scenes: [],
      }),
    ).toThrow(/not available/);

    expect(() =>
      validateProjectHardwareReferences({
        hardwareProfile: kmsFourString10LedProfile.id,
        scenes: [{ ledStates: { 'missing-led': {} }, name: 'Bad scene' }],
      }),
    ).toThrow(/missing-led/);
  });
});
