<script setup lang="ts">
import type { Block16Result, Block32Result, Endian16, Endian32, HexConversionResult } from './hex-converter.service';
import {
  BYTE_ORDER_LABELS_16,
  BYTE_ORDER_LABELS_32,
  ENDIAN_16,
  ENDIAN_32,
  HEX_LONG_INPUT_BYTES,
  VALUE_TYPE_LABELS,
  convertHex,
} from './hex-converter.service';
import { useCopy } from '@/composable/copy';
import { useValidation } from '@/composable/validation';
import { parseHexInput } from '@/utils/hex';

const { t, locale } = useI18n();

const VALUE_32_TYPES = ['float', 'uint32', 'int32'] as const;
const VALUE_16_TYPES = ['int16', 'uint16'] as const;

type Value32Type = (typeof VALUE_32_TYPES)[number];
type Value16Type = (typeof VALUE_16_TYPES)[number];
type AsciiMode = 'escape' | 'dots';

const emptyResult: HexConversionResult = {
  byteLength: 0,
  raw: '',
  ascii: '',
  binary: '',
  blocks32: [],
  blocks16: [],
  trailingBytes32: 0,
  trailingBytes16: 0,
};

const input = ref('41 48 00 00');
const asciiMode = ref<AsciiMode>('escape');

const validation = useValidation({
  source: input,
  rules: computed(() => [{
    message: '{0}',
    validator: (value: string) => {
      if (!value.trim()) {
        return true;
      }

      try {
        parseHexInput(value);
        return true;
      }
      catch {
        return false;
      }
    },
    getErrorMessage: () => t('tools.hex-converter.invalidHex'),
  }]),
  watch: [locale],
});

const result = computed<HexConversionResult>(() => {
  try {
    return convertHex(input.value, { asciiEscape: asciiMode.value === 'escape' });
  }
  catch {
    return emptyResult;
  }
});

const hasResult = computed(() => result.value.byteLength > 0);
const isEmpty = computed(() => !input.value.trim());
const isInvalid = computed(() => !isEmpty.value && !validation.isValid);
const isLongInput = computed(() => result.value.byteLength > HEX_LONG_INPUT_BYTES);

const asciiModeOptions = computed<{ label: string; value: AsciiMode }[]>(() => [
  { label: t('tools.hex-converter.asciiEscape'), value: 'escape' },
  { label: t('tools.hex-converter.asciiDots'), value: 'dots' },
]);

function value32(block: Block32Result, type: Value32Type, order: Endian32): string {
  return block.values[type][order];
}

function value16(block: Block16Result, type: Value16Type, order: Endian16): string {
  return block.values[type][order];
}

function value32Title(block: Block32Result, order: Endian32): string {
  return `${t('tools.hex-converter.copyValue')} · ${block.interpretedRaw[order]}`;
}

function value16Title(block: Block16Result, order: Endian16): string {
  return `${t('tools.hex-converter.copyValue')} · ${block.interpretedRaw[order]}`;
}

const { copy } = useCopy();

async function copyValue(value: string, notificationMessage = t('tools.hex-converter.copied')) {
  if (!value) {
    return;
  }

  await copy(value, { notificationMessage });
}

function rawAriaLabel(raw: string): string {
  return `${t('tools.hex-converter.copyRaw')}: ${raw}`;
}

function valueAriaLabel(value: string): string {
  return `${t('tools.hex-converter.copyValue')}: ${value}`;
}
</script>

