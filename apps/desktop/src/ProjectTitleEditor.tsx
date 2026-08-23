import { useEffect, useRef, useState } from 'react';

interface ProjectTitleEditorProps {
  name: string;
  onCommit: (name: string) => void;
}

export function ProjectTitleEditor({
  name,
  onCommit,
}: ProjectTitleEditorProps) {
  const [draft, setDraft] = useState(name);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(name);
  }, [editing, name]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function commit(): boolean {
    const nextName = draft.trim();
    if (nextName.length === 0) {
      setError('Project name cannot be empty');
      return false;
    }

    onCommit(nextName);
    setDraft(nextName);
    setError(null);
    setEditing(false);
    return true;
  }

  function cancel() {
    setDraft(name);
    setError(null);
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="workspace-project-name">
        <h1>{name}</h1>
        <button
          className="workspace-title-edit"
          type="button"
          aria-label="Edit project name"
          title="Edit project name"
          onClick={() => setEditing(true)}
        >
          <span aria-hidden="true">✎</span>
        </button>
      </div>
    );
  }

  return (
    <div className="workspace-project-name workspace-project-name-editing">
      <input
        ref={inputRef}
        aria-label="Project name"
        aria-invalid={error ? 'true' : undefined}
        value={draft}
        onBlur={commit}
        onChange={(event) => {
          setDraft(event.target.value);
          setError(null);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            cancel();
          }
        }}
      />
      {error ? <span role="alert">{error}</span> : null}
    </div>
  );
}
