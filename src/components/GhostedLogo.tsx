/* eslint-disable @next/next/no-img-element -- Production deploys do not provide a writable Next image cache directory. */
type GhostedLogoProps = {
  className?: string;
  src?: string;
  sizes?: string;
  priority?: boolean;
  decorative?: boolean;
  unoptimized?: boolean;
};

export function GhostedLogo(props: GhostedLogoProps) {
  const {
    className,
    src = '/brand/ghosted-clan-logo.png',
    priority = false,
    decorative = false,
  } = props;
  const resolvedClassName = ['ghosted-logo', className].filter(Boolean).join(' ');

  return (
    <span className={resolvedClassName} aria-hidden={decorative || undefined}>
      <img
        src={src}
        alt={decorative ? '' : 'Ghosted clan logo'}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        draggable={false}
        width={96}
        height={96}
        style={{ width: '100%', height: '100%' }}
      />
    </span>
  );
}
