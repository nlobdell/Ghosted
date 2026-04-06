'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import styles from '@/app/roster/page.module.css';

type RosterSortKey = 'rank' | 'xp' | 'name' | 'clan-rank' | 'build' | 'status';
type SortDirection = 'asc' | 'desc';

type Props = {
  sortKey: RosterSortKey;
  direction: SortDirection;
};

const SORT_OPTIONS: Array<{ value: RosterSortKey; label: string }> = [
  { value: 'rank', label: 'Roster order' },
  { value: 'xp', label: 'Overall XP' },
  { value: 'name', label: 'Name' },
  { value: 'clan-rank', label: 'Clan rank' },
  { value: 'build', label: 'Build' },
  { value: 'status', label: 'Status' },
];

const DIRECTION_OPTIONS: Array<{ value: SortDirection; label: string }> = [
  { value: 'asc', label: 'Ascending' },
  { value: 'desc', label: 'Descending' },
];

function defaultDirectionForSort(sort: RosterSortKey): SortDirection {
  return sort === 'rank' ? 'desc' : 'asc';
}

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
    if (nextDirection !== defaultDirectionForSort(nextSort)) params.set('dir', nextDirection);
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
                : defaultDirectionForSort(nextSort);
              setSelectedSort(nextSort);
              setSelectedDirection(nextDirection);
              applySelection(nextSort, nextDirection);
            }}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
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
            {DIRECTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
