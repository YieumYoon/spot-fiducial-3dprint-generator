import { bindTrackedLinks, initAnalytics } from "./analytics.js";

function start() {
  initAnalytics();
  bindTrackedLinks();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}
