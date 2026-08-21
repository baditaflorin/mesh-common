export default async function recipeRelay(a, b) {
  await a.getByPlaceholder("Cook name").fill("Ari");
  await b.getByPlaceholder("Cook name").fill("Bea");
  await a.getByLabel("Instruction").fill("Toast the cumin until fragrant.");
  await a.getByRole("button", { name: "Add my one step" }).click();
  await b.waitForTimeout(800);
  await b.getByLabel("Instruction").fill("Stir in tomatoes and simmer for five minutes.");
  await b.getByRole("button", { name: "Add my one step" }).click();
  await a.waitForTimeout(1200);
}
