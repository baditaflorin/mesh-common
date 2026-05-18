// Parent adds kid + chore, kid marks done, parent verifies, balance ticks.
import { fillFirst, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  // A acts as the parent
  await fillFirst(a, [/add a kid/i, /kid/i, /name/i], "Mia");
  await clickByText(a, /add kid|add|^\+/i);
  await wait(a, 600);

  await fillFirst(a, [/chore|task/i], "wash the dishes");
  await fillFirst(a, [/\$|amount|price/i], "3");
  await clickByText(a, /add chore|add/i);
  await wait(a, 1200);

  // B (kid) marks done
  await clickByText(b, /mark done|done|^✓/i);
  await wait(a, 1200);

  // A verifies → balance updates
  await clickByText(a, /^verify$|approve/i);
  await wait(a, 1500);

  // Add a second chore to show repeated flow
  await fillFirst(a, [/chore|task/i], "take out trash");
  await fillFirst(a, [/\$|amount|price/i], "2");
  await clickByText(a, /add chore|add/i);

  await wait(a, 3000);
}
