function normalizeCurrency(value) {
  if (typeof value !== 'string') return null;
  const currency = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : null;
}

// The last public pricing change (commit 993f24f) moved this product and its
// deployed Stripe unit_amount to $29.99. The current legacy result response does
// not expose totals, so this is a temporary analytics fallback only. Prefer the
// response values below and update/remove this fallback with any private-backend
// price change to avoid overstating revenue.
const POSITIONING_FALLBACK_PURCHASE = Object.freeze({currency: 'USD', value: 29.99});

function amountInMajorUnits(body) {
  const minorUnits = body?.amount_total ?? body?.amountTotal
    ?? body?.payment?.amount_total ?? body?.payment?.amountTotal;
  if (typeof minorUnits === 'number' && Number.isFinite(minorUnits) && minorUnits >= 0) {
    return minorUnits / 100;
  }

  const majorUnits = body?.value ?? body?.payment?.value;
  if (typeof majorUnits === 'number' && Number.isFinite(majorUnits) && majorUnits >= 0) {
    return majorUnits;
  }

  return null;
}

async function anonymousTransactionId(sessionId, subtle) {
  if (!sessionId || !subtle || typeof subtle.digest !== 'function') return null;
  const input = new TextEncoder().encode(`csgrad-positioning:v1:${sessionId}`);
  const digest = await subtle.digest('SHA-256', input);
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `positioning_${hex.slice(0, 32)}`;
}

export async function buildPositioningPurchaseParameters(
  body,
  sessionId,
  subtle = globalThis.crypto?.subtle,
) {
  if (!body || body.status !== 'paid') return null;
  const transactionId = await anonymousTransactionId(sessionId, subtle);
  if (!transactionId) return null;

  const responseValue = amountInMajorUnits(body);
  const purchase = responseValue === null
    ? POSITIONING_FALLBACK_PURCHASE
    : {
      currency: normalizeCurrency(body.currency ?? body.payment?.currency) || 'USD',
      value: responseValue,
    };

  return {
    ...purchase,
    transaction_id: transactionId,
  };
}
