import type { KeyframeEasing } from '@led-studio/project-format';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';

const easingOptions = [
  { label: 'Linear', value: 'linear' },
  { label: 'Ease in', value: 'ease-in' },
  { label: 'Ease out', value: 'ease-out' },
  { label: 'In / out', value: 'ease-in-out' },
] as const;

interface KeyframeEasingControlProps {
  disabled?: boolean;
  value: KeyframeEasing | null;
  onChange: (easing: KeyframeEasing) => void;
}

export function KeyframeEasingControl({
  disabled,
  onChange,
  value,
}: KeyframeEasingControlProps) {
  return (
    <SegmentedControl
      ariaLabel="Transition easing"
      disabled={disabled}
      options={easingOptions}
      value={value}
      onChange={onChange}
    />
  );
}
