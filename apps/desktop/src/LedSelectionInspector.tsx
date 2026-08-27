import type { HardwareLed } from '@led-studio/hardware-profiles';
import type { PaletteToken, Scene } from '@led-studio/project-format';
import { useEffect, useState } from 'react';

interface LedSelectionInspectorProps {
  leds: HardwareLed[];
  palette: PaletteToken[];
  scene: Scene;
  onBrightnessChange: (value: number) => void;
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
          onChange={(event) => setDraft(Number(event.target.value))}
          onPointerUp={() => onBrightnessChange(draft)}
          onKeyUp={() => onBrightnessChange(draft)}
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
