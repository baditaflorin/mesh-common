export type LeaderboardItem = {
  id: string;
  name: string;
  score: number;
  sub?: string;
  isMe?: boolean;
};

type Props = {
  items: LeaderboardItem[];
  /** Highlights the row matching this id with the `is-me` class. */
  highlightId?: string;
  /** Maximum rows to render (default 10). */
  limit?: number;
  /** Renders when `items` is empty (default "no scores yet"). */
  emptyText?: string;
  /** Format the score column (default: integer). */
  formatScore?: (s: number) => string;
  /** Override the title. Pass null to skip the header entirely. */
  title?: string | null;
  className?: string;
};

/**
 * Pure ranked-list component. Items are pre-sorted by the caller (or arrive
 * already sorted); this component just renders, numbers, and highlights.
 *
 * Highlights `items[*].isMe = true` OR `id === highlightId` with the `is-me`
 * class — apps can pass either explicitly or use the convenience prop.
 *
 * The DOM shape and class names match the existing `.viral-leaderboard`
 * styling already shipped in mesh-common's `styles.css`, so this component
 * is a drop-in for the dozens of bespoke leaderboard renderers the fleet
 * has been carrying.
 */
export function Leaderboard({
  items,
  highlightId,
  limit = 10,
  emptyText = "no scores yet",
  formatScore,
  title,
  className,
}: Props) {
  const visible = items.slice(0, limit);
  const fmt = formatScore ?? ((s: number) => String(s));

  if (visible.length === 0) {
    return (
      <div className={`mesh-leaderboard is-empty ${className ?? ""}`}>
        {title !== null && (
          <h2 className="mesh-leaderboard-title">{title ?? "leaderboard"}</h2>
        )}
        <p className="mesh-leaderboard-empty">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className={`mesh-leaderboard ${className ?? ""}`}>
      {title !== null && (
        <h2 className="mesh-leaderboard-title">{title ?? "leaderboard"}</h2>
      )}
      <ol className="mesh-leaderboard-list">
        {visible.map((item, i) => {
          const me = item.isMe || item.id === highlightId;
          return (
            <li key={item.id} className={`mesh-leaderboard-row ${me ? "is-me" : ""}`}>
              <span className="mesh-leaderboard-rank">{i + 1}</span>
              <span className="mesh-leaderboard-name">
                {item.name}
                {me && <span className="mesh-leaderboard-you"> (you)</span>}
              </span>
              {item.sub && <span className="mesh-leaderboard-sub">{item.sub}</span>}
              <span className="mesh-leaderboard-score">{fmt(item.score)}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
