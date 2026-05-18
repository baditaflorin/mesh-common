// Both peers join lobby, deal roles, observe role assignment + phase transitions.
import { tryName, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");

  await clickByText(a, /join lobby|join|start|connect/i);
  await clickByText(b, /join lobby|join|start|connect/i);
  await wait(a, 1200);

  // Deal roles (usually on host's screen, but try both)
  await clickByText(a, /deal roles|deal|begin|start round/i);
  await wait(a, 1500);
  // If first click did nothing, try the other peer
  await clickByText(b, /deal roles|deal/i);
  await wait(a, 1800);

  // Commit-reveal phase auto-progresses. Try clicking "begin night" / "next".
  await clickByText(a, /begin night|next|continue|night/i);
  await clickByText(b, /begin night|next|continue|night/i);
  await wait(a, 2000);

  // Day phase / morning
  await clickByText(a, /morning|day|next/i);
  await clickByText(b, /morning|day|next/i);

  await wait(a, 2500);
}
