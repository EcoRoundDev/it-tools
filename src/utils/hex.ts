export { formatHexBytes, parseHexInput };

function parseHexInput(input: string): Uint8Array {
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

function formatHexBytes(bytes: Uint8Array, separator = ' '): string {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0').toUpperCase()).join(separator);
}
