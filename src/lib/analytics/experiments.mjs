export const CONTACT_CTA_EXPERIMENT = Object.freeze({
  id: 'consulting_contact_cta_v1',
  enabled: true,
  variantAllocation: 0.5,
});

const VALID_VARIANTS = new Set(['control', 'variant']);

function storageKey(experimentId) {
  return `csgrad.experiment.${experimentId}`;
}

function readQaOverride(search, experimentId) {
  if (typeof search !== 'string' || search.length === 0) return null;
  try {
    const raw = new URLSearchParams(search).get('csgrad_experiment');
    if (!raw) return null;
    const separator = raw.lastIndexOf(':');
    if (separator < 1) return null;
    const requestedId = raw.slice(0, separator);
    const requestedVariant = raw.slice(separator + 1);
    if (requestedId !== experimentId || !VALID_VARIANTS.has(requestedVariant)) return null;
    return requestedVariant;
  } catch {
    return null;
  }
}

function readStoredVariant(storage, experimentId) {
  if (!storage || typeof storage.getItem !== 'function') return null;
  try {
    const value = storage.getItem(storageKey(experimentId));
    return VALID_VARIANTS.has(value) ? value : null;
  } catch {
    return null;
  }
}

function storeVariant(storage, experimentId, variant) {
  if (!storage || typeof storage.setItem !== 'function') return;
  try {
    storage.setItem(storageKey(experimentId), variant);
  } catch {
    // Storage can be unavailable in private browsing. The caller can retain the
    // returned assignment in memory for the current page lifecycle.
  }
}

export function resolveExperimentAssignment({
  experiment,
  search = '',
  providedVariant,
  storage,
  random = Math.random,
}) {
  const qaOverride = readQaOverride(search, experiment.id);
  if (qaOverride) {
    return {experiment_id: experiment.id, variant: qaOverride};
  }

  if (!experiment.enabled) {
    return {experiment_id: experiment.id, variant: 'control'};
  }

  if (VALID_VARIANTS.has(providedVariant)) {
    return {experiment_id: experiment.id, variant: providedVariant};
  }

  const stored = readStoredVariant(storage, experiment.id);
  const variant = stored || (random() < experiment.variantAllocation ? 'variant' : 'control');
  if (!stored) storeVariant(storage, experiment.id, variant);

  return {
    experiment_id: experiment.id,
    variant,
  };
}
