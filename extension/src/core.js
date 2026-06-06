(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.ChatGPTToolAutoApproverCore = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const BUTTON_SELECTOR = [
    "button",
    '[role="button"]',
    'input[type="button"]',
    'input[type="submit"]',
    'a[role="button"]'
  ].join(",");

  const APPROVE_LABELS = new Set([
    "允许",
    "同意",
    "allow",
    "approve",
    "approve and run",
    "allow once",
    "yes, allow"
  ]);

  const REJECT_LABELS = new Set([
    "拒绝",
    "deny",
    "reject",
    "decline"
  ]);

  const DETAILS_LABELS = new Set([
    "详细信息",
    "details",
    "show details"
  ]);

  const TOOL_CONTEXT_TERMS = [
    "使用工具存在风险",
    "工具存在风险",
    "run shell command",
    "run shell commands",
    "execute bash command",
    "execute bash commands",
    "using tools",
    "tool call",
    "工具调用",
    "mcp",
    "server_label",
    "了解更多",
    "risks-and-safety"
  ];

  const RETRY_TERMS = [
    "点击以重试",
    "click to retry",
    "retry"
  ];

  const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    autoRefresh: true,
    scanIntervalMs: 800,
    clickCooldownMs: 2500,
    refreshDelayMs: 12000,
    retryRefreshDelayMs: 20000,
    minRefreshGapMs: 60000,
    debug: false
  });

  function normalizeText(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function lowerText(value) {
    return normalizeText(value).toLowerCase();
  }

  function labelOf(element) {
    if (!element) return "";
    const parts = [];
    const attrNames = ["aria-label", "title", "alt", "value"];

    for (const attrName of attrNames) {
      if (typeof element.getAttribute === "function") {
        const value = element.getAttribute(attrName);
        if (value) parts.push(value);
      }
    }

    if (typeof element.value === "string" && element.value) {
      parts.push(element.value);
    }

    if (typeof element.innerText === "string" && element.innerText) {
      parts.push(element.innerText);
    } else if (typeof element.textContent === "string" && element.textContent) {
      parts.push(element.textContent);
    }

    return normalizeText(parts.join(" "));
  }

  function textOf(element) {
    if (!element) return "";
    const parts = [];

    if (typeof element.innerText === "string" && element.innerText) {
      parts.push(element.innerText);
    } else if (typeof element.textContent === "string" && element.textContent) {
      parts.push(element.textContent);
    }

    if (typeof element.getAttribute === "function") {
      for (const attrName of ["aria-label", "title", "data-testid", "href"]) {
        const value = element.getAttribute(attrName);
        if (value) parts.push(value);
      }
    }

    return normalizeText(parts.join(" "));
  }

  function isExactLabel(element, labels) {
    const raw = labelOf(element);
    const lower = lowerText(raw);
    const compact = lower.replace(/\s+/g, " ");
    return labels.has(raw) || labels.has(lower) || labels.has(compact);
  }

  function isApproveButton(element) {
    return isExactLabel(element, APPROVE_LABELS);
  }

  function isRejectButton(element) {
    return isExactLabel(element, REJECT_LABELS);
  }

  function isDetailsButton(element) {
    return isExactLabel(element, DETAILS_LABELS);
  }

  function isDisabled(element) {
    if (!element) return true;
    if (element.disabled) return true;
    if (typeof element.getAttribute === "function") {
      const ariaDisabled = lowerText(element.getAttribute("aria-disabled"));
      if (ariaDisabled === "true") return true;
      if (element.getAttribute("disabled") != null) return true;
    }
    return false;
  }

  function isVisible(element) {
    if (!element || isDisabled(element)) return false;
    if (element.isConnected === false) return false;
    if (typeof element.closest === "function" && element.closest("[hidden], [aria-hidden='true']")) {
      return false;
    }

    const doc = element.ownerDocument;
    const view = doc && doc.defaultView;
    if (view && typeof view.getComputedStyle === "function") {
      const style = view.getComputedStyle(element);
      if (style && (style.display === "none" || style.visibility === "hidden" || style.opacity === "0")) {
        return false;
      }
    }

    if (typeof element.getClientRects === "function") {
      const rects = element.getClientRects();
      if (rects && rects.length === 0) return false;
    }

    return true;
  }

  function queryButtons(root) {
    if (!root || typeof root.querySelectorAll !== "function") return [];
    return Array.from(root.querySelectorAll(BUTTON_SELECTOR)).filter(isVisible);
  }

  function containsToolContext(element) {
    const haystack = lowerText(textOf(element));
    return TOOL_CONTEXT_TERMS.some((term) => haystack.includes(term));
  }

  function countInteractiveLabels(root) {
    const buttons = queryButtons(root);
    return {
      buttons,
      hasApprove: buttons.some(isApproveButton),
      hasReject: buttons.some(isRejectButton),
      hasDetails: buttons.some(isDetailsButton)
    };
  }

  function findApprovalContextRoot(button) {
    let current = button;
    let depth = 0;

    while (current && depth < 10) {
      const labels = countInteractiveLabels(current);
      const hasCurrent = labels.buttons.includes(button);
      const enoughLocalControls = hasCurrent && labels.hasApprove && labels.hasReject;
      const looksLikeToolPrompt = containsToolContext(current);

      if (enoughLocalControls && looksLikeToolPrompt) {
        return current;
      }

      if (enoughLocalControls && labels.hasDetails) {
        return current;
      }

      current = current.parentElement;
      depth += 1;
    }

    return null;
  }

  function findApprovalButton(doc) {
    const root = doc && (doc.body || doc);
    const candidates = queryButtons(root)
      .filter(isApproveButton)
      .filter((button) => findApprovalContextRoot(button));

    return candidates.length > 0 ? candidates[candidates.length - 1] : null;
  }

  function hasPotentialApprovalPromptWithoutButton(doc) {
    const root = doc && (doc.body || doc);
    if (!root) return false;
    if (findApprovalButton(doc)) return false;

    const bodyText = lowerText(textOf(root));
    const hasContext = TOOL_CONTEXT_TERMS.some((term) => bodyText.includes(term));
    const buttons = queryButtons(root);
    const hasReject = buttons.some(isRejectButton);
    const hasDetails = buttons.some(isDetailsButton);

    return hasContext && (hasReject || hasDetails);
  }

  function hasRetryButton(doc) {
    const root = doc && (doc.body || doc);
    if (!root) return false;
    return queryButtons(root).some((button) => {
      const label = lowerText(labelOf(button));
      return RETRY_TERMS.some((term) => label.includes(term));
    });
  }

  function composerHasUserText(doc) {
    const root = doc && (doc.body || doc);
    if (!root || typeof root.querySelectorAll !== "function") return false;

    const editors = Array.from(root.querySelectorAll('[contenteditable="true"], textarea'));
    return editors.some((editor) => {
      if (!isVisible(editor)) return false;
      const text = normalizeText(editor.value || editor.innerText || editor.textContent || "");
      return text && text !== "有问题，尽管问" && text !== "Message ChatGPT";
    });
  }

  function updateRefreshState(doc, state, settings, now) {
    const merged = Object.assign({}, DEFAULT_SETTINGS, settings || {});
    state.promptMissingButtonSince = state.promptMissingButtonSince || 0;
    state.retrySince = state.retrySince || 0;
    state.lastRefreshAt = state.lastRefreshAt || 0;

    if (!merged.autoRefresh || composerHasUserText(doc)) {
      state.promptMissingButtonSince = 0;
      state.retrySince = 0;
      return null;
    }

    if (findApprovalButton(doc)) {
      state.promptMissingButtonSince = 0;
      state.retrySince = 0;
      return null;
    }

    const refreshGapOk = now - state.lastRefreshAt >= merged.minRefreshGapMs;
    const promptMissingButton = hasPotentialApprovalPromptWithoutButton(doc);
    if (promptMissingButton) {
      if (!state.promptMissingButtonSince) state.promptMissingButtonSince = now;
      if (refreshGapOk && now - state.promptMissingButtonSince >= merged.refreshDelayMs) {
        state.lastRefreshAt = now;
        state.promptMissingButtonSince = 0;
        return "approval prompt appeared without an Allow button";
      }
    } else {
      state.promptMissingButtonSince = 0;
    }

    const retryVisible = hasRetryButton(doc);
    if (retryVisible) {
      if (!state.retrySince) state.retrySince = now;
      if (refreshGapOk && now - state.retrySince >= merged.retryRefreshDelayMs) {
        state.lastRefreshAt = now;
        state.retrySince = 0;
        return "tool retry button stayed visible";
      }
    } else {
      state.retrySince = 0;
    }

    return null;
  }

  return {
    BUTTON_SELECTOR,
    DEFAULT_SETTINGS,
    normalizeText,
    labelOf,
    textOf,
    isApproveButton,
    isRejectButton,
    isDetailsButton,
    isVisible,
    queryButtons,
    containsToolContext,
    findApprovalContextRoot,
    findApprovalButton,
    hasPotentialApprovalPromptWithoutButton,
    hasRetryButton,
    composerHasUserText,
    updateRefreshState
  };
});
