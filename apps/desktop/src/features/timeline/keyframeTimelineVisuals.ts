import {
  evaluateBrightnessTrack,
  evaluateColourTrack,
  keyframesInActiveWindow,
} from '@led-studio/playback';
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

const AUTOMATION_SAMPLES_PER_SEGMENT = 12;

function sampledBeats<T extends { beat: number }>(
  keyframes: readonly T[],
  startBeat: number,
  endBeat: number,
): number[] {
  const beats = [startBeat, keyframes[0].beat];
  for (let index = 0; index < keyframes.length - 1; index += 1) {
    const left = keyframes[index].beat;
    const right = keyframes[index + 1].beat;
    for (let sample = 1; sample <= AUTOMATION_SAMPLES_PER_SEGMENT; sample += 1)
      beats.push(
        left + ((right - left) * sample) / AUTOMATION_SAMPLES_PER_SEGMENT,
      );
  }
  beats.push(endBeat);
  return beats.filter(
    (beat, index) => index === 0 || beat !== beats[index - 1],
  );
}

export function buildBrightnessAutomationPoints(
  keyframes: readonly BrightnessKeyframe[],
  startBeat: number,
  endBeat: number,
  loopLengthBeats: number,
): BrightnessAutomationPoint[] {
  const active = keyframesInActiveWindow(keyframes, startBeat, endBeat);
  if (active.length === 0) return [];

  const candidates = sampledBeats(active, startBeat, endBeat).map((beat) => ({
    beat,
    brightnessPercent: evaluateBrightnessTrack(active, beat)!,
  }));

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
  if (track.interpolation === 'linear-rgb')
    return sampledBeats(active, startBeat, endBeat).map((beat) => ({
      colour: evaluateColourTrack(
        { interpolation: track.interpolation, keyframes: active },
        colours,
        beat,
      )!,
      offsetPercent: offsetFor(beat),
    }));
  const stops: ColourAutomationStop[] = [
    { colour: colourFor(active[0].paletteTokenId), offsetPercent: 0 },
  ];

  active.forEach((keyframe, index) => {
    const colour = colourFor(keyframe.paletteTokenId);
    const offsetPercent = offsetFor(keyframe.beat);
    if (index > 0) {
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
