// Mic-permission gated; we exercise the arm + record UI affordance.
import { clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await clickByText(a, /open this bench|archive|arm|join/i);
  await clickByText(b, /open this bench|archive|arm|join/i);
  await wait(a, 1500);

  // Try record (will silent-fail without mic permission, but click is shown)
  await clickByText(a, /record/i);
  await wait(a, 3000);
  await clickByText(a, /stop|end/i);
  await wait(a, 4500);
}
