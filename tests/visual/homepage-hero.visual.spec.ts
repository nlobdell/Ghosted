import { expect, test } from '@playwright/test';

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1080 },
  { width: 2560, height: 1440 },
  { width: 3840, height: 2160 },
];

for (const viewport of VIEWPORTS) {
  test(`homepage hero ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/?sceneFixture=visual-baseline', {
      waitUntil: 'networkidle',
    });

    const hero = page.locator('[aria-label="Ghosted live canvas hero"]');
    await expect(hero).toBeVisible();
    await expect(hero).toHaveScreenshot(`homepage-hero-${viewport.width}x${viewport.height}.png`, {
      animations: 'disabled',
      caret: 'hide',
    });
  });
}
