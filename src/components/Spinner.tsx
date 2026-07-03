type SpinnerProps = {
  size?: number;
  className?: string;
  label?: string;
};

export function Spinner({ size = 20, className = "", label }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label ?? "Loading"}
      className={`inline-block shrink-0 animate-spin rounded-full border-2 border-ae-border border-t-ae-accent ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
