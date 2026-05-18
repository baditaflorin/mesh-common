// Both peers paste text into the shared clipboard list.
import { fillFirst, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await fillFirst(a, [/paste or type/i, /text|message|clip/i], "https://baditaflorin.github.io/mesh-common/demos/");
  await clickByText(a, /send to mesh|^send$|share/i);
  await wait(a, 800);

  await fillFirst(b, [/paste or type/i, /text|message|clip/i], "git push --force-with-lease origin main");
  await clickByText(b, /send to mesh|^send$|share/i);
  await wait(a, 1500);

  await fillFirst(a, [/paste or type/i, /text|message|clip/i], "Coffee ☕ at 3? lmk");
  await clickByText(a, /send to mesh|^send$|share/i);

  await wait(a, 3500);
}
