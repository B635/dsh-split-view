/**
 * Node-only smoke test for the browser bundle.
 *
 * The plugin is a plain-JS Web client half with no dependencies, so this test
 * stubs the browser module table (React, window, document) and a minimal Cordis
 * client context, then checks that:
 *   1. the bundle registers its factory and factory(require) works;
 *   2. apply(ctx) installs the expected slot entries;
 *   3. the split page renders two panes plus the divider;
 *   4. the conversation-header entry opens the split panel;
 *   5. the manifest/locale/patch files are present and valid.
 *
 * Run: node scripts/smoke.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

function check(name, condition, detail) {
  if (condition) {
    console.log(`  ok   ${name}`);
  } else {
    failures.push(detail === undefined ? name : `${name} — ${detail}`);
    console.log(`  FAIL ${name}${detail === undefined ? "" : ` — ${detail}`}`);
  }
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}

// --------------------------------------------------------------- fake React
let hookCursor = 0;
const resetHooks = () => {
  hookCursor = 0;
};
const fakeReact = {
  createElement(type, props, ...children) {
    const flat = [];
    for (const child of children.flat(Infinity)) {
      if (child === null || child === undefined || child === false) continue;
      flat.push(child);
    }
    return { type, props: props ?? {}, children: flat };
  },
  useState(initial) {
    hookCursor += 1;
    return [initial, () => {}];
  },
  useEffect() {
    hookCursor += 1;
  },
  useMemo(factory) {
    hookCursor += 1;
    return factory();
  },
  useCallback(fn) {
    hookCursor += 1;
    return fn;
  },
  useRef(initial) {
    hookCursor += 1;
    return { current: initial ?? null };
  },
  useSyncExternalStore(_subscribe, getSnapshot) {
    hookCursor += 1;
    return getSnapshot();
  },
  Component: class Component {
    constructor(props) {
      this.props = props;
      this.state = {};
    }
    setState(patch) {
      this.state = { ...this.state, ...patch };
    }
  },
};

// ----------------------------------------------------------------- fake DOM
const storage = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  },
  addEventListener() {},
  removeEventListener() {},
  __ModuleLoader__: { load() {} },
};
globalThis.document = {
  createElement: () => ({ dataset: {}, textContent: "", remove() {} }),
  head: { appendChild() {} },
  addEventListener() {},
  removeEventListener() {},
};
globalThis.localStorage = globalThis.window.localStorage;

const sessionsById = {
  "session-a": { id: "session-a", displayTitle: "Session A", cwd: "/work/a", running: false, blank: false, updatedAt: 2, retainedBy: { mainView: 1 } },
  "session-b": { id: "session-b", displayTitle: "Session B", cwd: "/work/b", running: false, blank: false, updatedAt: 1, retainedBy: {} },
};
const listSnapshot = { ids: Object.keys(sessionsById), byId: sessionsById, phase: "ready", projectionsBySession: {} };
const workspaceSnapshot = { items: [], archivedSessionIds: [], pinnedSessionIds: [], phase: "ready" };
const statusMap = new Map();

const registrations = [];
let selectedPanel = null;

const ctx = {
  effect(callback) {
    const dispose = callback();
    return typeof dispose === "function" ? dispose : () => {};
  },
  locale: { register() {}, bind: () => (key) => key },
  slots: {
    inject(_key, callback) {
      const dispose = callback();
      return typeof dispose === "function" ? dispose : () => {};
    },
    register(options, component) {
      registrations.push({ options, component });
      return () => {};
    },
  },
  layout: {
    selectPanel(panelId) {
      selectedPanel = panelId;
    },
  },
  sessions: {
    list: { getSnapshot: () => listSnapshot, subscribe: () => () => {} },
    retain(target) {
      const sessionId = typeof target === "string" ? target : target.childSessionId;
      const binding = { sessionId };
      return { sessionId, binding, ready: Promise.resolve(binding), release() {} };
    },
    binding() {
      return undefined;
    },
  },
  uiWorkspace: { openSession() {} },
};

// -------------------------------------------------------------------- checks
console.log("[1] manifest and assets");
const pkg = readJson("package.json");
check("package.json has a name and version", typeof pkg.name === "string" && typeof pkg.version === "string", pkg.version);
check("declares a web client bundle", pkg.dsh?.client?.platform === "web");
check("declares a client entry", typeof pkg.exports?.["./client"] === "string");
check("declares a bundle patch and the file exists", typeof pkg.dsh?.bundle?.patch === "string" && fs.existsSync(path.join(ROOT, pkg.dsh.bundle.patch)));
check("client entry file exists", fs.existsSync(path.join(ROOT, "client.js")));
for (const locale of ["en", "zh"]) {
  const dict = readJson(`locale/${locale}.json`);
  check(`locale/${locale}.json has meta.title and meta.description`, typeof dict.meta?.title === "string" && dict.meta.title.length > 0 && typeof dict.meta?.description === "string");
}
check("icon.svg exists and is non-trivial", fs.existsSync(path.join(ROOT, "icon.svg")) && fs.statSync(path.join(ROOT, "icon.svg")).size > 200);

console.log("[2] bundle factory and apply");
let loaded = null;
globalThis.window.__ModuleLoader__.load = (module) => {
  loaded = module;
};
const source = fs.readFileSync(path.join(ROOT, "client.js"), "utf8");
eval(source);
check("bundle registers through the module loader", loaded !== null && typeof loaded.factory === "function", String(loaded?.id));
const exportsObject = loaded.factory((request) => {
  if (request === "react") return fakeReact;
  throw new Error(`unexpected module request: ${request}`);
});
check("factory exports inject and apply", Array.isArray(exportsObject.inject) && typeof exportsObject.apply === "function");
exportsObject.apply(ctx);

const byName = (name) => registrations.filter((entry) => entry.options.name === name);
const mainEntry = byName("main")[0];
check("main panel registered", mainEntry !== undefined && mainEntry.options.key === "session-split");
check(
  "main declares pane and team session child slots",
  mainEntry?.options.children?.["sessionSplit.pane"]?.scope === "session" && mainEntry?.options.children?.["sessionSplit.team"]?.scope === "session",
  JSON.stringify(mainEntry?.options.children),
);
check("pane slot has an occupant", byName("sessionSplit.pane").length === 1);
check("team slot has an occupant", byName("sessionSplit.team").length === 1);
check("sidebar panel icon registered with the same id", byName("sidebar.panellist").some((entry) => entry.options.id === "session-split"));
check("conversation header entry registered", byName("conversation.session.header.utilities").some((entry) => entry.options.id === "session-split"));

console.log("[3] conversation-header entry opens the split panel");
const headerEntry = byName("conversation.session.header.utilities")[0];
selectedPanel = null;
headerEntry.options.inject("session-a").openSplit();
check("openSplit selects the split main panel", selectedPanel === "session-split", String(selectedPanel));

console.log("[4] split page renders");
const useSessions = (selector) => selector(listSnapshot);
const useWorkspaces = (selector) => selector(workspaceSnapshot);
const useSessionStatus = (selector) => selector(statusMap);
const renderSlotStub = (name, owner) => ({ type: "slot", props: { name, owner } });
const SessionProviderStub = (props) => fakeReact.createElement("provider", props, props.children);
resetHooks();
const page = mainEntry.component({
  useSessions,
  useWorkspaces,
  useSessionStatus,
  SessionProvider: SessionProviderStub,
  renderSlot: renderSlotStub,
  t: (key) => key,
  controller: mainEntry.options.inject().controller,
});
const panes = [];
let divider = null;
let dragRegion = null;
function walk(node) {
  if (node === null || node === undefined) return;
  if (Array.isArray(node)) {
    for (const child of node) walk(child);
    return;
  }
  if (typeof node !== "object") return;
  const isClass = typeof node.type === "function" && node.type.prototype instanceof fakeReact.Component;
  if (typeof node.type === "function" && !isClass) {
    resetHooks();
    walk(node.type(node.props));
    return;
  }
  if (node.props?.["data-session-split-pane"] !== undefined) panes.push(node);
  if (node.props?.role === "separator") divider = node;
  if (node.props?.["data-window-drag"] === true) dragRegion = node;
  for (const child of node.children ?? []) walk(child);
}
walk(page);
check("split page renders two panes", panes.length === 2, String(panes.length));
check("split page renders the draggable divider", divider !== null && typeof divider.props?.onPointerDown === "function");
check("top bar is a window drag region", dragRegion !== null);

console.log("");
if (failures.length > 0) {
  console.error(`${failures.length} smoke check(s) failed:`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log("ALL SMOKE CHECKS PASSED");
