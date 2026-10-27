import { Calculator } from '@vicons/tabler';
import { defineTool } from '../tool';

export const tool = defineTool({
  name: 'CRC calculator',
  path: '/crc-calculator',
  description: 'Calculate CRC checksums for HEX device packets and copy the complete packet with CRC.',
  keywords: ['crc', 'crc16', 'crc32', 'modbus', 'checksum', 'hex', 'packet', '校验', '报文', '循环冗余校验'],
  component: () => import('./crc-calculator.vue'),
  icon: Calculator,
  createdAt: new Date('2026-10-27'),
});
