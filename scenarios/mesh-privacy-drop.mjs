export default async function privacyDropScenario(a, b) {
  const secret = "cafe-babe-dead-beef-face-feed";
  await a.getByLabel("Room secret").fill(secret);
  await b.getByLabel("Room secret").fill(secret);
  await a.waitForTimeout(900);
  await a.locator('input[type="file"]').setInputFiles({
    name: "hello-private.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("This file was encrypted before entering the mesh."),
  });
  await a.getByRole("button", { name: "Encrypt & send" }).click();
  await a.waitForTimeout(1800);
}
