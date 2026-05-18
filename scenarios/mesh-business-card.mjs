// Both fill business-card details. QR exchange is camera-bound; we mainly
// show the form filling and the "your QR" appearance.
import { fillFirst, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await fillFirst(a, [/full name|name/i], "Alice Aalto");
  await fillFirst(a, [/email/i], "alice@example.com");
  await fillFirst(a, [/phone|tel/i], "+1 555 0102");

  await fillFirst(b, [/full name|name/i], "Bob Borges");
  await fillFirst(b, [/email/i], "bob@example.com");
  await fillFirst(b, [/phone|tel/i], "+1 555 0103");

  await wait(a, 4000);

  // Try to add a tagline / title if there's another field
  await fillFirst(a, [/title|role|tagline/i], "Builder of mesh-* apps");
  await fillFirst(b, [/title|role|tagline/i], "Trail runner. Pasta maximalist.");

  await wait(a, 3500);
}
