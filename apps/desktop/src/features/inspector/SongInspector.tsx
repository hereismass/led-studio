import type {
  ProjectTiming,
  Song,
  SongLaunchQuantization,
} from '@led-studio/project-format';
import { useEffect, useState } from 'react';
import { ChoiceMenu } from '@/shared/ui/ChoiceMenu';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { NumberDraft } from './NumberDraft';

interface SongInspectorProps {
  song: Song;
  songs: readonly Song[];
  onDelete: () => void;
  onDuplicate: () => void;
  onMove: (toIndex: number) => void;
  onUpdate: (
    changes: Partial<Pick<Song, 'launchQuantization' | 'name' | 'timing'>>,
  ) => void;
}

const denominatorOptions = [1, 2, 4, 8, 16].map((value) => ({
  label: String(value),
  value: String(value),
}));

const launchOptions = [
  { label: 'Immediate', value: 'immediate' },
  { label: 'Next beat', value: 'next-beat' },
  { label: 'Next bar', value: 'next-bar' },
] as const;

export function SongInspector({
  onDelete,
  onDuplicate,
  onMove,
  onUpdate,
  song,
  songs,
}: SongInspectorProps) {
  const [name, setName] = useState(song.name);
  const [nameError, setNameError] = useState<string | null>(null);
  const index = songs.findIndex(({ id }) => id === song.id);

  useEffect(() => {
    setName(song.name);
    setNameError(null);
  }, [song.id, song.name]);

  function commitName() {
    const value = name.trim();
    if (!value) {
      setNameError('Song name cannot be empty');
      return;
    }
    if (
      songs.some(
        (candidate) =>
          candidate.id !== song.id &&
          candidate.name.trim().toLowerCase() === value.toLowerCase(),
      )
    ) {
      setNameError('Song names must be unique');
      return;
    }
    setName(value);
    setNameError(null);
    if (value !== song.name) onUpdate({ name: value });
  }

  function updateTiming(changes: Partial<ProjectTiming>) {
    onUpdate({ timing: { ...song.timing, ...changes } });
  }

  return (
    <section className="inspector-section song-inspector">
      <div>
        <p className="workspace-eyebrow">Song</p>
        <h3>{song.name}</h3>
      </div>
      <label className="inspector-field">
        <span>Song name</span>
        <input
          aria-label="Song name"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setNameError(null);
          }}
          onBlur={commitName}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commitName();
            if (event.key === 'Escape') {
              setName(song.name);
              setNameError(null);
              event.currentTarget.blur();
            }
          }}
        />
      </label>
      {nameError ? (
        <p className="inspector-field-error" role="alert">
          {nameError}
        </p>
      ) : null}
      <div className="song-inspector-timing">
        <NumberDraft
          label="Song BPM"
          displayLabel="BPM"
          min={20}
          max={300}
          step={1}
          value={song.timing.previewBpm}
          onCommit={(previewBpm) => updateTiming({ previewBpm })}
        />
        <NumberDraft
          label="Song time signature beats"
          displayLabel="Beats"
          min={1}
          max={32}
          step={1}
          value={song.timing.timeSignature.numerator}
          onCommit={(numerator) =>
            updateTiming({
              timeSignature: { ...song.timing.timeSignature, numerator },
            })
          }
        />
        <div className="inspector-field">
          <span>Unit</span>
          <ChoiceMenu
            ariaLabel="Song time signature unit"
            options={denominatorOptions}
            value={String(song.timing.timeSignature.denominator)}
            onChange={(value) =>
              updateTiming({
                timeSignature: {
                  ...song.timing.timeSignature,
                  denominator: Number(value) as 1 | 2 | 4 | 8 | 16,
                },
              })
            }
          />
        </div>
      </div>
      <div className="inspector-field">
        <span>Song launch</span>
        <SegmentedControl
          ariaLabel="Song launch quantization"
          options={launchOptions}
          value={song.launchQuantization}
          onChange={(launchQuantization: SongLaunchQuantization) =>
            onUpdate({ launchQuantization })
          }
        />
      </div>
      <div className="inspector-actions song-inspector-order-actions">
        <button
          type="button"
          disabled={index <= 0}
          onClick={() => onMove(index - 1)}
        >
          Move earlier
        </button>
        <button
          type="button"
          disabled={index === -1 || index >= songs.length - 1}
          onClick={() => onMove(index + 1)}
        >
          Move later
        </button>
      </div>
      <div className="inspector-actions">
        <button type="button" onClick={onDuplicate}>
          Duplicate
        </button>
        <button className="inspector-delete" type="button" onClick={onDelete}>
          Delete
        </button>
      </div>
    </section>
  );
}
