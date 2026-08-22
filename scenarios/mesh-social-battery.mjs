export default async function socialBatteryScenario(a, b) {
  await a.getByLabel("Your display name").fill("Ari");
  await b.getByLabel("Your display name").fill("Bea");
  await a.getByRole("button", { name: "Open", exact: true }).click();
  await a.getByPlaceholder("e.g. Up for a walk later").fill("A gentle coffee break?");
  await a.getByRole("button", { name: "Share my check-in" }).click();
  await b.getByRole("button", { name: "Low" }).click();
  await b.getByPlaceholder("e.g. Up for a walk later").fill("Quiet company works for me.");
  await b.getByRole("button", { name: "Share my check-in" }).click();
  await b.waitForTimeout(1200);
}
