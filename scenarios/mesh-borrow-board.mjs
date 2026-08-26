export default async function borrowBoardScenario(a, b) {
  // The recorder deliberately keeps both peers in one BrowserContext so it can
  // use BroadcastChannel without external signaling. Give peer B a distinct
  // stable device id before it mounts so the board demonstrates a real borrow,
  // rather than treating two recording tabs as one physical owner.
  await b.evaluate(() => {
    localStorage.setItem("mesh-borrow-board:deviceId:v1", "demo-borrower-device");
  });
  await b.reload({ waitUntil: "domcontentloaded" });
  await b.waitForTimeout(600);
  await a.getByPlaceholder("Name on your listings").fill("Ari");
  await b.getByPlaceholder("Name on your listings").fill("Bea");
  await a.getByPlaceholder("Camping stove, drill, folding table…").fill("Folding table");
  await a.getByRole("button", { name: "List item" }).click();
  await b.waitForTimeout(700);
  await b.getByRole("button", { name: "Borrow item" }).click({ timeout: 4000 });
  await a.waitForTimeout(1500);
  await a.evaluate(() => window.scrollTo({ top: 0, behavior: "auto" }));
  await b.evaluate(() => window.scrollTo({ top: 0, behavior: "auto" }));
  await b.waitForTimeout(250);
}
