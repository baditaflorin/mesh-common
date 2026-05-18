// Both fill profiles, both like each other, A reveals mutual matches.
import { tryName, fillFirst, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");

  // Try to fill "about" + "looking for" textareas
  const fillProfile = async (page, about, looking) => {
    const tas = page.locator('textarea');
    const n = await tas.count();
    if (n > 0) await tas.nth(0).fill(about, { timeout: 800 }).catch(() => {});
    if (n > 1) await tas.nth(1).fill(looking, { timeout: 800 }).catch(() => {});
  };

  await fillProfile(a, "I love hiking and bad jokes.", "Someone who'll laugh at the jokes.");
  await fillProfile(b, "Cooks pasta from scratch on Sundays.", "Adventure buddy for trail days.");
  await wait(a, 1500);

  // Both like the other's profile
  await clickByText(a, /❤️ like|^like$/i);
  await clickByText(b, /❤️ like|^like$/i);
  await wait(a, 1500);

  // Reveal mutual matches
  await clickByText(a, /reveal mutual|mutual matches|reveal/i);

  await wait(a, 3000);
}
