// A claims "head", B claims "body" or "legs". Each draws a quick squiggle.
import { tryName, clickByText, canvasScribble, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");

  await clickByText(a, /^head$|claim head/i);
  await clickByText(b, /^body$|^legs$|claim body|claim legs/i);
  await wait(a, 600);

  await canvasScribble(a);
  await canvasScribble(b, {
    path: [[0.25, 0.4], [0.5, 0.3], [0.75, 0.4], [0.6, 0.6], [0.4, 0.6], [0.25, 0.5]],
  });
  await wait(a, 500);

  await clickByText(a, /i'?m done|^done$/i);
  await clickByText(b, /i'?m done|^done$/i);
  await wait(a, 1000);

  await clickByText(a, /reveal the corpse|reveal/i);

  await wait(a, 3500);
}
