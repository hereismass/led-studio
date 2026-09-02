import type { CueAdvance, Scene, Song } from '@led-studio/project-format';
import { useMemo } from 'react';
import { ChoiceMenu } from '@/shared/ui/ChoiceMenu';
import { SongCueRow, type CueUpdateResult } from './SongCueRow';

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
  ) => CueUpdateResult;
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
  const sceneOptions = useMemo(
    () =>
      scenes.map((scene) => ({
        label: scene.name,
        value: scene.id,
      })),
    [scenes],
  );

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
            <SongCueRow
              active={cue.id === activeCueId}
              cue={cue}
              index={index}
              key={cue.id}
              sceneOptions={sceneOptions}
              totalCues={song.cues.length}
              onDelete={onDeleteCue}
              onDuplicate={onDuplicateCue}
              onMove={onMoveCue}
              onSelect={onSelectCue}
              onUpdate={onUpdateCue}
            />
          ))}
        </ol>
      )}
    </div>
  );
}
