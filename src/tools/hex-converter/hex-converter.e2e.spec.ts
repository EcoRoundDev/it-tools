import { expect, test } from '@playwright/test';

type WindowWithClipboard = Window & { copiedHexText?: string };

test.describe('Tool - HEX converter', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            (window as WindowWithClipboard).copiedHexText = text;
          },
        },
      });
    });
    await page.goto('/hex-converter');
  });

  test('shows the default 4-byte decoding with RAW and every byte order', async ({ page }) => {
    await expect(page).toHaveTitle('HEX converter - IT Tools');

    await expect(page.getByTestId('hex-byte-count')).toHaveText('4 bytes');
    await expect(page.getByTestId('hex-normalized-raw')).toContainText('41 48 00 00');
    await expect(page.getByTestId('hex-raw-32-0')).toContainText('41 48 00 00');
    await expect(page.getByTestId('hex-raw-16-0')).toContainText('41 48');
    await expect(page.getByTestId('hex-raw-16-2')).toContainText('00 00');

    await expect(page.getByTestId('hex-value-float-ABCD-0')).toHaveText('12.5');
    await expect(page.getByTestId('hex-value-float-DCBA-0')).toHaveText('2.591981769461614e-41');
    await expect(page.getByTestId('hex-value-float-BADC-0')).toHaveText('197632');
    await expect(page.getByTestId('hex-value-float-CDAB-0')).toHaveText('2.3418499935796343e-41');

    await expect(page.getByTestId('hex-value-uint32-ABCD-0')).toHaveText('1095237632');
    await expect(page.getByTestId('hex-value-int32-ABCD-0')).toHaveText('1095237632');
    await expect(page.getByTestId('hex-value-int16-AB-0')).toHaveText('16712');
    await expect(page.getByTestId('hex-value-int16-BA-0')).toHaveText('18497');
    await expect(page.getByTestId('hex-value-uint16-AB-2')).toHaveText('0');

    await expect(page.getByTestId('hex-ascii-value')).toHaveText('AH\\x00\\x00');
    await expect(page.getByTestId('hex-binary-value')).toHaveText('01000001 01001000 00000000 00000000');
  });

  test('decodes float 1.0 with all four byte orders', async ({ page }) => {
    const input = page.getByTestId('hex-input');

    for (const [hex, order] of [
      ['3F 80 00 00', 'ABCD'],
      ['00 00 80 3F', 'DCBA'],
      ['80 3F 00 00', 'BADC'],
      ['00 00 3F 80', 'CDAB'],
    ]) {
      await input.fill(hex);
      await expect(page.getByTestId(`hex-value-float-${order}-0`)).toHaveText('1');
    }
  });

  test('decodes signed and unsigned 32-bit values', async ({ page }) => {
    await page.getByTestId('hex-input').fill('FF FF FF FF');

    await expect(page.getByTestId('hex-value-int32-ABCD-0')).toHaveText('-1');
    await expect(page.getByTestId('hex-value-uint32-ABCD-0')).toHaveText('4294967295');
    await expect(page.getByTestId('hex-value-float-ABCD-0')).toHaveText('NaN');

    await page.getByTestId('hex-input').fill('80 00 00 00');

    await expect(page.getByTestId('hex-value-int32-ABCD-0')).toHaveText('-2147483648');
    await expect(page.getByTestId('hex-value-uint32-ABCD-0')).toHaveText('2147483648');
    await expect(page.getByTestId('hex-value-float-ABCD-0')).toHaveText('-0');
  });

  test('decodes signed and unsigned 16-bit boundaries', async ({ page }) => {
    const input = page.getByTestId('hex-input');

    await input.fill('80 00');
    await expect(page.getByTestId('hex-value-int16-AB-0')).toHaveText('-32768');
    await expect(page.getByTestId('hex-value-int16-BA-0')).toHaveText('128');
    await expect(page.getByTestId('hex-value-uint16-AB-0')).toHaveText('32768');
    await expect(page.getByTestId('hex-value-uint16-BA-0')).toHaveText('128');

    await input.fill('00 80');
    await expect(page.getByTestId('hex-value-int16-AB-0')).toHaveText('128');
    await expect(page.getByTestId('hex-value-int16-BA-0')).toHaveText('-32768');
  });

  test('groups multiple 4-byte and 2-byte blocks with offsets', async ({ page }) => {
    await page.getByTestId('hex-input').fill('3F 80 00 00 40 00 00 00');

    await expect(page.getByTestId('hex-raw-32-0')).toContainText('3F 80 00 00');
    await expect(page.getByTestId('hex-raw-32-4')).toContainText('40 00 00 00');
    await expect(page.getByTestId('hex-value-float-ABCD-0')).toHaveText('1');
    await expect(page.getByTestId('hex-value-float-ABCD-4')).toHaveText('2');

    for (const offset of [0, 2, 4, 6]) {
      await expect(page.getByTestId(`hex-raw-16-${offset}`)).toBeVisible();
    }
  });

  test('keeps incomplete trailing bytes out of the decode and explains them', async ({ page }) => {
    await page.getByTestId('hex-input').fill('41 48 00 00 00 00');

    await expect(page.getByTestId('hex-raw-32-0')).toBeVisible();
    await expect(page.getByTestId('hex-raw-32-4')).toHaveCount(0);
    await expect(page.getByTestId('hex-trailing-32')).toContainText('2');
    await expect(page.getByTestId('hex-raw-16-4')).toContainText('00 00');
  });

  test('shows an error and no stale results for malformed HEX', async ({ page }) => {
    await page.getByTestId('hex-input').fill('0');

    await expect(page.getByText('Enter complete HEX bytes', { exact: false })).toBeVisible();
    await expect(page.getByTestId('hex-invalid')).toBeVisible();
    await expect(page.getByTestId('hex-value-float-ABCD-0')).toHaveCount(0);
    await expect(page.getByTestId('hex-32-table')).toHaveCount(0);
  });

  test('shows the empty state for empty input', async ({ page }) => {
    await page.getByTestId('hex-input').fill('');

    await expect(page.getByTestId('hex-empty')).toBeVisible();
    await expect(page.getByTestId('hex-text-table')).toHaveCount(0);
    await expect(page.getByTestId('hex-byte-count')).toHaveCount(0);
  });

  test('switches between escaped and dotted ASCII', async ({ page }) => {
    await page.getByTestId('hex-input').fill('41 00 0A 5C');

    await expect(page.getByTestId('hex-ascii-value')).toHaveText('A\\x00\\n\\\\');

    await page.getByRole('button', { name: 'Dots', exact: true }).click();
    await expect(page.getByTestId('hex-ascii-value')).toHaveText('A..\\');

    await page.getByRole('button', { name: 'Escape', exact: true }).click();
    await expect(page.getByTestId('hex-ascii-value')).toHaveText('A\\x00\\n\\\\');
  });

  test('copies values and RAW to the clipboard', async ({ page }) => {
    await page.getByTestId('hex-value-float-ABCD-0').click();
    await expect.poll(() => page.evaluate(() => (window as WindowWithClipboard).copiedHexText)).toBe('12.5');

    await page.getByTestId('hex-normalized-raw').click();
    await expect.poll(() => page.evaluate(() => (window as WindowWithClipboard).copiedHexText)).toBe('41 48 00 00');

    await page.getByTestId('hex-ascii-value').click();
    await expect.poll(() => page.evaluate(() => (window as WindowWithClipboard).copiedHexText)).toBe('AH\\x00\\x00');
  });

  test('handles long input without truncating it', async ({ page }) => {
    const hex = '00 '.repeat(260).trim();
    await page.getByTestId('hex-input').fill(hex);

    await expect(page.getByTestId('hex-byte-count')).toHaveText('260 bytes');
    await expect(page.getByTestId('hex-long-hint')).toBeVisible();
    await expect(page.getByTestId('hex-raw-32-256')).toContainText('00 00 00 00');
    await expect(page.getByTestId('hex-raw-16-258')).toContainText('00 00');
    await expect(page.getByTestId('hex-32-table').locator('tbody tr')).toHaveCount(65 * 3);
  });

  test('supports Chinese labels and narrow screens', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('locale', 'zh'));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();

    await expect(page.getByRole('heading', { name: 'HEX 转换器', exact: true })).toBeVisible();
    await expect(page.getByTestId('hex-byte-count')).toHaveText('共 4 字节');
    await expect(page.getByTestId('hex-value-float-ABCD-0')).toHaveText('12.5');

    const tableScrolls = await page.getByTestId('hex-32-table').evaluate(element => element.scrollWidth > element.clientWidth);
    expect(tableScrolls).toBe(true);
  });
});

test('copies through the legacy fallback when the Clipboard API is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Reflect.deleteProperty(navigator, 'clipboard');
    Reflect.deleteProperty(Navigator.prototype, 'clipboard');
    document.execCommand = (command: string) => {
      const input = document.activeElement;

      if (command === 'copy' && input instanceof HTMLTextAreaElement) {
        (window as WindowWithClipboard).copiedHexText = input.value;
        return true;
      }

      return false;
    };
  });
  await page.goto('/hex-converter');
  await page.getByTestId('hex-value-float-ABCD-0').click();

  await expect.poll(() => page.evaluate(() => (window as WindowWithClipboard).copiedHexText)).toBe('12.5');
});
