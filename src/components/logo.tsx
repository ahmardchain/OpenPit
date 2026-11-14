/** OpenPit mark: a blue tile with an arena ring, the bell notch on top and the long/fade fork inside. */
export function LogoMark({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden>
      <rect width="64" height="64" rx="10" fill="#1F5EFF" />
      <circle cx="32" cy="34" r="17" fill="none" stroke="#fff" strokeWidth="5" />
      <rect x="28.5" y="8" width="7" height="12" rx="2" fill="#fff" />
      <path d="M32 24 L32 44" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
      <path d="M23 40 L32 24" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
      <path d="M41 40 L32 24" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 text-[15px] font-semibold tracking-[-0.02em] ${className ?? ""}`}>
      <LogoMark />
      OpenPit
    </span>
  );
}
