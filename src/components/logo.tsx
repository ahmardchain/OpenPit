/** OpenPit mark: an amber arena ring with the bell-notch on top and the long/fade fork inside. Flat, single accent. */
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden>
      <rect width="64" height="64" rx="16" fill="var(--accent)" />
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
    <span className={`display inline-flex items-center gap-2 text-lg font-bold ${className ?? ""}`}>
      <LogoMark />
      <span>
        Open<span className="text-accent">Pit</span>
      </span>
    </span>
  );
}
