export default async function invitePocketScenario(a, b) { await a.getByRole("button").first().click(); await b.waitForTimeout(1200); }
