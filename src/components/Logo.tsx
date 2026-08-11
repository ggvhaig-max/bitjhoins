type LogoSize = 'sm' | 'md' | 'lg';

type LogoProps = {
  size?: LogoSize;
  onLight?: boolean;
};

const sizes: Record<LogoSize, { mark: string; word: string; gap: string }> = {
  sm: { mark: 'h-8 w-8', word: 'text-[1.05rem]', gap: 'gap-2' },
  md: { mark: 'h-11 w-11', word: 'text-[1.45rem]', gap: 'gap-2.5' },
  lg: { mark: 'h-16 w-16', word: 'text-[2.35rem]', gap: 'gap-3' },
};

export function Logo({ size = 'md', onLight = false }: LogoProps) {
  const dimensions = sizes[size];
  const jhoinsColor = onLight ? 'text-navy-900' : 'text-white';

  return (
    <div className={`flex items-center ${dimensions.gap}`} aria-label="BitJhoins">
      <svg viewBox="0 0 100 100" className={`${dimensions.mark} shrink-0`} role="img" aria-hidden="true">
        <circle cx="50" cy="50" r="44" fill={onLight ? '#00145c' : '#ffffff'} stroke="#00145c" strokeWidth="5" />
        <path d="M39 24v52M39 26h22c10 0 14 5 14 12s-4 11-12 12H39m0 0h24c9 0 14 5 14 12 0 9-6 14-16 14H39" fill="none" stroke="#ffc024" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M62 25v48c0 8-4 13-13 13" fill="none" stroke={onLight ? '#ffffff' : '#00145c'} strokeWidth="8" strokeLinecap="round" />
      </svg>
      <span className={`font-display font-extrabold uppercase leading-none tracking-[-0.07em] ${dimensions.word}`}>
        <span className="text-gold-400">BIT</span><span className={jhoinsColor}>JHOINS</span>
      </span>
    </div>
  );
}
