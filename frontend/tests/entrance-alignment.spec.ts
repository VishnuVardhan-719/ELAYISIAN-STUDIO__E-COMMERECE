import { test, expect } from '@playwright/test';

for (const width of [1440, 768, 390, 375]) {
  test(`entrance flowers mirror at the viewport edges at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Scroll to open', exact: true }).click();
    const flowers = page.locator('img[src="/images/entrance-botanicals.webp"]');
    await expect(flowers).toHaveCount(2);
    await expect.poll(() => flowers.evaluateAll(images => images.every(image =>
      (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0,
    ))).toBe(true);
    const bounds = await flowers.evaluateAll(images => images.map(image => {
      const wrapper = image.parentElement!;
      for (const animation of wrapper.getAnimations({ subtree: true })) animation.finish();
      const rect = wrapper.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, width: rect.width };
    }));
    await page.screenshot({ path: testInfo.outputPath(`flowers-${width}.png`) });
    expect(Math.abs(bounds[0].left + bounds[1].right - width)).toBeLessThan(1);
    expect(Math.abs(bounds[0].right + bounds[1].left - width)).toBeLessThan(1);
    expect(Math.abs(bounds[0].top - bounds[1].top)).toBeLessThan(1);
    expect(Math.abs(bounds[0].width - bounds[1].width)).toBeLessThan(1);
    expect(bounds[0].left).toBeLessThan(0);
    expect(bounds[1].right).toBeGreaterThan(width);
  });
}