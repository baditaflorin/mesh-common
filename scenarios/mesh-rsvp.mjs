// A edits the event; both RSVP with different statuses + plus-ones + dietary.
import { tryName, fillFirst, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");

  await clickByText(a, /untitled event|tap to edit|edit event/i);
  await fillFirst(a, [/event title|title/i], "Rooftop pasta night");
  await fillFirst(a, [/when|date|time/i], "Sat 19:00");
  await fillFirst(a, [/where|location|venue/i], "Studio rooftop");
  await clickByText(a, /^save$|^done$/i);
  await wait(a, 1500);

  // Both reply
  await clickByText(a, /^going$|^yes$/i);
  await clickByText(b, /^maybe$/i);
  await wait(a, 1500);

  // Dietary note on A
  await fillFirst(a, [/dietary|allerg|note/i], "veggie + nut-free");

  await wait(a, 4000);
}
