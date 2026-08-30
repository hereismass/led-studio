import { keyframesInActiveWindow } from '@led-studio/playback';
import type {
  BrightnessKeyframe,
  ColourKeyframeTrack,
} from '@led-studio/project-format';

export interface BrightnessAutomationPoint {
  beat: number;
  brightnessPercent: number;
  xPercent: number;
  yPercent: number;
}

export interface ColourAutomationStop {
  colour: string;
  offsetPercent: number;
}

function asPercent(value: number, total: number): number {
  return (value / total) * 100;
}

export function buildBrightnessAutomationPoints(
  keyframes: readonly BrightnessKeyframe[],
  startBeat: number,
  endBeat: number,
  loopLengthBeats: number,
): BrightnessAutomationPoint[] {
  const active = keyframesInActiveWindow(keyframes, startBeat, endBeat);
  if (active.length === 0) return [];

  const candidates = [
    { beat: startBeat, brightnessPercent: active[0].brightnessPercent },
    ...active,
    {
      beat: endBeat,
      brightnessPercent: active[active.length - 1].brightnessPercent,
    },
  ];

  return candidates
    .filter(
      (point, index) =>
        index === 0 ||
        point.beat !== candidates[index - 1].beat ||
        point.brightnessPercent !== candidates[index - 1].brightnessPercent,
    )
    .map(({ beat, brightnessPercent }) => ({
      beat,
      brightnessPercent,
      xPercent: asPercent(beat, loopLengthBeats),
      yPercent: 100 - brightnessPercent,
    }));
}

export function buildColourAutomationStops(
  track: ColourKeyframeTrack,
  colours: ReadonlyMap<string, string>,
  startBeat: number,
  endBeat: number,
): ColourAutomationStop[] {
  const active = keyframesInActiveWindow(track.keyframes, startBeat, endBeat);
  if (active.length === 0) return [];
  const duration = endBeat - startBeat;
  const colourFor = (paletteTokenId: string) => {
    const colour = colours.get(paletteTokenId);
    if (!colour)
      throw new Error(
        `Colour keyframe references unknown palette token "${paletteTokenId}"`,
      );
    return colour;
  };
  const offsetFor = (beat: number) => asPercent(beat - startBeat, duration);
  const stops: ColourAutomationStop[] = [
    { colour: colourFor(active[0].paletteTokenId), offsetPercent: 0 },
  ];

  active.forEach((keyframe, index) => {
    const colour = colourFor(keyframe.paletteTokenId);
    const offsetPercent = offsetFor(keyframe.beat);
    if (track.interpolation === 'step' && index > 0) {
      stops.push({
        colour: colourFor(active[index - 1].paletteTokenId),
        offsetPercent,
      });
    }
    const previous = stops[stops.length - 1];
    if (previous.colour !== colour || previous.offsetPercent !== offsetPercent)
      stops.push({ colour, offsetPercent });
  });

  const finalColour = colourFor(active[active.length - 1].paletteTokenId);
  const previous = stops[stops.length - 1];
  if (previous.colour !== finalColour || previous.offsetPercent !== 100)
    stops.push({ colour: finalColour, offsetPercent: 100 });
  return stops;
}
