import type { Effect } from '@led-studio/project-format';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { NumberDraft } from './NumberDraft';

interface EffectParameterFieldsProps {
  disabled: boolean;
  effect: Effect;
  onChange: (effect: Effect) => void;
}

export function EffectParameterFields({
  disabled,
  effect,
  onChange,
}: EffectParameterFieldsProps) {
  if (effect.type === 'pulse' || effect.type === 'wave') {
    return (
      <>
        <div className="inspector-field-grid">
          <NumberDraft
            disabled={disabled}
            label="Minimum brightness"
            min={0}
            max={100}
            step={1}
            value={effect.minBrightnessPercent}
            onCommit={(minBrightnessPercent) =>
              onChange({ ...effect, minBrightnessPercent })
            }
          />
          <NumberDraft
            disabled={disabled}
            label="Maximum brightness"
            min={0}
            max={100}
            step={1}
            value={effect.maxBrightnessPercent}
            onCommit={(maxBrightnessPercent) =>
              onChange({ ...effect, maxBrightnessPercent })
            }
          />
          <NumberDraft
            disabled={disabled}
            label="Cycle length (beats)"
            min={0.25}
            step={0.25}
            value={effect.cycleLengthBeats}
            onCommit={(cycleLengthBeats) =>
              onChange({ ...effect, cycleLengthBeats })
            }
          />
          <NumberDraft
            disabled={disabled}
            label="Phase offset (beats)"
            min={0}
            step={0.25}
            value={effect.phaseOffsetBeats}
            onCommit={(phaseOffsetBeats) =>
              onChange({ ...effect, phaseOffsetBeats })
            }
          />
          {effect.type === 'wave' ? (
            <NumberDraft
              disabled={disabled}
              label="Wavelength (LEDs)"
              min={1}
              step={1}
              value={effect.wavelengthLeds}
              onCommit={(wavelengthLeds) =>
                onChange({ ...effect, wavelengthLeds })
              }
            />
          ) : null}
        </div>
        <div className="inspector-field">
          <span>Waveform</span>
          <SegmentedControl
            ariaLabel="Waveform"
            disabled={disabled}
            options={[
              { label: 'Sine', value: 'sine' },
              { label: 'Triangle', value: 'triangle' },
              { label: 'Square', value: 'square' },
            ]}
            value={effect.waveform}
            onChange={(waveform) => onChange({ ...effect, waveform })}
          />
        </div>
        {effect.type === 'wave' ? (
          <div className="inspector-field">
            <span>Direction</span>
            <SegmentedControl
              ariaLabel="Direction"
              disabled={disabled}
              options={[
                { label: 'Forward', value: 'forward' },
                { label: 'Reverse', value: 'reverse' },
              ]}
              value={effect.direction}
              onChange={(direction) => onChange({ ...effect, direction })}
            />
          </div>
        ) : null}
      </>
    );
  }

  if (effect.type === 'chase') {
    return (
      <>
        <div className="inspector-field-grid">
          <NumberDraft
            disabled={disabled}
            label="Brightness"
            min={0}
            max={100}
            step={1}
            value={effect.brightnessPercent}
            onCommit={(brightnessPercent) =>
              onChange({ ...effect, brightnessPercent })
            }
          />
          <NumberDraft
            disabled={disabled}
            label="Step length (beats)"
            min={0.25}
            step={0.25}
            value={effect.stepLengthBeats}
            onCommit={(stepLengthBeats) =>
              onChange({ ...effect, stepLengthBeats })
            }
          />
          <NumberDraft
            disabled={disabled}
            label="Head width"
            min={1}
            step={1}
            value={effect.width}
            onCommit={(width) => onChange({ ...effect, width })}
          />
          <NumberDraft
            disabled={disabled}
            label="Trail length"
            min={0}
            step={1}
            value={effect.trailLength}
            onCommit={(trailLength) => onChange({ ...effect, trailLength })}
          />
        </div>
        <div className="inspector-field">
          <span>Direction</span>
          <SegmentedControl
            ariaLabel="Direction"
            disabled={disabled}
            options={[
              { label: 'Forward', value: 'forward' },
              { label: 'Reverse', value: 'reverse' },
            ]}
            value={effect.direction}
            onChange={(direction) => onChange({ ...effect, direction })}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="inspector-field-grid">
        <NumberDraft
          disabled={disabled}
          label="Brightness"
          min={0}
          max={100}
          step={1}
          value={effect.brightnessPercent}
          onCommit={(brightnessPercent) =>
            onChange({ ...effect, brightnessPercent })
          }
        />
        <NumberDraft
          disabled={disabled}
          label="Density (%)"
          min={0}
          max={100}
          step={1}
          value={effect.densityPercent}
          onCommit={(densityPercent) => onChange({ ...effect, densityPercent })}
        />
        <NumberDraft
          disabled={disabled}
          label="Step length (beats)"
          min={0.25}
          step={0.25}
          value={effect.stepLengthBeats}
          onCommit={(stepLengthBeats) =>
            onChange({ ...effect, stepLengthBeats })
          }
        />
      </div>
      <div className="inspector-field">
        <span>Decay</span>
        <SegmentedControl
          ariaLabel="Sparkle decay"
          disabled={disabled}
          options={[
            { label: 'Hold', value: 'hold' },
            { label: 'Fade', value: 'fade' },
          ]}
          value={effect.decay}
          onChange={(decay) => onChange({ ...effect, decay })}
        />
      </div>
      <div className="inspector-actions sparkle-actions">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            const values = new Uint32Array(1);
            crypto.getRandomValues(values);
            const seed =
              values[0] === effect.seed ? (values[0] + 1) >>> 0 : values[0];
            onChange({ ...effect, seed });
          }}
        >
          Reseed pattern
        </button>
      </div>
      <p className="inspector-help">
        The hidden seed keeps playback repeatable. Reseeding creates a new
        undoable pattern.
      </p>
    </>
  );
}
