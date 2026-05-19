/**
 * YTSB — content.js
 */

const DEFAULTS = {
  enabled: true,
  redirectHome: true,
  hideShorts: true,
  cleanSidebar: true,
  hideRecommendations: true,
};

let settings = { ...DEFAULTS };
let observer  = null;
let applyScheduled = false;
let redirected = false;

// ─── Storage ──────────────────────────────────────────────────────────────────

function loadState(cb) {
  browser.storage.local.get(DEFAULTS, (result) => { settings = result; cb(); });
}

// ─── Redirect ─────────────────────────────────────────────────────────────────

function maybeRedirectHome() {
  if (!settings.enabled || !settings.redirectHome || redirected) return;
  const p = window.location.pathname;
  if (p === "/" || p === "") {
    redirected = true;
    window.location.replace("https://www.youtube.com/feed/subscriptions");
  }
}

// ─── Shorts ───────────────────────────────────────────────────────────────────

function removeShortsShelves() {
  if (!settings.enabled || !settings.hideShorts) return;

  document.querySelectorAll("ytd-rich-section-renderer").forEach((el) => {
    const title = el.querySelector("#title, .ytd-rich-shelf-renderer #title");
    if (!title || title.textContent.trim().toLowerCase().includes("short")) hideEl(el);
  });

  document.querySelectorAll("ytd-reel-shelf-renderer").forEach(hideEl);

  document.querySelectorAll("ytd-video-renderer").forEach((el) => {
    const badge = el.querySelector("ytd-badge-supported-renderer .badge-style-type-simple");
    if (badge && badge.textContent.trim().toLowerCase() === "shorts") hideEl(el);
    if (el.querySelector("[overlay-style='SHORTS']")) hideEl(el);
  });

  document.querySelectorAll("ytd-compact-video-renderer").forEach((el) => {
    if (el.querySelector("[overlay-style='SHORTS']")) hideEl(el);
  });

  document.querySelectorAll("ytd-rich-item-renderer").forEach((el) => {
    if (el.querySelector("[overlay-style='SHORTS']")) hideEl(el);
  });
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

const ALLOWED_HREFS = [
  "/feed/subscriptions", "/feed/history", "/channel/",
  "/feed/downloads", "/feed/library",
];

const ALLOWED_LABELS = [
  "subscriptions", "history", "your channel",
  "downloads", "your videos", "watch later", "library",
];

const BLOCKED_HREFS = [
  "/feed/explore", "/feed/storefront", "/gaming", "/news",
  "/sports", "/learning", "/fashion", "/podcasts", "/feed/trending",
  "/explore", "/channel/UCbmNph6atAoGfqLoCL_duAg",
];

const BLOCKED_LABELS = [
  "explore", "music", "shopping", "gaming", "news",
  "sports", "fashion", "podcasts", "trending", "learning",
];

function isAllowedGuideEntry(el) {
  const a = el.querySelector("a[href]");
  if (a) {
    const href = a.getAttribute("href") || "";
    if (BLOCKED_HREFS.some((b) => href.startsWith(b))) return false;
    if (ALLOWED_HREFS.some((h) => href.startsWith(h))) return true;
  }
  const label = el.querySelector("#endpoint, .title, yt-formatted-string, #label")
    ?.textContent?.trim()?.toLowerCase() || "";
  if (BLOCKED_LABELS.some((b) => label === b)) return false;
  return ALLOWED_LABELS.some((l) => label.includes(l));
}

function filterSidebar() {
  if (!settings.enabled || !settings.cleanSidebar) return;

  document.querySelectorAll("ytd-guide-entry-renderer").forEach((el) => {
    isAllowedGuideEntry(el) ? showEl(el) : hideEl(el);
  });

  document.querySelectorAll("ytd-guide-section-renderer").forEach((section) => {
    const hasVisible = [...section.querySelectorAll("ytd-guide-entry-renderer")]
      .some((e) => !e.dataset.ytsbHidden);
    hasVisible ? showEl(section) : hideEl(section);
  });

  document.querySelectorAll("ytd-mini-guide-entry-renderer").forEach((el) => {
    isAllowedGuideEntry(el) ? showEl(el) : hideEl(el);
  });
}

// ─── Recommendations ──────────────────────────────────────────────────────────
// Only targets the right-hand sidebar on /watch — NOT comments.
// Comments live in ytd-comments, which we never touch.

const REC_SELECTORS = [
  "ytd-watch-next-secondary-results-renderer",
  "ytd-compact-autoplay-renderer",
  // The secondary column itself when recs are the only thing in it
  "#secondary ytd-compact-video-renderer",
];

function hideWatchRecommendations() {
  if (!settings.enabled || !settings.hideRecommendations) return;
  if (window.location.pathname !== "/watch") return;

  document.querySelectorAll("ytd-watch-next-secondary-results-renderer").forEach(hideEl);
  document.querySelectorAll("ytd-compact-autoplay-renderer").forEach(hideEl);

  // Hide individual video cards inside #secondary but NOT if they're inside
  // a section that also contains comments (ytd-comments is never in #secondary)
  document.querySelectorAll("#secondary ytd-compact-video-renderer").forEach((el) => {
    if (!el.querySelector("[overlay-style='SHORTS']")) hideEl(el);
  });
}

function showWatchRecommendations() {
  // Restore only elements we hid — identified by our data attribute
  document.querySelectorAll(
    "ytd-watch-next-secondary-results-renderer[data-ytsb-hidden]," +
    "ytd-compact-autoplay-renderer[data-ytsb-hidden]," +
    "#secondary ytd-compact-video-renderer[data-ytsb-hidden]"
  ).forEach(showEl);
}

// ─── Element helpers ──────────────────────────────────────────────────────────

function hideEl(el) {
  if (!el || el.dataset.ytsbHidden) return;
  el.dataset.ytsbHidden = "1";
  el.style.setProperty("display", "none", "important");
}

function showEl(el) {
  if (!el || !el.dataset.ytsbHidden) return;
  delete el.dataset.ytsbHidden;
  el.style.removeProperty("display");
}

function restoreAll() {
  document.querySelectorAll("[data-ytsb-hidden]").forEach(showEl);
}

// ─── Apply ────────────────────────────────────────────────────────────────────

function applyAll() {
  if (!settings.enabled) return;
  maybeRedirectHome();
  if (settings.hideShorts)          removeShortsShelves();
  if (settings.cleanSidebar)        filterSidebar();
  if (settings.hideRecommendations) hideWatchRecommendations();
  else                              showWatchRecommendations();
}

function scheduleApply() {
  if (applyScheduled) return;
  applyScheduled = true;
  requestAnimationFrame(() => {
    applyScheduled = false;
    if (settings.enabled) applyAll();
  });
}

// ─── Observer ─────────────────────────────────────────────────────────────────

function startObserver() {
  if (observer) return;
  observer = new MutationObserver((mutations) => {
    // Only re-apply when YouTube actually added new nodes (not our own changes)
    const hasNewNodes = mutations.some((m) => m.addedNodes.length > 0);
    if (hasNewNodes) scheduleApply();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function stopObserver() {
  if (observer) { observer.disconnect(); observer = null; }
}

function teardownAll() {
  restoreAll();
  stopObserver();
}

// ─── SPA navigation ───────────────────────────────────────────────────────────

window.addEventListener("yt-navigate-start", () => { redirected = false; });
window.addEventListener("yt-navigate-finish", () => { if (settings.enabled) applyAll(); });

// ─── Messages from popup ──────────────────────────────────────────────────────

browser.runtime.onMessage.addListener((msg) => {
  if (msg.type === "SET_SETTINGS") {
    settings = { ...DEFAULTS, ...msg.settings };
    if (settings.enabled) {
      restoreAll();
      applyAll();
      startObserver();
    } else {
      teardownAll();
    }
  }
});

// ─── Boot ─────────────────────────────────────────────────────────────────────

loadState(() => {
  if (!settings.enabled) return;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { applyAll(); startObserver(); });
  } else {
    applyAll();
    startObserver();
  }
});
