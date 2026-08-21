export default async function improvDirectorScenario(a, b) {
  await a.getByRole("textbox", { name: "Your rehearsal name" }).fill("Ari");
  await b.getByRole("textbox", { name: "Your rehearsal name" }).fill("Bea");
  await a
    .getByRole("textbox", { name: "Premise", exact: true })
    .fill("The mayor's portrait has started giving directions.");
  await a
    .getByRole("textbox", { name: "Direction", exact: true })
    .fill("Treat the portrait as a respected colleague.");
  await a.getByRole("button", { name: "Add cue and direct it" }).click();
  await b
    .getByRole("heading", { name: "The mayor's portrait has started giving directions." })
    .waitFor();
  await a.waitForTimeout(900);
  await b.waitForTimeout(900);
}
