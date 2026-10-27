import { expect, test } from '@playwright/test';

test.describe('Tool - CRC calculator', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            (window as Window & { copiedCrcText?: string }).copiedCrcText = text;
          },
        },
      });
    });
    await page.goto('/crc-calculator');
  });

  test('has the correct title and calculates a Modbus packet by default', async ({ page }) => {
    await expect(page).toHaveTitle('CRC calculator - IT Tools');
    await expect(page.getByTestId('crc-checksum')).toHaveValue('CDC5');
    await expect(page.getByTestId('crc-bytes')).toHaveValue('C5 CD');
    await expect(page.getByTestId('crc-packet')).toHaveValue('01 03 00 00 00 0A C5 CD');
    await expect(page.getByTestId('crc-byte-count')).toHaveText('Input length: 6 bytes');
  });

  test('accepts prefixed HEX bytes rather than hashing the input as text', async ({ page }) => {
    await page.getByTestId('crc-input').fill('0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39');

    await expect(page.getByTestId('crc-checksum')).toHaveValue('4B37');
    await expect(page.getByTestId('crc-bytes')).toHaveValue('37 4B');
  });

  test('switches the CRC byte order without reversing the input packet', async ({ page }) => {
    const select = page.getByTestId('crc-byte-order');
    await select.locator('.c-select-input').click();
    await select.getByText('High byte first (big-endian)', { exact: true }).click();

    await expect(page.getByTestId('crc-checksum')).toHaveValue('CDC5');
    await expect(page.getByTestId('crc-bytes')).toHaveValue('CD C5');
    await expect(page.getByTestId('crc-packet')).toHaveValue('01 03 00 00 00 0A CD C5');
  });

  test('changes algorithms and resets the default byte order', async ({ page }) => {
    await page.getByTestId('crc-input').fill('31 32 33 34 35 36 37 38 39');
    const select = page.getByTestId('crc-algorithm');
    await select.locator('.c-select-input').click();
    await select.getByText('CRC-16/XMODEM', { exact: true }).click();

    await expect(page.getByTestId('crc-checksum')).toHaveValue('31C3');
    await expect(page.getByTestId('crc-bytes')).toHaveValue('31 C3');
  });

  test('copies the CRC value, CRC bytes and complete packet separately', async ({ page }) => {
    for (const [id, expected] of [
      ['checksum', 'CDC5'],
      ['bytes', 'C5 CD'],
      ['packet', '01 03 00 00 00 0A C5 CD'],
    ]) {
      await page.getByTestId(`copy-crc-${id}`).click();
      await expect.poll(() => page.evaluate(() => (window as Window & { copiedCrcText?: string }).copiedCrcText)).toBe(expected);
    }
  });

  test('copies compact HEX after changing the output separator', async ({ page }) => {
    const select = page.getByTestId('crc-separator');
    await select.locator('.c-select-input').click();
    await select.getByText('None', { exact: true }).click();
    await expect(page.getByTestId('crc-packet')).toHaveValue('01030000000AC5CD');
    await page.getByTestId('copy-crc-packet').click();

    await expect.poll(() => page.evaluate(() => (window as Window & { copiedCrcText?: string }).copiedCrcText)).toBe('01030000000AC5CD');
  });

  test('clears stale results and disables copying for malformed input', async ({ page }) => {
    await page.getByTestId('crc-input').fill('01 0');
    await expect(page.getByText('Enter complete HEX bytes (00 to FF).', { exact: false })).toBeVisible();

    for (const id of ['checksum', 'bytes', 'packet']) {
      await expect(page.getByTestId(`crc-${id}`)).toHaveValue('');
      await expect(page.getByTestId(`copy-crc-${id}`)).toHaveAttribute('aria-disabled', 'true');
    }

    await page.getByTestId('copy-crc-packet').click({ force: true });
    expect(await page.evaluate(() => (window as Window & { copiedCrcText?: string }).copiedCrcText)).toBeUndefined();

    await page.getByTestId('crc-input').fill('01 03 00 00 00 0A');
    await expect(page.getByTestId('crc-checksum')).toHaveValue('CDC5');
    await expect(page.getByTestId('copy-crc-packet')).toHaveAttribute('aria-disabled', 'false');
  });

  test('displays all four CRC-32 bytes', async ({ page }) => {
    await page.getByTestId('crc-input').fill('31 32 33 34 35 36 37 38 39');
    const select = page.getByTestId('crc-algorithm');
    await select.locator('.c-select-input').click();
    await select.getByText('CRC-32/ISO-HDLC', { exact: true }).click();

    await expect(page.getByTestId('crc-checksum')).toHaveValue('CBF43926');
    await expect(page.getByTestId('crc-bytes')).toHaveValue('CB F4 39 26');
    await expect(page.getByTestId('crc-packet')).toHaveValue('31 32 33 34 35 36 37 38 39 CB F4 39 26');
  });

  test('supports Chinese labels and copying on a narrow screen', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('locale', 'zh'));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();

    await expect(page.getByRole('heading', { name: 'CRC 计算器', exact: true })).toBeVisible();
    await expect(page.getByTestId('copy-crc-packet')).toHaveText('复制完整报文');
    await expect(page.getByTestId('crc-byte-count')).toHaveText('输入长度：6 字节');
    await page.getByTestId('copy-crc-packet').click();
    await expect.poll(() => page.evaluate(() => (window as Window & { copiedCrcText?: string }).copiedCrcText)).toBe('01 03 00 00 00 0A C5 CD');
  });

  test('does not append a CRC to an empty packet', async ({ page }) => {
    await page.getByTestId('crc-input').fill(' \n ');

    await expect(page.getByTestId('crc-checksum')).toHaveValue('');
    await expect(page.getByTestId('crc-packet')).toHaveValue('');
    await expect(page.getByTestId('copy-crc-packet')).toHaveAttribute('aria-disabled', 'true');
  });
});

test('copies through the legacy fallback when the Clipboard API is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Reflect.deleteProperty(navigator, 'clipboard');
    Reflect.deleteProperty(Navigator.prototype, 'clipboard');
    document.execCommand = (command: string) => {
      const input = document.activeElement;

      if (command === 'copy' && input instanceof HTMLTextAreaElement) {
        (window as Window & { copiedCrcText?: string }).copiedCrcText = input.value;
        return true;
      }

      return false;
    };
  });
  await page.goto('/crc-calculator');
  await page.getByTestId('copy-crc-packet').click();

  await expect.poll(() => page.evaluate(() => (window as Window & { copiedCrcText?: string }).copiedCrcText)).toBe('01 03 00 00 00 0A C5 CD');
});
