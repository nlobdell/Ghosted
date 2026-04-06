'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import styles from '@/app/roster/page.module.css';
import {
  defaultDirectionForRosterSort,
  type RosterSortKey,
  ROSTER_DIRECTION_OPTIONS,
  type SortDirection,
  ROSTER_SORT_LABELS,
  ROSTER_SORT_OPTIONS,
} from '@/lib/roster-sort';

type Props = {
  sortKey: RosterSortKey;
  direction: SortDirection;
};

export function RosterSortForm({ sortKey, direction }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [selectedSort, setSelectedSort] = useState<RosterSortKey>(sortKey);
  const [selectedDirection, setSelectedDirection] = useState<SortDirection>(direction);
  const [isPending, startTransition] = useTransition();
  const directionWasManuallyChanged = useRef(false);

  function applySelection(nextSort: RosterSortKey, nextDirection: SortDirection) {
    const params = new URLSearchParams();
    if (nextSort !== 'rank') params.set('sort', nextSort);
    if (nextDirection !== defaultDirectionForRosterSort(nextSort)) params.set('dir', nextDirection);
    const query = params.toString();
    const href = query ? `${pathname}?${query}` : pathname;
    startTransition(() => {
      router.replace(href, { scroll: false });
    });
  }

  return (
    <div className={styles.sortForm}>
      <div className={styles.sortControls}>
        <label className={styles.sortField}>
          <span>Sort</span>
          <select
            name="sort"
            className="input-base"
            value={selectedSort}
            disabled={isPending}
            onChange={(event) => {
              const nextSort = event.target.value as RosterSortKey;
              const nextDirection = directionWasManuallyChanged.current
                ? selectedDirection
                : defaultDirectionForRosterSort(nextSort);
              setSelectedSort(nextSort);
              setSelectedDirection(nextDirection);
              applySelection(nextSort, nextDirection);
            }}
          >
            {ROSTER_SORT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {ROSTER_SORT_LABELS[option]}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.sortField}>
          <span>Direction</span>
          <select
            name="dir"
            className="input-base"
            value={selectedDirection}
            disabled={isPending}
            onChange={(event) => {
              const nextDirection = event.target.value as SortDirection;
              directionWasManuallyChanged.current = true;
              setSelectedDirection(nextDirection);
              applySelection(selectedSort, nextDirection);
            }}
          >
            {ROSTER_DIRECTION_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option === 'asc' ? 'Ascending' : 'Descending'}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
