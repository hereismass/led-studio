import type { HardwareLed } from '@led-studio/hardware-profiles';
import type { PaletteToken, Scene } from '@led-studio/project-format';
import type { ExecuteEditorCommandOptions } from '@led-studio/editor-core';
import { useEffect, useState } from 'react';
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
  const litStates = leds.flatMap((led) =>
    scene.ledStates[led.id] ? [scene.ledStates[led.id]] : [],
  );
  const brightnesses = new Set(
    litStates.map((state) => state.brightnessPercent),
  );
  const brightness =
    brightnesses.size === 1 ? (litStates[0]?.brightnessPercent ?? 100) : 100;
  const [draft, setDraft] = useState(brightness);
  const brightnessInteraction = useRafGroupedInteraction(
    (value: number, options) => onBrightnessChange(value, options),
  );

  useEffect(
    () => setDraft(brightness),
    [brightness, leds.map((led) => led.id).join('|')],
  );

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
        <span>Apply palette colour</span>
        <div className="inspector-swatches">
          {palette.map((token) => (
            <button
              key={token.id}
              type="button"
              aria-label={`Apply ${token.name}`}
              title={`${token.name} · ${token.value}`}
              style={{ backgroundColor: token.value }}
              onClick={() => onPaint(token.id)}
            />
          ))}
        </div>
      </div>
      <label className="inspector-field">
        <span>
          Brightness{' '}
          {brightnesses.size > 1
            ? '· Mixed'
            : litStates.length
              ? `· ${draft}%`
              : '· Off'}
        </span>
        <input
          aria-label="Selection brightness"
          type="range"
          min="0"
          max="100"
          value={draft}
          disabled={litStates.length === 0}
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
        onClick={onTurnOff}
      >
        Turn selected LEDs off
      </button>
    </section>
  );
}
