export default async function meshQueueScenario(a, b) {
  await a.getByPlaceholder("How should the desk call you?").fill("Ari");
  await b.getByPlaceholder("How should the desk call you?").fill("Bea");
  await a.getByRole("button", { name: "Take a number" }).click();
  await b.getByRole("button", { name: "Take a number" }).click();
  await a.waitForTimeout(1000);

  await a.getByRole("button", { name: "Run the desk" }).click();
  await a.getByRole("button", { name: "Call next guest" }).click();
  await a.waitForTimeout(2500);
}
