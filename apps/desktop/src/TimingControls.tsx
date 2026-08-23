import type { ProjectTiming } from '@led-studio/project-format';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

const DENOMINATORS = [1, 2, 4, 8, 16] as const;

interface TimingControlsProps {
  onCommit: (changes: Partial<ProjectTiming>) => void;
  timing: ProjectTiming;
}

function parseIntegerDraft(
  draft: string,
  minimum: number,
  maximum: number,
): number | null {
  const normalized = draft.trim();
  if (!/^\d+$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum
    ? value
    : null;
}

export function TimingControls({ onCommit, timing }: TimingControlsProps) {
  const [bpmDraft, setBpmDraft] = useState(String(timing.previewBpm));
  const [numeratorDraft, setNumeratorDraft] = useState(
    String(timing.timeSignature.numerator),
  );
  const skipBpmBlurRef = useRef(false);
  const skipNumeratorBlurRef = useRef(false);

  useEffect(() => setBpmDraft(String(timing.previewBpm)), [timing.previewBpm]);
  useEffect(
    () => setNumeratorDraft(String(timing.timeSignature.numerator)),
    [timing.timeSignature.numerator],
  );

  function commitBpm() {
    const value = parseIntegerDraft(bpmDraft, 20, 300);
    if (value === null) {
      setBpmDraft(String(timing.previewBpm));
      return;
    }
    setBpmDraft(String(value));
    if (value !== timing.previewBpm) onCommit({ previewBpm: value });
  }

  function commitNumerator() {
    const numerator = parseIntegerDraft(numeratorDraft, 1, 32);
    if (numerator === null) {
      setNumeratorDraft(String(timing.timeSignature.numerator));
      return;
    }
    setNumeratorDraft(String(numerator));
    if (numerator !== timing.timeSignature.numerator) {
      onCommit({
        timeSignature: { ...timing.timeSignature, numerator },
      });
    }
  }

  function handleDraftKey(
    event: KeyboardEvent<HTMLInputElement>,
    commit: () => void,
    revert: () => void,
  ) {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      revert();
      event.currentTarget.blur();
    }
  }

  return (
    <div className="timing-controls" aria-label="Preview timing">
      <label className="timing-field timing-bpm">
        <span>BPM</span>
        <input
          aria-label="Preview BPM"
          inputMode="numeric"
          type="number"
          min="20"
          max="300"
          step="1"
          value={bpmDraft}
          onBlur={() => {
            if (skipBpmBlurRef.current) {
              skipBpmBlurRef.current = false;
              return;
            }
            commitBpm();
          }}
          onChange={(event) => setBpmDraft(event.target.value)}
          onKeyDown={(event) =>
            handleDraftKey(event, commitBpm, () => {
              skipBpmBlurRef.current = true;
              setBpmDraft(String(timing.previewBpm));
            })
          }
        />
      </label>
      <div
        className="timing-signature"
        aria-label="Time signature"
        role="group"
      >
        <label className="timing-field">
          <span>Beats</span>
          <input
            aria-label="Time signature numerator"
            inputMode="numeric"
            type="number"
            min="1"
            max="32"
            step="1"
            value={numeratorDraft}
            onBlur={() => {
              if (skipNumeratorBlurRef.current) {
                skipNumeratorBlurRef.current = false;
                return;
              }
              commitNumerator();
            }}
            onChange={(event) => setNumeratorDraft(event.target.value)}
            onKeyDown={(event) =>
              handleDraftKey(event, commitNumerator, () => {
                skipNumeratorBlurRef.current = true;
                setNumeratorDraft(String(timing.timeSignature.numerator));
              })
            }
          />
        </label>
        <span className="timing-signature-separator" aria-hidden="true">
          /
        </span>
        <label className="timing-field timing-unit">
          <span>Unit</span>
          <select
            aria-label="Time signature denominator"
            value={timing.timeSignature.denominator}
            onChange={(event) =>
              onCommit({
                timeSignature: {
                  ...timing.timeSignature,
                  denominator: Number(event.target.value) as 1 | 2 | 4 | 8 | 16,
                },
              })
            }
          >
            {DENOMINATORS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
