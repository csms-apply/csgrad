import React, {useEffect} from 'react';
import {trackSeoEvent} from '@site/src/lib/analytics/events.mjs';
import {copyTextWithFallback} from '@site/src/lib/analytics/clipboard.mjs';
import {
  CONTACT_CTA_EXPERIMENT,
  resolveExperimentAssignment,
} from '@site/src/lib/analytics/experiments.mjs';

const VIEW_EVENT_SELECTOR = '[data-seo-view-event]';
const EXPERIMENT_SELECTOR = '[data-seo-experiment-id]';

function eventParameters(element, methodOverride) {
  return {
    locale: element.dataset.seoLocale,
    page_type: element.dataset.seoPageType,
    method: methodOverride || element.dataset.seoMethod,
    content_group: element.dataset.seoContentGroup,
    experiment_id: element.dataset.seoExperimentId,
    variant: element.dataset.seoExperimentVariant,
  };
}

function renderExperimentVariant(element, assignment) {
  const isVariant = assignment.variant === 'variant';
  element.dataset.seoExperimentVariant = assignment.variant;
  element.classList.toggle('seo-wechat-copy--control', !isVariant);
  element.classList.toggle('seo-wechat-copy--variant', isVariant);
  const label = isVariant
    ? element.dataset.seoVariantLabel
    : element.dataset.seoControlLabel;
  if (label) element.textContent = label;
}

export default function Root({children}) {
  useEffect(() => {
    const supportsVisibilityTracking = typeof IntersectionObserver === 'function';

    const handleClick = async (event) => {
      const element = event.target instanceof Element
        ? event.target.closest('[data-seo-copy]')
        : null;
      if (!element) return;

      const copyValue = element.dataset.seoCopy;
      if (!copyValue) return;

      const statusId = element.getAttribute('aria-describedby');
      const status = statusId ? document.getElementById(statusId) : null;

      try {
        const copied = await copyTextWithFallback(copyValue);
        if (copied) {
          const parameters = eventParameters(element, 'copy_button');
          trackSeoEvent('wechat_copy', parameters);
          trackSeoEvent('consulting_intent', parameters);
          if (status) {
            status.dataset.seoCopyState = 'success';
            status.textContent = element.dataset.seoCopySuccess || 'Copied';
          }
          return;
        }
        if (status) {
          status.dataset.seoCopyState = 'error';
          status.textContent = element.dataset.seoCopyFailure || 'Copy failed — copy the visible ID manually';
        }
      } catch {
        if (status) {
          status.dataset.seoCopyState = 'error';
          status.textContent = element.dataset.seoCopyFailure || 'Copy failed — copy the visible ID manually';
        }
      }
    };

    document.addEventListener('click', handleClick);

    const experimentElements = new WeakSet();
    const runtimeAssignments = new Map();
    const hydrateExperiments = () => {
      document.querySelectorAll(EXPERIMENT_SELECTOR).forEach((element) => {
        if (experimentElements.has(element)) return;
        if (element.dataset.seoExperimentId !== CONTACT_CTA_EXPERIMENT.id) return;

        let assignment = runtimeAssignments.get(CONTACT_CTA_EXPERIMENT.id);
        if (!assignment) {
          let storage = null;
          try {
            storage = window.localStorage;
          } catch {
            // The resolver still works without persistence; the runtime cache
            // keeps one stable assignment for the active page lifecycle.
          }
          assignment = resolveExperimentAssignment({
            experiment: CONTACT_CTA_EXPERIMENT,
            search: window.location.search,
            storage,
          });
          runtimeAssignments.set(CONTACT_CTA_EXPERIMENT.id, assignment);
        }

        experimentElements.add(element);
        renderExperimentVariant(element, assignment);
        if (supportsVisibilityTracking) {
          element.dataset.seoViewEvent = 'experiment_exposure';
        } else {
          trackSeoEvent('experiment_exposure', eventParameters(element));
        }
      });
    };

    hydrateExperiments();

    if (!supportsVisibilityTracking) {
      const fallbackMutationObserver = typeof MutationObserver === 'function'
        ? new MutationObserver(hydrateExperiments)
        : null;
      if (fallbackMutationObserver) {
        fallbackMutationObserver.observe(document.body, {childList: true, subtree: true});
      }
      return () => {
        document.removeEventListener('click', handleClick);
        if (fallbackMutationObserver) fallbackMutationObserver.disconnect();
      };
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
      hydrateExperiments();
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
