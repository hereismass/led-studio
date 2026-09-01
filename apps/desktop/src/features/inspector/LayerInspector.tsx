import type {
  ExecuteEditorCommandOptions,
  SceneLayerChanges,
} from '@led-studio/editor-core';
import type { HardwareProfile } from '@led-studio/hardware-profiles';
import type {
  LayerTarget,
  PaletteToken,
  ProjectGroup,
  Scene,
  SceneLayer,
} from '@led-studio/project-format';
import { useEffect, useState } from 'react';
import { PaletteSwatches } from '@/shared/editor-ui/PaletteSwatches';
import { ChoiceMenu, type ChoiceMenuOption } from '@/shared/ui/ChoiceMenu';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { EffectParameterFields } from './EffectParameterFields';
import { NumberDraft } from './NumberDraft';

interface LayerInspectorProps {
  groups: readonly ProjectGroup[];
  layer: SceneLayer;
  palette: readonly PaletteToken[];
  profile: HardwareProfile;
  scene: Scene;
  selectedLedIds: string[];
  onDelete: () => void;
  onDuplicate: () => void;
  onMove: (toIndex: number) => void;
  onUpdate: (
    changes: SceneLayerChanges,
    options?: ExecuteEditorCommandOptions,
  ) => void;
}

function targetValue(target: LayerTarget): string {
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
  const selectedColour =
    layer.kind === 'effect'
      ? palette.find(({ id }) => id === layer.effect.paletteTokenId)
      : null;
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

  return (
    <section className="inspector-section layer-inspector">
      <div className="layer-inspector-heading">
        <div>
          <p className="workspace-eyebrow">
            {layer.kind === 'effect'
              ? `${layer.effect.type} effect`
              : 'Keyframe layer'}
          </p>
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
          ariaLabel="Layer target"
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
      {layer.kind === 'keyframe' ? (
        <>
          <div className="inspector-field">
            <span>Colour interpolation</span>
            <SegmentedControl
              ariaLabel="Colour interpolation"
              disabled={editingDisabled}
              options={[
                { label: 'Smooth RGB', value: 'linear-rgb' },
                { label: 'Step', value: 'step' },
              ]}
              value={layer.tracks.colour.interpolation}
              onChange={(colourInterpolation) =>
                onUpdate({ colourInterpolation })
              }
            />
          </div>
          <p className="inspector-help">
            {layer.tracks.brightness.keyframes.length} brightness and{' '}
            {layer.tracks.colour.keyframes.length} colour keyframes. The active
            window masks keys without deleting or retiming them.
          </p>
        </>
      ) : (
        <>
          <div className="inspector-field">
            <span>Colour · {selectedColour?.name ?? 'Unavailable'}</span>
            <PaletteSwatches
              disabled={editingDisabled}
              palette={palette}
              selectedTokenId={layer.effect.paletteTokenId}
              onSelect={(paletteTokenId) =>
                onUpdate({ effect: { ...layer.effect, paletteTokenId } })
              }
            />
          </div>
          <EffectParameterFields
            disabled={editingDisabled}
            effect={layer.effect}
            onChange={(effect) => onUpdate({ effect })}
          />
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
