/* YTSB — popup.js */

const DEFAULTS = {
  enabled: true,
  redirectHome: true,
  hideShorts: true,
  cleanSidebar: true,
  hideRecommendations: true,
};

const masterBtn   = document.getElementById("masterToggle");
const container   = document.querySelector(".container");
const featureRows = document.querySelectorAll(".feature-row");

function setPressed(btn, value) {
  btn.setAttribute("aria-pressed", String(value));
}

function broadcastSettings(settings) {
  browser.tabs.query({ url: "*://www.youtube.com/*" }, (tabs) => {
    tabs.forEach((tab) => {
      browser.tabs.sendMessage(tab.id, { type: "SET_SETTINGS", settings }).catch(() => {});
    });
  });
}

function applyUI(settings) {
  setPressed(masterBtn, settings.enabled);
  container.classList.toggle("master-off", !settings.enabled);
  featureRows.forEach((row) => {
    setPressed(row.querySelector(".toggle-btn"), !!settings[row.dataset.key]);
  });
}

browser.storage.local.get(DEFAULTS, (settings) => applyUI(settings));

masterBtn.addEventListener("click", () => {
  browser.storage.local.get(DEFAULTS, (settings) => {
    const next = { ...settings, enabled: !settings.enabled };
    browser.storage.local.set(next);
    applyUI(next);
    broadcastSettings(next);
  });
});

featureRows.forEach((row) => {
  row.querySelector(".toggle-btn").addEventListener("click", () => {
    browser.storage.local.get(DEFAULTS, (settings) => {
      const next = { ...settings, [row.dataset.key]: !settings[row.dataset.key] };
      browser.storage.local.set(next);
      applyUI(next);
      broadcastSettings(next);
    });
  });
});