<template>
  <div class="hex-page" important:flex-1>
    <div class="hex-grid">
      <c-card :title="t('tools.hex-converter.input')" class="hex-input-card">
        <c-input-text
          v-model:value="input"
          :label="t('tools.hex-converter.inputLabel')"
          :placeholder="t('tools.hex-converter.inputPlaceholder')"
          :validation="validation"
          test-id="hex-input"

          autosize raw-text clearable autofocus multiline monospace
        />

        <div v-if="hasResult" class="hex-meta">
          <span data-test-id="hex-byte-count">{{ t('tools.hex-converter.byteCount', { count: result.byteLength }) }}</span>
          <span class="hex-meta-sep">·</span>
          <span>{{ t('tools.hex-converter.normalizedRaw') }}:</span>
          <button
            type="button"
            class="hex-value-button hex-meta-raw"
            data-test-id="hex-normalized-raw"
            :aria-label="rawAriaLabel(result.raw)"
            :title="t('tools.hex-converter.copyRaw')"
            @click="copyValue(result.raw)"
          >
            <span>{{ result.raw }}</span>
            <icon-mdi-content-copy class="hex-copy-icon" />
          </button>
        </div>

        <div mt-3 data-test-id="hex-ascii-mode">
          <c-buttons-select
            v-model:value="asciiMode"
            :options="asciiModeOptions"
            :label="t('tools.hex-converter.asciiMode')"
            label-position="top"
            size="small"
          />
        </div>

        <div v-if="isLongInput" mt-3 data-test-id="hex-long-hint">
          <n-alert type="warning" :show-icon="false">
            {{ t('tools.hex-converter.longInputHint', { count: result.byteLength }) }}
          </n-alert>
        </div>

        <div class="hex-help">
          <p>{{ t('tools.hex-converter.inputHelp') }}</p>
          <p>{{ t('tools.hex-converter.inputNote') }}</p>
          <p>{{ t('tools.hex-converter.endianNote') }}</p>
          <p>{{ t('tools.hex-converter.asciiNote') }}</p>
        </div>
      </c-card>

      <div class="hex-text-result">
        <c-card v-if="hasResult" :title="t('tools.hex-converter.textResults')">
          <div class="hex-table-wrap" data-test-id="hex-text-table">
            <n-table class="hex-table hex-table--text" :aria-label="t('tools.hex-converter.textResults')">
              <thead>
                <tr>
                  <th scope="col">
                    {{ t('tools.hex-converter.raw') }}
                  </th>
                  <th scope="col">
                    {{ t('tools.hex-converter.type') }}
                  </th>
                  <th scope="col">
                    {{ t('tools.hex-converter.value') }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td :rowspan="2" class="hex-raw-cell">
                    <button
                      type="button"
                      class="hex-value-button hex-raw-button"
                      data-test-id="hex-raw-text"
                      :aria-label="rawAriaLabel(result.raw)"
                      :title="t('tools.hex-converter.copyRaw')"
                      @click="copyValue(result.raw)"
                    >
                      <span class="font-mono">{{ result.raw }}</span>
                      <icon-mdi-content-copy class="hex-copy-icon" />
                    </button>
                  </td>
                  <td class="hex-type-cell">
                    {{ VALUE_TYPE_LABELS.ascii }}
                  </td>
                  <td class="hex-value-cell">
                    <button
                      type="button"
                      class="hex-value-button"
                      data-test-id="hex-ascii-value"
                      :aria-label="valueAriaLabel(result.ascii)"
                      :title="t('tools.hex-converter.copyValue')"
                      @click="copyValue(result.ascii)"
                    >
                      <span class="font-mono">{{ result.ascii }}</span>
                      <icon-mdi-content-copy class="hex-copy-icon" />
                    </button>
                  </td>
                </tr>
                <tr>
                  <td class="hex-type-cell">
                    {{ VALUE_TYPE_LABELS.binary }}
                  </td>
                  <td class="hex-value-cell">
                    <button
                      type="button"
                      class="hex-value-button"
                      data-test-id="hex-binary-value"
                      :aria-label="valueAriaLabel(result.binary)"
                      :title="t('tools.hex-converter.copyValue')"
                      @click="copyValue(result.binary)"
                    >
                      <span class="font-mono">{{ result.binary }}</span>
                      <icon-mdi-content-copy class="hex-copy-icon" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </n-table>
          </div>
        </c-card>

        <c-card v-else>
          <div class="hex-empty" :data-test-id="isInvalid ? 'hex-invalid' : 'hex-empty'">
            <p>{{ isInvalid ? t('tools.hex-converter.invalidHint') : t('tools.hex-converter.empty') }}</p>
          </div>
        </c-card>
      </div>

      <div v-if="hasResult" class="hex-numeric-results">
        <c-card :title="t('tools.hex-converter.values32')">
          <p class="hex-section-hint">
            {{ t('tools.hex-converter.values32Hint') }}
          </p>

          <p v-if="result.blocks32.length === 0" class="hex-hint" data-test-id="hex-need-32">
            {{ t('tools.hex-converter.need4Bytes') }}
          </p>
          <div v-else class="hex-table-wrap" data-test-id="hex-32-table">
            <n-table class="hex-table hex-table--32" :aria-label="t('tools.hex-converter.values32')">
              <thead>
                <tr>
                  <th scope="col">
                    {{ t('tools.hex-converter.raw') }}
                  </th>
                  <th scope="col">
                    {{ t('tools.hex-converter.offset') }}
                  </th>
                  <th scope="col">
                    {{ t('tools.hex-converter.type') }}
                  </th>
                  <th v-for="order in ENDIAN_32" :key="order" scope="col">
                    {{ BYTE_ORDER_LABELS_32[order] }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <template v-for="block in result.blocks32" :key="block.offset">
                  <tr v-for="(type, index) in VALUE_32_TYPES" :key="`${block.offset}-${type}`">
                    <td v-if="index === 0" :rowspan="VALUE_32_TYPES.length" class="hex-raw-cell">
                      <button
                        type="button"
                        class="hex-value-button hex-raw-button"
                        :data-test-id="`hex-raw-32-${block.offset}`"
                        :aria-label="rawAriaLabel(block.raw)"
                        :title="t('tools.hex-converter.copyRaw')"
                        @click="copyValue(block.raw)"
                      >
                        <span class="font-mono">{{ block.raw }}</span>
                        <icon-mdi-content-copy class="hex-copy-icon" />
                      </button>
                    </td>
                    <td v-if="index === 0" :rowspan="VALUE_32_TYPES.length" class="hex-offset-cell">
                      {{ block.offset }}
                    </td>
                    <td class="hex-type-cell">
                      {{ VALUE_TYPE_LABELS[type] }}
                    </td>
                    <td v-for="order in ENDIAN_32" :key="order" class="hex-value-cell">
                      <button
                        type="button"
                        class="hex-value-button"
                        :data-test-id="`hex-value-${type}-${order}-${block.offset}`"
                        :aria-label="valueAriaLabel(value32(block, type, order))"
                        :title="value32Title(block, order)"
                        @click="copyValue(value32(block, type, order))"
                      >
                        <span class="font-mono">{{ value32(block, type, order) }}</span>
                        <icon-mdi-content-copy class="hex-copy-icon" />
                      </button>
                    </td>
                  </tr>
                </template>
              </tbody>
            </n-table>
          </div>
          <p class="hex-scroll-hint">
            {{ t('tools.hex-converter.scrollHint') }}
          </p>
          <p v-if="result.blocks32.length > 0 && result.trailingBytes32 > 0" class="hex-warning" data-test-id="hex-trailing-32">
            {{ t('tools.hex-converter.trailing32', { count: result.trailingBytes32 }) }}
          </p>
        </c-card>

        <c-card :title="t('tools.hex-converter.values16')">
          <p class="hex-section-hint">
            {{ t('tools.hex-converter.values16Hint') }}
          </p>

          <p v-if="result.blocks16.length === 0" class="hex-hint" data-test-id="hex-need-16">
            {{ t('tools.hex-converter.need2Bytes') }}
          </p>
          <div v-else class="hex-table-wrap" data-test-id="hex-16-table">
            <n-table class="hex-table hex-table--16" :aria-label="t('tools.hex-converter.values16')">
              <thead>
                <tr>
                  <th scope="col">
                    {{ t('tools.hex-converter.raw') }}
                  </th>
                  <th scope="col">
                    {{ t('tools.hex-converter.offset') }}
                  </th>
                  <th scope="col">
                    {{ t('tools.hex-converter.type') }}
                  </th>
                  <th v-for="order in ENDIAN_16" :key="order" scope="col">
                    {{ BYTE_ORDER_LABELS_16[order] }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <template v-for="block in result.blocks16" :key="block.offset">
                  <tr v-for="(type, index) in VALUE_16_TYPES" :key="`${block.offset}-${type}`">
                    <td v-if="index === 0" :rowspan="VALUE_16_TYPES.length" class="hex-raw-cell">
                      <button
                        type="button"
                        class="hex-value-button hex-raw-button"
                        :data-test-id="`hex-raw-16-${block.offset}`"
                        :aria-label="rawAriaLabel(block.raw)"
                        :title="t('tools.hex-converter.copyRaw')"
                        @click="copyValue(block.raw)"
                      >
                        <span class="font-mono">{{ block.raw }}</span>
                        <icon-mdi-content-copy class="hex-copy-icon" />
                      </button>
                    </td>
                    <td v-if="index === 0" :rowspan="VALUE_16_TYPES.length" class="hex-offset-cell">
                      {{ block.offset }}
                    </td>
                    <td class="hex-type-cell">
                      {{ VALUE_TYPE_LABELS[type] }}
                    </td>
                    <td v-for="order in ENDIAN_16" :key="order" class="hex-value-cell">
                      <button
                        type="button"
                        class="hex-value-button"
                        :data-test-id="`hex-value-${type}-${order}-${block.offset}`"
                        :aria-label="valueAriaLabel(value16(block, type, order))"
                        :title="value16Title(block, order)"
                        @click="copyValue(value16(block, type, order))"
                      >
                        <span class="font-mono">{{ value16(block, type, order) }}</span>
                        <icon-mdi-content-copy class="hex-copy-icon" />
                      </button>
                    </td>
                  </tr>
                </template>
              </tbody>
            </n-table>
          </div>
          <p class="hex-scroll-hint">
            {{ t('tools.hex-converter.scrollHint') }}
          </p>
          <p v-if="result.blocks16.length > 0 && result.trailingBytes16 > 0" class="hex-warning" data-test-id="hex-trailing-16">
            {{ t('tools.hex-converter.trailing16', { count: result.trailingBytes16 }) }}
          </p>
        </c-card>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hex-page {
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
}

.hex-grid {
  display: grid;
  grid-template-columns: 1fr;
  align-items: flex-start;
  gap: 16px;
}

.hex-text-result,
.hex-numeric-results {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.hex-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px;
  margin-top: 10px;
  font-size: 13px;
  opacity: 0.8;
}

.hex-meta-sep {
  opacity: 0.5;
}

.hex-meta-raw {
  max-width: 100%;
  word-break: break-all;
}

.hex-help {
  margin-top: 16px;
  font-size: 13px;
  line-height: 1.5;
  opacity: 0.7;
}

.hex-help p {
  margin: 0 0 6px;
}

.hex-help p:last-child {
  margin-bottom: 0;
}

.hex-section-hint {
  margin: 0 0 10px;
  font-size: 13px;
  opacity: 0.7;
}

.hex-hint {
  margin: 0;
  font-size: 13px;
  opacity: 0.7;
}

.hex-warning {
  margin: 10px 0 0;
  font-size: 13px;
  color: #d97706;
}

.hex-scroll-hint {
  display: none;
  margin: 8px 0 0;
  font-size: 12px;
  opacity: 0.65;
}

@media (max-width: 900px) {
  .hex-scroll-hint {
    display: block;
  }
}

.hex-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 140px;
  padding: 16px;
  text-align: center;
  opacity: 0.7;
}

.hex-empty p {
  margin: 0;
}

.hex-table-wrap {
  overflow-x: auto;
}

.hex-table {
  font-size: 13px;
}

.hex-table--text {
  min-width: 420px;
}

.hex-table--32 {
  min-width: 820px;
}

.hex-table--16 {
  min-width: 520px;
}

.hex-table th {
  white-space: nowrap;
  font-size: 12px;
}

.hex-table td {
  vertical-align: top;
}

.hex-table tbody tr:hover {
  background-color: rgba(128, 128, 128, 0.06);
}

.hex-raw-cell {
  white-space: nowrap;
}

.hex-offset-cell {
  font-size: 12px;
  opacity: 0.65;
  white-space: nowrap;
}

.hex-type-cell {
  font-weight: 500;
  white-space: nowrap;
}

.hex-value-cell {
  min-width: 88px;
}

.hex-table--text .hex-value-cell {
  word-break: break-all;
}

.hex-value-button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.hex-table--32 .hex-value-button,
.hex-table--16 .hex-value-button {
  white-space: nowrap;
}

.hex-table--text .hex-value-button {
  white-space: normal;
  word-break: break-all;
}

.hex-table--text .hex-raw-cell .hex-value-button {
  white-space: nowrap;
  word-break: normal;
}

.hex-value-button:hover {
  color: var(--primary-color, #18a058);
}

.hex-value-button:focus-visible {
  outline: 1px solid currentColor;
  outline-offset: 2px;
}

.hex-raw-button {
  font-size: 12px;
  opacity: 0.75;
}

.hex-raw-button:hover {
  opacity: 1;
}

.hex-copy-icon {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
  opacity: 0.24;
  transition: opacity 0.15s;
}

.hex-value-button:hover .hex-copy-icon,
.hex-value-button:focus-visible .hex-copy-icon {
  opacity: 0.6;
}

@media (min-width: 1280px) {
  .hex-page {
    max-width: 1200px;
  }

  .hex-grid {
    grid-template-areas:
      'input text'
      'numbers numbers';
    grid-template-columns: minmax(320px, 0.85fr) minmax(0, 1.65fr);
  }

  .hex-input-card {
    grid-area: input;
  }

  .hex-text-result {
    grid-area: text;
  }

  .hex-numeric-results {
    grid-area: numbers;
  }
}
</style>
