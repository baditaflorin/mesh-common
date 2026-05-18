// A joins PRO, B joins CON, alternate logging points.
import { tryName, clickByText, fillFirst, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");

  await clickByText(a, /join pro|pro/i);
  await clickByText(b, /join con|con/i);
  await wait(a, 600);

  await clickByText(a, /start debate|start|begin/i);
  await wait(a, 800);

  await fillFirst(a, [/your point|point|argument/i], "Open offices erode deep work.");
  await clickByText(a, /log point|^log$|submit/i);
  await wait(a, 1200);

  await fillFirst(b, [/your point|point|argument/i], "But they create spontaneous mentoring.");
  await clickByText(b, /log point|^log$|submit/i);
  await wait(a, 1200);

  await fillFirst(a, [/your point|point|argument/i], "Headphones-on is the new wall.");
  await clickByText(a, /log point|^log$|submit/i);

  await wait(a, 3000);
}
