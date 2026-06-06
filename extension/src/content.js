(function () {
  "use strict";

  const core = window.ChatGPTToolAutoApproverCore;
  const settings = Object.assign({}, core.DEFAULT_SETTINGS);
  const state = {
    lastClickAt: 0,
    lastClickedText: "",
    promptMissingButtonSince: 0,
    retrySince: 0,
    chatErrorSince: 0,
    lastRefreshAt: 0
  };

  function log(...args) {
    if (settings.debug) {
      console.debug("[ChatGPT Tool Auto Approver]", ...args);
    }
  }

  function loadSettings() {
    if (!chrome || !chrome.storage || !chrome.storage.sync) return;

    chrome.storage.sync.get(core.DEFAULT_SETTINGS, (items) => {
      Object.assign(settings, items || {});
      log("settings loaded", settings);
    });

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "sync") return;
      for (const [key, change] of Object.entries(changes)) {
        if (key in settings) settings[key] = change.newValue;
      }
      log("settings changed", settings);
    });
  }

  function clickAllowButton(button) {
    const now = Date.now();
    const buttonLabel = core.labelOf(button);

    if (now - state.lastClickAt < settings.clickCooldownMs && state.lastClickedText === buttonLabel) {
      return false;
    }

    state.lastClickAt = now;
    state.lastClickedText = buttonLabel;
    button.scrollIntoView({ block: "center", inline: "center" });
    button.click();
    log("clicked", buttonLabel);
    return true;
  }

  function scan(reason) {
    if (!settings.enabled) return { clicked: false, refreshed: false, reason: "disabled" };

    const button = core.findApprovalButton(document);
    if (button) {
      const clicked = clickAllowButton(button);
      return { clicked, refreshed: false, reason: clicked ? "approved" : "cooldown" };
    }

    const refreshReason = core.updateRefreshState(document, state, settings, Date.now());
    if (refreshReason) {
      log("refreshing", refreshReason, reason);
      window.location.reload();
      return { clicked: false, refreshed: true, reason: refreshReason };
    }

    return { clicked: false, refreshed: false, reason: "nothing-found" };
  }

  function startObserver() {
    let queued = false;
    const queueScan = (reason) => {
      if (queued) return;
      queued = true;
      window.setTimeout(() => {
        queued = false;
        scan(reason);
      }, 100);
    };

    const observer = new MutationObserver(() => queueScan("mutation"));
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["aria-label", "disabled", "aria-disabled", "hidden", "style", "class"]
    });

    window.setInterval(() => scan("interval"), settings.scanIntervalMs);
    queueScan("startup");
  }

  function installMessageHandler() {
    if (!chrome || !chrome.runtime || !chrome.runtime.onMessage) return;

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!message || message.type !== "chatgpt-auto-approver") return false;

      if (message.action === "scan-now") {
        sendResponse(scan("manual"));
        return true;
      }

      if (message.action === "status") {
        const approvalButton = core.findApprovalButton(document);
        sendResponse({
          settings,
          hasApprovalButton: Boolean(approvalButton),
          hasRetryButton: core.hasRetryButton(document),
          hasChatError: core.hasChatGPTDisplayError(document),
          url: window.location.href
        });
        return true;
      }

      return false;
    });
  }

  loadSettings();
  installMessageHandler();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startObserver, { once: true });
  } else {
    startObserver();
  }
})();
