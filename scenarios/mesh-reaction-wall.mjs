export default async function reactionWallScenario(a, b) {
  await a.getByRole("button", { name: /👏/ }).click();
  await b.getByRole("button", { name: /❤️/ }).click();
  await b.getByRole("button", { name: /👏 1/ }).waitFor({ timeout: 10_000 });
  await a.waitForTimeout(1_200);
}
