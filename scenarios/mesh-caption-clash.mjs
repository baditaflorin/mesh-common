export default async function captionClashScenario(a, b) {
  await a.getByLabel("Contest prompt").fill("The meeting starts five minutes early");
  await a.getByRole("button", { name: "Set prompt" }).click();
  await b.getByText(/meeting starts/).waitFor({ timeout: 10_000 });
}
