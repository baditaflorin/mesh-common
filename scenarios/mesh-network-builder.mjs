/**
 * A real two-peer Linkfield recording: both people make a contact card, scan
 * each other's generated payload, and finish on the confirmed-room map.
 * The recorder keeps both pages in one BrowserContext, so this exercises the
 * same BroadcastChannel-backed local mesh path as the E2E contract.
 */
export default async function scenario(a, b) {
  const makeCard = async (page, name) => {
    await page.getByLabel("Name on your code").fill(name);
    await page.getByRole("button", { name: "Create my QR code" }).click();
    await page.locator(".network-qr-exchange").waitFor();
  };

  await Promise.all([makeCard(a, "Alex"), makeCard(b, "Rin")]);
  await a.waitForTimeout(1100);

  await a.locator(".mesh-qrx-payload summary").click();
  const aPayload =
    (await a.locator(".mesh-qrx-payload code").textContent()) ?? "";
  await b.getByLabel("paste payload").fill(aPayload);
  await b.getByRole("button", { name: "use", exact: true }).click();
  await b.waitForTimeout(900);

  await b.locator(".mesh-qrx-payload summary").click();
  const bPayload =
    (await b.locator(".mesh-qrx-payload code").textContent()) ?? "";
  await a.getByLabel("paste payload").fill(bPayload);
  await a.getByRole("button", { name: "use", exact: true }).click();
  await a.waitForTimeout(1600);

  await Promise.all([
    a.locator(".network-connections").scrollIntoViewIfNeeded(),
    b.locator(".network-connections").scrollIntoViewIfNeeded(),
  ]);
  await a.waitForTimeout(1200);
}
