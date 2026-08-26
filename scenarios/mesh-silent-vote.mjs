export default async function quietVoteScenario(a, b) {
  await Promise.all([
    a.getByRole("button", { name: "Enter this decision room" }).click(),
    b.getByRole("button", { name: "Enter this decision room" }).click(),
  ]);

  await a
    .getByRole("textbox", { name: "Options" })
    .fill("Dinner at Nola\nDinner at Kismet\nDinner at Haneul");
  await a.getByRole("button", { name: "Open voting" }).click();
  await b.getByRole("heading", { name: "Choose your position" }).waitFor();

  await a.getByRole("checkbox", { name: "Dinner at Nola" }).check();
  await b.getByRole("checkbox", { name: "Dinner at Kismet" }).check();
  await b.getByRole("button", { name: "Reveal the room tally" }).click();
  await a.getByRole("heading", { name: "Room tally" }).waitFor();
  await a.waitForTimeout(900);
  await Promise.all([
    a.evaluate(() => window.scrollTo({ top: 0, behavior: "auto" })),
    b.evaluate(() => window.scrollTo({ top: 0, behavior: "auto" })),
  ]);
  await a.waitForTimeout(250);
}
