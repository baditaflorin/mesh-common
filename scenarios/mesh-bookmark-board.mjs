export default async function bookmarkBoardScenario(a, b) { await a.getByRole("button").first().click(); await b.waitForTimeout(1200); }
