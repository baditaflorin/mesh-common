// Both connect, then A suggests pairs + starts sprint.
import { armBoth, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await armBoth(a, b);
  await wait(a, 800);

  await clickByText(a, /suggest pairs|suggest|shuffle|generate/i);
  await wait(a, 1500);

  await clickByText(a, /confirm.*sprint|start sprint|^start$/i);

  await wait(a, 9000);
}
