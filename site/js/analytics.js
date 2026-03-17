import { GOOGLE_ANALYTICS_ID } from "./site-config.js";

const analyticsState = {
  initialized: false,
  enabled: false
};

function isConfigured() {
  return Boolean(GOOGLE_ANALYTICS_ID) && GOOGLE_ANALYTICS_ID !== "G-REPLACE_ME";
}

function ensureGtag() {
  if (typeof window.gtag === "function") {
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args) {
    window.dataLayer.push(args);
  };
}

function loadAnalyticsScript() {
  if (document.querySelector(`script[data-ga-id="${GOOGLE_ANALYTICS_ID}"]`)) {
    return;
  }

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GOOGLE_ANALYTICS_ID)}`;
  script.dataset.gaId = GOOGLE_ANALYTICS_ID;
  document.head.append(script);
}

function buildTrackedLinkParams(element) {
  return {
    link_label: element.dataset.analyticsLabel || element.textContent.trim(),
    link_text: element.textContent.trim(),
    link_url: element.href || ""
  };
}

export function trackEvent(name, params = {}) {
  if (!analyticsState.enabled || typeof window.gtag !== "function") {
    return false;
  }

  const pageType = document.body.dataset.page || "site";
  window.gtag("event", name, {
    page_type: pageType,
    ...params
  });
  return true;
}

export function initAnalytics() {
  if (analyticsState.initialized) {
    return;
  }

  analyticsState.initialized = true;
  if (!isConfigured()) {
    return;
  }

  loadAnalyticsScript();
  ensureGtag();
  window.gtag("js", new Date());
  window.gtag("config", GOOGLE_ANALYTICS_ID, {
    anonymize_ip: true,
    send_page_view: false
  });
  analyticsState.enabled = true;

  trackEvent("page_view", {
    page_title: document.title,
    page_location: window.location.href,
    page_path: window.location.pathname
  });
}

export function bindTrackedLinks(root = document) {
  for (const element of root.querySelectorAll("[data-analytics-event]")) {
    if (element.dataset.analyticsBound === "true") {
      continue;
    }

    element.addEventListener("click", () => {
      trackEvent(element.dataset.analyticsEvent, buildTrackedLinkParams(element));
    });
    element.dataset.analyticsBound = "true";
  }
}
