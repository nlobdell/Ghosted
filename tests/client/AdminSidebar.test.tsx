/** @vitest-environment jsdom */

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const pathnameMock = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameMock(),
}));

import { AdminSidebar } from '@/components/nav/AdminSidebar';

describe('AdminSidebar', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('marks only the specialist route as current when inside a subsection', () => {
    pathnameMock.mockReturnValue('/admin/content/');

    render(<AdminSidebar />);

    const nav = screen.getByLabelText('Admin navigation');

    expect(screen.getByText('Operator nav')).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Ops' })).not.toBeNull();
    expect(within(nav).getAllByRole('link')).toHaveLength(6);
    expect(screen.getByText('HUB')).not.toBeNull();
    expect(screen.getByText('PUB')).not.toBeNull();
    expect(screen.getByText('WRL')).not.toBeNull();
    expect(screen.getByRole('link', { name: /Content/i }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: /Overview/i }).getAttribute('aria-current')).toBeNull();
    expect(screen.getByRole('link', { name: /Systems/i }).getAttribute('aria-current')).toBeNull();
  });
});
