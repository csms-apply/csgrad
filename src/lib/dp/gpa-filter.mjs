function parseBound(value) {
  if (value == null || value === '') return { value: undefined };
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return { error: 'value' };
  return { value: number };
}

export function parseGpaRange(minInput, maxInput) {
  const min = parseBound(minInput);
  const max = parseBound(maxInput);
  if (min.error || max.error) return { valid: false, error: 'value' };
  if (min.value != null && max.value != null && min.value > max.value) {
    return { valid: false, error: 'range' };
  }
  return { valid: true, min: min.value, max: max.value };
}

export function formatGpaRange(min, max) {
  if (min != null && max != null) return `${min}–${max}`;
  if (min != null) return `≥ ${min}`;
  if (max != null) return `≤ ${max}`;
  return '';
}
