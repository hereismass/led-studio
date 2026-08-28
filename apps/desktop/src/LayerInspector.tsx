import type { ExecuteEditorCommandOptions } from '@led-studio/editor-core';
import type { HardwareProfile } from '@led-studio/hardware-profiles';
import type {
  Effect,
  EffectLayer,
  EffectTarget,
  PaletteToken,
  ProjectGroup,
  Scene,
} from '@led-studio/project-format';
import { useEffect, useState, type KeyboardEvent } from 'react';
import { ChoiceMenu, type ChoiceMenuOption } from './ChoiceMenu';
import { PaletteSwatches } from './PaletteSwatches';
import { SegmentedControl } from './SegmentedControl';

interface NumberDraftProps {
  disabled?: boolean;
  label: string;
  max?: number;
  min: number;
  step: number;
  value: number;
  onCommit: (value: number) => void;
}

function NumberDraft({
  disabled,
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
      <span>{label}</span>
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

interface LayerInspectorProps {
  groups: readonly ProjectGroup[];
  layer: EffectLayer;
  palette: readonly PaletteToken[];
  profile: HardwareProfile;
  scene: Scene;
  selectedLedIds: string[];
  onDelete: () => void;
  onDuplicate: () => void;
  onMove: (toIndex: number) => void;
  onUpdate: (
    changes: Partial<Omit<EffectLayer, 'id'>>,
    options?: ExecuteEditorCommandOptions,
  ) => void;
}

function targetValue(target: EffectTarget): string {
  return target.kind === 'leds' ? 'leds' : `${target.kind}:${target.groupId}`;
}

export function LayerInspector({
  groups,
  layer,
  onDelete,
  onDuplicate,
  onMove,
  onUpdate,
  palette,
  profile,
  scene,
  selectedLedIds,
}: LayerInspectorProps) {
  const [name, setName] = useState(layer.name);
  const index = scene.layers.findIndex(({ id }) => id === layer.id);
  const editingDisabled = layer.locked;
  const selectedColour = palette.find(
    ({ id }) => id === layer.effect.paletteTokenId,
  );
  const targetOptions: ChoiceMenuOption[] = [
    {
      disabled: selectedLedIds.length === 0 && layer.target.kind !== 'leds',
      group: 'Selection',
      label:
        selectedLedIds.length > 0
          ? `Selected LEDs (${selectedLedIds.length}, direct)`
          : layer.target.kind === 'leds'
            ? `Direct LEDs (${layer.target.ledIds.length})`
            : 'Selected LEDs (direct)',
      value: 'leds',
    },
    ...profile.groups.map((group) => ({
      group: 'Profile groups',
      label: group.name,
      value: `profile-group:${group.id}`,
    })),
    ...groups.map((group) => ({
      group: 'Project groups',
      label: group.name,
      value: `project-group:${group.id}`,
    })),
  ];

  useEffect(() => setName(layer.name), [layer.id, layer.name]);

  function updateEffect(changes: Partial<Effect>) {
    onUpdate({ effect: { ...layer.effect, ...changes } as Effect });
  }

  return (
    <section className="inspector-section layer-inspector">
      <div className="layer-inspector-heading">
        <div>
          <p className="workspace-eyebrow">{layer.effect.type} effect</p>
          <h3>{layer.name}</h3>
        </div>
        <label className="layer-toggle">
          <input
            type="checkbox"
            checked={layer.enabled}
            onChange={(event) => onUpdate({ enabled: event.target.checked })}
          />
          Enabled
        </label>
      </div>
      <label className="inspector-field">
        <span>Layer name</span>
        <input
          aria-label="Layer name"
          disabled={editingDisabled}
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => {
            const value = name.trim();
            if (value) onUpdate({ name: value });
            else setName(layer.name);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') setName(layer.name);
          }}
        />
      </label>
      <div className="inspector-field">
        <span>Target</span>
        <ChoiceMenu
          ariaLabel="Effect target"
          disabled={editingDisabled}
          options={targetOptions}
          value={targetValue(layer.target)}
          onChange={(value) => {
            if (value === 'leds') {
              const ledIds =
                selectedLedIds.length > 0
                  ? selectedLedIds
                  : layer.target.kind === 'leds'
                    ? layer.target.ledIds
                    : [];
              if (ledIds.length > 0)
                onUpdate({ target: { kind: 'leds', ledIds } });
              return;
            }
            const separator = value.indexOf(':');
            onUpdate({
              target: {
                groupId: value.slice(separator + 1),
                kind: value.slice(0, separator) as
                  'profile-group' | 'project-group',
              },
            });
          }}
        />
      </div>
      <div className="inspector-field-grid">
        <NumberDraft
          disabled={editingDisabled}
          label="Start beat"
          min={0}
          max={scene.loopLengthBeats - 0.25}
          step={0.25}
          value={layer.startBeat}
          onCommit={(startBeat) => onUpdate({ startBeat })}
        />
        <NumberDraft
          disabled={editingDisabled}
          label="End beat"
          min={0.25}
          max={scene.loopLengthBeats}
          step={0.25}
          value={layer.endBeat}
          onCommit={(endBeat) => onUpdate({ endBeat })}
        />
      </div>
      <div className="inspector-field">
        <span>Colour · {selectedColour?.name ?? 'Unavailable'}</span>
        <PaletteSwatches
          disabled={editingDisabled}
          palette={palette}
          selectedTokenId={layer.effect.paletteTokenId}
          onSelect={(paletteTokenId) => updateEffect({ paletteTokenId })}
        />
      </div>
      {layer.effect.type === 'pulse' ? (
        <>
          <div className="inspector-field-grid">
            <NumberDraft
              disabled={editingDisabled}
              label="Minimum brightness"
              min={0}
              max={100}
              step={1}
              value={layer.effect.minBrightnessPercent}
              onCommit={(minBrightnessPercent) =>
                updateEffect({ minBrightnessPercent })
              }
            />
            <NumberDraft
              disabled={editingDisabled}
              label="Maximum brightness"
              min={0}
              max={100}
              step={1}
              value={layer.effect.maxBrightnessPercent}
              onCommit={(maxBrightnessPercent) =>
                updateEffect({ maxBrightnessPercent })
              }
            />
            <NumberDraft
              disabled={editingDisabled}
              label="Cycle length (beats)"
              min={0.25}
              step={0.25}
              value={layer.effect.cycleLengthBeats}
              onCommit={(cycleLengthBeats) =>
                updateEffect({ cycleLengthBeats })
              }
            />
            <NumberDraft
              disabled={editingDisabled}
              label="Phase offset (beats)"
              min={0}
              step={0.25}
              value={layer.effect.phaseOffsetBeats}
              onCommit={(phaseOffsetBeats) =>
                updateEffect({ phaseOffsetBeats })
              }
            />
          </div>
          <div className="inspector-field">
            <span>Waveform</span>
            <SegmentedControl
              ariaLabel="Waveform"
              disabled={editingDisabled}
              options={[
                { label: 'Sine', value: 'sine' },
                { label: 'Triangle', value: 'triangle' },
                { label: 'Square', value: 'square' },
              ]}
              value={layer.effect.waveform}
              onChange={(waveform) => updateEffect({ waveform })}
            />
          </div>
        </>
      ) : (
        <>
          <div className="inspector-field-grid">
            <NumberDraft
              disabled={editingDisabled}
              label="Brightness"
              min={0}
              max={100}
              step={1}
              value={layer.effect.brightnessPercent}
              onCommit={(brightnessPercent) =>
                updateEffect({ brightnessPercent })
              }
            />
            <NumberDraft
              disabled={editingDisabled}
              label="Step length (beats)"
              min={0.25}
              step={0.25}
              value={layer.effect.stepLengthBeats}
              onCommit={(stepLengthBeats) => updateEffect({ stepLengthBeats })}
            />
            <NumberDraft
              disabled={editingDisabled}
              label="Head width"
              min={1}
              step={1}
              value={layer.effect.width}
              onCommit={(width) => updateEffect({ width })}
            />
            <NumberDraft
              disabled={editingDisabled}
              label="Trail length"
              min={0}
              step={1}
              value={layer.effect.trailLength}
              onCommit={(trailLength) => updateEffect({ trailLength })}
            />
          </div>
          <div className="inspector-field">
            <span>Direction</span>
            <SegmentedControl
              ariaLabel="Direction"
              disabled={editingDisabled}
              options={[
                { label: 'Forward', value: 'forward' },
                { label: 'Reverse', value: 'reverse' },
              ]}
              value={layer.effect.direction}
              onChange={(direction) => updateEffect({ direction })}
            />
          </div>
        </>
      )}
      <div className="layer-lock-control">
        <label
          className="layer-toggle"
          title="Protect parameters, timing, targeting, ordering, and deletion"
        >
          <input
            type="checkbox"
            checked={layer.locked}
            onChange={(event) => onUpdate({ locked: event.target.checked })}
          />
          Lock editing
        </label>
        <p className="inspector-help">
          Protects this layer from parameter, timing, target, ordering, and
          deletion changes. You can still enable, duplicate, or unlock it.
        </p>
      </div>
      <div className="inspector-actions layer-order-actions">
        <button
          type="button"
          disabled={editingDisabled || index <= 0}
          onClick={() => onMove(index - 1)}
        >
          Move up
        </button>
        <button
          type="button"
          disabled={editingDisabled || index >= scene.layers.length - 1}
          onClick={() => onMove(index + 1)}
        >
          Move down
        </button>
      </div>
      <p className="inspector-help">
        Timeline rows can also be dragged. Higher layers override lower layers.
      </p>
      <div className="inspector-actions">
        <button type="button" onClick={onDuplicate}>
          Duplicate
        </button>
        <button
          className="inspector-delete"
          type="button"
          disabled={editingDisabled}
          onClick={onDelete}
        >
          Delete
        </button>
      </div>
    </section>
  );
}
