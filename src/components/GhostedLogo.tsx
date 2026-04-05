import Image from 'next/image';

type GhostedLogoProps = {
  className?: string;
  src?: string;
  sizes?: string;
  priority?: boolean;
  decorative?: boolean;
  unoptimized?: boolean;
};

export function GhostedLogo({
  className,
  src = '/brand/ghosted-clan-logo.png',
  sizes = '48px',
  priority = false,
  decorative = false,
  unoptimized = false,
}: GhostedLogoProps) {
  const resolvedClassName = ['ghosted-logo', className].filter(Boolean).join(' ');

  return (
    <span className={resolvedClassName} aria-hidden={decorative || undefined}>
      <Image
        src={src}
        alt={decorative ? '' : 'Ghosted clan logo'}
        fill
        sizes={sizes}
        priority={priority}
        unoptimized={unoptimized}
      />
    </span>
  );
}
