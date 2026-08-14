// ── SillyImage Lab 主题系统 ──
import { slLog } from '../log.js';
import { settings, saveSettings } from '../settings.js';

export var CAT_THEMES = {
  "奶糖小猫": { bg: "#fef7f0", card: "#ffffff", accent: "#ffb26b", accentHover: "#ff9a42", text: "#5a4030", sub: "#9a8070", mute: "#c8b8a8", line: "#f5e6d8", green: "#7cc29a", red: "#f07878", yellow: "#f5c26b", radius: "16px", borderRadiusBtn: "12px", borderRadiusInput: "10px", btnPadding: "8px 18px", inputPadding: "8px 12px", shadow: "0 4px 20px rgba(180,130,90,0.10)", btnShadow: "0 3px 10px rgba(255,178,107,0.25)", borderStyle: "1px solid", font: "Noto Sans SC, PingFang SC, Microsoft YaHei, sans-serif", backdropFilter: "none" },
  "贴纸小猫": { bg: "#fff9f0", card: "#ffffff", accent: "#ff8c42", accentHover: "#ff7322", text: "#2d2218", sub: "#7a6a5a", mute: "#b0a090", line: "#2d2218", green: "#44aa66", red: "#ee5555", yellow: "#eebb33", radius: "14px", borderRadiusBtn: "12px", borderRadiusInput: "10px", btnPadding: "8px 18px", inputPadding: "8px 12px", shadow: "3px 3px 0px rgba(45,34,24,0.15)", btnShadow: "2px 2px 0px rgba(45,34,24,0.2)", borderStyle: "2px solid", font: "Noto Sans SC, PingFang SC, Microsoft YaHei, sans-serif", backdropFilter: "none" },
  "云朵猫窝": { bg: "#f0f4f8", card: "rgba(255,255,255,0.75)", accent: "#6366f1", accentHover: "#818cf8", text: "#1e293b", sub: "#64748b", mute: "#94a3b8", line: "rgba(255,255,255,0.8)", green: "#10b981", red: "#ef4444", yellow: "#f59e0b", radius: "16px", borderRadiusBtn: "12px", borderRadiusInput: "10px", btnPadding: "8px 18px", inputPadding: "8px 12px", shadow: "0 8px 32px rgba(0,0,0,0.06)", btnShadow: "0 4px 12px rgba(99,102,241,0.2)", borderStyle: "1px solid", font: "Noto Sans SC, PingFang SC, Microsoft YaHei, sans-serif", backdropFilter: "blur(12px)" },
  "像素小猫": { bg: "#f0e8d8", card: "#fff8e8", accent: "#ff6b6b", accentHover: "#ff4949", text: "#333333", sub: "#776655", mute: "#aa9988", line: "#333333", green: "#66bb66", red: "#ff5555", yellow: "#ffcc33", radius: "0px", borderRadiusBtn: "0px", borderRadiusInput: "0px", btnPadding: "8px 16px", inputPadding: "8px 12px", shadow: "4px 4px 0px rgba(0,0,0,0.2)", btnShadow: "2px 2px 0px rgba(0,0,0,0.25)", borderStyle: "2px solid", font: "Consolas, Microsoft YaHei, monospace", backdropFilter: "none" }
};

export var CAT = CAT_THEMES["奶糖小猫"];

export var TEXT_THEMES = { "默认": { font: "inherit", lineHeight: "1.6", color: "inherit", bg: "transparent", fontSize: "inherit" }, "暖纸阅读": { font: "Noto Serif SC, SimSun, serif", lineHeight: "2.0", color: "#4a3728", bg: "#fef9f2", fontSize: "15px" }, "深夜模式": { font: "inherit", lineHeight: "1.7", color: "#d0d0d0", bg: "#1a1a1e", fontSize: "14px" }, "紧凑模式": { font: "Noto Sans SC, sans-serif", lineHeight: "1.4", color: "#1a1a1a", bg: "transparent", fontSize: "13px" } };

