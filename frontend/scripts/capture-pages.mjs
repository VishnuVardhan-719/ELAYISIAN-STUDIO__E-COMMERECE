/* global document */
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const screenshotDirectory = new URL('../screenshots/', import.meta.url);
const base=process.env.PREVIEW_URL || 'http://127.0.0.1:5173';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage();
await mkdir(screenshotDirectory,{recursive:true});
const captures=[['home-desktop','/',1440,950],['home-mobile','/',390,844],['shop-desktop','/shop',1440,950],['product-mobile','/products/sunset-vase',390,844],['creator-desktop','/creators/mira',1440,950],['admin-desktop','/admin',1440,950]];
for(const [name,route,width,height] of captures){await page.setViewportSize({width,height});await page.goto(base+route);await page.locator('main h1').waitFor();await page.waitForFunction(()=>!document.querySelector('main .loadingState'));await page.evaluate(()=>document.fonts.ready);await page.locator('main img').evaluateAll(imgs=>Promise.all(imgs.map(img=>{img.loading='eager';return img.decode().catch(()=>{});})));await page.screenshot({path:fileURLToPath(new URL(`${name}.png`,screenshotDirectory)),fullPage:true});if(name==='home-desktop')await page.screenshot({path:fileURLToPath(new URL('home-first-screen.png',screenshotDirectory))});console.log(`${name}: document width ${await page.evaluate(()=>document.documentElement.scrollWidth)} / viewport ${width}`);}
await browser.close();
