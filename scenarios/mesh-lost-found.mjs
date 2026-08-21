export default async function lostFoundScenario(a, b) {
  await a.getByLabel("Item title").fill("Blue umbrella");
  await a.getByLabel("Item details").fill("Found beside the entrance");
  await a.getByRole("button", { name: "Post to this room" }).click();
  await b.waitForTimeout(1500);
}
