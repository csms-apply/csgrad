/** Keyboard handling shared by tracker dialogs; returns cleanup restoring the opener. */
export function attachDialogBehavior(dialog, onClose) {
  if (!dialog) return () => {};
  const doc = dialog.ownerDocument;
  const opener = doc.activeElement;
  const focusable = () => [...dialog.querySelectorAll(
    'button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
  )].filter((element) => element.getClientRects().length > 0);
  (dialog.querySelector('[data-dialog-initial-focus]') || focusable()[0] || dialog).focus();
  const keydown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    } else if (event.key === 'Tab') {
      const elements = focusable();
      const first = elements[0] || dialog;
      const last = elements.at(-1) || dialog;
      if (!elements.length || !elements.includes(doc.activeElement)
        || (event.shiftKey ? doc.activeElement === first : doc.activeElement === last)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    }
  };
  doc.addEventListener('keydown', keydown);
  return () => {
    doc.removeEventListener('keydown', keydown);
    if (opener?.isConnected) opener.focus();
  };
}
