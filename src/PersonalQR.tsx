import { useMemo } from "react";
import qrcode from "qrcode-generator";

type Props = {
  payload: string;
  size?: number;
  ariaLabel?: string;
  background?: string;
  foreground?: string;
  errorCorrection?: "L" | "M" | "Q" | "H";
};

/**
 * Renders a payload as an inline-SVG QR code. Self-contained: no canvas, no
 * external requests, no images. Suitable for screenshots and printing.
 */
export function PersonalQR({
  payload,
  size = 192,
  ariaLabel = "QR code",
  background = "#ffffff",
  foreground = "#000000",
  errorCorrection = "M",
}: Props) {
  const cells = useMemo(() => {
    const qr = qrcode(0, errorCorrection);
    qr.addData(payload);
    qr.make();
    const n = qr.getModuleCount();
    const out: boolean[][] = [];
    for (let r = 0; r < n; r++) {
      const row: boolean[] = [];
      for (let c = 0; c < n; c++) row.push(qr.isDark(r, c));
      out.push(row);
    }
    return out;
  }, [payload, errorCorrection]);

  const n = cells.length || 1;
  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      width={size}
      height={size}
      viewBox={`0 0 ${n} ${n}`}
      shapeRendering="crispEdges"
      style={{ background, borderRadius: "0.4rem" }}
    >
      {cells.flatMap((row, r) =>
        row.map((on, c) =>
          on ? (
            <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill={foreground} />
          ) : null,
        ),
      )}
    </svg>
  );
}
