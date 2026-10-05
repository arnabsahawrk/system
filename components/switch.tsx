/** Track: 48x28. Ball: 20x20, 4px margin on every side in both states
 * (4 + 20 + 4 = 28 vertically; checked sits at 48 - 20 - 4 = 24px from the
 * left, i.e. 4px from the right — symmetric). overflow-hidden on the track
 * as a second line of defense so the ball can never visually escape it. */
export function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  /** Read out by screen readers; the visible text sits beside the switch. */
  label?: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      disabled={disabled}
      className={`relative h-7 w-12 shrink-0 overflow-hidden rounded-full transition-colors duration-200 disabled:opacity-40 ${
        checked ? "bg-accent" : "bg-surface-2 border border-border"
      }`}
    >
      <span
        className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-ink transition-transform duration-200 ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}
