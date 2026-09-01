import type { HardwareProfile } from '@led-studio/hardware-profiles';
import type { LedFrame } from '@led-studio/playback';
import type { Scene } from '@led-studio/project-format';
import { memo, useState, type KeyboardEvent, type PointerEvent } from 'react';

const VIEWBOX_WIDTH = 1000;
const VIEWBOX_HEIGHT = 280;
const BOARD_LEFT = 40;
const BOARD_WIDTH = 920;
const BOARD_TOP = 44;
const BOARD_HEIGHT = 176;

function displayBrightness(value: number): string {
  return String(Math.round(value * 10) / 10);
}

interface Point {
  x: number;
  y: number;
}

interface Marquee {
  additive: boolean;
  current: Point;
  start: Point;
}

interface FretboardEditorProps {
  frame: LedFrame;
  profile: HardwareProfile;
  scene: Scene | null;
  selectedLedIds: string[];
  onSelectionChange: (ledIds: string[]) => void;
}

function viewPoint(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): Point {
  const bounds = svg.getBoundingClientRect();
  return {
    x: ((clientX - bounds.left) / bounds.width) * VIEWBOX_WIDTH,
    y: ((clientY - bounds.top) / bounds.height) * VIEWBOX_HEIGHT,
  };
}

function ledPoint(position: { x: number; y: number }): Point {
  return {
    x: BOARD_LEFT + position.x * BOARD_WIDTH,
    y: BOARD_TOP + position.y * BOARD_HEIGHT,
  };
}

const FretboardGeometry = memo(function FretboardGeometry({
  profile,
}: {
  profile: HardwareProfile;
}) {
  return (
    <>
      <defs>
        <linearGradient id="neck-fill" x1="0" x2="1">
          <stop offset="0" stopColor="#211b22" />
          <stop offset="1" stopColor="#34262c" />
        </linearGradient>
        <filter id="led-glow" x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect
        className="fretboard-neck"
        x={BOARD_LEFT}
        y={BOARD_TOP}
        width={BOARD_WIDTH}
        height={BOARD_HEIGHT}
        rx="7"
      />
      {profile.layout.fretBoundaries.map((boundary, index) => {
        const x = BOARD_LEFT + boundary * BOARD_WIDTH;
        return (
          <line
            className={
              index === 0
                ? 'fretboard-body-edge'
                : index === profile.layout.fretCount
                  ? 'fretboard-nut'
                  : 'fretboard-fret'
            }
            key={`boundary-${index}`}
            x1={x}
            x2={x}
            y1={BOARD_TOP}
            y2={BOARD_TOP + BOARD_HEIGHT}
          />
        );
      })}
      {Array.from({ length: profile.layout.stringCount }, (_, index) => {
        const y =
          BOARD_TOP +
          ((index + 1) / (profile.layout.stringCount + 1)) * BOARD_HEIGHT;
        return (
          <line
            className="fretboard-string"
            key={`string-${index}`}
            x1={BOARD_LEFT}
            x2={BOARD_LEFT + BOARD_WIDTH}
            y1={y}
            y2={y}
          />
        );
      })}
      {Array.from({ length: profile.layout.fretCount }, (_, fretIndex) => {
        const x =
          BOARD_LEFT +
          ((profile.layout.fretBoundaries[fretIndex] +
            profile.layout.fretBoundaries[fretIndex + 1]) /
            2) *
            BOARD_WIDTH;
        return (
          <text
            className="fretboard-label"
            key={`label-${fretIndex}`}
            x={x}
            y={248}
          >
            {fretIndex + 1}
          </text>
        );
      })}
    </>
  );
});

