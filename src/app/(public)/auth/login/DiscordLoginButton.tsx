'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import styles from './page.module.css';

interface DiscordLoginButtonProps {
  callbackUrl: string;
  fallbackHref: string;
}

export function DiscordLoginButton({ callbackUrl, fallbackHref }: DiscordLoginButtonProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasError, setHasError] = useState(false);

  async function handleClick() {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setHasError(false);

    try {
      await signIn('discord', { callbackUrl });
    } catch {
      setIsSubmitting(false);
      setHasError(true);
    }
  }

  return (
    <div className={styles.ctaStack}>
      <button
        type="button"
        className="button"
        onClick={handleClick}
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Connecting to Discord...' : 'Continue with Discord'}
      </button>
      <p className={styles.ctaHint} aria-live="polite">
        {hasError ? (
          <>
            Discord sign-in did not open correctly. Use the{' '}
            <a href={fallbackHref}>fallback sign-in page</a>.
          </>
        ) : (
          <>
            Ghosted opens Discord next and returns you here after approval. If your browser blocks the
            handoff, use the <a href={fallbackHref}>fallback sign-in page</a>.
          </>
        )}
      </p>
      <noscript>
        <a className="button" href={fallbackHref}>Continue with Discord</a>
      </noscript>
    </div>
  );
}
