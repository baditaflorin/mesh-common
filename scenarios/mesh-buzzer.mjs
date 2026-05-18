// Alice arms a round. Bob races to buzz. Leaderboard updates with bob's ms.
// Then alice re-arms; this time alice buzzes first.
import { tryName, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");
  await wait(a, 400);

  // Round 1: alice arms, bob buzzes fast
  await clickByText(a, /^arm$|arm round|start/i);
  await wait(b, 600);
  await clickByText(b, /buzz/i);
  await wait(a, 1800);

  // Round 2: alice re-arms, alice buzzes herself
  await clickByText(a, /arm|reset|new round/i);
  await wait(a, 500);
  await clickByText(a, /buzz/i);
  await wait(a, 1200);

  // Round 3: arm + bob buzzes, then alice buzzes after
  await clickByText(a, /arm|reset|new round/i);
  await wait(a, 400);
  await clickByText(b, /buzz/i);
  await wait(a, 250);
  await clickByText(a, /buzz/i);

  await wait(a, 2500);
}
