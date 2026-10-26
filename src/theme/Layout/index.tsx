// src/theme/Layout/index.tsx
import React, { useEffect } from 'react';
import OriginalLayout from '@theme-original/Layout';
import { JSX } from 'react/jsx-runtime';

export default function Layout(props: JSX.IntrinsicAttributes) {
useEffect(() => {

    // 1. 拦截复制
    // Form fields (e.g. the tracker's share link) are the reader's own text, so copying them stays allowed.
    const inField = () => /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName ?? '');
    const onCopy = (e: ClipboardEvent) => {
      if (inField()) return;
      const selection = window.getSelection()?.toString();
      if (!selection) return;

      e.preventDefault();
      e.clipboardData?.setData(
        'text/plain',
        '该内容不允许复制'
      );
    };

    // 2. 拦截 Cmd/Ctrl + C
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'c' && !inField()) {
        const selection = window.getSelection()?.toString();
        if (selection && selection.length > 0) {
          e.preventDefault();
        }
      }
    };

    document.addEventListener('copy', onCopy);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return <OriginalLayout {...props} />;
}
