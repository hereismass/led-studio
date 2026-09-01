import type { CueAdvance, Scene, Song } from '@led-studio/project-format';
import { NumberDraft } from '@/features/inspector/NumberDraft';
import { ChoiceMenu } from '@/shared/ui/ChoiceMenu';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';

interface SongCueTimelineProps {
  activeCueId: string | null;
  scenes: readonly Scene[];
  song: Song;
  onAddCue: (sceneId: string) => void;
  onDeleteCue: (id: string) => void;
  onDuplicateCue: (id: string) => void;
  onMoveCue: (id: string, toIndex: number) => void;
  onSelectCue: (id: string) => void;
  onUpdateCue: (
    id: string,
    changes: { advance?: CueAdvance; name?: string; sceneId?: string },
  ) => void;
}

export function SongCueTimeline({
  activeCueId,
  onAddCue,
  onDeleteCue,
  onDuplicateCue,
  onMoveCue,
  onSelectCue,
  onUpdateCue,
  scenes,
  song,
}: SongCueTimelineProps) {
  const sceneOptions = scenes.map((scene) => ({
    label: scene.name,
    value: scene.id,
  }));

  return (
    <div className="song-cue-timeline">
      <div className="song-cue-header">
        <div className="song-cue-heading-copy">
          <strong>{song.name}</strong>
          <span>
            {song.cues.length} {song.cues.length === 1 ? 'cue' : 'cues'} ·{' '}
            {song.timing.previewBpm} BPM · {song.timing.timeSignature.numerator}
            /{song.timing.timeSignature.denominator}
          </span>
        </div>
        <ChoiceMenu
          ariaLabel="Add scene cue"
          className="song-add-cue"
          disabled={scenes.length === 0}
          options={sceneOptions}
          placeholder="＋ Add cue"
          value={null}
          onChange={onAddCue}
        />
      </div>

      {song.cues.length === 0 ? (
        <div className="panel-placeholder">
          <span aria-hidden="true">◇</span>
          <div>
            <strong>This song has no cues</strong>
            <p>Add a shared scene to define its first cue.</p>
          </div>
        </div>
      ) : (
        <ol className="song-cue-list" aria-label={`${song.name} cues`}>
          {song.cues.map((cue, index) => (
            <li
              className="song-cue-card"
              data-active={cue.id === activeCueId}
              key={cue.id}
            >
              <button
                className="song-cue-index"
                type="button"
                aria-label={`Preview cue ${index + 1}: ${cue.name}`}
                onClick={() => onSelectCue(cue.id)}
              >
                {index + 1}
              </button>
              <label className="song-cue-name">
                <span>Cue</span>
                <input
                  key={`${cue.id}-${cue.name}`}
                  aria-label={`Cue ${index + 1} name`}
                  defaultValue={cue.name}
                  onBlur={(event) => {
                    const name = event.currentTarget.value.trim();
                    if (name && name !== cue.name)
                      onUpdateCue(cue.id, { name });
                    else event.currentTarget.value = cue.name;
                  }}
                />
              </label>
              <div className="song-cue-scene">
                <span>Scene</span>
                <ChoiceMenu
                  ariaLabel={`Cue ${index + 1} scene`}
                  options={sceneOptions}
                  value={cue.sceneId}
                  onChange={(sceneId) => onUpdateCue(cue.id, { sceneId })}
                />
              </div>
              <div className="song-cue-advance">
                <span>Advance</span>
                <SegmentedControl
                  ariaLabel={`Cue ${index + 1} advance`}
                  options={[
                    { label: 'Manual', value: 'manual' },
                    { label: 'After loops', value: 'after-loops' },
                  ]}
                  value={cue.advance.kind}
                  onChange={(kind) =>
                    onUpdateCue(cue.id, {
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
                      onUpdateCue(cue.id, {
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
                  onClick={() => onMoveCue(cue.id, index - 1)}
                >
                  ↑
                </button>
                <button
                  className="song-cue-move-button"
                  type="button"
                  aria-label={`Move ${cue.name} later`}
                  title="Move later"
                  disabled={index === song.cues.length - 1}
                  onClick={() => onMoveCue(cue.id, index + 1)}
                >
                  ↓
                </button>
                <button
                  className="song-cue-action-button"
                  type="button"
                  aria-label={`Duplicate ${cue.name}`}
                  onClick={() => onDuplicateCue(cue.id)}
                >
                  Duplicate
                </button>
                <button
                  className="song-cue-action-button song-cue-delete-button"
                  type="button"
                  aria-label={`Delete ${cue.name}`}
                  onClick={() => onDeleteCue(cue.id)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
