// A labels the timer, picks a preset; B watches it tick and pauses + resumes.
import { fillFirst, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await fillFirst(a, [/label/i], "Standup");
  await wait(a, 400);

  await clickByText(a, /^1 min$|1m|^1$/i);
  await wait(a, 4000);

  // B pauses
  await clickByText(b, /^pause$|^⏸/i);
  await wait(a, 2500);
  // A resumes
  await clickByText(a, /resume|^▶/i);
  await wait(a, 3500);
  // Reset
  await clickByText(a, /reset|stop/i);

  await wait(a, 1500);
}
