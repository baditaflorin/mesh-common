// Both peers add people + chores. The assignments grid populates.
import { fillFirst, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  // Add people on A
  for (const n of ["Mia", "Theo"]) {
    await fillFirst(a, [/add person|person/i], n);
    await clickByText(a, /^\+$|add person|add/i);
    await a.waitForTimeout(300);
  }
  // Add chores on A
  for (const c of ["dishes", "laundry"]) {
    await fillFirst(a, [/add chore|chore/i], c);
    await clickByText(a, /^\+$|add chore|add/i);
    await a.waitForTimeout(300);
  }
  await wait(a, 1200);

  // B adds another person + chore so both sides participate
  await fillFirst(b, [/add person|person/i], "Noor");
  await clickByText(b, /^\+$|add person|add/i);
  await wait(b, 300);
  await fillFirst(b, [/add chore|chore/i], "vacuum");
  await clickByText(b, /^\+$|add chore|add/i);

  await wait(a, 3500);
}
