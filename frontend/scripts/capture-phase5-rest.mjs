/**
 * Capture remaining screens (health, maintenance, notifications).
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'screenshots', 'phase5');
const BASE = process.env.WEB_URL || 'http://localhost:19007';

async function boot(page) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate(() => {
    const val = 'true';
    localStorage.setItem('spp.onboarded', val);
    localStorage.setItem('@RNCAsyncStorage:spp.onboarded', val);
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await page.getByTestId('brief-card').waitFor({ state: 'visible', timeout: 240000 });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await boot(page);
  await page.getByTestId('qn-hub').scrollIntoViewIfNeeded();
  await page.getByTestId('qn-hub').click({ timeout: 15000 });
  await page.waitForTimeout(1500);

  for (const [tile, file, verdict] of [
    ['hub-health', '05-health.png', 'brain-verdict-health'],
    ['hub-maintenance', '06-maintenance.png', 'brain-verdict-maintenance'],
    ['hub-notifications', '07-notifications.png', null],
  ]) {
    await page.getByTestId(tile).scrollIntoViewIfNeeded();
    await page.getByTestId(tile).click({ timeout: 15000 });
    await page.waitForTimeout(2500);
    if (verdict) {
      await page.getByTestId(verdict).waitFor({ state: 'visible', timeout: 120000 });
    } else {
      await page.getByTestId('notifications-screen').waitFor({ state: 'visible', timeout: 30000 });
    }
    await page.screenshot({ path: path.join(OUT, file), fullPage: true });
    console.log('saved', file);
    await page.getByTestId('header-back').click({ timeout: 15000 });
    await page.waitForTimeout(1000);
  }

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
