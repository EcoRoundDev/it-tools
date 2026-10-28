import { describe, expect, it } from 'vitest';
import {
  BYTE_ORDER_LABELS_16,
  BYTE_ORDER_LABELS_32,
  VALUE_TYPE_LABELS,
  convertHex,
  convertHexBytes,
  formatAscii,
  formatBinary,
  formatFloat32,
} from './hex-converter.service';

describe('hex converter service', () => {
  describe('formatFloat32', () => {
    it('formats finite values using the shortest round-trip representation', () => {
      expect(formatFloat32(12.5)).toBe('12.5');
      expect(formatFloat32(1)).toBe('1');
      expect(formatFloat32(Math.PI)).toBe('3.141592653589793');
    });

    it('formats IEEE 754 special values', () => {
      expect(formatFloat32(Number.NaN)).toBe('NaN');
      expect(formatFloat32(Number.POSITIVE_INFINITY)).toBe('Infinity');
      expect(formatFloat32(Number.NEGATIVE_INFINITY)).toBe('-Infinity');
      expect(formatFloat32(-0)).toBe('-0');
    });
  });

  describe('formatAscii', () => {
    it('keeps printable ASCII characters', () => {
      expect(formatAscii(Uint8Array.from([0x48, 0x65, 0x6C, 0x6C, 0x6F]))).toBe('Hello');
    });

    it('escapes non-printable bytes by default', () => {
      expect(formatAscii(Uint8Array.from([0x41, 0x00, 0x0A, 0x0D, 0x09, 0x5C]))).toBe('A\\x00\\n\\r\\t\\\\');
      expect(formatAscii(Uint8Array.from([0x7F, 0x80, 0xFF]))).toBe('\\x7F\\x80\\xFF');
    });

    it('uses dots for non-printable bytes when escape is disabled', () => {
      expect(formatAscii(Uint8Array.from([0x41, 0x00, 0x0A, 0x0D, 0x09, 0x5C]), { escape: false })).toBe('A....\\');
      expect(formatAscii(Uint8Array.from([0x7F, 0x80, 0xFF]), { escape: false })).toBe('...');
    });
  });

  describe('formatBinary', () => {
    it('formats every byte as eight bits separated by spaces', () => {
      expect(formatBinary(Uint8Array.from([0, 255, 128]))).toBe('00000000 11111111 10000000');
      expect(formatBinary(new Uint8Array())).toBe('');
    });
  });

  describe('convertHex', () => {
    it('returns an empty result for empty input', () => {
      const result = convertHex('');

      expect(result.byteLength).toBe(0);
      expect(result.raw).toBe('');
      expect(result.ascii).toBe('');
      expect(result.binary).toBe('');
      expect(result.blocks32).toEqual([]);
      expect(result.blocks16).toEqual([]);
      expect(result.trailingBytes32).toBe(0);
      expect(result.trailingBytes16).toBe(0);
    });

    it('decodes the documented 4-byte example', () => {
      const result = convertHex('41 48 00 00');

      expect(result.byteLength).toBe(4);
      expect(result.raw).toBe('41 48 00 00');
      expect(result.ascii).toBe('AH\\x00\\x00');
      expect(result.binary).toBe('01000001 01001000 00000000 00000000');
      expect(result.blocks32).toHaveLength(1);
      expect(result.blocks32[0]).toEqual({
        offset: 0,
        raw: '41 48 00 00',
        interpretedRaw: {
          ABCD: '41 48 00 00',
          DCBA: '00 00 48 41',
          BADC: '48 41 00 00',
          CDAB: '00 00 41 48',
        },
        values: {
          float: {
            ABCD: '12.5',
            DCBA: '2.591981769461614e-41',
            BADC: '197632',
            CDAB: '2.3418499935796343e-41',
          },
          uint32: {
            ABCD: '1095237632',
            DCBA: '18497',
            BADC: '1212219392',
            CDAB: '16712',
          },
          int32: {
            ABCD: '1095237632',
            DCBA: '18497',
            BADC: '1212219392',
            CDAB: '16712',
          },
        },
      });
      expect(result.blocks16).toEqual([
        {
          offset: 0,
          raw: '41 48',
          interpretedRaw: { AB: '41 48', BA: '48 41' },
          values: {
            int16: { AB: '16712', BA: '18497' },
            uint16: { AB: '16712', BA: '18497' },
          },
        },
        {
          offset: 2,
          raw: '00 00',
          interpretedRaw: { AB: '00 00', BA: '00 00' },
          values: {
            int16: { AB: '0', BA: '0' },
            uint16: { AB: '0', BA: '0' },
          },
        },
      ]);
      expect(result.trailingBytes32).toBe(0);
      expect(result.trailingBytes16).toBe(0);
    });

    it.each([
      ['3F 80 00 00', 'ABCD'],
      ['00 00 80 3F', 'DCBA'],
      ['80 3F 00 00', 'BADC'],
      ['00 00 3F 80', 'CDAB'],
    ] as const)('decodes float 1.0 from %s with %s', (input, order) => {
      const result = convertHex(input);

      expect(result.blocks32[0].values.float[order]).toBe('1');
    });

    it.each([
      ['12 34 56 78', { ABCD: '305419896', DCBA: '2018915346', BADC: '873625686', CDAB: '1450709556' }],
    ] as const)('decodes unsigned 32-bit values for %s', (input, expected) => {
      const result = convertHex(input);

      expect(result.blocks32[0].values.uint32).toEqual(expected);
    });

    it('decodes signed 32-bit boundaries', () => {
      expect(convertHex('FF FF FF FF').blocks32[0].values).toMatchObject({
        int32: { ABCD: '-1' },
        uint32: { ABCD: '4294967295' },
      });
      expect(convertHex('80 00 00 00').blocks32[0].values).toMatchObject({
        int32: { ABCD: '-2147483648' },
        uint32: { ABCD: '2147483648' },
      });
    });

    it('decodes IEEE 754 special values', () => {
      expect(convertHex('7F C0 00 00').blocks32[0].values.float.ABCD).toBe('NaN');
      expect(convertHex('7F 80 00 00').blocks32[0].values.float.ABCD).toBe('Infinity');
      expect(convertHex('FF 80 00 00').blocks32[0].values.float.ABCD).toBe('-Infinity');
      expect(convertHex('80 00 00 00').blocks32[0].values.float.ABCD).toBe('-0');
    });

    it('decodes signed and unsigned 16-bit values', () => {
      expect(convertHex('80 00').blocks16[0].values).toEqual({
        int16: { AB: '-32768', BA: '128' },
        uint16: { AB: '32768', BA: '128' },
      });
      expect(convertHex('00 80').blocks16[0].values).toEqual({
        int16: { AB: '128', BA: '-32768' },
        uint16: { AB: '128', BA: '32768' },
      });
      expect(convertHex('FF FF').blocks16[0].values).toEqual({
        int16: { AB: '-1', BA: '-1' },
        uint16: { AB: '65535', BA: '65535' },
      });
    });

    it('supports ASCII escape and dot modes', () => {
      expect(convertHex('41 00 0A 5C').ascii).toBe('A\\x00\\n\\\\');
      expect(convertHex('41 00 0A 5C', { asciiEscape: false }).ascii).toBe('A..\\');
      expect(convertHex('E4 B8 AD').ascii).toBe('\\xE4\\xB8\\xAD');
      expect(convertHex('E4 B8 AD', { asciiEscape: false }).ascii).toBe('...');
    });

    it('groups every complete 4-byte and 2-byte block', () => {
      const result = convertHex('3F 80 00 00 40 00 00 00');

      expect(result.blocks32).toHaveLength(2);
      expect(result.blocks32[0]).toMatchObject({ offset: 0, raw: '3F 80 00 00' });
      expect(result.blocks32[1]).toMatchObject({ offset: 4, raw: '40 00 00 00' });
      expect(result.blocks32[0].values.float.ABCD).toBe('1');
      expect(result.blocks32[1].values.float.ABCD).toBe('2');

      expect(result.blocks16).toHaveLength(4);
      expect(result.blocks16.map(block => block.offset)).toEqual([0, 2, 4, 6]);
      expect(result.blocks16.map(block => block.raw)).toEqual(['3F 80', '00 00', '40 00', '00 00']);
    });

    it('reports trailing bytes without padding or truncating', () => {
      const sixBytes = convertHex('41 48 00 00 00 00');
      expect(sixBytes.blocks32).toHaveLength(1);
      expect(sixBytes.blocks16).toHaveLength(3);
      expect(sixBytes.trailingBytes32).toBe(2);
      expect(sixBytes.trailingBytes16).toBe(0);
      expect(sixBytes.raw).toBe('41 48 00 00 00 00');

      const sevenBytes = convertHex('41 48 00 00 00 00 00');
      expect(sevenBytes.blocks32).toHaveLength(1);
      expect(sevenBytes.blocks16).toHaveLength(3);
      expect(sevenBytes.trailingBytes32).toBe(3);
      expect(sevenBytes.trailingBytes16).toBe(1);

      const oneByte = convertHex('41');
      expect(oneByte.blocks32).toHaveLength(0);
      expect(oneByte.blocks16).toHaveLength(0);
      expect(oneByte.trailingBytes32).toBe(1);
      expect(oneByte.trailingBytes16).toBe(1);
      expect(oneByte.ascii).toBe('A');
      expect(oneByte.binary).toBe('01000001');
    });

    it('does not impose an input length limit', () => {
      const bytes = Uint8Array.from({ length: 128 }, (_, index) => index);
      const result = convertHexBytes(bytes);

      expect(result.byteLength).toBe(128);
      expect(result.blocks32).toHaveLength(32);
      expect(result.blocks16).toHaveLength(64);
      expect(result.trailingBytes32).toBe(0);
      expect(result.trailingBytes16).toBe(0);
      expect(result.blocks32[31]).toMatchObject({ offset: 124, raw: '7C 7D 7E 7F' });
      expect(result.blocks16[63]).toMatchObject({ offset: 126, raw: '7E 7F' });
    });

    it('does not mutate the input bytes', () => {
      const bytes = Uint8Array.from([0x41, 0x48, 0x00, 0x00]);
      convertHexBytes(bytes);

      expect(bytes).toEqual(Uint8Array.from([0x41, 0x48, 0x00, 0x00]));
    });

    it('rejects malformed HEX input', () => {
      expect(() => convertHex('0')).toThrow('Invalid HEX byte sequence');
      expect(() => convertHex('0 1')).toThrow('Invalid HEX byte sequence');
      expect(() => convertHex('GG')).toThrow('Invalid HEX byte sequence');
      expect(() => convertHex('0x')).toThrow('Invalid HEX byte sequence');
    });
  });

  describe('labels', () => {
    it('uses the labels required by the specification', () => {
      expect(VALUE_TYPE_LABELS).toMatchObject({
        float: 'Float',
        uint32: 'UINT32',
        int32: 'INT32',
        int16: 'INT16',
        uint16: 'UINT16',
        ascii: 'ASCII',
        binary: 'Binary',
      });
      expect(BYTE_ORDER_LABELS_32).toEqual({
        ABCD: 'Big Endian (ABCD)',
        DCBA: 'Little Endian (DCBA)',
        BADC: 'Mid-Big Endian (BADC)',
        CDAB: 'Mid-Little Endian (CDAB)',
      });
      expect(BYTE_ORDER_LABELS_16).toEqual({
        AB: 'Big Endian (AB)',
        BA: 'Little Endian (BA)',
      });
    });
  });
});
