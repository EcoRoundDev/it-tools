export type CrcByteOrder = 'little-endian' | 'big-endian';
export type HexSeparator = ' ' | '';

// Parameters follow the CRC RevEng catalogue: https://reveng.sourceforge.io/crc-catalogue/
// All presets use the same setting for RefIn and RefOut.
export const crcAlgorithms = {
  'crc16-modbus': {
    label: 'CRC-16/MODBUS',
    width: 16,
    polynomial: 0x8005,
    initial: 0xFFFF,
    xorOut: 0x0000,
    reflected: true,
    byteOrder: 'little-endian',
  },
  'crc16-arc': {
    label: 'CRC-16/ARC (IBM)',
    width: 16,
    polynomial: 0x8005,
    initial: 0x0000,
    xorOut: 0x0000,
    reflected: true,
    byteOrder: 'big-endian',
  },
  'crc16-ccitt-false': {
    label: 'CRC-16/CCITT-FALSE (IBM-3740)',
    width: 16,
    polynomial: 0x1021,
    initial: 0xFFFF,
    xorOut: 0x0000,
    reflected: false,
    byteOrder: 'big-endian',
  },
  'crc16-xmodem': {
    label: 'CRC-16/XMODEM',
    width: 16,
    polynomial: 0x1021,
    initial: 0x0000,
    xorOut: 0x0000,
    reflected: false,
    byteOrder: 'big-endian',
  },
  'crc32-iso-hdlc': {
    label: 'CRC-32/ISO-HDLC',
    width: 32,
    polynomial: 0x04C11DB7,
    initial: 0xFFFFFFFF,
    xorOut: 0xFFFFFFFF,
    reflected: true,
    byteOrder: 'big-endian',
  },
} as const;

export type CrcAlgorithmId = keyof typeof crcAlgorithms;

export function parseHexInput(input: string): Uint8Array {
  if (!input.trim()) {
    return new Uint8Array();
  }

  const bytes: number[] = [];

  for (const token of input.trim().split(/[\s,]+/)) {
    // Validate each group before parsing: do not silently discard bad characters
    // or turn incomplete groups such as "0 1" into the byte 01.
    if (!/^(?:0x)?(?:[\da-f]{2})+$/i.test(token)) {
      throw new Error('Invalid HEX byte sequence');
    }

    const hex = token.replace(/^0x/i, '');

    for (let offset = 0; offset < hex.length; offset += 2) {
      bytes.push(Number.parseInt(hex.slice(offset, offset + 2), 16));
    }
  }

  return Uint8Array.from(bytes);
}

function reflectBits(value: number, width: number): number {
  let reflected = 0;

  for (let bit = 0; bit < width; bit++) {
    reflected = (reflected << 1) | (value & 1);
    value >>>= 1;
  }

  return reflected >>> 0;
}

export function calculateCrc(bytes: Uint8Array, algorithm: CrcAlgorithmId): number {
  const { width, polynomial, initial, xorOut, reflected } = crcAlgorithms[algorithm];
  const mask = width === 32 ? 0xFFFFFFFF : 0xFFFF;
  const topBit = 1 << (width - 1);
  const workingPolynomial = reflected ? reflectBits(polynomial, width) : polynomial;
  let crc: number = initial;

  for (const byte of bytes) {
    crc ^= reflected ? byte : byte << (width - 8);

    for (let bit = 0; bit < 8; bit++) {
      crc = reflected
        ? (crc >>> 1) ^ ((crc & 1) ? workingPolynomial : 0)
        : (crc << 1) ^ ((crc & topBit) ? workingPolynomial : 0);
      crc = (crc & mask) >>> 0;
    }
  }

  return ((crc ^ xorOut) & mask) >>> 0;
}

export function formatHexBytes(bytes: Uint8Array, separator: HexSeparator = ' '): string {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0').toUpperCase()).join(separator);
}

export function calculatePacketCrc({
  input,
  algorithm = 'crc16-modbus',
  byteOrder = crcAlgorithms[algorithm].byteOrder,
  separator = ' ',
}: {
  input: string
  algorithm?: CrcAlgorithmId
  byteOrder?: CrcByteOrder
  separator?: HexSeparator
}) {
  const bytes = parseHexInput(input);
  const value = calculateCrc(bytes, algorithm);
  const checksumLength = crcAlgorithms[algorithm].width / 8;
  const checksumBytes = Uint8Array.from(
    { length: checksumLength },
    (_, index) => (value >>> (index * 8)) & 0xFF,
  );

  if (byteOrder === 'big-endian') {
    checksumBytes.reverse();
  }

  const packet = new Uint8Array(bytes.length + checksumBytes.length);
  packet.set(bytes);
  packet.set(checksumBytes, bytes.length);

  return {
    checksum: value.toString(16).padStart(checksumLength * 2, '0').toUpperCase(),
    checksumBytes: formatHexBytes(checksumBytes, separator),
    packet: formatHexBytes(packet, separator),
    byteLength: bytes.length,
  };
}
