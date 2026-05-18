// Both peers name themselves; alternate sentences as turn rotates.
import { tryName, fillFirst, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");
  await wait(a, 600);

  const send = async (page, text) => {
    await fillFirst(page, [/sentence|line|input|continue/i], text);
    await clickByText(page, /^submit$|^send$|^add$|enter/i);
  };

  await send(a, "It started with a small noise behind the bookshelf.");
  await wait(a, 1500);
  await send(b, "She tilted her head, then walked over slowly.");
  await wait(a, 1500);
  await send(a, "A tiny door, no bigger than a postage stamp, was glowing.");
  await wait(a, 1500);
  await send(b, "And just like that, the shelf creaked open.");

  await wait(a, 3500);
}
