import type { PaletteToken } from '@led-studio/project-format';

interface PaletteSwatchesProps {
  disabled?: boolean;
  mixed?: boolean;
  palette: readonly PaletteToken[];
  selectedTokenId: string | null;
  onSelect: (paletteTokenId: string) => void;
}

export function PaletteSwatches({
  disabled = false,
  mixed = false,
  onSelect,
  palette,
  selectedTokenId,
}: PaletteSwatchesProps) {
  return (
    <div
      className={`inspector-swatches ${mixed ? 'inspector-swatches-mixed' : ''}`}
      role="group"
      aria-label="Palette colours"
    >
      {palette.map((token) => {
        const selected = !mixed && token.id === selectedTokenId;
        return (
          <button
            key={token.id}
            type="button"
            aria-label={token.name}
            aria-pressed={selected}
            disabled={disabled}
            title={`${token.name} · ${token.value}`}
            style={{ backgroundColor: token.value }}
            onClick={() => onSelect(token.id)}
          >
            {selected ? <span aria-hidden="true">✓</span> : null}
          </button>
        );
      })}
    </div>
  );
}
