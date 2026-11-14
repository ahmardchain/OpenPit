/** OpenPit mark: a blue tile with an arena ring, the bell notch on top and the long/fade fork inside. */
export function LogoMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden>
      <rect width="64" height="64" rx="14" fill="var(--accent)" />
      <circle cx="32" cy="34" r="17" fill="none" stroke="var(--accent-ink)" strokeWidth="5" />
      <rect x="28.5" y="8" width="7" height="12" rx="2" fill="var(--accent-ink)" />
      <path d="M32 24 L32 44" stroke="var(--accent-ink)" strokeWidth="5" strokeLinecap="round" />
      <path d="M23 40 L32 24" stroke="var(--accent-ink)" strokeWidth="5" strokeLinecap="round" />
      <path d="M41 40 L32 24" stroke="var(--accent-ink)" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 text-base font-semibold ${className ?? ""}`}>
      <LogoMark />
      OpenPit
    </span>
  );
}
