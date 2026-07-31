/**
 * Phase 5 visual capture — waits for executive data before screenshots.
 * Usage: WEB_URL=http://localhost:19006 node scripts/capture-phase5.mjs
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'screenshots', 'phase5');
const BASE = process.env.WEB_URL || 'http://localhost:19006';

async function boot(page) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate(() => {
    const val = 'true';
    localStorage.setItem('spp.onboarded', val);
    localStorage.setItem('@RNCAsyncStorage:spp.onboarded', val);
  });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(5000);
  await page.getByTestId('brief-card').waitFor({ state: 'visible', timeout: 240000 });
  await page.waitForTimeout(2000);
}

async function shot(page, name) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: true });
  console.log('saved', name);
  return file;
}

async function clickTab(page, id) {
  await page.getByTestId(id).click({ timeout: 20000 });
  await page.waitForTimeout(2500);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  await boot(page);
  await shot(page, '01-home.png');

  await clickTab(page, 'tab-properties');
  await page.getByTestId('brain-verdict-portfolio').waitFor({ state: 'visible', timeout: 120000 });
  await shot(page, '02-portfolio.png');

  await clickTab(page, 'tab-analytics');
  await page.getByTestId('brain-verdict-insights').waitFor({ state: 'visible', timeout: 120000 });
  await shot(page, '03-insights.png');

  await clickTab(page, 'tab-home');
  await page.getByTestId('brief-card').waitFor({ state: 'visible', timeout: 120000 });
  await page.getByTestId('qn-hub').scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await page.getByTestId('qn-hub').click({ timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.getByTestId('hub-contracts').click({ timeout: 15000 });
  await page.getByTestId('brain-verdict-contracts').waitFor({ state: 'visible', timeout: 120000 });
  await shot(page, '04-contracts.png');

  await page.getByTestId('header-back').click({ timeout: 15000 });
  await page.waitForTimeout(1000);
  await page.getByTestId('hub-health').scrollIntoViewIfNeeded();
  await page.getByTestId('hub-health').click({ timeout: 15000 });
  await page.getByTestId('brain-verdict-health').waitFor({ state: 'visible', timeout: 120000 });
  await shot(page, '05-health.png');

  await page.getByTestId('header-back').click({ timeout: 15000 });
  await page.waitForTimeout(1000);
  await page.getByTestId('hub-maintenance').click({ timeout: 15000 });
  await page.getByTestId('brain-verdict-maintenance').waitFor({ state: 'visible', timeout: 120000 });
  await shot(page, '06-maintenance.png');

  await page.getByTestId('header-back').click({ timeout: 15000 });
  await page.waitForTimeout(1000);
  await page.getByTestId('hub-notifications').click({ timeout: 15000 });
  await page.getByTestId('notifications-screen').waitFor({ state: 'visible', timeout: 30000 });
  await shot(page, '07-notifications.png');

  await browser.close();
  console.log('Done →', OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
