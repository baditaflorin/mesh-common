import { useState, type ReactNode } from "react";
import { PersonalQR } from "./PersonalQR";
import { useWebShare } from "./useWebShare";
import { MeshSheet } from "./ui/MeshSheet";

type Props = {
  /** App name shown in the modal title + native share sheet. */
  appName: string;
  roomId: string;
  /** Inviter peer id — embedded as `p=` so the receiver can record a chain edge. */
  peerId?: string;
  /** Optional extra slot rendered under the QR (e.g. chain stats from useInviteChain). */
  extras?: ReactNode;
};

function buildInviteUrl(roomId: string, peerId: string | undefined): string {
  if (typeof window === "undefined") return "";
  const base = window.location.origin + window.location.pathname;
  const params = new URLSearchParams();
  params.set("r", roomId);
  if (peerId) params.set("p", peerId);
  return `${base}#${params.toString()}`;
}

/**
 * Universal one-tap invite. Renders a floating FAB next to the settings cog;
 * tap → modal with a dynamic QR + copy-link + Web-Share. URL format matches
 * `useIncomingScanLink` (`#r=<roomId>&p=<inviterPeerId>`) so receivers
 * auto-join the room AND record the chain edge if the host app uses
 * `useInviteChain`.
 */
export function InviteShareButton({ appName, roomId, peerId, extras }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ws = useWebShare();
  const url = buildInviteUrl(roomId, peerId);

  const onShare = async () => {
    const result = await ws.share({
      title: `${appName} — join my room`,
      text: `tap to join: ${appName}`,
      url,
    });
    if (result === "copied") {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* private mode / no clipboard */
    }
  };

  return (
    <>
      <button
        type="button"
        className="mesh-invite-fab"
        onClick={() => setOpen(true)}
        aria-label="invite via QR"
        title="invite via QR"
      >
        📡
      </button>
      <MeshSheet
        open={open}
        onOpenChange={setOpen}
        title={`invite to ${appName}`}
        description="Scan the QR code or copy the room link to join."
        className="mesh-invite-sheet"
      >
        <div className="mesh-invite-content">
            <div className="mesh-invite-qr">
              <PersonalQR payload={url} size={240} ariaLabel="room invite QR" />
            </div>
            <button
              type="button"
              className="mesh-invite-url"
              onClick={onCopy}
              title="Copy invite link"
            >
              {url}
            </button>
            <div className="mesh-invite-actions">
              <button
                type="button"
                className="mesh-invite-share"
                onClick={onShare}
                aria-label="share invite link"
              >
                {ws.supported ? "share" : "copy link"}
              </button>
              {copied && <span className="mesh-invite-copied">copied!</span>}
            </div>
            {extras && <div className="mesh-invite-extras">{extras}</div>}
            <p className="mesh-invite-room">
              room: <code>{roomId}</code>
              {peerId && (
                <>
                  {" · "}you: <code>{peerId.slice(0, 6)}</code>
                </>
              )}
            </p>
        </div>
      </MeshSheet>
    </>
  );
}
