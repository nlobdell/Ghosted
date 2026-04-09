'use client';

/* eslint-disable @next/next/no-img-element -- Companion preview assets are generated at runtime and not routed through next/image yet. */
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AnimatedCompanionStage } from '@/components/companion/AnimatedCompanionStage';
import {
  AppGrid,
  Banner,
  EmptyState,
  Panel,
  SectionHeading,
  StatStrip,
} from '@/components/ui/AppUI';
import { formatPoints, getJSON } from '@/lib/api';
import type {
  CompanionData,
  CompanionItem,
  CompanionSlotKey,
  ShellData,
} from '@/lib/types';
import styles from './page.module.css';

type CompanionMutationResponse = {
  ok: boolean;
  message?: string;
  companion: CompanionData;
};

const SLOT_ORDER: CompanionSlotKey[] = ['hat', 'face', 'neck', 'body'];

function toGhostlingCopy(text: string) {
  return text.replaceAll('Companion', 'Ghostling').replaceAll('companion', 'Ghostling');
}

function buildAbsoluteUrl(path: string) {
  if (typeof window === 'undefined') return path;
  return `${window.location.origin}${path}`;
}

function slugifyFilename(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'ghostling';
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function loadImageFromBlob(blob: Blob) {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = new window.Image();
    image.decoding = 'async';
    image.src = objectUrl;
    await image.decode();
    return image;
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
}

export default function CompanionPage() {
  const [companion, setCompanion] = useState<CompanionData | null>(null);
  const [shell, setShell] = useState<ShellData | null>(null);
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; variant: 'info' | 'error' } | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [companionData, shellData] = await Promise.all([
          getJSON<CompanionData>('/api/companion').catch((nextError: Error) => {
            if (
              nextError.message.includes('401')
              || nextError.message.toLowerCase().includes('unauthorized')
              || nextError.message.toLowerCase().includes('please sign in')
            ) {
              setAuthed(false);
              return null;
            }
            throw nextError;
          }),
          getJSON<ShellData>(`/api/site-shell?next=${encodeURIComponent('/hall/ghostling/')}`).catch(() => null),
        ]);

        if (companionData) setCompanion(companionData);
        if (shellData) setShell(shellData);
      } catch (nextError) {
        setError(nextError instanceof Error ? toGhostlingCopy(nextError.message) : 'Failed to load the Ghostling studio.');
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const groupedItems = useMemo(() => {
    const groups = new Map<CompanionSlotKey, CompanionItem[]>();
    SLOT_ORDER.forEach((slot) => groups.set(slot, []));
    for (const item of companion?.items ?? []) {
      groups.get(item.slot)?.push(item);
    }
    return groups;
  }, [companion?.items]);
  function applyMutation(result: CompanionMutationResponse) {
    setCompanion(result.companion);
    setMessage({ text: toGhostlingCopy(result.message ?? 'Ghostling updated.'), variant: 'info' });
  }

  async function handlePurchase(slug: string) {
    setPendingKey(`buy:${slug}`);
    setMessage(null);
    try {
      const result = await getJSON<CompanionMutationResponse>('/api/companion/purchase', {
        method: 'POST',
        body: JSON.stringify({ slug }),
      });
      applyMutation(result);
    } catch (nextError) {
      setMessage({ text: nextError instanceof Error ? toGhostlingCopy(nextError.message) : 'Unable to unlock Ghostling cosmetic.', variant: 'error' });
    } finally {
      setPendingKey(null);
    }
  }

  async function handleEquip(slot: CompanionSlotKey, slug: string) {
    setPendingKey(`equip:${slot}`);
    setMessage(null);
    try {
      const result = await getJSON<CompanionMutationResponse>('/api/companion/equip', {
        method: 'POST',
        body: JSON.stringify({ slot, slug }),
      });
      applyMutation(result);
    } catch (nextError) {
      setMessage({ text: nextError instanceof Error ? toGhostlingCopy(nextError.message) : 'Unable to update Ghostling.', variant: 'error' });
    } finally {
      setPendingKey(null);
    }
  }

  async function copyUrl(path: string, label: string) {
    try {
      await navigator.clipboard.writeText(buildAbsoluteUrl(path));
      setMessage({ text: `${label} copied to clipboard.`, variant: 'info' });
    } catch {
      setMessage({ text: `Unable to copy ${label.toLowerCase()} right now.`, variant: 'error' });
    }
  }

  async function downloadSvg(path: string, filename: string, label: string) {
    try {
      const response = await fetch(path, { headers: { Accept: 'image/svg+xml,*/*' } });
      if (!response.ok) throw new Error(`Request failed: ${path}`);
      const blob = await response.blob();
      triggerDownload(blob, filename);
      setMessage({ text: `${label} downloaded.`, variant: 'info' });
    } catch (nextError) {
      setMessage({ text: nextError instanceof Error ? nextError.message : `Unable to download ${label.toLowerCase()}.`, variant: 'error' });
    }
  }

  async function downloadPng(path: string, filename: string, label: string, width: number, height: number) {
    try {
      const response = await fetch(path, { headers: { Accept: 'image/svg+xml,*/*' } });
      if (!response.ok) throw new Error(`Request failed: ${path}`);
      const blob = await response.blob();
      const image = await loadImageFromBlob(blob);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas export is unavailable in this browser.');
      context.clearRect(0, 0, width, height);
      context.imageSmoothingEnabled = false;
      context.drawImage(image, 0, 0, width, height);
      const pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!pngBlob) throw new Error('PNG export failed.');
      triggerDownload(pngBlob, filename);
      setMessage({ text: `${label} downloaded.`, variant: 'info' });
    } catch (nextError) {
      setMessage({ text: nextError instanceof Error ? nextError.message : `Unable to download ${label.toLowerCase()}.`, variant: 'error' });
    }
  }

  return (
    <main id="main-content" className={`page-shell workspace-page ${styles.page}`}>
      {error ? <Banner message={error} variant="error" /> : null}
      {message ? <Banner message={message.text} variant={message.variant} /> : null}

      {loading ? (
        <Banner message="Loading Ghostling studio..." variant="info" />
      ) : !authed ? (
        <EmptyState
          message="Sign in with Discord to unlock Ghostling cosmetics and save a loadout."
          action={<Link href={shell?.auth.loginHref ?? '/auth/login?next=%2Fhall%2Fghostling%2F'} className="button button--secondary button--small">Sign in with Discord</Link>}
        />
      ) : companion ? (
        <>
          <section className={styles.hero}>
            <div className={styles.heroCopy}>
              <p className="kicker">Ghostling studio</p>
              <h1 className={styles.heroTitle}>Set the live Ghostling that represents you in the Hall.</h1>
              <p className={styles.heroText}>
                Pick the Ghostling that carries your name in the Hall. Equip your loadout first, then download share files once it looks right.
              </p>
              <div className={styles.heroActions}>
                <a href="#ghostling-studio" className="button button--small">Equip your loadout</a>
                <a href="#ghostling-library" className="button button--secondary button--small">Browse unlocks</a>
              </div>
            </div>
          </section>

          <section id="ghostling-studio" className={styles.studioSection}>
            <AppGrid className={styles.studioGrid}>
              <Panel
                className={styles.studioPanel}
                tier="primary"
                title="Equip your live Ghostling"
                body={(
                  <div className={styles.studioBody}>
                    <div className={styles.previewColumn}>
                      <div className={styles.previewIntro}>
                        <p className="kicker">Live Ghostling</p>
                        <div className={styles.previewHeading}>
                          <strong>{companion.user.displayName}&apos;s equipped loadout</strong>
                          <span>Your full-size preview updates as soon as you equip a change.</span>
                        </div>
                      </div>
                      <div className={styles.previewSurface}>
                        <AnimatedCompanionStage
                          manifest={companion.renderManifest}
                          fallbackSrc={companion.animatedRenderUrl}
                          alt={`${companion.user.displayName}'s Ghostling`}
                          className={styles.previewImage}
                          targetSize={352}
                        />
                      </div>
                    </div>
                    <aside className={styles.controlRail}>
                      <div className={styles.controlIntro}>
                        <strong>Loadout controls</strong>
                        <span>Pick from your owned cosmetics for each slot and lock in the loadout you want the Hall to show.</span>
                      </div>
                      <div className={styles.slotList}>
                        {companion.slots.map((slot) => (
                          <label key={slot.key} className={styles.slotField}>
                            <span>{slot.label}</span>
                            <select
                              className="input-base"
                              value={slot.equippedSlug ?? ''}
                              disabled={pendingKey === `equip:${slot.key}`}
                              onChange={(event) => void handleEquip(slot.key, event.target.value)}
                            >
                              <option value="">Nothing equipped</option>
                              {slot.ownedOptions.map((option) => (
                                <option key={option.slug} value={option.slug}>
                                  {option.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        ))}
                      </div>
                    </aside>
                  </div>
                )}
              />

              <Panel
                className={styles.sharePanel}
                tier="meta"
                title="Download and share files"
                body={(
                  <div className={styles.shareBody}>
                    <p className={styles.sharePrelude}>
                      Download these once your Ghostling looks the way you want it to.
                    </p>
                    <div className={styles.cardPreview}>
                      <img src={companion.share.animatedDiscordEmbedUrl} alt="Animated Ghostling Discord share card" className={styles.cardImage} />
                    </div>
                    <div className={styles.shareList}>
                      {[
                        {
                          label: 'Avatar PNG',
                          detail: '512 x 512 transparent output for profile images and overlays.',
                          path: companion.share.avatarUrl,
                          primaryLabel: 'Download PNG',
                          primaryAction: () => downloadPng(companion.share.avatarUrl, `${slugifyFilename(companion.user.displayName)}-ghostling-avatar.png`, 'Avatar PNG', 512, 512),
                        },
                        {
                          label: 'Avatar SVG',
                          detail: 'Animated vector source for sharp exports and future reuse.',
                          path: companion.share.animatedAvatarUrl,
                          primaryLabel: 'Download SVG',
                          primaryAction: () => downloadSvg(companion.share.animatedAvatarUrl, `${slugifyFilename(companion.user.displayName)}-ghostling-avatar-animated.svg`, 'Animated avatar SVG'),
                        },
                        {
                          label: 'Discord card PNG',
                          detail: '1200 x 630 Discord-ready card with WOM rank and tracked stats when linked.',
                          path: companion.share.discordCardUrl,
                          primaryLabel: 'Download PNG',
                          copyLabel: 'Discord card export URL',
                          primaryAction: () => downloadPng(companion.share.discordCardUrl, `${slugifyFilename(companion.user.displayName)}-ghostling-discord-card.png`, 'Discord card PNG', 1200, 630),
                        },
                        {
                          label: 'Animated Discord card SVG',
                          detail: 'Motion-preserving Discord export URL for the animated Ghostling card.',
                          path: companion.share.animatedDiscordCardUrl,
                          primaryLabel: 'Download SVG',
                          copyLabel: 'Animated Discord export URL',
                          primaryAction: () => downloadSvg(companion.share.animatedDiscordCardUrl, `${slugifyFilename(companion.user.displayName)}-ghostling-discord-card-animated.svg`, 'Animated Discord card SVG'),
                        },
                        {
                          label: 'Discord embed GIF',
                          detail: 'Paste this direct GIF URL into Discord to auto-embed the animated Ghostling card.',
                          path: companion.share.animatedDiscordEmbedUrl,
                          primaryLabel: 'Download GIF',
                          copyLabel: 'Discord embed GIF URL',
                          primaryAction: async () => {
                            try {
                              const response = await fetch(companion.share.animatedDiscordEmbedUrl, { headers: { Accept: 'image/gif,*/*' } });
                              if (!response.ok) throw new Error(`Request failed: ${companion.share.animatedDiscordEmbedUrl}`);
                              const blob = await response.blob();
                              triggerDownload(blob, `${slugifyFilename(companion.user.displayName)}-ghostling-discord-embed.gif`);
                              setMessage({ text: 'Discord embed GIF downloaded.', variant: 'info' });
                            } catch (nextError) {
                              setMessage({ text: nextError instanceof Error ? nextError.message : 'Unable to download Discord embed GIF.', variant: 'error' });
                            }
                          },
                        },
                      ].map((item) => (
                        <div key={item.label} className={styles.shareRow}>
                          <div>
                            <strong>{item.label}</strong>
                            <span>{item.detail}</span>
                          </div>
                          <div className={styles.shareActions}>
                            <button
                              type="button"
                              className="button button--secondary button--small"
                              onClick={() => void item.primaryAction()}
                            >
                              {item.primaryLabel}
                            </button>
                            <button
                              type="button"
                              className="button button--secondary button--small"
                              onClick={() => copyUrl(item.path, item.copyLabel ?? `${item.label} URL`)}
                            >
                              {item.copyLabel ? 'Copy export URL' : 'Copy source URL'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              />
            </AppGrid>
          </section>

          <StatStrip
            className={styles.scoreboard}
            leadIndex={0}
            stats={[
              { label: 'Balance', value: formatPoints(companion.balance), href: '/hall/rewards/' },
              { label: 'Unlocked', value: String(companion.ownedCount) },
              { label: 'Equipped slots', value: `${companion.equippedCount}/4` },
              { label: 'Export tools', value: 'Ready' },
            ]}
          />

          <section id="ghostling-library" className={styles.shopSection}>
              <SectionHeading
                eyebrow="Unlock library"
                title="Ghostling cosmetics"
                copy="Unlock once, then come back and equip the pieces you want on your live Ghostling."
              />
            <div className={styles.slotGroups}>
              {SLOT_ORDER.map((slot) => {
                const items = groupedItems.get(slot) ?? [];
                if (!items.length) return null;

                return (
                  <section key={slot} className={styles.slotGroup}>
                    <div className={styles.slotHeading}>
                      <h3>{items[0]?.slotLabel ?? slot}</h3>
                      <span>{items.filter((item) => item.owned).length} unlocked</span>
                    </div>
                    <div className={styles.itemGrid}>
                      {items.map((item) => {
                        const isBuying = pendingKey === `buy:${item.slug}`;

                        return (
                          <article key={item.slug} className={styles.itemCard}>
                            <div className={styles.itemPreview}>
                              <img src={item.previewUrl} alt={item.name} className={styles.itemPreviewImage} />
                            </div>
                            <div className={styles.itemCopy}>
                          <div className={styles.itemHeader}>
                                <strong>{item.name}</strong>
                                <div className={styles.itemChips}>
                                  <span className="app-chip">{item.rarity}</span>
                                  {!item.active ? <span className="app-chip">Hidden</span> : null}
                                </div>
                              </div>
                              <p>{item.description}</p>
                              <div className={styles.itemFooter}>
                                <span>{formatPoints(item.cost)}</span>
                                {item.owned ? (
                                  item.equipped ? (
                                    <span className={styles.itemState}>Equipped</span>
                                  ) : (
                                    <button
                                      type="button"
                                      className="button button--secondary button--small"
                                      onClick={() => void handleEquip(item.slot, item.slug)}
                                      disabled={pendingKey === `equip:${item.slot}`}
                                    >
                                      Equip
                                    </button>
                                  )
                                ) : (
                                  <button
                                    type="button"
                                    className="button button--secondary button--small"
                                    onClick={() => void handlePurchase(item.slug)}
                                    disabled={isBuying}
                                  >
                                    {isBuying ? 'Unlocking...' : 'Unlock'}
                                  </button>
                                )}
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          </section>

        </>
      ) : (
        <EmptyState message="Could not load the Ghostling studio." />
      )}
    </main>
  );
}
