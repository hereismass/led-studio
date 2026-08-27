import type { ProjectGroup } from '@led-studio/project-format';
import { useEffect, useState } from 'react';

interface GroupInspectorProps {
  group: ProjectGroup;
  groupNames: Array<{ id: string; name: string }>;
  selectedLedIds: string[];
  usageCount: number;
  onDelete: () => void;
  onDuplicate: () => void;
  onSelectionChange: (ledIds: string[]) => void;
  onUpdate: (changes: Partial<Pick<ProjectGroup, 'ledIds' | 'name'>>) => void;
}

export function GroupInspector({
  group,
  groupNames,
  onDelete,
  onDuplicate,
  onSelectionChange,
  onUpdate,
  selectedLedIds,
  usageCount,
}: GroupInspectorProps) {
  const [editingMembers, setEditingMembers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(group.name);

  useEffect(() => {
    setEditingMembers(false);
    setError(null);
    setName(group.name);
  }, [group.id, group.name]);

  function commitName() {
    const value = name.trim();
    if (!value) return setError('Group name cannot be empty');
    if (
      groupNames.some(
        (candidate) =>
          candidate.id !== group.id &&
          candidate.name.trim().toLowerCase() === value.toLowerCase(),
      )
    )
      return setError('Group names must be unique');
    setError(null);
    setName(value);
    onUpdate({ name: value });
  }

  return (
    <section className="inspector-section group-inspector">
      <div>
        <p className="workspace-eyebrow">LED group</p>
        <h3>{group.name}</h3>
      </div>
      <label className="inspector-field">
        <span>Group name</span>
        <input
          aria-label="Group name"
          disabled={editingMembers}
          value={name}
          onChange={(event) => {
            setError(null);
            setName(event.target.value);
          }}
          onBlur={commitName}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commitName();
            if (event.key === 'Escape') {
              setError(null);
              setName(group.name);
            }
          }}
        />
      </label>
      <p className="inspector-help">
        {group.ledIds.length} LEDs · linked by {usageCount}{' '}
        {usageCount === 1 ? 'effect' : 'effects'}
      </p>
      {editingMembers ? (
        <div className="group-member-editor">
          <p>Select group members on the fretboard, then save.</p>
          <div className="inspector-actions">
            <button
              type="button"
              disabled={selectedLedIds.length === 0}
              onClick={() => {
                if (selectedLedIds.length === 0) return;
                onUpdate({ ledIds: selectedLedIds });
                setEditingMembers(false);
              }}
            >
              Save members
            </button>
            <button
              type="button"
              onClick={() => {
                onSelectionChange(group.ledIds);
                setEditingMembers(false);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            onSelectionChange(group.ledIds);
            setEditingMembers(true);
          }}
        >
          Edit members on fretboard
        </button>
      )}
      {error ? (
        <p className="inspector-field-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="inspector-actions">
        <button type="button" onClick={onDuplicate}>
          Duplicate
        </button>
        <button
          className="inspector-delete"
          type="button"
          disabled={usageCount > 0}
          title={
            usageCount > 0 ? 'Remove linked effect targets first' : undefined
          }
          onClick={onDelete}
        >
          Delete
        </button>
      </div>
    </section>
  );
}
