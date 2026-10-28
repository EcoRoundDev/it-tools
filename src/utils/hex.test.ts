import { describe, expect, it } from 'vitest';
import { formatHexBytes, parseHexInput } from './hex';

describe('hex utils', () => {
  describe('parseHexInput', () => {
    it.each([
      '01030000000A',
      '01 03 00 00 00 0a',
      '  01\t03\n00\r\n00 00 0A  ',
      '0x01 0X03 0x00 0x00 0x00 0x0A',
      '0x01030000000A',
      '01,03,00,00,00,0A',
      '0x01, 0x03, 00 00 000A',
    ])('parses equivalent raw HEX bytes: %s', (input) => {
      expect(parseHexInput(input)).toEqual(Uint8Array.from([1, 3, 0, 0, 0, 10]));
    });

    it.each(['', ' \n\t '])('accepts empty input without inventing bytes', (input) => {
      expect(parseHexInput(input)).toEqual(new Uint8Array());
    });

    it.each([
      '0', '001', '0 1', '01 0', '0x1', '0x', '0x01 0x0',
      'GG', '01 ZZ 02', '01.02', '01;02', '01/02', '0x010x02',
      '-01', ',01', '01,', '[01, 02]',
    ])('rejects malformed input rather than silently changing it: %s', (input) => {
      expect(() => parseHexInput(input)).toThrow('Invalid HEX byte sequence');
    });

    it('preserves zero bytes and does not encode HEX characters as text', () => {
      expect(parseHexInput('00 FF 80')).toEqual(Uint8Array.from([0, 255, 128]));
      expect(parseHexInput('31 32')).toEqual(Uint8Array.from([49, 50]));
    });
  });

  describe('formatHexBytes', () => {
    it('formats all bytes with two uppercase HEX digits', () => {
      expect(formatHexBytes(Uint8Array.from([0, 1, 128, 255]))).toBe('00 01 80 FF');
      expect(formatHexBytes(Uint8Array.from([0, 1, 128, 255]), '')).toBe('000180FF');
    });

    it('preserves leading zeroes', () => {
      expect(formatHexBytes(Uint8Array.from([0, 0, 10]))).toBe('00 00 0A');
    });
  });
});
