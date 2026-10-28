<script setup lang="ts">
import type { CrcAlgorithmId, CrcByteOrder, HexSeparator } from './crc-calculator.service';
import { calculatePacketCrc, crcAlgorithms } from './crc-calculator.service';
import { useCopy } from '@/composable/copy';
import { useValidation } from '@/composable/validation';
import { isNotThrowing } from '@/utils/boolean';
import { parseHexInput } from '@/utils/hex';

const { t, locale } = useI18n();
const input = ref('01 03 00 00 00 0A');
const algorithm = ref<CrcAlgorithmId>('crc16-modbus');
const byteOrder = ref<CrcByteOrder>('little-endian');
const separator = ref<HexSeparator>(' ');
const selectedAlgorithm = computed(() => crcAlgorithms[algorithm.value]);
const algorithmOptions = Object.entries(crcAlgorithms).map(([value, { label }]) => ({ label, value }));
const byteOrderOptions = computed(() => [
  { label: t('tools.crc-calculator.littleEndian'), value: 'little-endian' },
  { label: t('tools.crc-calculator.bigEndian'), value: 'big-endian' },
]);
const separatorOptions = computed(() => [
  { label: t('tools.crc-calculator.space'), value: ' ' },
  { label: t('tools.crc-calculator.none'), value: '' },
]);

watch(algorithm, value => byteOrder.value = crcAlgorithms[value].byteOrder);

const validation = useValidation({
  source: input,
  rules: computed(() => [{
    message: t('tools.crc-calculator.invalidHex'),
    validator: (value: string) => isNotThrowing(() => parseHexInput(value)),
  }]),
  watch: [locale],
});

const result = computed(() => {
  if (!input.value.trim()) {
    return undefined;
  }

  try {
    return calculatePacketCrc({
      input: input.value,
      algorithm: algorithm.value,
      byteOrder: byteOrder.value,
      separator: separator.value,
    });
  }
  catch {
    return undefined;
  }
});

const outputs = computed(() => [
  { id: 'checksum', label: t('tools.crc-calculator.checksum'), value: result.value?.checksum ?? '', copyLabel: t('tools.crc-calculator.copyChecksum') },
  { id: 'bytes', label: t('tools.crc-calculator.checksumBytes'), value: result.value?.checksumBytes ?? '', copyLabel: t('tools.crc-calculator.copyBytes') },
  { id: 'packet', label: t('tools.crc-calculator.packet'), value: result.value?.packet ?? '', copyLabel: t('tools.crc-calculator.copyPacket') },
]);
const { copy } = useCopy();

async function copyResult(value: string) {
  if (value) {
    await copy(value, { notificationMessage: t('tools.crc-calculator.copied') });
  }
}

function formatParameter(value: number) {
  return `0x${value.toString(16).padStart(selectedAlgorithm.value.width / 4, '0').toUpperCase()}`;
}
</script>

<template>
  <div class="crc-page" important:flex-1>
    <div class="crc-grid">
      <c-card>
        <div grid grid-cols-1 mb-5 gap-4 sm:grid-cols-2>
          <div sm:col-span-2 data-test-id="crc-algorithm">
            <c-select v-model:value="algorithm" :label="t('tools.crc-calculator.algorithm')" :options="algorithmOptions" />
          </div>
          <div data-test-id="crc-byte-order">
            <c-select v-model:value="byteOrder" :label="t('tools.crc-calculator.byteOrder')" :options="byteOrderOptions">
              <template #displayed-value>
                {{ byteOrder === 'little-endian' ? t('tools.crc-calculator.littleEndian') : t('tools.crc-calculator.bigEndian') }}
              </template>
            </c-select>
          </div>
          <div data-test-id="crc-separator">
            <c-select v-model:value="separator" :label="t('tools.crc-calculator.separator')" :options="separatorOptions">
              <template #displayed-value>
                {{ separator === ' ' ? t('tools.crc-calculator.space') : t('tools.crc-calculator.none') }}
              </template>
            </c-select>
          </div>
        </div>

        <c-input-text
          v-model:value="input"
          :label="t('tools.crc-calculator.input')"
          placeholder="01 03 00 00 00 0A"
          :validation="validation"
          raw-text clearable autofocus multiline monospace
          rows="4"
          test-id="crc-input"
        />

        <p mb-0 text-sm op-70>
          {{ t('tools.crc-calculator.inputHelp') }}
        </p>
        <p text-sm op-70>
          {{ t('tools.crc-calculator.coverageHelp') }}
        </p>
        <div break-all text-xs font-mono op-70 data-test-id="crc-parameters">
          Width={{ selectedAlgorithm.width }} · Poly={{ formatParameter(selectedAlgorithm.polynomial) }} ·
          Init={{ formatParameter(selectedAlgorithm.initial) }} · RefIn/RefOut={{ selectedAlgorithm.reflected }} ·
          XorOut={{ formatParameter(selectedAlgorithm.xorOut) }}
        </div>
      </c-card>

      <c-card>
        <p mt-0 text-sm op-70 data-test-id="crc-byte-count">
          {{ t('tools.crc-calculator.byteCount', { count: result?.byteLength ?? 0 }) }}
        </p>
        <div v-for="output in outputs" :key="output.id" mb-4>
          <c-input-text
            :value="output.value"
            :label="output.label"
            :test-id="`crc-${output.id}`"
            placeholder=""
            multiline raw-text monospace autosize readonly
            rows="2"
          />
          <div mt-2 flex justify-end>
            <c-button
              :disabled="!output.value"
              :aria-disabled="!output.value"
              :data-test-id="`copy-crc-${output.id}`"
              @click="copyResult(output.value)"
            >
              {{ output.copyLabel }}
            </c-button>
          </div>
        </div>
        <p mb-0 text-sm op-70>
          {{ t('tools.crc-calculator.byteOrderHelp') }}
        </p>
      </c-card>
    </div>
  </div>
</template>

<style scoped>
.crc-page {
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
}

.crc-grid {
  display: grid;
  grid-template-columns: 1fr;
  align-items: flex-start;
  gap: 16px;
}

@media (min-width: 1280px) {
  .crc-page {
    max-width: 1200px;
  }

  .crc-grid {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
  }
}
</style>
