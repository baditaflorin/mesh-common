export default async function habitSprintScenario(a, b) {
  await a.getByPlaceholder("Name on your check-in").fill("Ari");
  await b.getByPlaceholder("Name on your check-in").fill("Bea");
  await a.getByRole("button", { name: "Start the sprint" }).click();
  await b.waitForTimeout(700);
  await a.getByRole("button", { name: "I completed it" }).click();
  await b.waitForTimeout(1200);
}