export function applyTheme(n) {
  if (typeof CAT_THEMES === "undefined") return;
  CAT = CAT_THEMES[n] || CAT_THEMES["奶糖小猫"];
  if (!CAT) CAT = CAT_THEMES["奶糖小猫"];
  var r = document.documentElement;
  r.style.setProperty("--sl-accent", CAT.accent);
  r.style.setProperty("--sl-accent-hover", CAT.accentHover || CAT.accent);
  r.style.setProperty("--sl-line", CAT.line);
  r.style.setProperty("--sl-card", CAT.card);
  r.style.setProperty("--sl-radius", CAT.radius);
  r.style.setProperty("--sl-border", CAT.borderStyle + " " + CAT.line);
  r.style.setProperty("--sl-shadow", CAT.shadow);
  r.style.setProperty("--sl-font", CAT.font);
  r.style.setProperty("--sl-bg", CAT.bg);
  r.style.setProperty("--sl-text", CAT.text);
  if (CAT.backdropFilter && CAT.backdropFilter !== "none") r.style.setProperty("--sl-backdrop", CAT.backdropFilter);
  else r.style.removeProperty("--sl-backdrop");
  syncThemeToDOM();
}

export function injectThemeStyle() {
  var id = "sl_theme_overrides";
  var el = document.getElementById(id);
  if (!el) { el = document.createElement("style"); el.id = id; document.head.appendChild(el); }
  var rules = "";
  if (settings.uiTheme === "贴纸小猫") {
    rules += "#sl_compact button:active,#sl_panel button:active{transform:translate(2px,2px)!important;box-shadow:none!important}";
  } else if (settings.uiTheme === "像素小猫") {
    rules += "#sl_compact button,#sl_panel button{transition:none!important}#sl_compact button:hover,#sl_panel button:hover{filter:none!important;transform:none!important}";
  }
  el.textContent = rules;
}

function syncThemeToDOM() {
  try {
    var t = TEXT_THEMES[settings.enhancedTheme] || TEXT_THEMES["默认"];
    if (document.getElementById("sl_global_text_style")) return;
    var s = document.createElement("style");
    s.id = "sl_global_text_style";
    s.textContent = ".sl_enhanced,.sl_enhanced *{font-family:" + (t.font || "inherit") + ";line-height:" + (t.lineHeight || "1.6") + ";color:" + (t.color || "inherit") + ";background:" + (t.bg || "transparent") + ";font-size:" + (t.fontSize || "inherit") + "}";
    document.head.appendChild(s);
  } catch (e) {}
}

// ── 工具函数 ──
export function getCatStatusFace(s) {
  return ({ idle: "=^_^=", queuing: "^_^", busy: "*o*", error: ">_<" }[s] || "=^_^=");
}

export function toast(t, m) {
  try {
    if (typeof toastr !== "undefined") {
      var faces = { success: "=^_^=", info: "(=^_^=)", warning: "(T_T)", error: "(x_x)" };
      toastr[t]((faces[t] || "=^_^=") + " " + m);
    } else console.log("[sillab]", t, m);
  } catch (e) { console.log("[sillab]", t, m); }
}

export function esc(s) {
  if (!s) return "";
  var d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

export function escAttr(s) {
  if (!s) return "";
  return ("" + s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function sbtn(c) {
  return "padding:" + (CAT.btnPadding || "8px 16px") + ";border:none;border-radius:" + (CAT.borderRadiusBtn || CAT.radius) + ";background:" + c + ";color:#fff;cursor:pointer;font-size:12px;font-weight:600;box-shadow:" + (CAT.btnShadow || "none") + ";transition:all 0.2s cubic-bezier(0.34,1.56,0.64,1);";
}

export function fi() {
  return "width:100%;padding:" + (CAT.inputPadding || "8px 10px") + ";border:" + CAT.borderStyle + " " + CAT.line + ";border-radius:" + (CAT.borderRadiusInput || "8px") + ";background:" + CAT.card + ";font-size:12px;color:" + CAT.text + ";box-sizing:border-box;outline:none;transition:all 0.2s ease;";
}
