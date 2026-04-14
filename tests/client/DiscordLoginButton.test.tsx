/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { signInMock } = vi.hoisted(() => ({
  signInMock: vi.fn(),
}));

vi.mock('next-auth/react', () => ({
  signIn: signInMock,
}));

import { DiscordLoginButton } from '@/app/(public)/auth/login/DiscordLoginButton';

describe('DiscordLoginButton', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('starts the Discord provider flow with the requested callback path', async () => {
    signInMock.mockResolvedValue(undefined);

    render(
      <DiscordLoginButton
        callbackUrl="/hall/profile/"
        fallbackHref="/api/auth/signin?callbackUrl=%2Fhall%2Fprofile%2F"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Continue with Discord' }));

    await waitFor(() => {
      expect(signInMock).toHaveBeenCalledWith('discord', { callbackUrl: '/hall/profile/' });
    });

    expect(screen.getByRole('button', { name: 'Connecting to Discord...' })).not.toBeNull();
  });

  it('shows the fallback hint when the direct Discord handoff throws', async () => {
    signInMock.mockRejectedValue(new Error('blocked'));

    render(
      <DiscordLoginButton
        callbackUrl="/runelite/link?code=TEST"
        fallbackHref="/api/auth/signin?callbackUrl=%2Frunelite%2Flink%3Fcode%3DTEST"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Continue with Discord' }));

    expect(await screen.findByText(/Discord sign-in did not open correctly\./)).not.toBeNull();
    expect(screen.getByRole('link', { name: 'fallback sign-in page' })).not.toBeNull();
  });
});
