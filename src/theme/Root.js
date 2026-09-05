import React, {useEffect} from 'react';
import {trackSeoEvent} from '@site/src/lib/analytics/events.mjs';

const VIEW_EVENT_SELECTOR = '[data-seo-view-event]';

function eventParameters(element, methodOverride) {
  return {
    locale: element.dataset.seoLocale,
    page_type: element.dataset.seoPageType,
    method: methodOverride || element.dataset.seoMethod,
    content_group: element.dataset.seoContentGroup,
  };
}

async function copyText(text) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const input = document.createElement('textarea');
  input.value = text;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand('copy');
  input.remove();
  return copied;
}

export default function Root({children}) {
  useEffect(() => {
    const handleClick = async (event) => {
      const element = event.target instanceof Element
        ? event.target.closest('[data-seo-copy]')
        : null;
      if (!element) return;

      const copyValue = element.dataset.seoCopy;
      if (!copyValue) return;

      try {
        const copied = await copyText(copyValue);
        if (!copied) return;

        const parameters = eventParameters(element, 'copy_button');
        trackSeoEvent('wechat_copy', parameters);
        trackSeoEvent('consulting_intent', parameters);

        const statusId = element.getAttribute('aria-describedby');
        const status = statusId ? document.getElementById(statusId) : null;
        if (status) status.textContent = element.dataset.seoCopySuccess || 'Copied';
      } catch {
        // Clipboard access can be denied by the browser. Leave the public handle
        // visible so the visitor can still copy it manually.
      }
    };

    document.addEventListener('click', handleClick);

    if (typeof IntersectionObserver !== 'function') {
      return () => document.removeEventListener('click', handleClick);
    }

    const observed = new WeakSet();
    const visibilityObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting || entry.intersectionRatio < 0.5) continue;
        const element = entry.target;
        const eventName = element.dataset.seoViewEvent;
        trackSeoEvent(eventName, eventParameters(element));
        visibilityObserver.unobserve(element);
      }
    }, {threshold: 0.5});

    const observeNewElements = () => {
      document.querySelectorAll(VIEW_EVENT_SELECTOR).forEach((element) => {
        if (observed.has(element)) return;
        observed.add(element);
        visibilityObserver.observe(element);
      });
    };

    observeNewElements();
    const mutationObserver = new MutationObserver(observeNewElements);
    mutationObserver.observe(document.body, {childList: true, subtree: true});

    return () => {
      document.removeEventListener('click', handleClick);
      mutationObserver.disconnect();
      visibilityObserver.disconnect();
    };
  }, []);

  return children;
}
