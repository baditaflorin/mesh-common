// A loads a YouTube video; B toggles play/pause.
import { fillFirst, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await fillFirst(a, [/youtube|url|video/i], "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  await clickByText(a, /^load$|^play$|^add$|submit/i);
  await wait(a, 4000);

  await clickByText(b, /^pause$|^⏸/i);
  await wait(a, 2500);
  await clickByText(a, /^play$|^▶|resume/i);

  await wait(a, 4000);
}
