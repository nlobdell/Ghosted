'use client';

/* eslint-disable @next/next/no-img-element -- Companion preview assets are generated at runtime and not routed through next/image yet. */
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  AppContext,
  AppGrid,
  Banner,
  EmptyState,
  Panel,
  SectionHeading,
  StatStrip,
} from '@/components/ui/AppUI';
import { AnimatedCompanionStage } from '@/components/companion/AnimatedCompanionStage';
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

  return (
    <main id="main-content" className={`page-shell workspace-page ${styles.page}`}>
      <AppContext
        breadcrumbs={[{ label: 'Ghosted', href: '/' }, { label: 'Hall', href: '/hall/' }, { label: 'Ghostling' }]}
        title="Ghostling studio"
        summary="Equip the Ghostling that now anchors your Ghosted identity, spend from the same shared points loop, and export it anywhere you want the hall to follow."
        actions={(
          <>
            {shell?.user?.isAdmin ? <Link href="/admin/ghostling/" className="button button--secondary button--small">Ghostling admin</Link> : null}
            <Link href="/hall/rewards/" className="button button--secondary button--small">Rewards</Link>
            <Link href="/hall/profile/" className="button button--secondary button--small">Profile</Link>
          </>
        )}
      />

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
              <p className="kicker">Hall center</p>
              <h2 className={styles.heroTitle}>Your Ghostling is now the front door to Ghosted.</h2>
              <p className={styles.heroText}>
                Equip the live loadout, unlock cosmetics with the points you already earn, and keep a share-ready version of your Ghostling ready for Discord, bios, and anywhere else the hall shows up.
              </p>
              <div className="app-inline-actions">
                <button className="button button--secondary button--small" type="button" onClick={() => copyUrl(companion.share.avatarUrl, 'Avatar URL')}>
                  Copy avatar URL
                </button>
                <button className="button button--secondary button--small" type="button" onClick={() => copyUrl(companion.share.animatedAvatarUrl, 'Animated avatar URL')}>
                  Copy animated avatar
                </button>
                <button className="button button--secondary button--small" type="button" onClick={() => copyUrl(companion.share.cardUrl, 'Share card URL')}>
                  Copy share card
                </button>
                <button className="button button--secondary button--small" type="button" onClick={() => copyUrl(companion.share.animatedCardUrl, 'Animated share card URL')}>
                  Copy animated card
                </button>
                {companion.baseAssetUrl ? (
                  <a href={companion.baseAssetUrl} target="_blank" rel="noreferrer" className="button button--secondary button--small">
                    Open base asset
                  </a>
                ) : null}
              </div>
            </div>
            <div className={styles.heroStage}>
              <div className={styles.avatarFrame}>
                <AnimatedCompanionStage
                  manifest={companion.renderManifest}
                  fallbackSrc={companion.renderUrl}
                  alt={`${companion.user.displayName}'s Ghostling`}
                  className={styles.avatarImage}
                />
              </div>
              <div className={styles.stageMeta}>
                <strong>{companion.user.displayName}</strong>
                <span>@{companion.user.username}</span>
              </div>
            </div>
          </section>

          <StatStrip
            className={styles.scoreboard}
            leadIndex={0}
            stats={[
              { label: 'Balance', value: formatPoints(companion.balance), href: '/hall/rewards/' },
              { label: 'Unlocked', value: String(companion.ownedCount) },
              { label: 'Equipped slots', value: `${companion.equippedCount}/4` },
              { label: 'Share ready', value: 'Yes' },
            ]}
          />

          <AppGrid>
            <Panel
              className={styles.studioPanel}
              tier="primary"
              eyebrow="Loadout"
              title="Equip your current Ghostling"
              body={(
                <div className={styles.studioBody}>
                  <div className={styles.previewSurface}>
                    <AnimatedCompanionStage
                      manifest={companion.renderManifest}
                      fallbackSrc={companion.renderUrl}
                      alt="Equipped Ghostling preview"
                      className={styles.previewImage}
                    />
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
                </div>
              )}
            />

            <Panel
              className={styles.sharePanel}
              tier="meta"
              eyebrow="Share"
              title="Export for Discord and beyond"
              body={(
                <div className={styles.shareBody}>
                  <div className={styles.cardPreview}>
                    <img src={companion.cardUrl} alt="Ghostling share card" className={styles.cardImage} />
                  </div>
                  <div className={styles.shareList}>
                    {[
                      ['Transparent avatar', companion.share.avatarUrl, 'Copy avatar URL'],
                      ['Animated avatar (SVG)', companion.share.animatedAvatarUrl, 'Copy animated avatar URL'],
                      ['Discord share card', companion.share.cardUrl, 'Copy card URL'],
                      ['Animated share card (SVG)', companion.share.animatedCardUrl, 'Copy animated card URL'],
                    ].map(([label, path, actionLabel]) => (
                      <div key={label} className={styles.shareRow}>
                        <div>
                          <strong>{label}</strong>
                          <span>{path}</span>
                        </div>
                        <button
                          type="button"
                          className="button button--secondary button--small"
                          onClick={() => copyUrl(path, label)}
                        >
                          {actionLabel}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            />
          </AppGrid>

          <section className={styles.shopSection}>
              <SectionHeading
                eyebrow="Unlockables"
                title="Ghostling cosmetics"
                copy="Unlock once, equip whenever you want. Every cosmetic pulls from the same Ghosted points balance you already use for rewards, drops, and the rest of the hall."
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
