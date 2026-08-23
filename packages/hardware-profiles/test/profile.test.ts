import { describe, expect, it } from 'vitest';
import {
  HardwareProfileSchema,
  KMS_MARKER_FRETS,
  getHardwareProfile,
  kmsFourString31InlayProfile,
  listHardwareProfiles,
  validateProjectHardwareReferences,
} from '../src/index.js';

describe('KMS 31-inlay profile', () => {
  it('registers one valid profile with 31 contiguous addresses', () => {
    expect(listHardwareProfiles()).toEqual([kmsFourString31InlayProfile]);
    expect(getHardwareProfile(kmsFourString31InlayProfile.id)).toBe(
      kmsFourString31InlayProfile,
    );
    expect(kmsFourString31InlayProfile.leds).toHaveLength(31);
    expect(kmsFourString31InlayProfile.leds.map((led) => led.address)).toEqual(
      Array.from({ length: 31 }, (_, address) => address),
    );
  });

  it('interleaves primary and secondary addresses while walking frets', () => {
    expect(
      kmsFourString31InlayProfile.leds.map(({ address, id }) => [address, id]),
    ).toEqual(
      expect.arrayContaining([
        [0, 'fret-01-primary'],
        [2, 'fret-03-primary'],
        [3, 'fret-03-secondary'],
        [29, 'fret-21-secondary'],
        [30, 'fret-22-primary'],
      ]),
    );
  });

  it('uses physical nut-right fret spacing and complete selection groups', () => {
    const { fretBoundaries } = kmsFourString31InlayProfile.layout;
    expect(fretBoundaries[0]).toBeCloseTo(1);
    expect(fretBoundaries.at(-1)).toBeCloseTo(0);
    expect(fretBoundaries[0] - fretBoundaries[1]).toBeGreaterThan(
      fretBoundaries[21] - fretBoundaries[22],
    );

    expect(
      kmsFourString31InlayProfile.groups.map((group) => [
        group.id,
        group.ledIds.length,
      ]),
    ).toEqual([
      ['all-inlays', 31],
      ['primary-inlays', 22],
      ['secondary-markers', KMS_MARKER_FRETS.length],
      ['all-marker-frets', KMS_MARKER_FRETS.length * 2],
    ]);
  });

  it('rejects duplicate or incomplete address maps', () => {
    const invalid = structuredClone(kmsFourString31InlayProfile);
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
        hardwareProfile: kmsFourString31InlayProfile.id,
        scenes: [{ ledStates: { 'missing-led': {} }, name: 'Bad scene' }],
      }),
    ).toThrow(/missing-led/);
  });
});
