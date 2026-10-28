import { formatHexBytes, parseHexInput } from '@/utils/hex';

export const ENDIAN_32 = ['ABCD', 'DCBA', 'BADC', 'CDAB'] as const;
export const ENDIAN_16 = ['AB', 'BA'] as const;

export type Endian32 = (typeof ENDIAN_32)[number];
export type Endian16 = (typeof ENDIAN_16)[number];

export const BYTE_ORDER_SEQUENCES_32: Record<Endian32, readonly number[]> = {
  ABCD: [0, 1, 2, 3],
  DCBA: [3, 2, 1, 0],
  BADC: [1, 0, 3, 2],
  CDAB: [2, 3, 0, 1],
};

export const BYTE_ORDER_SEQUENCES_16: Record<Endian16, readonly number[]> = {
  AB: [0, 1],
  BA: [1, 0],
};

export const BYTE_ORDER_LABELS_32: Record<Endian32, string> = {
  ABCD: 'Big Endian (ABCD)',
  DCBA: 'Little Endian (DCBA)',
  BADC: 'Mid-Big Endian (BADC)',
  CDAB: 'Mid-Little Endian (CDAB)',
};

export const BYTE_ORDER_LABELS_16: Record<Endian16, string> = {
  AB: 'Big Endian (AB)',
  BA: 'Little Endian (BA)',
};

export const VALUE_TYPE_LABELS = {
  float: 'Float',
  uint32: 'UINT32',
  int32: 'INT32',
  int16: 'INT16',
  uint16: 'UINT16',
  ascii: 'ASCII',
  binary: 'Binary',
} as const;

// Only used to show a non-blocking performance hint in the UI; the input is never truncated.
export const HEX_LONG_INPUT_BYTES = 256;

export interface ConvertHexOptions {
  asciiEscape?: boolean
}

export interface Block32Result {
  offset: number
  raw: string
  interpretedRaw: Record<Endian32, string>
  values: {
    float: Record<Endian32, string>
    uint32: Record<Endian32, string>
    int32: Record<Endian32, string>
  }
}

export interface Block16Result {
  offset: number
  raw: string
  interpretedRaw: Record<Endian16, string>
  values: {
    int16: Record<Endian16, string>
    uint16: Record<Endian16, string>
  }
}

export interface HexConversionResult {
  byteLength: number
  raw: string
  ascii: string
  binary: string
  blocks32: Block32Result[]
  blocks16: Block16Result[]
  trailingBytes32: number
  trailingBytes16: number
}

function reorderBytes(bytes: Uint8Array, sequence: readonly number[]): Uint8Array {
  return Uint8Array.from(sequence, index => bytes[index]);
}

function decodeBlock32(bytes: Uint8Array, order: Endian32): {
  interpretedRaw: string
  float: string
  uint32: string
  int32: string
} {
  const sequence = reorderBytes(bytes, BYTE_ORDER_SEQUENCES_32[order]);
  const view = new DataView(sequence.buffer);

  return {
    interpretedRaw: formatHexBytes(sequence),
    float: formatFloat32(view.getFloat32(0, false)),
    uint32: String(view.getUint32(0, false)),
    int32: String(view.getInt32(0, false)),
  };
}

function decodeBlock16(bytes: Uint8Array, order: Endian16): {
  interpretedRaw: string
  int16: string
  uint16: string
} {
  const sequence = reorderBytes(bytes, BYTE_ORDER_SEQUENCES_16[order]);
  const view = new DataView(sequence.buffer);

  return {
    interpretedRaw: formatHexBytes(sequence),
    int16: String(view.getInt16(0, false)),
    uint16: String(view.getUint16(0, false)),
  };
}

export function formatFloat32(value: number): string {
  if (Number.isNaN(value)) {
    return 'NaN';
  }
  if (value === Number.POSITIVE_INFINITY) {
    return 'Infinity';
  }
  if (value === Number.NEGATIVE_INFINITY) {
    return '-Infinity';
  }
  if (Object.is(value, -0)) {
    return '-0';
  }

  return String(value);
}

export function formatAscii(bytes: Uint8Array, { escape = true }: { escape?: boolean } = {}): string {
  let result = '';

  for (const byte of bytes) {
    if (byte >= 0x20 && byte <= 0x7E && byte !== 0x5C) {
      result += String.fromCharCode(byte);
      continue;
    }

    if (!escape) {
      result += byte === 0x5C ? '\\' : '.';
      continue;
    }

    switch (byte) {
      case 0x09:
        result += '\\t';
        break;
      case 0x0A:
        result += '\\n';
        break;
      case 0x0D:
        result += '\\r';
        break;
      case 0x5C:
        result += '\\\\';
        break;
      default:
        result += `\\x${byte.toString(16).padStart(2, '0').toUpperCase()}`;
    }
  }

  return result;
}

export function formatBinary(bytes: Uint8Array): string {
  return Array.from(bytes, byte => byte.toString(2).padStart(8, '0')).join(' ');
}

export function convertHexBytes(
  bytes: Uint8Array,
  { asciiEscape = true }: ConvertHexOptions = {},
): HexConversionResult {
  const blocks32: Block32Result[] = [];
  const blocks16: Block16Result[] = [];

  for (let offset = 0; offset + 4 <= bytes.length; offset += 4) {
    const blockBytes = bytes.subarray(offset, offset + 4);
    const interpretedRaw = {} as Record<Endian32, string>;
    const values: Block32Result['values'] = {
      float: {} as Record<Endian32, string>,
      uint32: {} as Record<Endian32, string>,
      int32: {} as Record<Endian32, string>,
    };

    for (const order of ENDIAN_32) {
      const decoded = decodeBlock32(blockBytes, order);
      interpretedRaw[order] = decoded.interpretedRaw;
      values.float[order] = decoded.float;
      values.uint32[order] = decoded.uint32;
      values.int32[order] = decoded.int32;
    }

    blocks32.push({
      offset,
      raw: formatHexBytes(blockBytes),
      interpretedRaw,
      values,
    });
  }

  for (let offset = 0; offset + 2 <= bytes.length; offset += 2) {
    const blockBytes = bytes.subarray(offset, offset + 2);
    const interpretedRaw = {} as Record<Endian16, string>;
    const values: Block16Result['values'] = {
      int16: {} as Record<Endian16, string>,
      uint16: {} as Record<Endian16, string>,
    };

    for (const order of ENDIAN_16) {
      const decoded = decodeBlock16(blockBytes, order);
      interpretedRaw[order] = decoded.interpretedRaw;
      values.int16[order] = decoded.int16;
      values.uint16[order] = decoded.uint16;
    }

    blocks16.push({
      offset,
      raw: formatHexBytes(blockBytes),
      interpretedRaw,
      values,
    });
  }

  return {
    byteLength: bytes.length,
    raw: formatHexBytes(bytes),
    ascii: formatAscii(bytes, { escape: asciiEscape }),
    binary: formatBinary(bytes),
    blocks32,
    blocks16,
    trailingBytes32: bytes.length % 4,
    trailingBytes16: bytes.length % 2,
  };
}

export function convertHex(input: string, options: ConvertHexOptions = {}): HexConversionResult {
  return convertHexBytes(parseHexInput(input), options);
}
