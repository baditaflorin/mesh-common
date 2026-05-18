// Camera-permission gated — use the "stub face" fallback if present.
import { tryName, clickByText, wait, tapMany } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");
  await clickByText(a, /enable camera|camera|arm/i);
  await clickByText(b, /enable camera|camera|arm/i);
  await wait(a, 800);

  await clickByText(a, /stub face|snap selfie|snap/i);
  await clickByText(b, /stub face|snap selfie|snap/i);
  await wait(a, 1500);

  // React on each other's tiles
  await tapMany(a, 'button:has-text("❤️"), button:has-text("👍")', 1, 200);
  await tapMany(b, 'button:has-text("🔥"), button:has-text("😂")', 1, 200);

  await wait(a, 4000);
}
