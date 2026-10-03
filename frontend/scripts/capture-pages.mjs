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
const skipEntrance=async(route)=>{if(route!=='/')return;const skip=page.getByRole('button',{name:'Skip intro'});const shown=await skip.waitFor({state:'visible',timeout:5000}).then(()=>true).catch(()=>false);if(!shown)return;await skip.click();await page.getByRole('dialog',{name:'Enter Elysian Studio'}).waitFor({state:'hidden'});};
const signInAdmin=async()=>{await page.goto(base+'/login');await page.getByLabel('Email address').fill('studio@example.test');await page.getByLabel('Password',{exact:true}).fill('elysian123');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL(url=>!url.pathname.endsWith('/login'));};
for(const [name,route,width,height] of captures){await page.setViewportSize({width,height});if(route==='/admin')await signInAdmin();await page.goto(base+route);await skipEntrance(route);await page.locator('main h1').waitFor();await page.waitForFunction(()=>!document.querySelector('main .loadingState'));await page.evaluate(()=>document.fonts.ready);await page.locator('main img').evaluateAll(imgs=>Promise.all(imgs.map(img=>{img.loading='eager';return img.decode().catch(()=>{});})));await page.screenshot({path:fileURLToPath(new URL(`${name}.png`,screenshotDirectory)),fullPage:true});if(name==='home-desktop')await page.screenshot({path:fileURLToPath(new URL('home-first-screen.png',screenshotDirectory))});console.log(`${name}: document width ${await page.evaluate(()=>document.documentElement.scrollWidth)} / viewport ${width}`);}
await browser.close();
