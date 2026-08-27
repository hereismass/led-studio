import { useEffect, useState } from 'react';
import type { PaletteToken } from '@led-studio/project-format';

interface PaletteInspectorProps {
  focusName: boolean;
  palette: PaletteToken[];
  token: PaletteToken;
  onDelete: () => void;
  onDuplicate: () => void;
  onUpdate: (changes: Partial<Pick<PaletteToken, 'name' | 'value'>>) => void;
  usageCount: number;
}

const HEX_COLOUR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export function PaletteInspector({
  focusName,
  palette,
  token,
  onDelete,
  onDuplicate,
  onUpdate,
  usageCount,
}: PaletteInspectorProps) {
  const [nameDraft, setNameDraft] = useState(token.name);
  const [valueDraft, setValueDraft] = useState(token.value);
  const [nameError, setNameError] = useState<string | null>(null);
  const [valueError, setValueError] = useState<string | null>(null);

  useEffect(() => {
    setNameDraft(token.name);
    setValueDraft(token.value);
    setNameError(null);
    setValueError(null);
  }, [token.id, token.name, token.value]);

  function commitName(): boolean {
    const name = nameDraft.trim();
    if (name.length === 0) {
      setNameError('Colour name cannot be empty');
      return false;
    }

    const duplicate = palette.some(
      (candidate) =>
        candidate.id !== token.id &&
        candidate.name.trim().toLowerCase() === name.toLowerCase(),
    );
    if (duplicate) {
      setNameError('Colour names must be unique');
      return false;
    }

    onUpdate({ name });
    setNameDraft(name);
    setNameError(null);
    return true;
  }

  function commitValue(): boolean {
    if (!HEX_COLOUR_PATTERN.test(valueDraft)) {
      setValueError('Use a six-digit value such as #FF2B9A');
      return false;
    }

    const value = valueDraft.toUpperCase();
    onUpdate({ value });
    setValueDraft(value);
    setValueError(null);
    return true;
  }

  return (
    <section className="inspector-section palette-inspector">
      <div className="palette-inspector-heading">
        <div
          className="palette-inspector-swatch"
          style={{ backgroundColor: token.value }}
          aria-hidden="true"
        />
        <div>
          <p className="workspace-eyebrow">Palette colour</p>
          <h3>{token.name}</h3>
        </div>
      </div>

      <label className="inspector-field">
        <span>Display name</span>
        <input
          autoFocus={focusName}
          aria-invalid={nameError ? 'true' : undefined}
          value={nameDraft}
          onBlur={commitName}
          onChange={(event) => {
            setNameDraft(event.target.value);
            setNameError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commitName();
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              setNameDraft(token.name);
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

      <div className="inspector-field">
        <span>Colour value</span>
        <div className="colour-value-controls">
          <input
            className="colour-picker"
            type="color"
            aria-label="Colour picker"
            value={token.value}
            onChange={(event) => {
              const value = event.target.value.toUpperCase();
              setValueDraft(value);
              setValueError(null);
              onUpdate({ value });
            }}
          />
          <input
            aria-label="Hex colour"
            aria-invalid={valueError ? 'true' : undefined}
            spellCheck={false}
            value={valueDraft}
            onBlur={commitValue}
            onChange={(event) => {
              setValueDraft(event.target.value);
              setValueError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitValue();
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                setValueDraft(token.value);
                setValueError(null);
                event.currentTarget.blur();
              }
            }}
          />
        </div>
      </div>
      {valueError ? (
        <p className="inspector-field-error" role="alert">
          {valueError}
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
            usageCount > 0
              ? 'Remove all scene references before deleting this colour'
              : undefined
          }
          onClick={onDelete}
        >
          Delete
        </button>
      </div>
      {usageCount > 0 ? (
        <p className="palette-usage-note">
          Used by {usageCount} scene {usageCount === 1 ? 'LED' : 'LEDs'}. Turn
          those LEDs off or apply another colour before deleting.
        </p>
      ) : null}
    </section>
  );
}
