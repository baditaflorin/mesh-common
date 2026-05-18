// Both arm; each "drags" a drop on the canvas via mouse moves.
import { armConnect, canvasScribble, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await armConnect(a);
  await armConnect(b);
  await wait(a, 600);

  await canvasScribble(a, {
    path: [[0.2, 0.3], [0.4, 0.5], [0.6, 0.4], [0.7, 0.7]],
    gap: 300,
  });
  await canvasScribble(b, {
    path: [[0.8, 0.3], [0.6, 0.5], [0.4, 0.6], [0.3, 0.4]],
    gap: 300,
  });

  await wait(a, 5500);
}
