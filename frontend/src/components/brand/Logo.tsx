import { cn } from '@/utils/cn';

/** Bloom mark: a five-petal flower with a sunny centre. Colours are fixed brand colours. */
export function BloomMark({ className, title = 'Bloom' }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} role="img" aria-label={title}>
      {[0, 72, 144, 216, 288].map((deg, i) => (
        <ellipse key={deg} cx="16" cy="8.8" rx="4.8" ry="6.6" transform={`rotate(${deg} 16 16)`} fill={i % 2 === 0 ? '#F0509A' : '#F78FBF'} />
      ))}
      <circle cx="16" cy="16" r="4.6" fill="#FFD24D" />
      <circle cx="16" cy="16" r="1.7" fill="#F5B700" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <BloomMark className="logo-flower h-9 w-9" />
      <span className="text-[24px] font-extrabold leading-none tracking-tight text-fg">bloom</span>
    </span>
  );
}
