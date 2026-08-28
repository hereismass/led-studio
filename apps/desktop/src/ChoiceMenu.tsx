import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

export interface ChoiceMenuOption {
  disabled?: boolean;
  group?: string;
  label: string;
  value: string;
}

interface ChoiceMenuProps {
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  options: readonly ChoiceMenuOption[];
  placeholder?: string;
  title?: string;
  value: string | null;
  onChange: (value: string) => void;
}

function enabledIndex(
  options: readonly ChoiceMenuOption[],
  start: number,
  direction: 1 | -1,
): number {
  for (let offset = 1; offset <= options.length; offset += 1) {
    const index =
      (start + direction * offset + options.length) % options.length;
    if (!options[index].disabled) return index;
  }
  return start;
}

export function ChoiceMenu({
  ariaLabel,
  className = '',
  disabled = false,
  onChange,
  options,
  placeholder = 'Choose…',
  title,
  value,
}: ChoiceMenuProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  function openMenu(direction: 1 | -1 = 1) {
    if (disabled || options.every((option) => option.disabled)) return;
    const initial =
      selectedIndex >= 0 && !options[selectedIndex].disabled
        ? selectedIndex
        : enabledIndex(options, direction === 1 ? -1 : 0, direction);
    setActiveIndex(initial);
    setOpen(true);
  }

  function closeMenu(restoreFocus = false) {
    setOpen(false);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  }

  useEffect(() => {
    if (!open) return;
    optionRefs.current[activeIndex]?.focus();
  }, [activeIndex, open]);

  useEffect(() => {
    if (!open) return;
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) closeMenu();
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () =>
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [open]);

  function handleTriggerKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      openMenu(event.key === 'ArrowDown' ? 1 : -1);
    }
  }

  function handleOptionKey(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowDown') nextIndex = enabledIndex(options, index, 1);
    if (event.key === 'ArrowUp') nextIndex = enabledIndex(options, index, -1);
    if (event.key === 'Home')
      nextIndex = options.findIndex((option) => !option.disabled);
    if (event.key === 'End') {
      for (let candidate = options.length - 1; candidate >= 0; candidate -= 1) {
        if (!options[candidate].disabled) {
          nextIndex = candidate;
          break;
        }
      }
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu(true);
      return;
    }
    if (event.key === 'Tab') {
      closeMenu();
      return;
    }
    if (nextIndex === null || nextIndex < 0) return;
    event.preventDefault();
    setActiveIndex(nextIndex);
  }

  let currentGroup: string | undefined;
  return (
    <div ref={rootRef} className={`choice-menu ${className}`.trim()}>
      <button
        ref={triggerRef}
        className="choice-menu-trigger"
        type="button"
        aria-controls={open ? `${id}-listbox` : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        disabled={disabled}
        title={title}
        onClick={() => (open ? closeMenu() : openMenu())}
        onKeyDown={handleTriggerKey}
      >
        <span>{selected?.label ?? placeholder}</span>
        <span className="choice-menu-chevron" aria-hidden="true">
          ▾
        </span>
      </button>
      {open ? (
        <div
          className="choice-menu-options"
          id={`${id}-listbox`}
          role="listbox"
          aria-label={ariaLabel}
        >
          {options.map((option, index) => {
            const showGroup = option.group !== currentGroup;
            currentGroup = option.group;
            return (
              <div key={option.value}>
                {showGroup && option.group ? (
                  <div className="choice-menu-group" aria-hidden="true">
                    {option.group}
                  </div>
                ) : null}
                <button
                  ref={(element) => {
                    optionRefs.current[index] = element;
                  }}
                  className="choice-menu-option"
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  disabled={option.disabled}
                  tabIndex={index === activeIndex ? 0 : -1}
                  onClick={() => {
                    onChange(option.value);
                    closeMenu(true);
                  }}
                  onKeyDown={(event) => handleOptionKey(event, index)}
                >
                  <span>{option.label}</span>
                  {option.value === value ? (
                    <span aria-hidden="true">✓</span>
                  ) : null}
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
