import { describe, expect, it } from 'vitest';
import type { CrcAlgorithmId } from './crc-calculator.service';
import { calculateCrc, calculatePacketCrc, formatHexBytes, parseHexInput } from './crc-calculator.service';

describe('CRC calculator', () => {
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

  describe('calculateCrc', () => {
    const checkBytes = parseHexInput('31 32 33 34 35 36 37 38 39');
    const checkValues: [CrcAlgorithmId, number][] = [
      ['crc16-modbus', 0x4B37],
      ['crc16-arc', 0xBB3D],
      ['crc16-ccitt-false', 0x29B1],
      ['crc16-xmodem', 0x31C3],
      ['crc32-iso-hdlc', 0xCBF43926],
    ];

    it.each(checkValues)('matches the catalogue check value for %s', (algorithm, expected) => {
      expect(calculateCrc(checkBytes, algorithm)).toBe(expected);
    });

    const emptyValues: [CrcAlgorithmId, number][] = [
      ['crc16-modbus', 0xFFFF],
      ['crc16-arc', 0x0000],
      ['crc16-ccitt-false', 0xFFFF],
      ['crc16-xmodem', 0x0000],
      ['crc32-iso-hdlc', 0x00000000],
    ];

    it.each(emptyValues)('uses the correct initial/final values for empty %s input', (algorithm, expected) => {
      expect(calculateCrc(new Uint8Array(), algorithm)).toBe(expected);
    });

    it('matches the Modbus specification byte-order example', () => {
      expect(calculateCrc(parseHexInput('02 07'), 'crc16-modbus')).toBe(0x1241);
    });

    it('does not mutate the input bytes', () => {
      const input = Uint8Array.from([0, 128, 255]);
      calculateCrc(input, 'crc32-iso-hdlc');

      expect(input).toEqual(Uint8Array.from([0, 128, 255]));
    });
  });

  describe('calculatePacketCrc', () => {
    it('defaults to Modbus with low byte first', () => {
      expect(calculatePacketCrc({ input: '01 03 00 00 00 0A' })).toEqual({
        checksum: 'CDC5',
        checksumBytes: 'C5 CD',
        packet: '01 03 00 00 00 0A C5 CD',
        byteLength: 6,
      });
    });

    it('changes only the appended CRC byte order, not the input or checksum value', () => {
      expect(calculatePacketCrc({ input: '01 03 00 00 00 0A', byteOrder: 'big-endian' })).toEqual({
        checksum: 'CDC5',
        checksumBytes: 'CD C5',
        packet: '01 03 00 00 00 0A CD C5',
        byteLength: 6,
      });
    });

    it('formats a compact packet for copying', () => {
      expect(calculatePacketCrc({ input: '0x01, 0x03, 00 00 00 0a', separator: '' })).toEqual({
        checksum: 'CDC5',
        checksumBytes: 'C5CD',
        packet: '01030000000AC5CD',
        byteLength: 6,
      });
    });

    it('keeps all four CRC-32 bytes, including an unsigned high bit', () => {
      const result = calculatePacketCrc({
        input: '31 32 33 34 35 36 37 38 39',
        algorithm: 'crc32-iso-hdlc',
        byteOrder: 'little-endian',
      });

      expect(result.checksum).toBe('CBF43926');
      expect(result.checksumBytes).toBe('26 39 F4 CB');
      expect(result.packet).toBe('31 32 33 34 35 36 37 38 39 26 39 F4 CB');
    });

    it('starts non-Modbus presets with high byte first', () => {
      const result = calculatePacketCrc({ input: '31 32 33 34 35 36 37 38 39', algorithm: 'crc16-xmodem' });

      expect(result.checksum).toBe('31C3');
      expect(result.checksumBytes).toBe('31 C3');
    });

    it('preserves leading zeroes in checksums', () => {
      const result = calculatePacketCrc({ input: '00', algorithm: 'crc16-xmodem' });

      expect(result.checksum).toBe('0000');
      expect(result.checksumBytes).toBe('00 00');
      expect(result.packet).toBe('00 00 00');
    });

    it('rejects invalid input before producing a packet', () => {
      expect(() => calculatePacketCrc({ input: '01 0' })).toThrow();
    });
  });

  it('formats all bytes with two uppercase HEX digits', () => {
    expect(formatHexBytes(Uint8Array.from([0, 1, 128, 255]))).toBe('00 01 80 FF');
    expect(formatHexBytes(Uint8Array.from([0, 1, 128, 255]), '')).toBe('000180FF');
  });
});
