const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../extension/src/core.js");

class FakeElement {
  constructor(tagName, options = {}, children = []) {
    this.tagName = tagName.toLowerCase();
    this.attrs = Object.assign({}, options.attrs || {});
    this.ownText = options.text || "";
    this.ownInnerText = options.innerText || "";
    this.value = options.value || "";
    this.disabled = Boolean(options.disabled);
    this.hidden = Boolean(options.hidden);
    this.children = [];
    this.parentElement = null;
    this.ownerDocument = null;
    this.isConnected = true;
    for (const child of children) this.appendChild(child);
  }

  get textContent() {
    return [this.ownText, ...this.children.map((child) => child.textContent)].filter(Boolean).join(" ");
  }

  set textContent(value) {
    this.ownText = value || "";
  }

  get innerText() {
    return [
      this.ownInnerText || this.ownText,
      ...this.children.map((child) => child.innerText)
    ].filter(Boolean).join(" ");
  }

  set innerText(value) {
    this.ownInnerText = value || "";
  }

  appendChild(child) {
    child.parentElement = this;
    child.ownerDocument = this.ownerDocument;
    this.children.push(child);
  }

  getAttribute(name) {
    if (name === "hidden" && this.hidden) return "";
    return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null;
  }

  closest(selector) {
    let current = this;
    while (current) {
      if (selector.includes("[hidden]") && current.hidden) return current;
      if (selector.includes("[aria-hidden='true']") && current.getAttribute("aria-hidden") === "true") {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }

  getClientRects() {
    return this.hidden ? [] : [{ x: 0, y: 0, width: 10, height: 10 }];
  }

  querySelectorAll(selector) {
    const results = [];
    const selectors = selector.split(",").map((part) => part.trim());
    const matches = (element, part) => {
      if (part === "button") return element.tagName === "button";
      if (part === '[role="button"]') return element.getAttribute("role") === "button";
      if (part === 'input[type="button"]') {
        return element.tagName === "input" && element.getAttribute("type") === "button";
      }
      if (part === 'input[type="submit"]') {
        return element.tagName === "input" && element.getAttribute("type") === "submit";
      }
      if (part === 'a[role="button"]') {
        return element.tagName === "a" && element.getAttribute("role") === "button";
      }
      if (part === '[contenteditable="true"]') {
        return element.getAttribute("contenteditable") === "true";
      }
      if (part === "textarea") return element.tagName === "textarea";
      return false;
    };

    const visit = (element) => {
      if (selectors.some((part) => matches(element, part))) results.push(element);
      for (const child of element.children) visit(child);
    };

    for (const child of this.children) visit(child);
    return results;
  }
}

class FakeDocument {
  constructor(body) {
    this.body = body;
    this.defaultView = {
      getComputedStyle: () => ({ display: "block", visibility: "visible", opacity: "1" })
    };
    this.setOwner(body);
  }

  setOwner(element) {
    element.ownerDocument = this;
    for (const child of element.children) this.setOwner(child);
  }
}

function el(tagName, options, children) {
  return new FakeElement(tagName, options, children);
}

function button(text, attrs = {}) {
  return el("button", { text, attrs });
}

function doc(children) {
  return new FakeDocument(el("main", {}, children));
}

test("finds Allow only inside a tool approval card", () => {
  const fakeDoc = doc([
    el("section", { text: "Run shell commands on VPS? 使用工具存在风险" }, [
      button("详细信息"),
      button("拒绝"),
      button("允许")
    ])
  ]);

  const found = core.findApprovalButton(fakeDoc);
  assert.ok(found);
  assert.equal(core.labelOf(found), "允许");
});

test("does not click generic allow buttons without tool context", () => {
  const fakeDoc = doc([
    el("section", { text: "普通弹窗" }, [
      button("取消"),
      button("允许")
    ])
  ]);

  assert.equal(core.findApprovalButton(fakeDoc), null);
});

test("does not mistake reject for approve", () => {
  const fakeDoc = doc([
    el("section", { text: "Run shell command on VPS? using tools" }, [
      button("详细信息"),
      button("拒绝")
    ])
  ]);

  assert.equal(core.findApprovalButton(fakeDoc), null);
});

test("accepts English approval labels in the same guarded context", () => {
  const fakeDoc = doc([
    el("section", { text: "This will execute Bash commands. Using tools can carry risks." }, [
      button("Details"),
      button("Deny"),
      button("Allow")
    ])
  ]);

  const found = core.findApprovalButton(fakeDoc);
  assert.ok(found);
  assert.equal(core.labelOf(found), "Allow");
});

test("refresh gate waits for missing approval button", () => {
  const fakeDoc = doc([
    el("section", { text: "Run shell commands on VPS? 使用工具存在风险" }, [
      button("详细信息"),
      button("拒绝")
    ])
  ]);
  const state = {};
  const settings = {
    autoRefresh: true,
    refreshDelayMs: 1000,
    retryRefreshDelayMs: 1000,
    minRefreshGapMs: 0
  };

  assert.equal(core.updateRefreshState(fakeDoc, state, settings, 1000), null);
  assert.equal(
    core.updateRefreshState(fakeDoc, state, settings, 2001),
    "approval prompt appeared without an Allow button"
  );
});

test("refresh gate waits for ChatGPT display errors", () => {
  const fakeDoc = doc([
    el("section", { text: "出错了，无法显示此消息。" })
  ]);
  const state = {};
  const settings = {
    autoRefresh: true,
    errorRefreshDelayMs: 1000,
    minRefreshGapMs: 0
  };

  assert.equal(core.hasChatGPTDisplayError(fakeDoc), true);
  assert.equal(core.updateRefreshState(fakeDoc, state, settings, 1000), null);
  assert.equal(core.updateRefreshState(fakeDoc, state, settings, 2001), "ChatGPT display error stayed visible");
});

test("refresh gate does not refresh while user has typed composer text", () => {
  const fakeDoc = doc([
    el("section", { text: "Run shell commands on VPS? 使用工具存在风险" }, [
      button("详细信息"),
      button("拒绝")
    ]),
    el("div", { text: "我正在输入", attrs: { contenteditable: "true" } })
  ]);

  assert.equal(
    core.updateRefreshState(fakeDoc, {}, { autoRefresh: true, refreshDelayMs: 1, minRefreshGapMs: 0 }, 100),
    null
  );
});

test("display error refresh is skipped while user has typed composer text", () => {
  const fakeDoc = doc([
    el("section", { text: "出错了，无法显示此消息。" }),
    el("div", { text: "继续处理这段内容", attrs: { contenteditable: "true" } })
  ]);

  assert.equal(
    core.updateRefreshState(fakeDoc, {}, { autoRefresh: true, errorRefreshDelayMs: 1, minRefreshGapMs: 0 }, 100),
    null
  );
});
