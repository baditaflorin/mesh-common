// Both peers paste URLs into the shared feed.
import { fillFirst, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await fillFirst(a, [/url|paste or type|link/i], "https://baditaflorin.github.io/mesh-common/demos/");
  await clickByText(a, /^send$|share|submit|^add$/i);
  await wait(a, 800);

  await fillFirst(b, [/url|paste or type|link/i], "https://github.com/baditaflorin/mesh-common");
  await clickByText(b, /^send$|share|submit|^add$/i);
  await wait(a, 1500);

  await fillFirst(a, [/url|paste or type|link/i], "https://anthropic.com/news");
  await clickByText(a, /^send$|share|submit|^add$/i);

  await wait(a, 3500);
}
