// Chat-only-with-questions; both peers send questions, then break the rule.
import { tryName, fillFirst, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");

  const sendA = async (text) => {
    await fillFirst(a, [/type a question|message|question|chat/i], text);
    await clickByText(a, /^send$|submit|^post$/i);
  };
  const sendB = async (text) => {
    await fillFirst(b, [/type a question|message|question|chat/i], text);
    await clickByText(b, /^send$|submit|^post$/i);
  };

  await sendA("What's the best mesh app for icebreakers?");
  await wait(a, 800);
  await sendB("Is it the bench-archive one with voice clips?");
  await wait(a, 800);
  await sendA("Or maybe truth-bomb, depending on the crowd?");
  await wait(a, 800);
  // Break the chain
  await sendB("It is definitely the dare wheel.");
  await wait(a, 1500);

  // Restart
  await clickByText(a, /restart|reset|new game/i);

  await wait(a, 3000);
}
