import type {
  BrightnessKeyframe,
  ColourKeyframeTrack,
  PaletteToken,
} from '@led-studio/project-format';
import { memo, useId } from 'react';
import {
  buildBrightnessAutomationPoints,
  buildColourAutomationStops,
} from './keyframeTimelineVisuals';

export const BrightnessAutomation = memo(function BrightnessAutomation({
  endBeat,
  keyframes,
  loopLengthBeats,
  startBeat,
}: {
  endBeat: number;
  keyframes: readonly BrightnessKeyframe[];
  loopLengthBeats: number;
  startBeat: number;
}) {
  const points = buildBrightnessAutomationPoints(
    keyframes,
    startBeat,
    endBeat,
    loopLengthBeats,
  );
  if (points.length === 0) return null;
  const linePoints = points
    .map(({ xPercent, yPercent }) => `${xPercent},${yPercent}`)
    .join(' ');
  const areaPath = `M ${points[0].xPercent} 100 L ${linePoints.replaceAll(' ', ' L ')} L ${points[points.length - 1].xPercent} 100 Z`;
  return (
    <svg
      aria-hidden="true"
      className="scene-keyframe-automation scene-brightness-automation"
      data-testid="brightness-automation"
      preserveAspectRatio="none"
      viewBox="0 0 100 100"
    >
      <path className="scene-brightness-automation-fill" d={areaPath} />
      <polyline
        className="scene-brightness-automation-line"
        points={linePoints}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
});

export const ColourAutomation = memo(function ColourAutomation({
  endBeat,
  loopLengthBeats,
  palette,
  startBeat,
  track,
}: {
  endBeat: number;
  loopLengthBeats: number;
  palette: readonly PaletteToken[];
  startBeat: number;
  track: ColourKeyframeTrack;
}) {
  const gradientId = `colour-automation-${useId().replace(/:/g, '')}`;
  const colours = new Map(palette.map(({ id, value }) => [id, value]));
  const stops = buildColourAutomationStops(track, colours, startBeat, endBeat);
  if (stops.length === 0) return null;
  return (
    <svg
      aria-hidden="true"
      className="scene-keyframe-automation scene-colour-automation"
      data-testid="colour-automation"
      preserveAspectRatio="none"
      viewBox="0 0 100 100"
    >
      <defs>
        <linearGradient colorInterpolation="sRGB" id={gradientId} x1="0" x2="1">
          {stops.map(({ colour, offsetPercent }, index) => (
            <stop
              key={`${offsetPercent}-${colour}-${index}`}
              offset={`${offsetPercent}%`}
              stopColor={colour}
            />
          ))}
        </linearGradient>
      </defs>
      <rect
        className="scene-colour-automation-strip"
        fill={`url(#${gradientId})`}
        height="100"
        width={`${((endBeat - startBeat) / loopLengthBeats) * 100}`}
        x={`${(startBeat / loopLengthBeats) * 100}`}
        y="0"
      />
    </svg>
  );
});
