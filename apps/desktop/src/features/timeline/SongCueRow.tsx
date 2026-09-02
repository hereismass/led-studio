import type { CueAdvance, SongCue } from '@led-studio/project-format';
import { memo, useEffect, useRef, useState } from 'react';
import { NumberDraft } from '@/features/inspector/NumberDraft';
import { ChoiceMenu } from '@/shared/ui/ChoiceMenu';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';

export interface CueUpdateResult {
  message?: string;
  ok: boolean;
}

interface SongCueRowProps {
  active: boolean;
  cue: SongCue;
  index: number;
  sceneOptions: readonly { label: string; value: string }[];
  totalCues: number;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onMove: (id: string, toIndex: number) => void;
  onSelect: (id: string) => void;
  onUpdate: (
    id: string,
    changes: { advance?: CueAdvance; name?: string; sceneId?: string },
  ) => CueUpdateResult;
}

const advanceOptions = [
  { label: 'Manual', value: 'manual' },
  { label: 'After loops', value: 'after-loops' },
] as const;

export const SongCueRow = memo(function SongCueRow({
  active,
  cue,
  index,
  onDelete,
  onDuplicate,
  onMove,
  onSelect,
  onUpdate,
  sceneOptions,
  totalCues,
}: SongCueRowProps) {
  const [nameDraft, setNameDraft] = useState(cue.name);
  const [nameError, setNameError] = useState<string | null>(null);
  const skipNameBlurRef = useRef(false);

  useEffect(() => {
    setNameDraft(cue.name);
    setNameError(null);
  }, [cue.name]);

  function commitName() {
    const name = nameDraft.trim();
    if (!name || name === cue.name) {
      setNameDraft(cue.name);
      setNameError(null);
      return;
    }
    const result = onUpdate(cue.id, { name });
    if (!result.ok) {
      setNameDraft(cue.name);
      setNameError(result.message ?? 'The cue name is not valid.');
      return;
    }
    setNameDraft(name);
    setNameError(null);
  }

  return (
    <li className="song-cue-card" data-active={active}>
      <button
        className="song-cue-index"
        type="button"
        aria-label={`Preview cue ${index + 1}: ${cue.name}`}
        onClick={() => onSelect(cue.id)}
      >
        {index + 1}
      </button>
      <label className="song-cue-name">
        <span>Cue</span>
        <input
          aria-label={`Cue ${index + 1} name`}
          aria-invalid={nameError ? 'true' : undefined}
          value={nameDraft}
          onBlur={() => {
            if (skipNameBlurRef.current) {
              skipNameBlurRef.current = false;
              return;
            }
            commitName();
          }}
          onChange={(event) => {
            setNameDraft(event.target.value);
            setNameError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              skipNameBlurRef.current = true;
              setNameDraft(cue.name);
              setNameError(null);
              event.currentTarget.blur();
            }
          }}
        />
        {nameError ? (
          <small className="song-cue-name-error" role="alert">
            {nameError}
          </small>
        ) : null}
      </label>
      <div className="song-cue-scene">
        <span>Scene</span>
        <ChoiceMenu
          ariaLabel={`Cue ${index + 1} scene`}
          options={sceneOptions}
          value={cue.sceneId}
          onChange={(sceneId) => onUpdate(cue.id, { sceneId })}
        />
      </div>
      <div className="song-cue-advance">
        <span>Advance</span>
        <SegmentedControl
          ariaLabel={`Cue ${index + 1} advance`}
          options={advanceOptions}
          value={cue.advance.kind}
          onChange={(kind) =>
            onUpdate(cue.id, {
              advance:
                kind === 'manual'
                  ? { kind: 'manual' }
                  : { kind: 'after-loops', loopCount: 1 },
            })
          }
        />
      </div>
      {cue.advance.kind === 'after-loops' ? (
        <div className="song-loop-count">
          <NumberDraft
            label={`Cue ${index + 1} loop count`}
            displayLabel="Loops"
            min={1}
            max={4096}
            step={1}
            value={cue.advance.loopCount}
            onCommit={(loopCount) =>
              onUpdate(cue.id, {
                advance: { kind: 'after-loops', loopCount },
              })
            }
          />
        </div>
      ) : (
        <div className="song-loop-count song-loop-count-empty">
          <span>Loops</span>
          <output aria-label={`Cue ${index + 1} loop count`}>—</output>
        </div>
      )}
      <div className="song-cue-actions">
        <button
          className="song-cue-move-button"
          type="button"
          aria-label={`Move ${cue.name} earlier`}
          title="Move earlier"
          disabled={index === 0}
          onClick={() => onMove(cue.id, index - 1)}
        >
          ↑
        </button>
        <button
          className="song-cue-move-button"
          type="button"
          aria-label={`Move ${cue.name} later`}
          title="Move later"
          disabled={index === totalCues - 1}
          onClick={() => onMove(cue.id, index + 1)}
        >
          ↓
        </button>
        <button
          className="song-cue-action-button"
          type="button"
          aria-label={`Duplicate ${cue.name}`}
          onClick={() => onDuplicate(cue.id)}
        >
          Duplicate
        </button>
        <button
          className="song-cue-action-button song-cue-delete-button"
          type="button"
          aria-label={`Delete ${cue.name}`}
          onClick={() => onDelete(cue.id)}
        >
          Delete
        </button>
      </div>
    </li>
  );
});
