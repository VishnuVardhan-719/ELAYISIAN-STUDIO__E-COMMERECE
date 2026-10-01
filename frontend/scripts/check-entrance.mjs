/* global document, getComputedStyle */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const screenshotDirectory = new URL('../screenshots/', import.meta.url);
await mkdir(screenshotDirectory, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto('http://127.0.0.1:5173/');
    await page.getByRole('dialog', { name: 'Enter Elysian Studio' }).waitFor();
    await page.screenshot({ path: fileURLToPath(new URL(`door-${width}.png`, screenshotDirectory)) });
    await page.mouse.wheel(0, 450);
    await page.waitForTimeout(1500);
    if (!await page.getByRole('dialog').isVisible()) throw new Error('Entrance skipped before the opening finished');
    await page.screenshot({ path: fileURLToPath(new URL(`door-opening-${width}.png`, screenshotDirectory)) });
    await page.mouse.wheel(0, 1000);
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    await page.screenshot({ path: fileURLToPath(new URL(`door-reveal-${width}.png`, screenshotDirectory)) });
    await page.getByRole('link', { name: 'Shop the collection', exact: true }).click();
    await page.waitForURL('**/shop');
    await page.getByRole('link', { name: 'Elysian Studio home', exact: true }).click();
    await page.getByRole('dialog', { name: 'Enter Elysian Studio' }).waitFor();
    await page.getByRole('button', { name: 'Skip intro' }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    console.log(`Scroll entrance and shop navigation passed at ${width}px`);
    await page.close();
  }
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('button', { name: 'Scroll to open', exact: true }).click();
  await page.waitForTimeout(3000);
  if (!await page.getByRole('dialog').isVisible()) throw new Error('Door disappeared before five-second opening');
  const effects = await page.evaluate(() => {
    const butterfly = document.querySelector('[class*="butterfly"]');
    const flower = document.querySelector('[class*="flower"]');
    return { butterfly: butterfly && getComputedStyle(butterfly).animationName, flower: flower && getComputedStyle(flower).animationName, animations: document.getAnimations().length };
  });
  if (!effects.butterfly || effects.butterfly === 'none' || !effects.flower || effects.flower === 'none' || effects.animations < 10) throw new Error(JSON.stringify(effects));
  await page.screenshot({ path: fileURLToPath(new URL('entrance-effects-reduced-motion.png', screenshotDirectory)) });
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  console.log('Timed opening plus active flower/butterfly animations verified with reduced motion enabled:', effects);
} finally { await browser.close(); }
