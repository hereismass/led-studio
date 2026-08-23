import type { Scene } from '@led-studio/project-format';
import { useEffect, useState } from 'react';

interface SceneInspectorProps {
  scene: Scene;
  sceneNames: Array<{ id: string; name: string }>;
  onDelete: () => void;
  onDuplicate: () => void;
  onUpdate: (changes: Partial<Pick<Scene, 'loopLengthBeats' | 'name'>>) => void;
}

export function SceneInspector({
  scene,
  sceneNames,
  onDelete,
  onDuplicate,
  onUpdate,
}: SceneInspectorProps) {
  const [name, setName] = useState(scene.name);
  const [loopLength, setLoopLength] = useState(String(scene.loopLengthBeats));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(scene.name);
    setLoopLength(String(scene.loopLengthBeats));
    setError(null);
  }, [scene.id, scene.loopLengthBeats, scene.name]);

  function commitName() {
    const value = name.trim();
    if (!value) return setError('Scene name cannot be empty');
    if (
      sceneNames.some(
        (candidate) =>
          candidate.id !== scene.id &&
          candidate.name.trim().toLowerCase() === value.toLowerCase(),
      )
    ) {
      return setError('Scene names must be unique');
    }
    setName(value);
    setError(null);
    onUpdate({ name: value });
  }

  function commitLoopLength() {
    const value = Number(loopLength);
    if (!Number.isFinite(value) || value <= 0 || !Number.isInteger(value * 4)) {
      setError('Use a positive loop length in 0.25-beat steps');
      return;
    }
    setLoopLength(String(value));
    setError(null);
    onUpdate({ loopLengthBeats: value });
  }

  return (
    <section className="inspector-section scene-inspector">
      <div>
        <p className="workspace-eyebrow">Scene</p>
        <h3>{scene.name}</h3>
      </div>
      <label className="inspector-field">
        <span>Scene name</span>
        <input
          aria-label="Scene name"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
          onBlur={commitName}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commitName();
          }}
        />
      </label>
      <label className="inspector-field">
        <span>Loop length (beats)</span>
        <input
          aria-label="Loop length in beats"
          type="number"
          min="0.25"
          step="0.25"
          value={loopLength}
          onChange={(event) => {
            setLoopLength(event.target.value);
            setError(null);
          }}
          onBlur={commitLoopLength}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commitLoopLength();
          }}
        />
      </label>
      {error ? (
        <p className="inspector-field-error" role="alert">
          {error}
        </p>
      ) : null}
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
