(function () {
  "use strict";

  const defaults = window.ChatGPTToolAutoApproverCore.DEFAULT_SETTINGS;
  const fields = {
    enabled: document.getElementById("enabled"),
    autoRefresh: document.getElementById("autoRefresh"),
    refreshDelaySeconds: document.getElementById("refreshDelaySeconds"),
    retryRefreshDelaySeconds: document.getElementById("retryRefreshDelaySeconds"),
    scanNow: document.getElementById("scanNow"),
    status: document.getElementById("status")
  };

  function setStatus(text) {
    fields.status.textContent = text;
  }

  function seconds(ms) {
    return Math.round(ms / 1000);
  }

  function ms(value) {
    return Math.max(1, Number(value || 0)) * 1000;
  }

  function readForm() {
    return {
      enabled: fields.enabled.checked,
      autoRefresh: fields.autoRefresh.checked,
      refreshDelayMs: ms(fields.refreshDelaySeconds.value),
      retryRefreshDelayMs: ms(fields.retryRefreshDelaySeconds.value)
    };
  }

  function writeForm(settings) {
    fields.enabled.checked = Boolean(settings.enabled);
    fields.autoRefresh.checked = Boolean(settings.autoRefresh);
    fields.refreshDelaySeconds.value = seconds(settings.refreshDelayMs);
    fields.retryRefreshDelaySeconds.value = seconds(settings.retryRefreshDelayMs);
  }

  function save() {
    chrome.storage.sync.set(readForm(), () => setStatus("设置已保存"));
  }

  function sendToCurrentTab(message, callback) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      if (!tab || !tab.id) {
        callback(null, "没有当前标签页");
        return;
      }

      chrome.tabs.sendMessage(tab.id, message, (response) => {
        if (chrome.runtime.lastError) {
          callback(null, chrome.runtime.lastError.message);
          return;
        }
        callback(response, null);
      });
    });
  }

  chrome.storage.sync.get(defaults, (settings) => {
    writeForm(settings);
    setStatus("已加载设置");
  });

  for (const input of [
    fields.enabled,
    fields.autoRefresh,
    fields.refreshDelaySeconds,
    fields.retryRefreshDelaySeconds
  ]) {
    input.addEventListener("change", save);
  }

  fields.scanNow.addEventListener("click", () => {
    sendToCurrentTab(
      { type: "chatgpt-auto-approver", action: "scan-now" },
      (response, error) => {
        if (error) {
          setStatus("当前页未加载插件脚本");
          return;
        }
        setStatus(response && response.clicked ? "已点击允许" : "没有发现确认按钮");
      }
    );
  });
})();
