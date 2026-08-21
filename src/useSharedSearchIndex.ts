import { useMemo, useState } from "react";

export type SharedSearchIndexOptions<T> = { getText: (item: T) => string; initialQuery?: string };
export type SharedSearchIndex<T> = {
  query: string;
  results: T[];
  setQuery: (query: string) => void;
  rebuild: () => void;
};

/** Local, derived, case-insensitive search over a replicated collection. */
export function useSharedSearchIndex<T>(items: readonly T[], options: SharedSearchIndexOptions<T>): SharedSearchIndex<T> {
  const [query, setQuery] = useState(options.initialQuery ?? "");
  const [generation, setGeneration] = useState(0);
  const normalized = query.trim().toLocaleLowerCase();
  const results = useMemo(() => {
    void generation;
    return normalized ? items.filter((item) => options.getText(item).toLocaleLowerCase().includes(normalized)) : [...items];
  }, [generation, items, normalized, options]);
  return { query, results, setQuery, rebuild: () => setGeneration((value) => value + 1) };
}
