import { describe, expect, it } from 'vitest';
import {
  buildBrightnessAutomationPoints,
  buildColourAutomationStops,
} from './keyframeTimelineVisuals';

const PINK_ID = '1a2b3c4d-5e6f-4789-8abc-def012345678';
const GREEN_ID = 'f0e1d2c3-b4a5-4678-9abc-def012345678';
const colours = new Map([
  [PINK_ID, '#FF2B9A'],
  [GREEN_ID, '#45FF72'],
]);

describe('keyframe timeline visuals', () => {
  it('builds a brightness line with held values at both active boundaries', () => {
    expect(
      buildBrightnessAutomationPoints(
        [
          {
            beat: 0,
            brightnessPercent: 80,
            id: '11111111-1111-4111-8111-111111111111',
          },
          {
            beat: 2,
            brightnessPercent: 20,
            id: '22222222-2222-4222-8222-222222222222',
          },
          {
            beat: 3,
            brightnessPercent: 100,
            id: '33333333-3333-4333-8333-333333333333',
          },
        ],
        1,
        4,
        4,
      ),
    ).toEqual([
      { beat: 1, brightnessPercent: 20, xPercent: 25, yPercent: 80 },
      { beat: 2, brightnessPercent: 20, xPercent: 50, yPercent: 80 },
      { beat: 3, brightnessPercent: 100, xPercent: 75, yPercent: 0 },
      { beat: 4, brightnessPercent: 100, xPercent: 100, yPercent: 0 },
    ]);
  });

  it('returns no brightness visual without an active key', () => {
    expect(
      buildBrightnessAutomationPoints(
        [
          {
            beat: 0,
            brightnessPercent: 50,
            id: '11111111-1111-4111-8111-111111111111',
          },
        ],
        1,
        4,
        4,
      ),
    ).toEqual([]);
  });

  it('builds smooth colour stops and holds the endpoint colours', () => {
    expect(
      buildColourAutomationStops(
        {
          interpolation: 'linear-rgb',
          keyframes: [
            {
              beat: 1,
              id: '11111111-1111-4111-8111-111111111111',
              paletteTokenId: GREEN_ID,
            },
            {
              beat: 2,
              id: '22222222-2222-4222-8222-222222222222',
              paletteTokenId: PINK_ID,
            },
            {
              beat: 4,
              id: '33333333-3333-4333-8333-333333333333',
              paletteTokenId: GREEN_ID,
            },
          ],
        },
        colours,
        0,
        4,
      ),
    ).toEqual([
      { colour: '#45FF72', offsetPercent: 0 },
      { colour: '#45FF72', offsetPercent: 25 },
      { colour: '#FF2B9A', offsetPercent: 50 },
      { colour: '#45FF72', offsetPercent: 100 },
    ]);
  });

  it('duplicates intermediate stops for stepped colours', () => {
    expect(
      buildColourAutomationStops(
        {
          interpolation: 'step',
          keyframes: [
            {
              beat: 0,
              id: '11111111-1111-4111-8111-111111111111',
              paletteTokenId: GREEN_ID,
            },
            {
              beat: 2,
              id: '22222222-2222-4222-8222-222222222222',
              paletteTokenId: PINK_ID,
            },
          ],
        },
        colours,
        0,
        4,
      ),
    ).toEqual([
      { colour: '#45FF72', offsetPercent: 0 },
      { colour: '#45FF72', offsetPercent: 50 },
      { colour: '#FF2B9A', offsetPercent: 50 },
      { colour: '#FF2B9A', offsetPercent: 100 },
    ]);
  });

  it('renders one active colour as a solid strip', () => {
    expect(
      buildColourAutomationStops(
        {
          interpolation: 'linear-rgb',
          keyframes: [
            {
              beat: 2,
              id: '11111111-1111-4111-8111-111111111111',
              paletteTokenId: PINK_ID,
            },
          ],
        },
        colours,
        1,
        3,
      ),
    ).toEqual([
      { colour: '#FF2B9A', offsetPercent: 0 },
      { colour: '#FF2B9A', offsetPercent: 50 },
      { colour: '#FF2B9A', offsetPercent: 100 },
    ]);
  });
});
