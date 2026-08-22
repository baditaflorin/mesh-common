export default async function choiceBoardScenario(a, b) { await a.getByRole("button").first().click(); await b.waitForTimeout(1200); }
