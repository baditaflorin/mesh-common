export default async function borrowBoardScenario(a, b) {
  await a.getByPlaceholder("Name on your listings").fill("Ari");
  await b.getByPlaceholder("Name on your listings").fill("Bea");
  await a.getByPlaceholder("Camping stove, drill, folding table…").fill("Folding table");
  await a.getByRole("button", { name: "List item" }).click();
  await b.waitForTimeout(700);
  await b.getByRole("button", { name: "Borrow item" }).click();
  await a.waitForTimeout(1500);
}
