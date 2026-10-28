import { Exchange } from '@vicons/tabler';
import { defineTool } from '../tool';

export const tool = defineTool({
  name: 'HEX converter',
  path: '/hex-converter',
  description: 'Decode HEX bytes into ASCII, binary, IEEE-754 floats and signed/unsigned integers, showing RAW bytes and results for every common byte order.',
  keywords: [
    'hex', 'hexadecimal', 'decoder', 'converter', 'ascii', 'binary',
    'float', 'uint32', 'int32', 'int16', 'uint16',
    'endian', 'big endian', 'little endian', 'mid-big endian', 'mid-little endian',
    'device packet', '16进制', '十六进制', '转换', '解码', '字节序', '浮点数', '设备报文',
  ],
  component: () => import('./hex-converter.vue'),
  icon: Exchange,
  createdAt: new Date('2026-10-28'),
});
