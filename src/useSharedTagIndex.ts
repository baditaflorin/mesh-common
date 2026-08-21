import { useMemo, useState } from "react";

export type SharedTagIndexOptions<T> = { getTags: (item: T) => readonly string[] };
export type SharedTagIndex<T> = {
  tags: string[];
  counts: Record<string, number>;
  selected: string[];
  results: T[];
  toggle: (tag: string) => void;
  setFilter: (tags: readonly string[]) => void;
  clear: () => void;
  filter: (tags: readonly string[]) => T[];
};

/** Local tag aggregation and AND filtering for a replicated collection. */
export function useSharedTagIndex<T>(items: readonly T[], options: SharedTagIndexOptions<T>): SharedTagIndex<T> {
  const [selected, setSelected] = useState<string[]>([]);
  const normalizedTags = (item: T) => [...new Set(options.getTags(item).map((tag) => tag.trim().toLocaleLowerCase()).filter(Boolean))];
  const counts = useMemo(() => {
    const next: Record<string, number> = {};
    items.forEach((item) => normalizedTags(item).forEach((tag) => { next[tag] = (next[tag] ?? 0) + 1; }));
    return next;
  }, [items, options]);
  const filter = (tags: readonly string[]) => {
    const wanted = [...new Set(tags.map((tag) => tag.trim().toLocaleLowerCase()).filter(Boolean))];
    return wanted.length === 0 ? [...items] : items.filter((item) => {
      const itemTags = normalizedTags(item);
      return wanted.every((tag) => itemTags.includes(tag));
    });
  };
  return {
    tags: Object.keys(counts).sort((a, b) => a.localeCompare(b)),
    counts,
    selected,
    results: filter(selected),
    toggle: (tag) => setSelected((current) => current.includes(tag) ? current.filter((value) => value !== tag) : [...current, tag]),
    setFilter: (tags) => setSelected([...new Set(tags.map((tag) => tag.trim().toLocaleLowerCase()).filter(Boolean))]),
    clear: () => setSelected([]),
    filter,
  };
}
