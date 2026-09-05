import test from 'node:test';
import assert from 'node:assert/strict';
import {attachDialogBehavior} from './dialog.mjs';

function fixture() {
  const listeners = new Map();
  const doc = {activeElement: null,
    addEventListener: (name, handler) => listeners.set(name, handler),
    removeEventListener: (name, handler) => { if (listeners.get(name) === handler) listeners.delete(name); }};
  const element = () => ({isConnected: true, getClientRects: () => [1], focus() { doc.activeElement = this; }});
  const opener = element();
  const first = element();
  const last = element();
  opener.focus();
  const dialog = {...element(), ownerDocument: doc,
    querySelector: () => first, querySelectorAll: () => [first, last]};
  let closed = 0;
  const cleanup = attachDialogBehavior(dialog, () => { closed++; });
  const key = (value, shiftKey = false) => {
    let prevented = false;
    listeners.get('keydown')?.({key: value, shiftKey, preventDefault() { prevented = true; }});
    return prevented;
  };
  return {doc, opener, first, last, key, cleanup, closed: () => closed, listeners};
}

test('dialog focuses its initial field and Escape closes once', () => {
  const dialog = fixture();
  assert.equal(dialog.doc.activeElement, dialog.first);
  assert.equal(dialog.key('Escape'), true);
  assert.equal(dialog.closed(), 1);
  dialog.cleanup();
  assert.equal(dialog.doc.activeElement, dialog.opener);
  assert.equal(dialog.listeners.has('keydown'), false);
});

test('Tab and Shift+Tab remain inside the dialog', () => {
  const dialog = fixture();
  dialog.last.focus();
  assert.equal(dialog.key('Tab'), true);
  assert.equal(dialog.doc.activeElement, dialog.first);
  assert.equal(dialog.key('Tab', true), true);
  assert.equal(dialog.doc.activeElement, dialog.last);
  dialog.opener.focus();
  assert.equal(dialog.key('Tab'), true);
  assert.equal(dialog.doc.activeElement, dialog.first);
  dialog.cleanup();
});

test('ordinary keys do not dismiss the dialog or interfere with input', () => {
  const dialog = fixture();
  assert.equal(dialog.key('a'), false);
  assert.equal(dialog.closed(), 0);
  dialog.cleanup();
});
