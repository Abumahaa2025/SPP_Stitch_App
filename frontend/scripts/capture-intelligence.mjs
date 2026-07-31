/**
 * Canonical intelligence milestone — screenshots for Maintenance, Health, Insights.
 * Usage: WEB_URL=http://localhost:19006 node scripts/capture-intelligence.mjs
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'screenshots', 'intelligence-milestone');
const BASE = process.env.WEB_URL || 'http://localhost:19006';
const API = process.env.BACKEND_URL || 'http://127.0.0.1:8000';

async function warmApi() {
  const paths = ['/api/', '/api/portfolio-memory', '/api/intelligence', '/api/executive'];
  for (const p of paths) {
    try {
      await fetch(`${API}${p}`, { signal: AbortSignal.timeout(120000) });
    } catch {
      /* retry on next path */
    }
  }
}

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
  console.log('saved', file);
  return file;
}

async function openHubTile(page, tileId, screenTestId) {
  await page.getByTestId('qn-hub').scrollIntoViewIfNeeded();
  await page.getByTestId('qn-hub').click({ timeout: 20000 });
  await page.getByTestId('hub-screen').waitFor({ state: 'visible', timeout: 30000 });
  await page.getByTestId(tileId).click({ timeout: 20000 });
  await page.getByTestId(screenTestId).waitFor({ state: 'visible', timeout: 120000 });
}

async function main() {
  await mkdir(OUT, { recursive: true });
  console.log('warming API…');
  await warmApi();

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  await boot(page);

  await openHubTile(page, 'hub-maintenance', 'maintenance-screen');
  await page.getByTestId('portfolio-memory-card').waitFor({ state: 'visible', timeout: 180000 });
  await page.waitForTimeout(2500);
  await shot(page, '01-maintenance-memory.png');

  await page.getByTestId('maintenance-screen').getByTestId('header-back').click({ timeout: 15000 });
  await page.getByTestId('hub-screen').waitFor({ state: 'visible', timeout: 30000 });
  await page.getByTestId('hub-health').click({ timeout: 20000 });
  await page.getByTestId('health-screen').waitFor({ state: 'visible', timeout: 120000 });
  await page.getByTestId('portfolio-memory-card').waitFor({ state: 'visible', timeout: 180000 });
  await page.waitForTimeout(2500);
  await shot(page, '02-health-memory.png');

  await page.getByTestId('tab-home').first().click({ timeout: 20000 });
  await page.getByTestId('brief-card').waitFor({ state: 'visible', timeout: 120000 });
  await page.getByTestId('tab-analytics').first().click({ timeout: 20000 });
  await page.getByTestId('insights-screen').waitFor({ state: 'visible', timeout: 120000 });
  await page.getByTestId('intelligence-section').waitFor({ state: 'visible', timeout: 180000 });
  await page.waitForTimeout(2000);
  await shot(page, '03-insights-intelligence.png');

  await browser.close();
  console.log('Done →', OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
