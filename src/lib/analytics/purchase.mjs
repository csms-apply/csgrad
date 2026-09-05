function normalizeCurrency(value) {
  if (typeof value !== 'string') return null;
  const currency = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : null;
}

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
  if (responseValue === null) return null;
  const currency = normalizeCurrency(body.currency ?? body.payment?.currency);
  if (!currency) return null;

  return {
    currency,
    value: responseValue,
    transaction_id: transactionId,
    items: [{
      item_id: 'school_positioning_report',
      item_name: 'MSCS School Positioning Report',
      price: responseValue,
      quantity: 1,
    }],
  };
}
