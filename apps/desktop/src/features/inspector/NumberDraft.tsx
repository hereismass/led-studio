import { useEffect, useState, type KeyboardEvent } from 'react';

interface NumberDraftProps {
  displayLabel?: string;
  disabled?: boolean;
  label: string;
  max?: number;
  min: number;
  step: number;
  value: number;
  onCommit: (value: number) => void;
}

export function NumberDraft({
  disabled,
  displayLabel,
  label,
  max,
  min,
  onCommit,
  step,
  value,
}: NumberDraftProps) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  function commit() {
    const next = Number(draft);
    if (
      !Number.isFinite(next) ||
      next < min ||
      (max !== undefined && next > max) ||
      !Number.isInteger(next / step)
    ) {
      setDraft(String(value));
      return;
    }
    setDraft(String(next));
    onCommit(next);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') commit();
    if (event.key === 'Escape') setDraft(String(value));
  }

  return (
    <label className="inspector-field">
      <span>{displayLabel ?? label}</span>
      <input
        aria-label={label}
        disabled={disabled}
        type="number"
        min={min}
        max={max}
        step={step}
        value={draft}
        onBlur={commit}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
      />
    </label>
  );
}
