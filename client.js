/**
 * Session Split View — Web Client half.
 *
 * Registers a global main panel ("session-split") that shows two Sessions side by
 * side. Each pane retains its own SessionReference, binds it with the framework
 * SessionProvider, and renders the shared `conversation.content` Factory in its
 * "embedded" variant, so both panes get the real transcript, composer, queue and
 * tool views without importing any Harness Client package.
 */
window.__ModuleLoader__.load({
  id: "@local/dsh-session-split",
  factory: (require) => {
    const react = require("react");
    const h = react.createElement;
    const { Component, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } = react;

    /** Global main-panel key; also the sidebar panel-list id. */
    const PANEL_ID = "session-split";
    /** Locale namespace owned by this plugin. */
    const NS = "sessionSplit";
    /** Browser-local persistence for the pane choices and divider ratio. */
    const STORAGE_KEY = "dsh.session-split.v1";
    const DEFAULT_RATIO = 0.5;
    const MIN_RATIO = 0.2;
    const MAX_RATIO = 0.8;
    const PANE_SLOT = "sessionSplit.pane";
    const TEAM_SLOT = "sessionSplit.team";

    // ------------------------------------------------------------------ locale
    /** Simplified Chinese dictionary. */
    const zh = {
      "panel.title": "会话分栏",
      "pane.empty.title": "未选择会话",
      "pane.empty.action": "选择会话",
      "picker.title": "选择会话",
      "picker.empty": "暂无可用会话",
      "picker.inUse": "已在另一栏",
      "session.untitled": "未命名会话",
      "action.swap": "交换左右",
      "action.close": "关闭分栏",
      "action.openInMain": "在主会话中打开",
      "action.change": "切换会话",
      "action.left": "左侧会话",
      "action.right": "右侧会话",
      "pane.running": "运行中",
      "error.title": "此栏加载失败",
      "error.hint": "重新选择会话即可恢复。",
      "loading": "正在载入会话…",
      "header.open": "分栏查看",
      "team.title": "智能体团队",
      "team.open": "打开成员会话",
      "team.memberTag": "成员",
      "team.members": "成员",
      "team.tasks": "共享任务",
      "team.empty": "暂无共享任务",
      "team.current": "当前",
      "team.owner": "负责",
      "team.unowned": "未分配",
      "team.ready": "就绪",
      "team.blocked": "依赖未完成",
      "team.blockedBy": "依赖",
      "team.status.running": "运行中",
      "team.status.inactive": "空闲",
      "team.status.provisioning": "创建中",
      "team.status.failed": "失败",
      "team.task.pending": "待处理",
      "team.task.inProgress": "进行中",
      "team.task.completed": "已完成",
    };
    /** English dictionary for the same keys. */
    const en = {
      "panel.title": "Split view",
      "pane.empty.title": "No session selected",
      "pane.empty.action": "Choose a session",
      "picker.title": "Choose a session",
      "picker.empty": "No sessions available",
      "picker.inUse": "Shown in the other pane",
      "session.untitled": "Untitled session",
      "action.swap": "Swap panes",
      "action.close": "Close split view",
      "action.openInMain": "Open in main conversation",
      "action.change": "Change session",
      "action.left": "Left session",
      "action.right": "Right session",
      "pane.running": "Running",
      "error.title": "This pane failed to load",
      "error.hint": "Choose a session to recover.",
      "loading": "Loading session…",
      "header.open": "Split view",
      "team.title": "Agent Teams",
      "team.open": "Open member conversation",
      "team.memberTag": "Member",
      "team.members": "Members",
      "team.tasks": "Shared tasks",
      "team.empty": "No shared tasks yet",
      "team.current": "Current",
      "team.owner": "Owner",
      "team.unowned": "Unowned",
      "team.ready": "Ready",
      "team.blocked": "Blocked by dependencies",
      "team.blockedBy": "Blocked by",
      "team.status.running": "Running",
      "team.status.inactive": "Inactive",
      "team.status.provisioning": "Provisioning",
      "team.status.failed": "Failed",
      "team.task.pending": "Pending",
      "team.task.inProgress": "In progress",
      "team.task.completed": "Completed",
    };

    // ------------------------------------------------------------------- styles
    const CSS = `
.dss-page{display:flex;flex-direction:column;min-width:0;min-height:0;height:100%;background:var(--dsw-alias-bg-base);position:relative}
.dss-topbar{display:flex;align-items:center;gap:8px;flex:none;height:48px;padding:0 12px 0 20px;border-bottom:.5px solid var(--dsw-alias-border-l1);min-width:0}
.dss-title{display:flex;align-items:center;gap:8px;min-width:0;color:var(--dsw-alias-label-primary);font-size:13px;font-weight:500;line-height:20px}
.dss-title-text{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dss-spacer{flex:1;min-width:8px}
.dss-topbar-actions{display:flex;align-items:center;gap:4px;flex:none}
.dss-icon-button{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border:none;border-radius:var(--dsw-radius-md);background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;flex:none}
.dss-icon-button:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dss-icon-button:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.dss-icon-button[disabled]{cursor:default;opacity:.45}
.dss-panes{flex:1;min-height:0;min-width:0;display:flex;position:relative;overflow:hidden}
.dss-pane{display:flex;flex-direction:column;min-width:0;min-height:0;flex-basis:0;flex-shrink:1;position:relative;background:var(--dsw-alias-bg-base)}
.dss-pane + .dss-pane{border-left:.5px solid var(--dsw-alias-border-l1)}
.dss-pane-head{display:flex;align-items:center;gap:6px;flex:none;height:40px;padding:0 6px 0 10px;border-bottom:.5px solid var(--dsw-alias-border-l1);position:relative;background:var(--dsw-alias-bg-base)}
.dss-session-chip{box-sizing:border-box;display:inline-flex;align-items:center;gap:7px;min-width:0;max-width:100%;height:28px;padding:2px 6px;border:none;border-radius:var(--dsw-radius-md);background:transparent;color:var(--dsw-alias-label-primary);cursor:pointer;font-size:13px;line-height:18px;font-weight:500}
.dss-session-chip:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dss-session-chip:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.dss-session-chip[aria-expanded="true"]{background:var(--dsw-alias-interactive-bg-hover)}
.dss-chip-title{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.dss-chip-chevron{flex:none;color:var(--dsw-alias-label-secondary);display:inline-flex}
.dss-dot{width:6px;height:6px;border-radius:50%;flex:none;background:var(--dsw-alias-state-idle-primary)}
.dss-dot[data-running="true"]{background:var(--dsw-alias-state-success-primary)}
.dss-dot[data-empty="true"]{background:var(--dsw-alias-state-idle-primary);opacity:.6}
.dss-pane-cwd{color:var(--dsw-alias-label-secondary);font-size:11px;line-height:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;flex:1}
.dss-pane-actions{display:flex;align-items:center;gap:2px;flex:none}
.dss-pane-body{flex:1;min-height:0;min-width:0;display:flex;flex-direction:column;position:relative;overflow:hidden}
.dss-divider{flex:none;width:7px;margin:0 -3px;position:relative;z-index:6;cursor:col-resize;touch-action:none;background:transparent}
.dss-divider::before{content:"";position:absolute;top:0;bottom:0;left:3px;width:1px;background:var(--dsw-alias-border-l1)}
.dss-divider:hover::before,.dss-divider[data-dragging="true"]::before{background:var(--dsw-alias-brand-primary);width:2px;left:2.5px}
.dss-divider:focus-visible{outline:none}
.dss-divider:focus-visible::before{background:var(--dsw-alias-brand-primary);width:2px;left:2.5px}
.dss-picker{position:absolute;top:calc(100% + 4px);left:8px;z-index:40;width:360px;max-width:calc(100% - 16px);max-height:min(420px,60vh);overflow:auto;box-sizing:border-box;padding:4px;border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-bg-overlay);box-shadow:var(--dsw-elevation-prominent)}
.dss-picker-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 8px 8px;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:16px}
.dss-picker-row{box-sizing:border-box;display:flex;align-items:center;gap:8px;width:100%;min-height:44px;padding:6px 8px;border:none;border-radius:var(--dsw-radius-md);background:transparent;color:var(--dsw-alias-label-primary);cursor:pointer;text-align:left}
.dss-picker-row:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dss-picker-row:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.dss-picker-row[aria-current="true"]{background:var(--dsw-alias-bg-layer-1)}
.dss-picker-main{display:flex;flex-direction:column;gap:1px;min-width:0;flex:1}
.dss-picker-title{font-size:13px;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dss-picker-sub{font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dss-picker-badge{flex:none;color:var(--dsw-alias-label-secondary);font-size:10px;line-height:14px;border:.5px solid var(--dsw-alias-border-l2);border-radius:999px;padding:1px 6px}
.dss-picker-empty{padding:16px 8px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;text-align:center}
.dss-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:0 24px;text-align:center;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px}
.dss-empty-action{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;height:30px;padding:0 12px;border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);background:transparent;color:var(--dsw-alias-label-primary);cursor:pointer;font-size:12px;line-height:18px}
.dss-empty-action:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dss-empty-action:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.dss-error{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:0 24px;text-align:center;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
.dss-error-title{color:var(--dsw-alias-state-error-primary);font-size:13px;line-height:20px;font-weight:500}
.dss-loading{flex:1;display:flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
.dss-header-button{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border:none;border-radius:var(--dsw-radius-md);background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;flex:none}
.dss-header-button:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dss-header-button:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.dss-team-root{flex:none;display:flex;align-items:center}
.dss-team-chip{box-sizing:border-box;display:inline-flex;align-items:center;gap:4px;height:24px;padding:1px 7px;border:.5px solid var(--dsw-alias-border-l1);border-radius:999px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:11px;line-height:16px;flex:none}
.dss-team-chip:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dss-team-chip:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.dss-team-chip[aria-expanded="true"]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dss-team-chip-count{font-variant-numeric:tabular-nums}
.dss-dot[data-state="running"],.dss-dot[data-state="done"]{background:var(--dsw-alias-state-success-primary)}
.dss-dot[data-state="warn"]{background:var(--dsw-alias-state-warn-primary)}
.dss-dot[data-state="error"]{background:var(--dsw-alias-state-error-primary)}
.dss-dot[data-state="ongoing"]{background:var(--dsw-alias-brand-primary)}
.dss-team-panel{width:420px;max-height:min(520px,68vh);overflow:auto;padding:4px 4px 8px}
.dss-team-section-title{color:var(--dsw-alias-label-secondary);font-size:11px;line-height:16px;padding:10px 8px 6px;font-weight:500}
.dss-team-members{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;padding:0 4px}
.dss-team-member{box-sizing:border-box;display:flex;align-items:flex-start;gap:7px;min-width:0;padding:7px 8px;border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);cursor:pointer;text-align:left}
.dss-team-member:hover:not(:disabled){border-color:var(--dsw-alias-border-l2);background:var(--dsw-alias-interactive-bg-hover)}
.dss-team-member:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.dss-team-member:disabled{cursor:default;opacity:.75}
.dss-team-member[data-current="true"]{border-color:var(--dsw-alias-brand-primary)}
.dss-team-member .dss-dot{margin-top:5px}
.dss-team-member-text{display:flex;flex-direction:column;gap:1px;min-width:0}
.dss-team-member-name{display:inline-flex;align-items:center;gap:5px;min-width:0;font-size:12px;line-height:17px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dss-team-tag{flex:none;color:var(--dsw-alias-label-secondary);border:.5px solid var(--dsw-alias-border-l2);border-radius:999px;padding:0 5px;font-size:10px;line-height:15px;font-weight:400}
.dss-team-member-sub{color:var(--dsw-alias-label-secondary);font-size:11px;line-height:15px}
.dss-team-member-error{color:var(--dsw-alias-state-error-primary);font-size:10px;line-height:14px;overflow-wrap:anywhere}
.dss-team-tasks{display:flex;flex-direction:column;gap:6px;padding:0 4px}
.dss-team-task{border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-1);padding:8px 10px}
.dss-team-task-title{display:flex;align-items:center;gap:6px;font-size:12px;line-height:17px;color:var(--dsw-alias-label-primary);min-width:0}
.dss-team-task-title strong{font-weight:500;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dss-team-task-state{color:var(--dsw-alias-label-secondary);font-size:10px;line-height:15px;margin-left:auto;flex:none}
.dss-team-task-desc{color:var(--dsw-alias-label-secondary);font-size:11px;line-height:16px;margin:4px 0 0;white-space:pre-wrap;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.dss-team-task-meta{display:flex;flex-wrap:wrap;gap:8px;color:var(--dsw-alias-label-secondary);font-size:10px;line-height:15px;margin-top:4px}
.dss-team-task-blocked{color:var(--dsw-alias-state-warn-primary)}
.dss-team-empty{color:var(--dsw-alias-label-secondary);font-size:11px;line-height:16px;padding:2px 8px 10px}
`;

    // -------------------------------------------------------------------- state
    function clampRatio(value) {
      if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_RATIO;
      return Math.min(MAX_RATIO, Math.max(MIN_RATIO, value));
    }

    /** A subagent address token: how a pane addresses a Team member's session. */
    function isAddressTarget(target) {
      return (
        target !== null &&
        typeof target === "object" &&
        typeof target.parentSessionId === "string" &&
        typeof target.childSessionId === "string"
      );
    }

    /** Stable identity for a pane target (Session id or subagent address). */
    function targetKey(target) {
      if (typeof target === "string" && target !== "") return `id:${target}`;
      if (isAddressTarget(target)) return `address:${target.parentSessionId}>${target.childSessionId}:${target.mode ?? "continuable"}`;
      return null;
    }

    /** The Session id a pane target names (the child id for a subagent address). */
    function targetSessionId(target) {
      if (typeof target === "string") return target;
      if (isAddressTarget(target)) return target.childSessionId;
      return null;
    }

    /** The Lead Session a target belongs to; a plain Session id is its own Lead. */
    function targetLeadId(target) {
      if (typeof target === "string") return target;
      if (isAddressTarget(target)) return target.parentSessionId;
      return null;
    }

    /** Accept a persisted target only when it is a Session id or a subagent address. */
    function normalizePaneTarget(value) {
      if (typeof value === "string" && value !== "") return value;
      if (isAddressTarget(value)) {
        const mode = value.mode === "one-shot" || value.mode === "unknown" ? value.mode : "continuable";
        return { parentSessionId: value.parentSessionId, childSessionId: value.childSessionId, mode };
      }
      return null;
    }

    /** Read the persisted pane choices; any malformed value falls back to defaults. */
    function loadSplitState() {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw === null) return { leftId: null, rightId: null, ratio: DEFAULT_RATIO };
        const parsed = JSON.parse(raw);
        return {
          leftId: normalizePaneTarget(parsed?.leftId),
          rightId: normalizePaneTarget(parsed?.rightId),
          ratio: clampRatio(parsed?.ratio),
        };
      } catch (error) {
        return { leftId: null, rightId: null, ratio: DEFAULT_RATIO };
      }
    }

    let splitState = loadSplitState();
    const splitListeners = new Set();

    function getSplitState() {
      return splitState;
    }

    function subscribeSplitState(listener) {
      splitListeners.add(listener);
      return () => {
        splitListeners.delete(listener);
      };
    }

    function setSplitState(patch) {
      const next = { ...splitState, ...patch };
      if (next.leftId === splitState.leftId && next.rightId === splitState.rightId && next.ratio === splitState.ratio) return;
      splitState = next;
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (error) {
        /* persistence is optional */
      }
      for (const listener of [...splitListeners]) listener();
    }

    function useSplitState() {
      return useSyncExternalStore(subscribeSplitState, getSplitState, getSplitState);
    }

    // -------------------------------------------------------------------- icons
    function SplitGlyph(props) {
      const size = props.size ?? 16;
      return h(
        "svg",
        { viewBox: "0 0 24 24", width: size, height: size, "aria-hidden": true, style: { display: "block", flex: "none" } },
        h("rect", { x: 3, y: 4, width: 18, height: 16, rx: 3, fill: "none", stroke: "currentColor", strokeWidth: 1.6 }),
        h("path", { d: "M12 4.5v15", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" }),
        h("path", { d: "M6.4 9.2h3.2M6.4 12h3.2M14.4 9.2h3.2M14.4 12h3.2", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round", opacity: 0.75 }),
      );
    }

    function SwapGlyph(props) {
      const size = props.size ?? 16;
      return h(
        "svg",
        { viewBox: "0 0 24 24", width: size, height: size, "aria-hidden": true, style: { display: "block" } },
        h("path", { d: "M4 8h13.5M14.5 4.5 18 8l-3.5 3.5", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" }),
        h("path", { d: "M20 16H6.5M9.5 12.5 6 16l3.5 3.5", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" }),
      );
    }

    function CloseGlyph(props) {
      const size = props.size ?? 16;
      return h(
        "svg",
        { viewBox: "0 0 24 24", width: size, height: size, "aria-hidden": true, style: { display: "block" } },
        h("path", { d: "M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" }),
      );
    }

    function FocusGlyph(props) {
      const size = props.size ?? 16;
      return h(
        "svg",
        { viewBox: "0 0 24 24", width: size, height: size, "aria-hidden": true, style: { display: "block" } },
        h("path", { d: "M9 4.5H6.5A2 2 0 0 0 4.5 6.5V9M15 4.5h2.5a2 2 0 0 1 2 2V9M9 19.5H6.5a2 2 0 0 1-2-2V15M15 19.5h2.5a2 2 0 0 0 2-2V15", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" }),
        h("path", { d: "m13.2 10.8-3 3M10.2 10.8v3h3", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" }),
      );
    }

    function ChevronGlyph(props) {
      const size = props.size ?? 12;
      return h(
        "svg",
        { viewBox: "0 0 12 12", width: size, height: size, "aria-hidden": true, style: { display: "block" } },
        h("path", { d: "m2.5 4.5 3.5 3.5 3.5-3.5", fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round" }),
      );
    }

    function TeamGlyph(props) {
      const size = props.size ?? 14;
      return h(
        "svg",
        { viewBox: "0 0 24 24", width: size, height: size, "aria-hidden": true, style: { display: "block" } },
        h("path", { d: "M9 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z", fill: "none", stroke: "currentColor", strokeWidth: 1.5 }),
        h("path", { d: "M2.5 20v-.9c0-2.6 2.9-4.4 6.5-4.4s6.5 1.8 6.5 4.4v.9", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" }),
        h("path", { d: "M16.2 5.1a3 3 0 0 1 0 5.8M18.3 14.9c1.9.6 3.2 1.9 3.2 3.6v1.5", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" }),
      );
    }

    function IconButton(props) {
      return h(
        "button",
        {
          type: "button",
          className: props.className ?? "dss-icon-button",
          title: props.label,
          "aria-label": props.label,
          disabled: props.disabled === true,
          onClick: props.onClick,
        },
        h(props.icon, { size: 16 }),
      );
    }

    // ------------------------------------------------------------------ helpers
    /** Localized display title for one Session summary. */
    function sessionTitle(summary, t) {
      if (!summary) return null;
      if (summary.blank === true) return t("session.untitled");
      const display = typeof summary.displayTitle === "string" ? summary.displayTitle.trim() : "";
      if (display !== "") return display;
      const raw = typeof summary.title === "string" ? summary.title.trim() : "";
      return raw !== "" ? raw : summary.id;
    }

    /** Directory basename shown beside a Session title. */
    function cwdLabel(cwd) {
      if (typeof cwd !== "string" || cwd === "") return "";
      const parts = cwd.split(/[\\/]+/).filter(Boolean);
      return parts.length === 0 ? cwd : parts[parts.length - 1];
    }

    /** Secondary picker line: owning Workspace title, else the directory basename. */
    function pickerSubtitle(row, workspaceOf) {
      const workspaceTitle = typeof workspaceOf === "function" ? workspaceOf(row.id) : "";
      if (typeof workspaceTitle === "string" && workspaceTitle !== "") return workspaceTitle;
      return cwdLabel(row.cwd);
    }

    /** Rows offered by the picker, most recently updated first, archived rows removed. */
    function buildSessionRows(snapshot, archivedIds) {
      if (!snapshot || !snapshot.ids || !snapshot.byId) return [];
      const archived = archivedIds instanceof Set ? archivedIds : new Set(archivedIds ?? []);
      const rows = [];
      for (const id of snapshot.ids) {
        const summary = snapshot.byId[id];
        if (!summary) continue;
        if (summary.origin === "subagent") continue;
        if (archived.has(id)) continue;
        rows.push(summary);
      }
      rows.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
      return rows;
    }

    /** Read the Session currently bound to the main Conversation, if any. */
    function currentMainSessionId(byId) {
      if (!byId) return null;
      for (const summary of Object.values(byId)) {
        if (summary && (summary.retainedBy?.mainView ?? 0) > 0) return summary.id;
      }
      return null;
    }

    function findSession(rows, id) {
      if (id === null || id === undefined) return null;
      return rows.find((row) => row.id === id) ?? null;
    }

    /**
     * Retain one owned SessionReference for a pane target (Session id or subagent
     * address), releasing it on change/unmount.
     * @returns `{ reference, error }` where reference is null until the retain
     * settled in an active Controller generation.
     */
    function useSessionReference(sessions, target) {
      const key = targetKey(target);
      const targetRef = useRef(target);
      targetRef.current = target;
      const [binding, setBinding] = useState({ key: null, reference: null, error: null });
      useEffect(() => {
        if (!sessions || key === null) {
          setBinding({ key: null, reference: null, error: null });
          return undefined;
        }
        const current = targetRef.current;
        let reference = null;
        let cancelled = false;
        try {
          reference = sessions.retain(current, { source: "sessionSplit" });
        } catch (error) {
          setBinding({ key, reference: null, error: error instanceof Error ? error : new Error(String(error)) });
          return undefined;
        }
        if (!cancelled) {
          let active = null;
          try {
            if (sessions.binding(reference.sessionId) !== reference.binding) active = new Error("session reference is not active");
          } catch (error) {
            active = error instanceof Error ? error : new Error(String(error));
          }
          if (active !== null) {
            try {
              reference.release();
            } catch (error) {
              /* already dropped */
            }
            reference = null;
          }
          setBinding({ key, reference: active === null ? reference : null, error: active });
        }
        return () => {
          cancelled = true;
          try {
            reference.release();
          } catch (error) {
            /* the Controller already dropped it */
          }
        };
      }, [sessions, key]);
      if (binding.key === key) return { reference: binding.reference, error: binding.error };
      return { reference: null, error: null };
    }

    /** Contain one pane's render failure so the other pane and the page survive. */
    class PaneBoundary extends Component {
      constructor(props) {
        super(props);
        this.state = { failed: false };
      }

      static getDerivedStateFromError() {
        return { failed: true };
      }

      componentDidCatch(error) {
        console.error("[session-split] pane crashed:", error);
      }

      render() {
        if (this.state.failed) {
          return h(
            "div",
            { className: "dss-error", "data-session-split-error": "" },
            h("div", { className: "dss-error-title" }, this.props.t("error.title")),
            h("div", null, this.props.t("error.hint")),
          );
        }
        return this.props.children;
      }
    }

    // -------------------------------------------------------- conversation pane
    /** Fixed Chat View for an embedded Conversation occurrence. */
    function FixedChatView(props) {
      return props.renderSlot("conversation.session", { view: "chat" });
    }

    /**
     * Session-scoped slot occupant: render the shared Conversation body for the
     * Session bound by the surrounding SessionProvider.
     */
    function PaneConversation(props) {
      const { sessionId, useSession, useConversation, useSessions, renderFactorySlot } = props;
      const session = useSession((value) => value);
      const conversation = useConversation((value) => value);
      const summaryBlank = useSessions((state) => (sessionId === undefined ? undefined : state.byId[sessionId]?.blank));
      const shellPhase =
        conversation.activeTargets.size > 0 || (!session.blank && !session.awaitingFirstTurn) || session.running
          ? "active"
          : session.promptAttempted
            ? "engaging"
            : "blank";
      const settling = shellPhase === "blank" && session.openState === "loading" && summaryBlank !== true;
      const hero = shellPhase === "blank" && (session.openState === "open" || summaryBlank === true);
      return renderFactorySlot(
        "conversation.content",
        { variant: "embedded", phase: settling ? "settling" : hero ? "hero" : "active", hero },
        { slots: { views: FixedChatView } },
      );
    }

    // ------------------------------------------------------------------- picker
    /** Popover list of Sessions for one pane. */
    function SessionPicker(props) {
      const { rows, currentId, otherId, onPick, onClose, t, workspaceOf } = props;
      const rootRef = useRef(null);
      useEffect(() => {
        const onPointerDown = (event) => {
          if (rootRef.current !== null && rootRef.current.contains(event.target)) return;
          onClose();
        };
        const onKeyDown = (event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onClose();
          }
        };
        document.addEventListener("mousedown", onPointerDown, true);
        document.addEventListener("keydown", onKeyDown, true);
        return () => {
          document.removeEventListener("mousedown", onPointerDown, true);
          document.removeEventListener("keydown", onKeyDown, true);
        };
      }, [onClose]);
      let body;
      if (rows.length === 0) {
        body = h("div", { className: "dss-picker-empty" }, t("picker.empty"));
      } else {
        body = rows.map((row) => {
          const inOther = row.id === otherId;
          const current = row.id === currentId;
          return h(
            "button",
            {
              type: "button",
              key: row.id,
              className: "dss-picker-row",
              "aria-current": current ? "true" : undefined,
              title: inOther ? t("picker.inUse") : undefined,
              onClick: () => onPick(row.id),
            },
            h("span", { className: "dss-dot", "data-running": row.running === true ? "true" : undefined }),
            h(
              "span",
              { className: "dss-picker-main" },
              h("span", { className: "dss-picker-title" }, sessionTitle(row, t)),
              pickerSubtitle(row, workspaceOf) === ""
                ? null
                : h("span", { className: "dss-picker-sub" }, pickerSubtitle(row, workspaceOf)),
            ),
            inOther ? h("span", { className: "dss-picker-badge" }, t("picker.inUse")) : null,
          );
        });
      }
      return h(
        "div",
        { className: "dss-picker", ref: rootRef, role: "listbox", "aria-label": t("picker.title"), "data-session-split-picker": "" },
        h("div", { className: "dss-picker-head" }, h("span", null, t("picker.title"))),
        body,
      );
    }

    // --------------------------------------------------------------------- team
    /** Status of one Team member, following the shipped Agent Teams panel. */
    function memberStatusOf(member, running, summaryRunning) {
      if (member.phase === "active") return (running ?? summaryRunning) === true ? "running" : "inactive";
      return member.phase ?? "inactive";
    }

    function memberStatusKey(status) {
      switch (status) {
        case "running": return "team.status.running";
        case "provisioning": return "team.status.provisioning";
        case "failed": return "team.status.failed";
        default: return "team.status.inactive";
      }
    }

    function memberDotState(status) {
      switch (status) {
        case "running": return "running";
        case "provisioning": return "ongoing";
        case "failed": return "error";
        default: return "idle";
      }
    }

    function taskStatusOf(task) {
      switch (task.status) {
        case "pending": return task.ready === true ? "idle" : "warn";
        case "in_progress": return "ongoing";
        case "completed": return "done";
        default: return "idle";
      }
    }

    function taskStatusKey(status) {
      switch (status) {
        case "in_progress": return "team.task.inProgress";
        case "completed": return "team.task.completed";
        default: return "team.task.pending";
      }
    }

    /** One roster row; clicking opens that member's conversation in the main column. */
    function TeamMemberRow(props) {
      const { member, currentId, useSessions, useSessionStatus, openTeammate, t } = props;
      const running = useSessionStatus((state) => state.get(member.id)?.running);
      const summaryRunning = useSessions((state) => state.byId?.[member.id]?.running);
      const status = memberStatusOf(member, running, summaryRunning);
      const current = member.id === currentId;
      const inert = current || status === "failed" || status === "provisioning";
      return h(
        "button",
        {
          type: "button",
          className: "dss-team-member",
          "data-current": current ? "true" : undefined,
          title: inert ? undefined : t("team.open"),
          disabled: inert,
          onClick: () => {
            if (inert) return;
            try {
              openTeammate(member.id);
            } catch (error) {
              console.error("[session-split] open teammate failed:", error);
            }
          },
        },
        h("span", { className: "dss-dot", "data-state": memberDotState(status) }),
        h(
          "span",
          { className: "dss-team-member-text" },
          h(
            "span",
            { className: "dss-team-member-name" },
            member.name ?? member.id,
            current ? h("span", { className: "dss-team-tag" }, t("team.current")) : null,
          ),
          h("span", { className: "dss-team-member-sub" }, t(memberStatusKey(status))),
          typeof member.error === "string" && member.error !== ""
            ? h("span", { className: "dss-team-member-error" }, member.error)
            : null,
        ),
      );
    }

    /** One read-only shared-task row. */
    function TeamTaskRow(props) {
      const { task, t } = props;
      return h(
        "div",
        { className: "dss-team-task" },
        h(
          "div",
          { className: "dss-team-task-title" },
          h("span", { className: "dss-dot", "data-state": taskStatusOf(task) }),
          h("strong", null, task.subject ?? task.id),
          h("span", { className: "dss-team-task-state" }, t(taskStatusKey(task.status))),
        ),
        typeof task.description === "string" && task.description !== "" ? h("p", { className: "dss-team-task-desc" }, task.description) : null,
        h(
          "div",
          { className: "dss-team-task-meta" },
          h("span", null, `${t("team.owner")}: ${task.ownerName ?? t("team.unowned")}`),
          task.status === "pending"
            ? h("span", { className: task.ready === true ? undefined : "dss-team-task-blocked" }, task.ready === true ? t("team.ready") : t("team.blocked"))
            : null,
          Array.isArray(task.blockedBy) && task.blockedBy.length > 0
            ? h("span", null, `${t("team.blockedBy")}: ${task.blockedBy.join(", ")}`)
            : null,
        ),
      );
    }

    /** Roster + shared task board popover for one pane's Lead Session. */
    function TeamPanel(props) {
      const { team, currentId, useSessions, useSessionStatus, openTeammate, t } = props;
      const members = Array.isArray(team.members) ? team.members : [];
      const tasks = Array.isArray(team.tasks) ? team.tasks : [];
      return h(
        "div",
        { className: "dss-picker dss-team-panel", role: "dialog", "aria-label": t("team.title"), "data-session-split-team": "" },
        h("div", { className: "dss-picker-head" }, h("span", null, t("team.title"))),
        h("div", { className: "dss-team-section-title" }, `${t("team.members")} · ${members.length}`),
        h(
          "div",
          { className: "dss-team-members" },
          members.map((member) =>
            h(TeamMemberRow, {
              key: member.id,
              member,
              currentId,
              useSessions,
              useSessionStatus,
              openTeammate,
              t,
            }),
          ),
        ),
        h("div", { className: "dss-team-section-title" }, `${t("team.tasks")} · ${tasks.length}`),
        tasks.length === 0
          ? h("div", { className: "dss-team-empty" }, t("team.empty"))
          : h("div", { className: "dss-team-tasks" }, tasks.map((task) => h(TeamTaskRow, { key: task.id, task, t }))),
      );
    }

    /**
     * Agent Teams entry for one pane. The shipped Agent Teams action only exists
     * in the conversation header, which an embedded Conversation occurrence does
     * not render, so this mirrors its roster and task board from the same
     * `agentTeam` projection the official panel reads.
     */
    function TeamChip(props) {
      const { sessionId, useSession, useSessions, useSessionStatus, openTeammate, t } = props;
      const leadSessionId = useSession((snapshot) => snapshot.subagent?.address?.parentSessionId) ?? sessionId;
      const team = useSessions((state) =>
        leadSessionId === undefined ? undefined : state.projectionsBySession?.[leadSessionId]?.values?.agentTeam,
      );
      const [open, setOpen] = useState(false);
      const rootRef = useRef(null);
      const close = useCallback(() => setOpen(false), []);
      useEffect(() => {
        setOpen(false);
      }, [sessionId]);
      useEffect(() => {
        if (!open) return undefined;
        const onPointerDown = (event) => {
          if (rootRef.current !== null && rootRef.current.contains(event.target)) return;
          close();
        };
        const onKeyDown = (event) => {
          if (event.key !== "Escape") return;
          event.stopPropagation();
          close();
        };
        document.addEventListener("mousedown", onPointerDown, true);
        document.addEventListener("keydown", onKeyDown, true);
        return () => {
          document.removeEventListener("mousedown", onPointerDown, true);
          document.removeEventListener("keydown", onKeyDown, true);
        };
      }, [open, close]);
      const members = Array.isArray(team?.members) ? team.members : [];
      const tasks = Array.isArray(team?.tasks) ? team.tasks : [];
      if (team === undefined || (members.length <= 1 && tasks.length === 0)) return null;
      return h(
        "div",
        { className: "dss-team-root", ref: rootRef },
        h(
          "button",
          {
            type: "button",
            className: "dss-team-chip",
            title: t("team.title"),
            "aria-label": t("team.title"),
            "aria-haspopup": "dialog",
            "aria-expanded": open ? "true" : "false",
            onClick: () => setOpen((value) => !value),
          },
          h(TeamGlyph, { size: 14 }),
          members.length > 0 ? h("span", { className: "dss-team-chip-count" }, String(members.length)) : null,
        ),
        open ? h(TeamPanel, { team, currentId: sessionId, useSessions, useSessionStatus, openTeammate, t }) : null,
      );
    }

    // --------------------------------------------------------------------- pane
    /** One split pane: Session chip, picker, Team chip, and the embedded Conversation body. */
    function PaneColumn(props) {
      const { side, target, otherTarget, rows, byId, SessionProvider, renderSlot, controller, t, ratio, workspaceOf } = props;
      const sessionId = targetSessionId(target);
      const summary = sessionId === null ? null : byId?.[sessionId] ?? findSession(rows, sessionId);
      const [pickerOpen, setPickerOpen] = useState(false);
      const { reference, error } = useSessionReference(controller.sessions, target);
      const closePicker = useCallback(() => setPickerOpen(false), []);
      const choose = useCallback(
        (id) => {
          setPickerOpen(false);
          controller.choose(side, id);
        },
        [controller, side],
      );

      let body;
      if (sessionId === null) {
        body = h(
          "div",
          { className: "dss-empty" },
          h("div", null, t("pane.empty.title")),
          h(
            "button",
            { type: "button", className: "dss-empty-action", onClick: () => setPickerOpen(true) },
            t("pane.empty.action"),
          ),
        );
      } else if (error !== null) {
        body = h(
          "div",
          { className: "dss-error" },
          h("div", { className: "dss-error-title" }, t("error.title")),
          h("div", null, t("error.hint")),
        );
      } else if (reference === null) {
        body = h("div", { className: "dss-loading" }, t("loading"));
      } else {
        body = h(
          PaneBoundary,
          { key: targetKey(target), t },
          h(SessionProvider, { session: reference }, renderSlot(PANE_SLOT, {})),
        );
      }

      const teammate = isAddressTarget(target);
      const titleFallback = sessionId === null ? null : teammate ? sessionId.slice(-8) : sessionId;
      const chipTitle = sessionId === null ? t("pane.empty.action") : sessionTitle(summary, t) ?? titleFallback;
      return h(
        "section",
        {
          className: "dss-pane",
          "data-session-split-pane": side,
          style: { flexGrow: ratio },
        },
        h(
          "div",
          { className: "dss-pane-head" },
          h(
            "button",
            {
              type: "button",
              className: "dss-session-chip",
              title: t("action.change"),
              "aria-label": t("action.change"),
              "aria-expanded": pickerOpen ? "true" : "false",
              onClick: () => setPickerOpen((open) => !open),
            },
            h("span", {
              className: "dss-dot",
              "data-running": summary?.running === true ? "true" : undefined,
              "data-empty": summary === null ? "true" : undefined,
            }),
            h("span", { className: "dss-chip-title" }, chipTitle),
            teammate ? h("span", { className: "dss-team-tag" }, t("team.memberTag")) : null,
            h("span", { className: "dss-chip-chevron" }, h(ChevronGlyph, {})),
          ),
          h(
            "span",
            { className: "dss-pane-cwd", title: summary?.cwd ?? "" },
            sessionId === null || summary === null ? "" : pickerSubtitle(summary, workspaceOf),
          ),
          reference === null
            ? null
            : h(
                SessionProvider,
                { session: reference, empty: () => null },
                renderSlot(TEAM_SLOT, { openTeammate: (childId) => controller.openTeammateInPane(side, childId) }),
              ),
          h(
            "div",
            { className: "dss-pane-actions" },
            sessionId === null || sessionId === undefined
              ? null
              : h(IconButton, { label: t("action.openInMain"), icon: FocusGlyph, onClick: () => controller.openInMain(target) }),
          ),
          pickerOpen
            ? h(SessionPicker, { rows, currentId: sessionId, otherId: targetSessionId(otherTarget), onPick: choose, onClose: closePicker, t, workspaceOf })
            : null,
        ),
        h("div", { className: "dss-pane-body" }, body),
      );
    }

    // --------------------------------------------------------------------- page
    /** Root-scoped main panel body: two panes and the draggable divider. */
    function SessionSplitPage(props) {
      const { useSessions, useWorkspaces, SessionProvider, renderSlot, t, controller } = props;
      const split = useSplitState();
      const ids = useSessions((state) => state.ids);
      const byId = useSessions((state) => state.byId);
      const archivedIds = useWorkspaces((state) => state.archivedSessionIds);
      const workspaceItems = useWorkspaces((state) => state.items);
      const rows = useMemo(() => buildSessionRows({ ids, byId }, archivedIds), [ids, byId, archivedIds]);
      const workspaceOf = useMemo(() => {
        const map = new Map();
        for (const workspace of workspaceItems ?? []) {
          for (const id of workspace.sessionIds ?? []) if (!map.has(id)) map.set(id, workspace.title ?? "");
        }
        return (id) => map.get(id) ?? "";
      }, [workspaceItems]);
      const panesRef = useRef(null);
      const [resizing, setResizing] = useState(false);
      const resizeRef = useRef(null);

      const currentId = useMemo(() => currentMainSessionId(byId), [byId]);
      const leftTarget = resolvePane(split.leftId, split.rightId, rows, byId, currentId);
      let rightTarget = resolvePane(split.rightId, leftTarget, rows, byId, null);
      if (rightTarget !== null && targetKey(rightTarget) === targetKey(leftTarget)) rightTarget = null;

      const choose = useCallback(
        (side, id) => {
          const other = side === "left" ? rightTarget : leftTarget;
          if (targetKey(id) === targetKey(other)) {
            if (leftTarget !== null && rightTarget !== null) {
              setSplitState({ leftId: rightTarget, rightId: leftTarget });
            }
            return;
          }
          const patch = { leftId: leftTarget, rightId: rightTarget };
          patch[side === "left" ? "leftId" : "rightId"] = id;
          setSplitState(patch);
        },
        [leftTarget, rightTarget],
      );

      /** Open a Team member inside this pane instead of leaving the split page. */
      const openTeammateInPane = useCallback(
        (side, memberId) => {
          const target = side === "left" ? leftTarget : rightTarget;
          const leadId = targetLeadId(target);
          if (leadId === null || memberId === null || memberId === undefined) return;
          const next = memberId === leadId ? leadId : { parentSessionId: leadId, childSessionId: memberId, mode: "continuable" };
          const other = side === "left" ? rightTarget : leftTarget;
          if (targetKey(next) !== null && targetKey(next) === targetKey(other)) return;
          const patch = { leftId: leftTarget, rightId: rightTarget };
          patch[side === "left" ? "leftId" : "rightId"] = next;
          setSplitState(patch);
        },
        [leftTarget, rightTarget],
      );

      const openInMain = useCallback(
        (target) => {
          try {
            controller.openSession(target);
          } catch (error) {
            console.error("[session-split] open session failed:", error);
          }
        },
        [controller],
      );
      const swap = useCallback(() => {
        setSplitState({ leftId: rightTarget, rightId: leftTarget });
      }, [leftTarget, rightTarget]);
      const close = useCallback(() => {
        try {
          controller.closePanel();
        } catch (error) {
          console.error("[session-split] close panel failed:", error);
        }
      }, [controller]);

      const onDividerPointerDown = useCallback((event) => {
        if (event.button !== 0) return;
        const panes = panesRef.current;
        if (panes === null) return;
        const rect = panes.getBoundingClientRect();
        if (rect.width <= 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        resizeRef.current = { pointerId: event.pointerId, startX: event.clientX, startRatio: getSplitState().ratio, width: rect.width };
        panes.dataset.resizing = "true";
        setResizing(true);
      }, []);

      const onDividerPointerMove = useCallback((event) => {
        const drag = resizeRef.current;
        if (drag === null || drag.pointerId !== event.pointerId) return;
        const ratio = Math.min(MAX_RATIO, Math.max(MIN_RATIO, drag.startRatio + (event.clientX - drag.startX) / drag.width));
        drag.ratio = ratio;
        const panes = panesRef.current;
        if (panes !== null) {
          const left = panes.children[0];
          const right = panes.children[2];
          if (left !== undefined) left.style.flexGrow = String(ratio);
          if (right !== undefined) right.style.flexGrow = String(1 - ratio);
        }
      }, []);

      const finishResize = useCallback((event) => {
        const drag = resizeRef.current;
        if (drag === null || (event !== undefined && drag.pointerId !== event.pointerId)) return;
        resizeRef.current = null;
        const panes = panesRef.current;
        if (panes !== null) delete panes.dataset.resizing;
        setResizing(false);
        if (typeof drag.ratio === "number") setSplitState({ ratio: drag.ratio });
      }, []);

      const paneProps = {
        rows,
        byId,
        SessionProvider,
        renderSlot,
        controller: { sessions: controller.sessions, choose, openInMain, closePanel: close, openTeammateInPane },
        workspaceOf,
        t,
      };

      return h(
        "div",
        { className: "dss-page", "data-session-split": "", "data-resizing": resizing ? "true" : undefined },
        h(
          "div",
          { className: "dss-topbar" },
          h("div", { className: "dss-title" }, h(SplitGlyph, { size: 16 }), h("span", { className: "dss-title-text" }, t("panel.title"))),
          h("div", { className: "dss-spacer" }),
          h(
            "div",
            { className: "dss-topbar-actions" },
            h(IconButton, { label: t("action.swap"), icon: SwapGlyph, onClick: swap }),
            h(IconButton, { label: t("action.close"), icon: CloseGlyph, onClick: close }),
          ),
        ),
        h(
          "div",
          { className: "dss-panes", ref: panesRef },
          h(PaneColumn, { ...paneProps, side: "left", target: leftTarget, otherTarget: rightTarget, ratio: split.ratio }),
          h("div", {
            className: "dss-divider",
            role: "separator",
            tabIndex: 0,
            "aria-orientation": "vertical",
            "aria-label": t("panel.title"),
            onPointerDown: onDividerPointerDown,
            onPointerMove: onDividerPointerMove,
            onPointerUp: finishResize,
            onPointerCancel: finishResize,
            onLostPointerCapture: finishResize,
          }),
          h(PaneColumn, { ...paneProps, side: "right", target: rightTarget, otherTarget: leftTarget, ratio: 1 - split.ratio }),
        ),
      );
    }

    /** Pick a usable pane target, avoiding the other pane when possible. */
    function resolvePane(preferred, other, rows, byId, fallbackId) {
      const otherKey = targetKey(other);
      const usable = (target) => (typeof target === "string" ? byId?.[target] !== undefined : isAddressTarget(target));
      if (usable(preferred) && targetKey(preferred) !== otherKey) return preferred;
      if (typeof fallbackId === "string" && byId?.[fallbackId] !== undefined && targetKey(fallbackId) !== otherKey) {
        return fallbackId;
      }
      const otherSession = targetSessionId(other);
      const notOther = rows.filter((row) => row.id !== otherSession);
      const candidate = notOther.find((row) => row.blank !== true) ?? notOther[0];
      return candidate === undefined ? null : candidate.id;
    }

    // ----------------------------------------------------------- header entry
    /** Conversation header button: open the current Session in the split panel. */
    function SplitHeaderButton(props) {
      const { openSplit, t } = props;
      return h(
        "button",
        {
          type: "button",
          className: "dss-header-button",
          title: t("header.open"),
          "aria-label": t("header.open"),
          onClick: () => openSplit(),
        },
        h(SplitGlyph, { size: 16 }),
      );
    }

    // ------------------------------------------------------------ panel entry
    /** Sidebar global-panel icon for the split panel. */
    function SplitPanelIcon(props) {
      const size = props.size ?? 16;
      return h(SplitGlyph, { size });
    }

    // -------------------------------------------------------------------- apply
    /** Required Client services. */
    const inject = ["slots", "sessions", "locale", "layout", "uiWorkspace"];

    /**
     * Client plugin body.
     * @param ctx - Client root context carrying Slots, Sessions, locale, layout.
     */
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), "session-split: dictionaries");
      const t = ctx.locale.bind(NS);
      ctx.effect(() => {
        if (typeof document === "undefined") return () => {};
        const tag = document.createElement("style");
        tag.dataset.plugin = "@local/dsh-session-split";
        tag.dataset.pluginCss = "@local/dsh-session-split/SessionSplit.module.css";
        tag.textContent = CSS;
        document.head.appendChild(tag);
        return () => {
          tag.remove();
        };
      }, "session-split: stylesheet");

      const sessions = ctx.sessions;

      /** Choose ids for a split opened from a Session header. */
      const openSplit = (pinnedSessionId) => {
        let rows = [];
        try {
          rows = buildSessionRows(sessions.list.getSnapshot());
        } catch (error) {
          rows = [];
        }
        const known = (target) =>
          typeof target === "string" ? rows.some((row) => row.id === target) : isAddressTarget(target);
        const current = getSplitState();
        let leftId = null;
        let rightId = null;
        if (pinnedSessionId !== null && pinnedSessionId !== undefined) {
          leftId = pinnedSessionId;
          if (known(current.rightId) && targetKey(current.rightId) !== targetKey(leftId)) rightId = current.rightId;
          else if (known(current.leftId) && targetKey(current.leftId) !== targetKey(leftId)) rightId = current.leftId;
        } else {
          if (known(current.leftId)) leftId = current.leftId;
          else {
            const first = rows.find((row) => row.blank !== true) ?? rows[0];
            leftId = first === undefined ? null : first.id;
          }
          if (known(current.rightId) && targetKey(current.rightId) !== targetKey(leftId)) rightId = current.rightId;
        }
        if (rightId === null) {
          const otherSession = targetSessionId(leftId);
          const other = rows.find((row) => row.id !== otherSession && row.blank !== true) ?? rows.find((row) => row.id !== otherSession);
          rightId = other === undefined ? null : other.id;
        }
        setSplitState({ leftId, rightId });
        ctx.layout.selectPanel(PANEL_ID);
      };

      const controller = {
        sessions,
        openSession: (target) => {
          try {
            ctx.uiWorkspace.openSession(target);
          } finally {
            ctx.layout.selectPanel(null);
          }
        },
        closePanel: () => {
          ctx.layout.selectPanel(null);
        },
      };

      // The global panels list: one icon that selects the split main panel.
      ctx.effect(
        () =>
          ctx.slots.inject("sidebar.panellist", () =>
            ctx.slots.register(
              {
                name: "sidebar.panellist",
                id: PANEL_ID,
                order: 102,
                label: () => t("panel.title"),
              },
              SplitPanelIcon,
            ),
          ),
        "session-split: panel icon",
      );

      // The split page itself: a keyed `main` panel with a session-scoped child slot.
      ctx.effect(
        () =>
          ctx.slots.inject("main", () =>
            ctx.slots.register(
              {
                name: "main",
                key: PANEL_ID,
                locale: NS,
                children: {
                  [PANE_SLOT]: { kind: "single", scope: "session" },
                  [TEAM_SLOT]: { kind: "single", scope: "session" },
                },
                inject: () => ({ controller }),
              },
              SessionSplitPage,
            ),
          ),
        "session-split: main panel",
      );

      // One Session-bound Conversation body per pane.
      ctx.effect(
        () =>
          ctx.slots.inject(PANE_SLOT, () =>
            ctx.slots.register({ name: PANE_SLOT, locale: NS }, PaneConversation),
          ),
        "session-split: pane conversation",
      );

      // Per-pane Agent Teams entry (roster + shared task board).
      ctx.effect(
        () =>
          ctx.slots.inject(TEAM_SLOT, () =>
            ctx.slots.register(
              {
                name: TEAM_SLOT,
                locale: NS,
              },
              TeamChip,
            ),
          ),
        "session-split: team chip",
      );

      // Conversation header entry: open the current Session in the split panel.
      ctx.effect(
        () =>
          ctx.slots.inject("conversation.session.header.utilities", () =>
            ctx.slots.register(
              {
                name: "conversation.session.header.utilities",
                id: "session-split",
                order: 50,
                locale: NS,
                inject: (sessionId) => ({ openSplit: () => openSplit(sessionId) }),
              },
              SplitHeaderButton,
            ),
          ),
        "session-split: header button",
      );
    }

    return { inject, apply };
  },
});
