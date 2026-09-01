import { useRef, type KeyboardEvent } from 'react';

interface SegmentedControlOption<T extends string> {
  label: string;
  value: T;
}

interface SegmentedControlProps<T extends string> {
  ariaLabel: string;
  disabled?: boolean;
  options: readonly SegmentedControlOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({
  ariaLabel,
  disabled = false,
  onChange,
  options,
  value,
}: SegmentedControlProps<T>) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function handleKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp')
      nextIndex = (index - 1 + options.length) % options.length;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown')
      nextIndex = (index + 1) % options.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = options.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    onChange(options[nextIndex].value);
    buttonRefs.current[nextIndex]?.focus();
  }

  return (
    <div className="segmented-control" role="radiogroup" aria-label={ariaLabel}>
      {options.map((option, index) => (
        <button
          ref={(element) => {
            buttonRefs.current[index] = element;
          }}
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          disabled={disabled}
          tabIndex={
            option.value === value || (value === null && index === 0) ? 0 : -1
          }
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => handleKey(event, index)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
