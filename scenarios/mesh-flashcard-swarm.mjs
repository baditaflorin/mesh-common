export default async function flashcardSwarmScenario(a, b) {
  await a.getByLabel("Your display name").fill("Ari");
  await b.getByLabel("Your display name").fill("Bea");
  await a.getByLabel("Prompt").fill("What is the chemical symbol for water?");
  await a.getByLabel("Answer").fill("H₂O");
  await a.getByRole("button", { name: "Add shared card" }).click();
  await b.getByRole("button", { name: "Start shared review" }).click();
  await a.getByRole("button", { name: "Reveal answer" }).click();
  await b.waitForTimeout(900);
}
