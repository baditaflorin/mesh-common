export default async function countdownWallScenario(a, b) { await a.getByRole("button").first().click(); await b.waitForTimeout(1200); }
