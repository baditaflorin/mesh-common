export default async function standup(a, b) {
  await a.getByPlaceholder("Your name").fill("Ari");
  await b.getByPlaceholder("Your name").fill("Bea");
  await a.getByRole("button", { name: "Start one-minute timebox" }).click();
  await b.waitForTimeout(600);
  await a.getByLabel("Yesterday").fill("Shipped the card");
  await a.getByLabel("Today").fill("Review feedback");
  await a.getByRole("button", { name: "Save my update" }).click();
  await b.waitForTimeout(800);
}
