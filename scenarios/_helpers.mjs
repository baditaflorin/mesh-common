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

// Common "arm the app" button. Tries Connect / Arm / Allow / Join / Start in order.
export const armConnect = async (page) => {
  for (const re of [/^connect$/i, /^arm$/i, /allow|grant/i, /^join/i, /^start/i, /begin/i]) {
    const btn = page.getByRole("button", { name: re }).first();
    try {
      if ((await btn.count()) > 0) {
        await btn.click({ timeout: 1000 });
        return true;
      }
    } catch {}
  }
  return false;
};

// Tap the same button N times with a small delay between presses. Used for
// tap-broadcast apps (emoji rain, doorbell, fist-of-five).
export const tapMany = async (page, locator, times = 3, gap = 200) => {
  const el = typeof locator === "function" ? locator(page) : page.locator(locator).first();
  if ((await el.count()) === 0) return 0;
  let n = 0;
  for (let i = 0; i < times; i++) {
    try {
      await el.click({ timeout: 600, force: true });
      n++;
    } catch {}
    await page.waitForTimeout(gap);
  }
  return n;
};

// Click N visible buttons by index, ignoring the FAB/settings chrome that
// always lives top-right. Useful for grids (bingo, fist-of-five, dare wheel).
export const clickNthButtons = async (page, indices, scope) => {
  const sel = scope || 'main button:visible, [role="main"] button:visible, body > div button:visible';
  const btns = page.locator(sel);
  const count = await btns.count();
  let clicks = 0;
  for (const i of indices) {
    if (i < count) {
      try {
        await btns.nth(i).click({ timeout: 700, force: false });
        clicks++;
        await page.waitForTimeout(120);
      } catch {}
    }
  }
  return clicks;
};

// Quick squiggle stroke on the first <canvas>. Used for draw apps.
export const canvasScribble = async (page, opts = {}) => {
  const canvas = page.locator(opts.selector || "canvas").first();
  if ((await canvas.count()) === 0) return false;
  const box = await canvas.boundingBox().catch(() => null);
  if (!box) return false;
  const path = opts.path || [
    [0.2, 0.3], [0.4, 0.4], [0.6, 0.3], [0.8, 0.5],
    [0.5, 0.6], [0.3, 0.7], [0.5, 0.8], [0.7, 0.7],
  ];
  await page.mouse.move(box.x + box.width * path[0][0], box.y + box.height * path[0][1]);
  await page.mouse.down();
  for (let i = 1; i < path.length; i++) {
    const [px, py] = path[i];
    try {
      await page.mouse.move(box.x + box.width * px, box.y + box.height * py, { steps: 6 });
      await page.waitForTimeout(opts.gap ?? 100);
    } catch {}
  }
  await page.mouse.up();
  return true;
};

// Set a range slider to a value 0..1 of its [min,max].
export const setRange = async (page, fraction = 0.7) => {
  const range = page.locator('input[type="range"]').first();
  if ((await range.count()) === 0) return false;
  try {
    await range.evaluate((el, f) => {
      const min = Number(el.min || 0);
      const max = Number(el.max || 100);
      el.value = String(min + (max - min) * f);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }, fraction);
    return true;
  } catch {}
  return false;
};

// Type into a freeform text input matching any of several placeholder hints.
export const fillFirst = async (page, placeholderHints, value) => {
  for (const hint of placeholderHints) {
    const el = page.getByPlaceholder(hint).first();
    try {
      if ((await el.count()) > 0) {
        await el.fill(String(value), { timeout: 1000 });
        return true;
      }
    } catch {}
  }
  return false;
};

// Both peers do the same prelude: name then arm.
export const armBoth = async (a, b, nameA = "alice", nameB = "bob") => {
  await tryName(a, nameA);
  await tryName(b, nameB);
  await Promise.all([armConnect(a), armConnect(b)]);
};
