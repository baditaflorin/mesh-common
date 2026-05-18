// Both join. Vote on options. A reveals.
import { clickByText, wait, clickNthButtons } from "./_helpers.mjs";

export default async function (a, b) {
  await clickByText(a, /join room|^join$|enter/i);
  await clickByText(b, /join room|^join$|enter/i);
  await wait(a, 800);

  // For approval mode, click a couple of option checkboxes/buttons
  await clickNthButtons(a, [0, 2]);
  await clickNthButtons(b, [1, 2]);
  await wait(a, 1500);

  await clickByText(a, /reveal results|reveal/i);

  await wait(a, 6000);
}
