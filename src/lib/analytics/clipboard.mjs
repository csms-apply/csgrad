export async function copyTextWithFallback(text, options = {}) {
  const clipboard = options.clipboard === undefined
    ? globalThis.navigator?.clipboard
    : options.clipboard;
  const documentAdapter = options.documentAdapter === undefined
    ? globalThis.document
    : options.documentAdapter;

  if (clipboard && typeof clipboard.writeText === 'function') {
    try {
      await clipboard.writeText(text);
      return true;
    } catch {
      // Permission and browser-policy failures are common. Fall through to the
      // synchronous selection-based adapter while it remains supported.
    }
  }

  if (
    !documentAdapter
    || !documentAdapter.body
    || typeof documentAdapter.createElement !== 'function'
    || typeof documentAdapter.execCommand !== 'function'
  ) {
    return false;
  }

  const input = documentAdapter.createElement('textarea');
  input.value = text;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  documentAdapter.body.appendChild(input);

  try {
    if (typeof input.focus === 'function') input.focus();
    if (typeof input.select === 'function') input.select();
    if (typeof input.setSelectionRange === 'function') {
      input.setSelectionRange(0, text.length);
    }
    return documentAdapter.execCommand('copy') === true;
  } catch {
    return false;
  } finally {
    if (typeof input.remove === 'function') input.remove();
  }
}
