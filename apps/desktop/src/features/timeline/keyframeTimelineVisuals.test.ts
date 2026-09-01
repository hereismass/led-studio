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
    const points = buildBrightnessAutomationPoints(
      [
        {
          beat: 0,
          brightnessPercent: 80,
          easing: 'linear',
          id: '11111111-1111-4111-8111-111111111111',
        },
        {
          beat: 2,
          brightnessPercent: 20,
          easing: 'ease-in',
          id: '22222222-2222-4222-8222-222222222222',
        },
        {
          beat: 3,
          brightnessPercent: 100,
          easing: 'linear',
          id: '33333333-3333-4333-8333-333333333333',
        },
      ],
      1,
      4,
      4,
    );
    expect(points[0]).toEqual({
      beat: 1,
      brightnessPercent: 20,
      xPercent: 25,
      yPercent: 80,
    });
    expect(points.find(({ beat }) => beat === 2.5)).toEqual({
      beat: 2.5,
      brightnessPercent: 40,
      xPercent: 62.5,
      yPercent: 60,
    });
    expect(points.at(-1)).toEqual({
      beat: 4,
      brightnessPercent: 100,
      xPercent: 100,
      yPercent: 0,
    });
  });

  it('returns no brightness visual without an active key', () => {
    expect(
      buildBrightnessAutomationPoints(
        [
          {
            beat: 0,
            brightnessPercent: 50,
            easing: 'linear',
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
    const stops = buildColourAutomationStops(
      {
        interpolation: 'linear-rgb',
        keyframes: [
          {
            beat: 1,
            easing: 'ease-in',
            id: '11111111-1111-4111-8111-111111111111',
            paletteTokenId: GREEN_ID,
          },
          {
            beat: 2,
            easing: 'linear',
            id: '22222222-2222-4222-8222-222222222222',
            paletteTokenId: PINK_ID,
          },
          {
            beat: 4,
            easing: 'linear',
            id: '33333333-3333-4333-8333-333333333333',
            paletteTokenId: GREEN_ID,
          },
        ],
      },
      colours,
      0,
      4,
    );
    expect(stops[0]).toEqual({ colour: '#45FF72', offsetPercent: 0 });
    expect(stops.find(({ offsetPercent }) => offsetPercent === 37.5)).toEqual({
      colour: '#74CA7C',
      offsetPercent: 37.5,
    });
    expect(stops.at(-1)).toEqual({
      colour: '#45FF72',
      offsetPercent: 100,
    });
  });

  it('duplicates intermediate stops for stepped colours', () => {
    expect(
      buildColourAutomationStops(
        {
          interpolation: 'step',
          keyframes: [
            {
              beat: 0,
              easing: 'linear',
              id: '11111111-1111-4111-8111-111111111111',
              paletteTokenId: GREEN_ID,
            },
            {
              beat: 2,
              easing: 'linear',
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
              easing: 'linear',
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
