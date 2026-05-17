import type { ModeratorState } from "./moderator";

type Props = {
  state: ModeratorState;
  /** Optional display name lookup — pass a function returning the human name
   *  for a peerId (e.g., from your app's display-name Y.Map). */
  resolveName?: (peerId: string) => string | undefined;
  className?: string;
};

/**
 * Drop-in moderator badge. Shows the current moderator, a countdown to
 * auto-clear, and a claim/relinquish button.
 *
 * Honest framing baked into the UI: the badge always reads "moderating"
 * never "admin," and explicitly displays the auto-clear timer to set the
 * expectation that this is a coordination affordance, not an enforcement.
 */
export function ModeratorBadge({ state, resolveName, className }: Props) {
  const { current, isMe, expiresInMs, claim, relinquish } = state;
  const mins = Math.floor(expiresInMs / 60000);
  const secs = Math.floor((expiresInMs % 60000) / 1000);
  const time = mins > 0 ? `${mins}m ${String(secs).padStart(2, "0")}s` : `${secs}s`;
  const name = current ? (resolveName?.(current.peerId) ?? current.peerId.slice(0, 8)) : null;

  return (
    <div className={`mesh-mod ${className ?? ""} ${isMe ? "is-me" : ""} ${current ? "is-active" : "is-vacant"}`}>
      <div className="mesh-mod-row">
        <span className="mesh-mod-icon" aria-hidden="true">
          {current ? "🛡" : "⚙"}
        </span>
        <div className="mesh-mod-text">
          {current ? (
            <>
              <strong>{isMe ? "you're moderating" : `${name} is moderating`}</strong>
              <span className="mesh-mod-sub">auto-clears in {time} · soft role, not enforcement</span>
            </>
          ) : (
            <>
              <strong>no moderator</strong>
              <span className="mesh-mod-sub">anyone can claim · auto-clears after 30 min</span>
            </>
          )}
        </div>
        {isMe ? (
          <button type="button" className="mesh-mod-btn" onClick={relinquish}>
            release
          </button>
        ) : (
          <button type="button" className="mesh-mod-btn mesh-mod-claim" onClick={claim}>
            {current ? "wait…" : "claim"}
          </button>
        )}
      </div>
    </div>
  );
}
