export default async function ratingBoardScenario(a, b) { await a.getByRole("button", { name: /5/ }).click(); await b.waitForTimeout(1200); }
