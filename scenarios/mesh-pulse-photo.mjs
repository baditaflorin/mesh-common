/** A deterministic two-peer room for the published release recording. */
export default async function pulsePhotoScenario(a, b) {
  const arm = async (page) => {
    await page.getByRole("button", { name: /allow camera & start pulse/i }).click();
    await page
      .getByRole("spinbutton", { name: /enter bpm manually/i })
      .waitFor({ state: "visible" });
  };

  await Promise.all([arm(a), arm(b)]);

  await a.getByRole("spinbutton", { name: /enter bpm manually/i }).fill("84");
  await a.getByRole("button", { name: /log bpm manually/i }).click();
  await b.getByRole("spinbutton", { name: /enter bpm manually/i }).fill("96");
  await b.getByRole("button", { name: /log bpm manually/i }).click();

  // Keep both readings visible long enough for the recording to show the
  // room-average pulse propagated through the actual Yjs awareness channel.
  await a.waitForTimeout(8500);
}
