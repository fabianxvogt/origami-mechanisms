import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const pageSource = await readFile(new URL("../index.html", import.meta.url), "utf8");
const pageIds = new Set([...pageSource.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));

class FakeElement {
  constructor(document, id = "") {
    this.ownerDocument = document;
    this.id = id;
    this.children = [];
    this.listeners = new Map();
    this.attributes = new Map();
    this.classList = {
      values: new Set(),
      add: (...names) => names.forEach((name) => this.classList.values.add(name)),
      remove: (...names) => names.forEach((name) => this.classList.values.delete(name)),
      toggle: (name, force) => {
        const next = force === undefined ? !this.classList.values.has(name) : force;
        next ? this.classList.values.add(name) : this.classList.values.delete(name);
        return next;
      }
    };
    this.style = {};
    this.dataset = {};
    this.hidden = false;
    this.value = "";
    this.textContent = "";
    this.checked = false;
  }

  set className(value) {
    this.classList.values = new Set(String(value).split(/\s+/).filter(Boolean));
  }

  addEventListener(type, handler) {
    const handlers = this.listeners.get(type) || [];
    handlers.push(handler);
    this.listeners.set(type, handlers);
  }

  dispatchEvent(event) {
    for (const handler of this.listeners.get(event.type) || []) handler(event);
  }

  click() { this.dispatchEvent({ type: "click" }); }

  focus() { this.ownerDocument.activeElement = this; }
  select() { this.selected = true; }

  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
    this.parentNode = null;
  }

  set innerHTML(value) {
    this.html = String(value);
    if (!value) this.children = [];
  }

  get innerHTML() { return this.html || ""; }

  querySelectorAll(selector) {
    if (selector === ".variant-row") return this.children.filter((child) => child.classList.values.has("variant-row"));
    if (selector === ".variant-open") return this.children.filter((child) => child.classList.values.has("variant-open"));
    return [];
  }
}

class FakeDocument {
  constructor() {
    this.activeElement = null;
    this.elements = new Map([...pageIds].map((id) => [id, new FakeElement(this, id)]));
    this.branchInputs = [-1, 1].map((value) => { const input = new FakeElement(this); input.value = String(value); return input; });
    this.stageTabs = ["flat", "3d", "reference"].map((view) => { const tab = new FakeElement(this); tab.dataset.view = view; tab.className = "stage-tab"; return tab; });
  }

  getElementById(id) { return this.elements.get(id) || null; }

  querySelectorAll(selector) {
    if (selector === "input[name=branch]") return this.branchInputs;
    if (selector === ".stage-tab") return this.stageTabs;
    return [];
  }

  createElement() { return new FakeElement(this); }
  createElementNS() { return new FakeElement(this); }
  addEventListener() {}
}

test("production render wiring resolves real SVG IDs for flat, 3D, and Save completion", async () => {
  const document = new FakeDocument();
  const storage = new Map();
  globalThis.document = document;
  globalThis.window = { setTimeout };
  globalThis.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) };

  await import(`./app.js?dom-wiring=${Date.now()}`);

  document.stageTabs[0].click();
  assert.match(document.getElementById("flat-label-1").textContent, /^1 \/ /);
  document.stageTabs[1].click();
  assert.match(document.getElementById("panel-label-1").textContent, /^F1$/);
  assert.ok(document.getElementById("panel-1").attributes.has("points"));

  document.getElementById("save-variant").click();
  document.getElementById("variant-name-input").value = "DOM wiring regression";
  document.getElementById("variant-form").dispatchEvent({ type: "submit", preventDefault() {} });

  const saved = JSON.parse(storage.get("foldline.mechanisms.v2"));
  assert.equal(saved.length, 1);
  assert.equal(saved[0].name, "DOM wiring regression");
  assert.equal(document.getElementById("variant-modal").hidden, true);
  assert.equal(document.getElementById("save-variant"), document.activeElement);
});
