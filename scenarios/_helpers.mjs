// Shared defensive helpers for demo scenarios.
//
// All operations swallow errors: a scenario should produce *some* recording
// even if a selector has drifted. Each helper returns true on success.

export const safeFill = async (page, locator, value) => {
  try {
    const el = typeof locator === "function" ? locator(page) : page.locator(locator).first();
    if ((await el.count()) === 0) return false;
    await el.fill(String(value), { timeout: 1200 });
    return true;
  } catch {
    return false;
  }
};

export const safeClick = async (page, locator) => {
  try {
    const el = typeof locator === "function" ? locator(page) : page.locator(locator).first();
    if ((await el.count()) === 0) return false;
    await el.click({ timeout: 1200, force: false });
    return true;
  } catch {
    return false;
  }
};

export const tryName = async (page, name) => {
  // Most apps render a "your name" input on first paint
  const ph = page.getByPlaceholder(/your name|name|alex/i).first();
  if ((await ph.count()) > 0) {
    try {
      await ph.fill(name, { timeout: 1200 });
      return true;
    } catch {}
  }
  return false;
};

export const clickByText = async (page, re) => {
  try {
    const btn = page.getByRole("button", { name: re }).first();
    if ((await btn.count()) > 0) {
      await btn.click({ timeout: 1200 });
      return true;
    }
  } catch {}
  return false;
};

export const wait = (page, ms) => page.waitForTimeout(ms);