export function FretboardEditor({
  frame,
  onSelectionChange,
  profile,
  scene,
  selectedLedIds,
}: FretboardEditorProps) {
  const [marquee, setMarquee] = useState<Marquee | null>(null);
  const selected = new Set(selectedLedIds);
  const output = new Map(frame.map((led) => [led.ledId, led]));
  const interactive = scene !== null;

  function selectLed(id: string, additive: boolean) {
    if (!interactive) return;
    if (!additive) {
      onSelectionChange([id]);
      return;
    }
    const next = new Set(selectedLedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange([...next]);
  }

  function startMarquee(event: PointerEvent<SVGRectElement>) {
    if (!interactive) return;
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const start = viewPoint(svg, event.clientX, event.clientY);
    setMarquee({
      additive: event.shiftKey || event.metaKey || event.ctrlKey,
      current: start,
      start,
    });
  }

  function moveMarquee(event: PointerEvent<SVGRectElement>) {
    if (!marquee) return;
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;
    setMarquee({
      ...marquee,
      current: viewPoint(svg, event.clientX, event.clientY),
    });
  }

  function finishMarquee() {
    if (!marquee) return;
    const left = Math.min(marquee.start.x, marquee.current.x);
    const right = Math.max(marquee.start.x, marquee.current.x);
    const top = Math.min(marquee.start.y, marquee.current.y);
    const bottom = Math.max(marquee.start.y, marquee.current.y);
    const dragged = right - left > 3 || bottom - top > 3;
    const matches = dragged
      ? profile.leds
          .filter((led) => {
            const point = ledPoint(led.position);
            return (
              point.x >= left &&
              point.x <= right &&
              point.y >= top &&
              point.y <= bottom
            );
          })
          .map((led) => led.id)
      : [];
    onSelectionChange(
      marquee.additive
        ? [...new Set([...selectedLedIds, ...matches])]
        : matches,
    );
    setMarquee(null);
  }

  function handleLedKey(event: KeyboardEvent<SVGGElement>, id: string) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    selectLed(id, event.shiftKey || event.metaKey || event.ctrlKey);
  }

  const marqueeRect = marquee
    ? {
        height: Math.abs(marquee.current.y - marquee.start.y),
        width: Math.abs(marquee.current.x - marquee.start.x),
        x: Math.min(marquee.current.x, marquee.start.x),
        y: Math.min(marquee.current.y, marquee.start.y),
      }
    : null;

  return (
    <div className="fretboard-editor">
      <svg
        aria-label={`${profile.name} fretboard`}
        className="fretboard-svg"
        role="group"
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      >
        <FretboardGeometry profile={profile} />
        <rect
          className="fretboard-selection-surface"
          x="0"
          y="0"
          width={VIEWBOX_WIDTH}
          height={VIEWBOX_HEIGHT}
          onPointerDown={startMarquee}
          onPointerMove={moveMarquee}
          onPointerUp={finishMarquee}
          onPointerCancel={() => setMarquee(null)}
        />
        {profile.leds.map((led, logicalIndex) => {
          const point = ledPoint(led.position);
          const state = output.get(led.id);
          const lit = Boolean(
            state && state.colour && state.brightnessPercent > 0,
          );
          const colour = state?.colour ?? '#5D5663';
          const label = lit
            ? `LED ${logicalIndex + 1}, ${led.label}, physical address ${led.address}, ${colour} at ${displayBrightness(state!.brightnessPercent)}%`
            : `LED ${logicalIndex + 1}, ${led.label}, physical address ${led.address}, off`;
          return (
            <g
              aria-label={label}
              aria-pressed={selected.has(led.id)}
              className={`fretboard-led ${selected.has(led.id) ? 'fretboard-led-selected' : ''}`}
              key={led.id}
              role={interactive ? 'button' : 'img'}
              tabIndex={interactive ? 0 : -1}
              onClick={(event) => {
                event.stopPropagation();
                selectLed(
                  led.id,
                  event.shiftKey || event.metaKey || event.ctrlKey,
                );
              }}
              onKeyDown={(event) => handleLedKey(event, led.id)}
            >
              <title>{label}</title>
              {lit ? (
                <circle
                  className="fretboard-led-glow"
                  cx={point.x}
                  cy={point.y}
                  r="10"
                  fill={colour}
                  opacity={0.15 + state!.brightnessPercent / 125}
                />
              ) : null}
              <circle
                className="fretboard-led-hit"
                cx={point.x}
                cy={point.y}
                r="15"
              />
              <circle
                className="fretboard-led-dot"
                cx={point.x}
                cy={point.y}
                r="7"
                fill={colour}
                fillOpacity={lit ? 0.28 + state!.brightnessPercent / 139 : 0.16}
              />
            </g>
          );
        })}
        {marqueeRect ? (
          <rect className="fretboard-marquee" {...marqueeRect} />
        ) : null}
      </svg>
      {!scene ? (
        <p className="fretboard-empty-hint">
          Create or select a scene to edit its LEDs.
        </p>
      ) : null}
    </div>
  );
}
