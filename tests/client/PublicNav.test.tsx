/** @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const pathnameMock = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameMock(),
}));

import { PublicNav } from '@/components/nav/PublicNav';

describe('PublicNav', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('uses the same standard public nav treatment on the homepage', () => {
    pathnameMock.mockReturnValue('/');

    render(<PublicNav hallHref="/hall/" />);

    const header = screen.getByRole('banner');
    expect(header.hasAttribute('data-home-hero')).toBe(false);
    expect(document.querySelector('.nav-shell--hero')).toBeNull();
  });

  it('keeps the standard public nav treatment on non-home routes', () => {
    pathnameMock.mockReturnValue('/news/');

    render(<PublicNav hallHref="/hall/" />);

    const header = screen.getByRole('banner');
    expect(header.hasAttribute('data-home-hero')).toBe(false);
    expect(document.querySelector('.nav-shell--hero')).toBeNull();
    expect(screen.getByRole('link', { name: 'Dispatches' }).getAttribute('aria-current')).toBe('page');
  });
});
