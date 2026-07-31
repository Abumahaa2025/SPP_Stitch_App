/** Insights-only capture (API pre-warmed). */
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'screenshots', 'intelligence-milestone');
const BASE = process.env.WEB_URL || 'http://localhost:19006';
const API = process.env.BACKEND_URL || 'http://127.0.0.1:8000';

async function warmApi() {
  for (const p of ['/api/', '/api/intelligence', '/api/executive']) {
    await fetch(`${API}${p}`, { signal: AbortSignal.timeout(120000) });
  }
}

async function main() {
  await warmApi();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate(() => {
    localStorage.setItem('spp.onboarded', 'true');
    localStorage.setItem('@RNCAsyncStorage:spp.onboarded', JSON.stringify(true));
  });
  await page.reload({ waitUntil: 'networkidle', timeout: 180000 });
  await page.waitForTimeout(8000);
  await page.getByTestId('tab-analytics').first().click({ timeout: 30000 });
  await page.getByTestId('insights-screen').waitFor({ state: 'visible', timeout: 120000 });
  await page.getByTestId('intelligence-section').waitFor({ state: 'visible', timeout: 180000 });
  await page.waitForTimeout(2000);
  const file = path.join(OUT, '03-insights-intelligence.png');
  await page.screenshot({ path: file, fullPage: true });
  console.log('saved', file);
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
