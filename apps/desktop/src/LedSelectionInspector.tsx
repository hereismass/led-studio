import type { HardwareLed } from '@led-studio/hardware-profiles';
import type { PaletteToken, Scene } from '@led-studio/project-format';
import type { ExecuteEditorCommandOptions } from '@led-studio/editor-core';
import { useEffect, useState, type CSSProperties } from 'react';
import { PaletteSwatches } from './PaletteSwatches';
import { useRafGroupedInteraction } from './useRafGroupedInteraction';

interface LedSelectionInspectorProps {
  leds: HardwareLed[];
  palette: PaletteToken[];
  scene: Scene;
  onBrightnessChange: (
    value: number,
    options?: ExecuteEditorCommandOptions,
  ) => void;
  onPaint: (paletteTokenId: string) => void;
  onTurnOff: () => void;
}

export function LedSelectionInspector({
  leds,
  onBrightnessChange,
  onPaint,
  onTurnOff,
  palette,
  scene,
}: LedSelectionInspectorProps) {
  const states = leds.map((led) => scene.ledStates[led.id] ?? null);
  const assignedStates = states.flatMap((state) => (state ? [state] : []));
  const allAssigned = assignedStates.length === leds.length;
  const brightnesses = new Set(
    assignedStates.map((state) => state.brightnessPercent),
  );
  const mixedBrightness =
    assignedStates.length > 0 && (!allAssigned || brightnesses.size > 1);
  const brightness = mixedBrightness
    ? Math.round(
        assignedStates.reduce(
          (total, state) => total + state.brightnessPercent,
          0,
        ) / assignedStates.length,
      )
    : (assignedStates[0]?.brightnessPercent ?? 0);
  const paletteTokenIds = new Set(
    assignedStates.map((state) => state.paletteTokenId),
  );
  const mixedColour =
    assignedStates.length > 0 && (!allAssigned || paletteTokenIds.size > 1);
  const selectedTokenId =
    !mixedColour && assignedStates.length > 0
      ? assignedStates[0].paletteTokenId
      : null;
  const selectedToken = palette.find(({ id }) => id === selectedTokenId);
  const hasLitState = assignedStates.some(
    ({ brightnessPercent }) => brightnessPercent > 0,
  );
  const [draft, setDraft] = useState(brightness);
  const brightnessInteraction = useRafGroupedInteraction(
    (value: number, options) => onBrightnessChange(value, options),
  );
  const selectedLedKey = leds.map((led) => led.id).join('|');

  useEffect(
    () => setDraft(brightness),
    [brightness, mixedBrightness, selectedLedKey],
  );

  const brightnessStyle = {
    '--range-accent': selectedToken?.value ?? '#8F8798',
    '--range-fill': `${draft}%`,
  } as CSSProperties;

  return (
    <section className="inspector-section led-inspector">
      <div>
        <p className="workspace-eyebrow">LED selection</p>
        <h3>
          {leds.length} {leds.length === 1 ? 'LED' : 'LEDs'} selected
        </h3>
        <p className="selection-labels">
          {leds
            .slice(0, 4)
            .map((led) => led.label)
            .join(' · ')}
          {leds.length > 4 ? ` · +${leds.length - 4} more` : ''}
        </p>
      </div>
      <div className="inspector-field">
        <span>
          Palette colour ·{' '}
          {mixedColour
            ? 'Mixed'
            : (selectedToken?.name ??
              (assignedStates.length === 0 ? 'Off' : 'Unavailable'))}
        </span>
        <PaletteSwatches
          mixed={mixedColour}
          palette={palette}
          selectedTokenId={selectedTokenId}
          onSelect={onPaint}
        />
      </div>
      <label className="inspector-field">
        <span>
          Brightness{' '}
          {mixedBrightness
            ? '· Mixed'
            : assignedStates.length
              ? `· ${draft}%`
              : '· Off'}
        </span>
        <input
          className={`selection-brightness ${mixedBrightness ? 'selection-brightness-mixed' : ''}`}
          aria-label="Selection brightness"
          aria-valuetext={
            mixedBrightness ? `Mixed, average ${draft}%` : `${draft}%`
          }
          type="range"
          min="0"
          max="100"
          value={draft}
          disabled={assignedStates.length === 0}
          style={brightnessStyle}
          onBlur={brightnessInteraction.end}
          onChange={(event) => {
            const value = Number(event.target.value);
            setDraft(value);
            brightnessInteraction.update(value);
          }}
          onKeyDown={(event) => {
            if (
              [
                'ArrowDown',
                'ArrowLeft',
                'ArrowRight',
                'ArrowUp',
                'End',
                'Home',
                'PageDown',
                'PageUp',
              ].includes(event.key)
            )
              brightnessInteraction.begin();
          }}
          onKeyUp={(event) => {
            if (
              [
                'ArrowDown',
                'ArrowLeft',
                'ArrowRight',
                'ArrowUp',
                'End',
                'Home',
                'PageDown',
                'PageUp',
              ].includes(event.key)
            )
              brightnessInteraction.end();
          }}
          onPointerCancel={brightnessInteraction.end}
          onPointerDown={brightnessInteraction.begin}
          onPointerUp={brightnessInteraction.end}
        />
      </label>
      <button
        className="inspector-off-button"
        type="button"
        disabled={!hasLitState}
        onClick={onTurnOff}
      >
        Turn selected LEDs off
      </button>
    </section>
  );
}
