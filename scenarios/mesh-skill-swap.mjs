// Both fill teach + learn skills.  Matches surface.
import { tryName, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");

  const ta1 = a.locator('textarea').nth(0);
  const ta2 = a.locator('textarea').nth(1);
  const tb1 = b.locator('textarea').nth(0);
  const tb2 = b.locator('textarea').nth(1);
  await ta1.fill("ffmpeg pipelines, Rust async, sourdough", { timeout: 800 }).catch(() => {});
  await ta2.fill("Figma, public speaking, ML basics", { timeout: 800 }).catch(() => {});
  await wait(a, 700);
  await tb1.fill("Figma, watercolour, vibrato", { timeout: 800 }).catch(() => {});
  await tb2.fill("ffmpeg pipelines, sourdough, gardening", { timeout: 800 }).catch(() => {});

  await wait(a, 6000);
}
