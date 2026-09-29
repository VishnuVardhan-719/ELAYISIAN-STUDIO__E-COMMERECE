import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('homepage follows the revised content hierarchy at every requested width', async ({ page }) => {
  test.setTimeout(180000);
  for (const width of [1440,1280,1024,768,430,390,375]) {
    await page.setViewportSize({ width, height: 950 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Made by people.');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Found with feeling.');
    await expect(page.getByRole('link', { name: 'Shop the collection', exact: true })).toHaveAttribute('href','/shop');
    await expect(page.getByRole('link', { name: 'Meet the makers', exact: true })).toHaveAttribute('href','/creators');
    const collections=page.getByRole('region',{name:'Curated collections'});
    for(const name of ['Art','Ceramics','Textiles','Jewellery','Decor','Crafts']) await expect(collections.getByRole('link',{name:new RegExp(name+'$')})).toBeVisible();
    await expect(page.getByRole('region',{name:'Featured products'}).getByRole('link',{name:'View all pieces'})).toHaveAttribute('href','/shop');
    await expect(page.getByRole('list',{name:'Collaboration journey'}).getByRole('listitem')).toHaveCount(4);
    await expect(page.locator('.creatorProfileLink')).toHaveCount(3);
    await expect(page.locator('main > section')).toHaveCount(8);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
  const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(results.violations).toEqual([]);
});
