// SillyImage Lab v2.1 — 三Tab + 档案重构
import { slLog, slErr, slLogDump, getLogCount, slClearLogs } from "./log.js";
import { settings, getDefaults, COLORS, INPUT_STYLE, BUTTON_STYLE, getSTContext, getSTHeaders, escapeHtml, saveSettings } from "./settings.js";
import { loadWorkflowList, loadWorkflow, saveWorkflow, deleteWorkflow, fetchComfyModels, generateImage, STYLE_PRESETS } from "./comfyui.js";
import { getProfiles, scanCharacterProfile, getCharacterName, deleteCharacterProfile, refineStaticProfile } from "./pipeline.js";
import { hasCastCache, stopPolling, getScannerStatus } from "./scanner.js";
import { exportProfiles } from "./export.js";
import { getQueueLength, clearQueue } from "./queue.js";

var CAT_THEMES = { "暖色猫窝": { bg: "#fff8f0", card: "#ffffff", accent: "#f0834c", text: "#3d2b1f", sub: "#8c6e5a", mute: "#bfa894", line: "#e8d5c4", green: "#5fa88c", red: "#e05555", yellow: "#e8a840", shadow: "0 2px 16px rgba(100,60,30,0.10)", radius: "14px", font: '"Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif', borderStyle: "1px solid" }, "暗夜模式": { bg: "#1a1a2e", card: "#252540", accent: "#f0834c", text: "#e0e0e0", sub: "#999", mute: "#666", line: "#333366", green: "#5fa88c", red: "#e05555", yellow: "#e8a840", shadow: "0 2px 16px rgba(0,0,0,0.4)", radius: "12px", font: '"Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif', borderStyle: "1px solid" }, "古籍书卷": { bg: "#f5f0e8", card: "#faf7f0", accent: "#5c6b7a", text: "#2c1810", sub: "#6b5a4e", mute: "#a89880", line: "#c8b8a0", green: "#4a7c59", red: "#a04040", yellow: "#c09050", shadow: "0 1px 8px rgba(60,40,20,0.08)", radius: "2px", font: '"Noto Serif SC","SimSun","KaiTi",serif', borderStyle: "1px dashed" }, "赛博朋克": { bg: "#0a0a0a", card: "#111118", accent: "#00ffcc", text: "#ccffcc", sub: "#66aa66", mute: "#336633", line: "#00ffcc", green: "#00ff66", red: "#ff3366", yellow: "#ffcc00", shadow: "0 0 20px rgba(0,255,204,0.3)", radius: "4px", font: '"Consolas","Fira Code","Microsoft YaHei",monospace', borderStyle: "2px solid" }, "樱花物语": { bg: "#fff0f5", card: "#ffffff", accent: "#ff8fab", text: "#4a2030", sub: "#8b6070", mute: "#c0a0b0", line: "#ffcdd8", green: "#7fa88c", red: "#d06070", yellow: "#e8b060", shadow: "0 2px 14px rgba(200,100,130,0.12)", radius: "18px", font: '"Noto Sans SC","PingFang SC",sans-serif', borderStyle: "1px dotted" }, "午夜星空": { bg: "#0d1b2a", card: "#1b2838", accent: "#ffd700", text: "#e8e8f0", sub: "#8899aa", mute: "#556677", line: "#1e3a5f", green: "#4ea8a0", red: "#c06060", yellow: "#e8c040", shadow: "0 0 12px rgba(100,150,255,0.15)", radius: "10px", font: '"Noto Sans SC","PingFang SC",sans-serif', borderStyle: "1px solid" }, "极简素白": { bg: "#fafafa", card: "#ffffff", accent: "#333333", text: "#1a1a1a", sub: "#666666", mute: "#aaaaaa", line: "#e0e0e0", green: "#4a8c6a", red: "#c04040", yellow: "#c08040", shadow: "0 1px 4px rgba(0,0,0,0.06)", radius: "6px", font: '"Helvetica Neue","PingFang SC",sans-serif', borderStyle: "1px solid" } };
var CAT = CAT_THEMES["暖色猫窝"];
var TEXT_THEMES = { "默认": { font: "inherit", lineHeight: "1.6", color: "inherit", bg: "transparent", fontSize: "inherit" }, "舒适阅读": { font: '"Noto Serif SC","SimSun",serif', lineHeight: "2.0", color: "#3d2b1f", bg: "#fffaf5", fontSize: "15px" }, "紧凑模式": { font: '"Noto Sans SC",sans-serif', lineHeight: "1.4", color: "#1a1a1a", bg: "transparent", fontSize: "13px" }, "暗纸护眼": { font: "inherit", lineHeight: "1.7", color: "#d0d0d0", bg: "#1e1e1e", fontSize: "inherit" }, "复古信笺": { font: '"KaiTi","STKaiti",serif', lineHeight: "1.8", color: "#2c1810", bg: "#faf3e0", fontSize: "15px" }, "赛博终端": { font: '"Consolas","Courier New",monospace', lineHeight: "1.5", color: "#00ff66", bg: "#0a0a0a", fontSize: "13px" }, "打字机": { font: '"Courier Prime","Courier New",monospace', lineHeight: "1.7", color: "#1a1a1a", bg: "#fafaf5", fontSize: "14px" } };

function applyTheme(n) { CAT = CAT_THEMES[n] || CAT_THEMES["暖色猫窝"]; }
function catFace(s) { return { idle: "=^_^=", scanning: "o_o", queuing: "^_^", busy: "*o*", error: ">_<" }[s] || "=^_^="; }
function toast(t, m) { try { if (typeof toastr !== "undefined") { var faces = { success: "=^_^=", info: "(=^_^=)", warning: "(T_T)", error: "(x_x)" }; toastr[t]((faces[t] || "=^_^=") + " " + m); } else console.log("[sillab]", t, m); } catch (e) { console.log("[sillab]", t, m); } }
function esc(s) { if (!s) return ""; var d = document.createElement("div"); d.textContent = s; return d.innerHTML; }
function escAttr(s) { if (!s) return ""; return ("" + s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function sbtn(c) { return "padding:8px 16px;border:none;border-radius:" + CAT.radius + ";background:" + c + ";color:#fff;cursor:pointer;font-size:12px;font-weight:600;"; }
function fi() { return "width:100%;padding:8px 10px;border:" + CAT.borderStyle + " " + CAT.line + ";border-radius:8px;background:" + CAT.card + ";font-size:12px;color:" + CAT.text + ";box-sizing:border-box;outline:none;"; }
function chkProf() { try { var s = JSON.parse(localStorage.sillab_settings); var pf = s.profiles || {}; var cn = Object.keys(pf)[0]; return (cn && pf[cn] && Object.keys(pf[cn].cast || {}).length > 0) || (pf[cn] && pf[cn].meta && pf[cn].meta.cardType === "世界观卡"); } catch (e) { return false; } }

var _panelEl = null, _compactEl = null, _expandedVisible = false, _compactTimer = null, _compDragMoved = false;

// ════════════════ 状态条 ════════════════
function createCompactBar() {
  if (_compactEl && _compactEl.parent().length) return;
  var saved = { x: null, y: null };
  try { var s = localStorage.getItem("sl_compact_pos"); if (s) saved = JSON.parse(s); } catch (e) { }
  var x = saved.x || null, y = saved.y || null, l = x != null ? x + "px" : "auto", t = y != null ? y + "px" : "auto", r = x != null ? "auto" : "16px", b = y != null ? "auto" : "16px", W = 320, H = Math.round(W * 0.75);
  var bar = "";
  bar += '<div id="sl_compact" style="position:fixed;z-index:30000;bottom:' + b + ";right:" + r + ";left:" + l + ";top:" + t + ";width:" + W + "px;height:" + H + "px;background:" + CAT.card + ";border-radius:" + CAT.radius + ";box-shadow:" + CAT.shadow + ";border:" + CAT.borderStyle + " " + CAT.line + ";font-family:" + CAT.font + ";font-size:12px;color:" + CAT.text + ";user-select:none;overflow:hidden;display:flex;flex-direction:column;";
  bar += '"><div id="sl_comp_header" style="display:flex;align-items:center;padding:10px 12px 8px;cursor:move;border-bottom:1px solid ' + CAT.line + ";gap:8px;flex-shrink:0;height:20%;";
  bar += '"><span id="sl_cat_icon" style="font-size:20px;line-height:1;pointer-events:none;">=^_^=</span><span style="font-weight:700;font-size:13px;flex:1;pointer-events:none;">偷懒小猫</span><button id="sl_comp_panel_btn" style="border:none;background:none;cursor:pointer;font-size:16px;color:' + CAT.sub + ';padding:2px 4px;">📋</button></div>';
  bar += '<div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;padding:0 12px;border-bottom:1px solid ' + CAT.line + ';flex-shrink:0;height:20%;"><span id="sl_comp_char" style="font-size:12px;color:' + CAT.text + ';font-weight:600;">--</span><span id="sl_comp_model" style="font-size:10px;color:' + CAT.accent + ';"></span><span id="sl_comp_profile" style="font-size:10px;"></span><button id="sl_comp_scan" style="display:none;font-size:10px;padding:2px 10px;border:none;border-radius:4px;background:' + CAT.accent + ';color:#fff;cursor:pointer;">🔍扫描</button></div>';
  bar += '<div style="padding:0 12px;flex-shrink:0;display:flex;flex-direction:column;justify-content:center;height:30%;"><div style="font-size:11px;color:' + CAT.sub + ';"><span id="sl_comp_status">空闲</span> · <span id="sl_comp_queue_txt">排队 0</span> · <span id="sl_comp_mode">⚡自动</span></div><div id="sl_comp_event" style="font-size:10px;color:' + CAT.mute + ';margin-top:4px;">« 就绪 »</div></div>';
  bar += '<div style="display:flex;align-items:center;gap:6px;padding:0 12px;flex-shrink:0;height:30%;"><button id="sl_comp_gen" style="flex:1;font-size:12px;padding:0;height:36px;border:none;border-radius:8px;background:' + CAT.accent + ';color:#fff;cursor:pointer;">⚡ 排图</button><button id="sl_comp_auto" style="flex:1;font-size:12px;padding:0;height:36px;border:1px solid ' + CAT.line + ';border-radius:8px;background:transparent;color:' + CAT.text + ';cursor:pointer;">⚡自动</button></div></div>';
  _compactEl = jQuery(bar).appendTo("body");
  (function () { var dragging = false, sx, sy, ox, oy; jQuery("#sl_comp_header").on("mousedown touchstart", function (e) { if (jQuery(e.target).is("button")) return; e.preventDefault(); dragging = true; _compDragMoved = false; var p = (e.touches || [e])[0]; sx = p.clientX; sy = p.clientY; var o = _compactEl.offset(); ox = o.left; oy = o.top; _compactEl.css({ right: "auto", bottom: "auto", left: ox + "px", top: oy + "px" }); }); jQuery(document).on("mousemove touchmove", function (e) { if (!dragging) return; var p = (e.touches || [e])[0]; if (Math.abs(p.clientX - sx) > 2 || Math.abs(p.clientY - sy) > 2) _compDragMoved = true; _compactEl.css({ left: (ox + p.clientX - sx) + "px", top: (oy + p.clientY - sy) + "px" }); }).on("mouseup touchend", function () { if (!dragging) return; dragging = false; if (_compDragMoved) { var o = _compactEl.offset(); try { localStorage.setItem("sl_compact_pos", JSON.stringify({ x: o.left, y: o.top })); } catch (e) { } } }); })();
  jQuery("#sl_comp_header").on("click", function (e) { var was = _compDragMoved; _compDragMoved = false; if (jQuery(e.target).is("button") || was) return; togglePanel(); });
  jQuery("#sl_comp_panel_btn").on("click", function (e) { e.stopPropagation(); togglePanel(); });
  jQuery("#sl_comp_gen").on("click", function (e) { e.stopPropagation(); triggerGenAll(); });
  jQuery("#sl_comp_auto").on("click", function (e) { e.stopPropagation(); settings.autoGen = settings.autoGen === 1 ? 0 : 1; saveSettings(); refreshCompactBar(); });
  jQuery("#sl_comp_scan").on("click", async function (e) { e.stopPropagation(); var b = jQuery(this); b.prop("disabled", true).text("扫描中..."); try { await scanCharacterProfile(); toast("success", "扫描完成喵~ ✨"); } catch (e2) { toast("error", "扫描失败喵…"); } b.prop("disabled", false).text("🔍扫描"); refreshCompactBar(); });
  _compactTimer = setInterval(refreshCompactBar, 3000); refreshCompactBar();
}
function refreshCompactBar() {
  if (!_compactEl || !_compactEl.is(":visible")) return;
  var cn = getCharacterName() || "", hasChat = !!cn;
  jQuery("#sl_comp_char").text(hasChat ? cn : "未进入聊天");
  jQuery("#sl_comp_model").text(hasChat ? (settings.modelType === "anime" ? "🎬Anime" : "🖼️ZIT") : "");
  var hp = chkProf();
  if (!hasChat) { jQuery("#sl_comp_profile").text("").hide(); jQuery("#sl_comp_scan").hide(); }
  else if (hp) { jQuery("#sl_comp_profile").text("📋✅已扫描").css("color", CAT.green).show(); jQuery("#sl_comp_scan").hide(); }
  else { jQuery("#sl_comp_profile").text("📋❌未扫描").css("color", CAT.red).show(); jQuery("#sl_comp_scan").show(); }
  var ss = getScannerStatus(), sm = { off: "已关闭", idle: "空闲", waiting_body: "等待正文", waiting_end: "AI回复中", scanning: "分析中" };
  jQuery("#sl_comp_status").text(sm[ss] || ss);
  var ql = getQueueLength();
  jQuery("#sl_comp_queue_txt").text("排队 " + ql);
  jQuery("#sl_comp_mode").text(settings.autoGen === 1 ? "⚡自动" : "🖐手动");
  jQuery("#sl_comp_auto").text(settings.autoGen === 1 ? "⚡自动" : "🖐手动");
  var cs = "idle"; if (ss === "scanning") cs = "scanning"; else if (ql > 0) cs = ql > 5 ? "busy" : "queuing";
  jQuery("#sl_cat_icon").text(catFace(cs));
}
function triggerGenAll() { var c = 0; jQuery(".sl_img_btn[data-prompt]").each(function () { var b = jQuery(this); if (b.text().indexOf("排队") < 0 && b.text().indexOf("🔄") < 0 && b.text().indexOf("生成图片") >= 0) { b.trigger("click"); c++; } }); if (c === 0) toast("info", "没有待生成的图片喵~"); else toast("success", "已排队 " + c + " 张图片喵~ ✨"); }

// ════════════════ 面板 ════════════════
function createExpandedPanel() {
  if (_panelEl && _panelEl.parent().length) return;
  var isM = window.innerWidth < 600, ps = "position:fixed;z-index:10000;background:" + CAT.bg + ";border-radius:" + CAT.radius + ";box-shadow:0 4px 32px rgba(0,0,0,0.2);border:" + CAT.borderStyle + " " + CAT.line + ";font-family:" + CAT.font + ";color:" + CAT.text + ";display:none;flex-direction:column;overflow:hidden;";
  ps += isM ? "bottom:0;left:0;right:0;height:70vh;border-radius:18px 18px 0 0;" : "width:540px;height:80vh;top:50%;left:50%;transform:translate(-50%,-50%);";
  var h = '<div id="sl_panel" style="' + ps + '">';
  h += '<div id="sl_panel_header" style="position:relative;padding:14px 20px 10px;display:flex;align-items:center;justify-content:center;border-bottom:1px solid ' + CAT.line + ';cursor:move;flex-shrink:0;"><div style="display:flex;align-items:center;gap:10px;pointer-events:none;"><span style="font-size:26px;">=^_^=</span><div><div style="font-weight:700;font-size:15px;color:' + CAT.text + ';">偷懒小猫</div><div style="font-size:9px;color:' + CAT.sub + ';">SillyImage Lab v2.1</div></div></div><button id="sl_close_panel" style="position:absolute;right:14px;top:50%;transform:translateY(-50%);border:none;background:none;cursor:pointer;font-size:18px;color:' + CAT.mute + ';padding:4px 8px;">✕</button><button id="sl_btn_log" style="position:absolute;right:40px;top:50%;transform:translateY(-50%);border:none;background:none;cursor:pointer;font-size:14px;color:' + CAT.mute + ';padding:4px 6px;">📋</button></div>';
  h += '<div id="sl_panel_body" style="flex:1;overflow-y:scroll;padding:16px 18px;min-height:0;"></div>';
  h += '<div id="sl_panel_tabs" style="display:flex;border-top:1px solid ' + CAT.line + ';flex-shrink:0;"><button class="sl_tab_btn active" data-tab="home" style="flex:1;padding:12px;border:none;background:none;cursor:pointer;font-size:13px;color:' + CAT.accent + ';font-weight:600;border-top:2px solid ' + CAT.accent + ';margin-top:-1px;">🏠 首页</button><button class="sl_tab_btn" data-tab="settings" style="flex:1;padding:12px;border:none;background:none;cursor:pointer;font-size:13px;color:' + CAT.sub + ';font-weight:400;">⚙️ 设置</button><button class="sl_tab_btn" data-tab="archive" style="flex:1;padding:12px;border:none;background:none;cursor:pointer;font-size:13px;color:' + CAT.sub + ';font-weight:400;">📋 档案</button></div></div>';
  _panelEl = jQuery(h).appendTo("body");
  _panelEl.on("click", ".sl_tab_btn", function () { var tab = jQuery(this).data("tab"); _panelEl.find(".sl_tab_btn").removeClass("active").css({ color: CAT.sub, fontWeight: "400", borderTopColor: "transparent" }); jQuery(this).addClass("active").css({ color: CAT.accent, fontWeight: "600", borderTopColor: CAT.accent }); if (tab === "home") renderHomeTab(); else if (tab === "settings") renderSettingsTab(); else renderArchiveTab(); });
  jQuery("#sl_close_panel").on("click", function (e) { e.stopPropagation(); hidePanel(); });
  jQuery("#sl_btn_log").on("click", function (e) { e.stopPropagation(); showLogViewer(); });
  if (!isM) { (function () { var dragging = false, sx, sy, px, py; jQuery("#sl_panel_header").on("mousedown", function (e) { if (jQuery(e.target).closest("button").length) return; dragging = true; sx = e.clientX; sy = e.clientY; var o = _panelEl.offset(); px = o.left; py = o.top; _panelEl.css({ left: px + "px", top: py + "px", right: "auto", bottom: "auto", transform: "none" }); }); jQuery(document).on("mousemove", function (e) { if (!dragging) return; _panelEl.css({ left: (px + e.clientX - sx) + "px", top: (py + e.clientY - sy) + "px" }); }).on("mouseup", function () { dragging = false; }); })(); }
}
function togglePanel() { if (!_panelEl) createExpandedPanel(); _expandedVisible ? hidePanel() : showPanel(); }
function showPanel() { if (!_panelEl) createExpandedPanel(); _expandedVisible = true; _panelEl.css({ left: "50%", top: "50%", right: "auto", bottom: "auto", transform: "translate(-50%,-50%)", maxHeight: "80vh", height: "80vh", width: "540px", flexDirection: "column" }); _panelEl.fadeIn(200, function () { _panelEl.css("display", "flex"); }); if (_compactEl) _compactEl.hide(); renderHomeTab(); }
function hidePanel() { _expandedVisible = false; if (_panelEl) { _panelEl.remove(); _panelEl = null; } if (_compactEl) _compactEl.show(); refreshCompactBar(); }

// ════════════════ 首页 ════════════════
function renderHomeTab() {
  var body = jQuery("#sl_panel_body"); if (!body.length) return;
  var cn = getCharacterName() || "未选择角色", hp = chkProf(), ss = getScannerStatus(), ql = getQueueLength(),
    ha = !!(settings.auxUrl && settings.auxModel), hc = !!settings.cUrl, hw = !!(settings.cWf && settings.cWf.length > 50), allReady = ha && hc && hw && hp, h = "";
  if (!allReady) { var steps = [{ l: "连接 AI助理", ok: ha }, { l: "连接 ComfyUI", ok: hc }, { l: "导入工作流", ok: hw }, { l: "扫描角色卡", ok: hp }]; h += '<div style="background:' + CAT.card + ';border-radius:12px;padding:12px 14px;margin-bottom:10px;border:2px solid ' + CAT.accent + ';">'; h += '<div style="font-weight:700;font-size:13px;margin-bottom:6px;">=^_^= 欢迎喵~ 完成下面几步就能用啦</div>'; for (var i = 0; i < steps.length; i++)h += '<div style="padding:2px 0;font-size:11px;color:' + (steps[i].ok ? CAT.green : CAT.sub) + ';">' + (steps[i].ok ? "✅" : "☐") + " " + steps[i].l + "</div>"; h += '<button id="sl_goto_settings" style="margin-top:6px;padding:6px 14px;border:none;border-radius:8px;background:' + CAT.accent + ';color:#fff;cursor:pointer;font-size:11px;font-weight:600;">去设置 →</button></div>'; }
  h += '<div style="background:' + CAT.card + ';border-radius:12px;padding:12px 14px;margin-bottom:10px;border:1px solid ' + CAT.line + ';">';
  h += '<div style="font-weight:700;font-size:14px;color:' + CAT.text + ';margin-bottom:4px;">👤 ' + esc(cn) + "</div>";
  h += '<div style="font-size:11px;color:' + CAT.sub + ';">' + (settings.modelType === "anime" ? "🎬Anime" : "🖼️ZIT") + " · " + (settings.autoGen === 1 ? "⚡自动" : "🖐手动") + " · 档案：" + (hp ? "✅已扫描" : "❌未扫描") + " · 排队：" + ql + "张</div></div>";
  h += '<div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;"><button id="sl_btn_scan_cast" style="' + sbtn(CAT.accent) + '">🔍 扫描角色喵~</button><button id="sl_btn_gen_all" style="' + sbtn(CAT.green) + '">⚡ 一键排图</button><button id="sl_btn_clear_cache" style="' + sbtn(CAT.red) + '">🗑 清除缓存</button></div>';
  h += '<div style="background:' + CAT.card + ';border-radius:12px;padding:12px 14px;margin-bottom:8px;border:1px solid ' + CAT.line + ';">';
  h += '<div style="font-size:11px;color:' + CAT.sub + ';margin-bottom:6px;">🎨 外观</div><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;"><span style="font-size:11px;color:' + CAT.text + ';">插件主题</span><select id="sl_ui_theme" style="' + fi() + 'width:auto;min-width:100px;">';
  for (var tk in CAT_THEMES) h += '<option value="' + escAttr(tk) + '"' + (settings.uiTheme === tk ? " selected" : "") + ">" + tk + "</option>";
  h += '</select><span style="font-size:11px;color:' + CAT.text + ';margin-left:8px;">文本渲染</span><select id="sl_text_theme" style="' + fi() + 'width:auto;min-width:100px;">';
  for (var tk2 in TEXT_THEMES) h += '<option value="' + escAttr(tk2) + '"' + (settings.textTheme === tk2 ? " selected" : "") + ">" + tk2 + "</option>";
  h += "</select></div></div>";
  var sm2 = { off: "已关闭", idle: "空闲", waiting_body: "等待正文", waiting_end: "AI回复中", scanning: "分析中喵~" };
  h += '<div style="font-size:10px;color:' + CAT.mute + ';text-align:center;">📊 ' + (sm2[ss] || ss) + " · 📥 排队 " + ql + " 张" + (allReady ? "" : " · ⚠ 配置未完成") + "</div>";
  body.html(h);
  body.off("click", "#sl_goto_settings").on("click", "#sl_goto_settings", function () { _panelEl.find('.sl_tab_btn[data-tab="settings"]').trigger("click"); });
  body.off("click", "#sl_btn_scan_cast").on("click", "#sl_btn_scan_cast", async function () { var b = jQuery(this); b.prop("disabled", true).text("扫描中..."); try { var sr = await scanCharacterProfile(); if (sr) { toast("success", "扫描完成喵~ ✨"); } else { toast("error", "扫描没成功喵… (╥﹏╥)"); } renderHomeTab(); refreshCompactBar(); } catch (e) { toast("error", "扫描失败喵… (╥﹏╥)"); } b.prop("disabled", false).text("🔍 扫描角色喵~"); });
  body.off("click", "#sl_btn_gen_all").on("click", "#sl_btn_gen_all", triggerGenAll);
  body.off("click", "#sl_btn_clear_cache").on("click", "#sl_btn_clear_cache", function () { if (!confirm("确定要清除当前角色卡的全部缓存吗？")) return; if (!confirm("真的确定吗？这个操作回不来的喵！")) return; deleteCharacterProfile(true); toast("warning", "档案全部删掉了喵… (｡•́︿•̀｡)"); setTimeout(function () { toast("info", "请点击扫描按钮重新生成档案喵~ ✨"); }, 1000); renderHomeTab(); refreshCompactBar(); });
  body.off("change", "#sl_ui_theme").on("change", "#sl_ui_theme", function () { var name = jQuery(this).val(); hidePanel(); settings.uiTheme = name; applyTheme(name); saveSettings(); if (_compactEl) { _compactEl.remove(); _compactEl = null; clearInterval(_compactTimer); } setTimeout(function () { createCompactBar(); showPanel(); }, 150); });
  body.off("change", "#sl_text_theme").on("change", "#sl_text_theme", function () { settings.textTheme = jQuery(this).val(); saveSettings(); });
}

// ════════════════ 设置 ════════════════
function renderSettingsTab() {
  var body = jQuery("#sl_panel_body"), f = fi(), h = "";
  h += '<div style="background:' + CAT.card + ';border-radius:10px;padding:10px 14px;margin-bottom:10px;border:1px solid ' + CAT.line + ';"><label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="checkbox" id="sl_plugin_on"' + (settings.pluginOn !== false ? " checked" : "") + '><span style="font-size:12px;color:' + CAT.text + ';">✅ 插件开启</span></label></div>';
  h += '<div style="background:' + CAT.card + ';border-radius:12px;padding:12px 14px;margin-bottom:10px;border:1px solid ' + CAT.line + ';">';
  h += '<div style="font-size:11px;color:' + CAT.sub + ';margin-bottom:2px;">模型类型</div><select id="sl_model_type" style="' + f + '"><option value="zit"' + (settings.modelType === "zit" ? " selected" : "") + '>🖼️ ZIT</option><option value="anime"' + (settings.modelType === "anime" ? " selected" : "") + ">🎬 Anime</option></select></div>";
  h += '<div style="background:' + CAT.card + ';border-radius:12px;padding:12px 14px;margin-bottom:10px;border:1px solid ' + CAT.line + ';">';
  h += '<div style="font-size:11px;color:' + CAT.sub + ';margin-bottom:2px;">📝 前置提示词</div><input id="sl_prompt_prefix" type="text" value="' + escAttr(settings.promptPrefix || "") + '" style="' + f + '" placeholder="留空则不生效"></div>';
  h += '<div id="sl_anime_opts" style="background:' + CAT.card + ';border-radius:12px;padding:12px 14px;margin-bottom:10px;border:1px solid ' + CAT.line + ';' + (settings.modelType === "anime" ? "" : "display:none;") + '">';
  h += '<div style="font-size:11px;color:' + CAT.sub + ';margin-bottom:2px;">质量前缀</div><input id="sl_anime_prefix" type="text" value="' + escAttr(settings.animeQualityPrefix || "") + '" style="' + f + 'margin-bottom:6px;">';
  h += '<div style="font-size:11px;color:' + CAT.sub + ';margin-bottom:2px;">艺术家标签</div><input id="sl_anime_artist" type="text" value="' + escAttr(settings.animeArtist || "") + '" style="' + f + '" placeholder="留空则不使用"></div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;"><button class="sl_open_sub" data-sub="aux" style="' + sbtn(CAT.accent) + '">🧠 AI助理</button><button class="sl_open_sub" data-sub="comfy" style="' + sbtn(CAT.accent) + '">🎨 ComfyUI & 工作流</button></div>';
  h += '<button class="sl_open_sub" data-sub="advanced" style="width:100%;' + sbtn(CAT.sub) + '">⚙️ 高级选项</button>';
  h += '<div style="margin-top:12px;"><button id="sl_save_settings" style="width:100%;padding:12px;border:none;border-radius:' + CAT.radius + ';background:' + CAT.accent + ';color:#fff;cursor:pointer;font-size:14px;font-weight:600;">💾 保存全部设置喵~</button></div>';
  body.html(h); bindSettingsEvents(body);
}
function bindSettingsEvents(b) {
  b.off("change", "#sl_plugin_on").on("change", "#sl_plugin_on", function () { settings.pluginOn = jQuery(this).is(":checked"); saveSettings(); });
  b.off("change", "#sl_model_type").on("change", "#sl_model_type", function () { settings.modelType = jQuery(this).val(); jQuery("#sl_anime_opts").toggle(settings.modelType === "anime"); saveSettings(); });
  b.off("change input", "#sl_prompt_prefix").on("change input", "#sl_prompt_prefix", function () { settings.promptPrefix = jQuery(this).val(); saveSettings(); });
  b.off("change input", "#sl_anime_prefix").on("change input", "#sl_anime_prefix", function () { settings.animeQualityPrefix = jQuery(this).val(); saveSettings(); });
  b.off("change input", "#sl_anime_artist").on("change input", "#sl_anime_artist", function () { settings.animeArtist = jQuery(this).val(); saveSettings(); });
  b.off("click", "#sl_save_settings").on("click", "#sl_save_settings", function () { settings.promptPrefix = jQuery("#sl_prompt_prefix").val(); saveSettings(); toast("success", "全部保存好啦喵~ ✨"); });
  b.off("click", ".sl_open_sub").on("click", ".sl_open_sub", function () { openSubPanel(jQuery(this).data("sub")); });
}

// ════════════════ 子面板 ════════════════
function openSubPanel(type) {
  var h = '<div id="sl_sub_panel" style="position:absolute;top:0;left:0;right:0;bottom:0;background:' + CAT.bg + ';display:flex;flex-direction:column;z-index:10;border-radius:' + CAT.radius + ';transform:scale(0.5);opacity:0;transition:transform .15s ease-out,opacity .15s ease-out;">';
  h += '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid ' + CAT.line + ';flex-shrink:0;"><button class="sl_close_sub" style="border:none;background:none;cursor:pointer;font-size:16px;color:' + CAT.accent + ';font-weight:600;">← 返回</button><span style="font-weight:700;font-size:13px;color:' + CAT.text + ';"></span><span></span></div><div id="sl_sub_body" style="flex:1;overflow-y:auto;padding:14px 16px;"></div></div>';
  var sub = jQuery(h).appendTo("#sl_panel"); jQuery(".sl_close_sub").on("click", function () { closeSubPanel(sub); }); fillSubPanel(type, jQuery("#sl_sub_body"));
  requestAnimationFrame(function () { sub.css({ transform: "scale(1)", opacity: "1" }); });
}
function closeSubPanel(sub) { sub.css({ transform: "scale(0.5)", opacity: "0", transition: "transform .1s ease-in,opacity .1s ease-in" }); setTimeout(function () { sub.remove(); }, 120); }
function fillSubPanel(type, body) {
  var f = fi();
  if (type === "aux") {
    var h = '<div style="margin-bottom:8px;"><div style="font-size:11px;color:' + CAT.sub + ';margin-bottom:2px;">AI 提供商</div><select id="sl_aux_provider" style="' + f + '"><option value="deepseek"' + (settings.auxProvider === "deepseek" ? " selected" : "") + '>DeepSeek</option><option value="gemini"' + (settings.auxProvider === "gemini" ? " selected" : "") + '>Gemini</option><option value="custom"' + (settings.auxProvider === "custom" ? " selected" : "") + ">自定义</option></select></div>";
    h += '<div style="margin-bottom:8px;"><div style="font-size:11px;color:' + CAT.sub + ';margin-bottom:2px;">API 地址</div><input id="sl_aux_url" type="text" value="' + escAttr(settings.auxUrl || "") + '" style="' + f + '"></div>';
    h += '<div style="margin-bottom:8px;"><div style="font-size:11px;color:' + CAT.sub + ';margin-bottom:2px;">API Key</div><input id="sl_aux_key" type="password" value="' + escAttr(settings.auxKey || "") + '" style="' + f + '"></div>';
    h += '<div style="margin-bottom:8px;"><div style="font-size:11px;color:' + CAT.sub + ';margin-bottom:2px;">聊天分析模型</div><input id="sl_aux_model" type="text" value="' + escAttr(settings.auxModel || "") + '" style="' + f + '"></div>';
    h += '<div style="margin-bottom:8px;"><div style="font-size:11px;color:' + CAT.sub + ';margin-bottom:2px;">角色卡分析模型</div><input id="sl_profile_model" type="text" value="' + escAttr(settings.profileModel || "") + '" style="' + f + '"></div>';
    h += '<div style="display:flex;gap:8px;align-items:center;"><button id="sl_test_aux" style="' + sbtn(CAT.accent) + '">🔌 测试连接</button><span id="sl_aux_status" style="font-size:11px;color:' + CAT.sub + ';"></span></div>';
    body.html(h);
    jQuery("#sl_aux_provider").on("change", function () { settings.auxProvider = jQuery(this).val(); saveSettings(); });
    jQuery("#sl_aux_url").on("change input", function () { settings.auxUrl = jQuery(this).val(); saveSettings(); });
    jQuery("#sl_aux_key").on("change input", function () { settings.auxKey = jQuery(this).val(); saveSettings(); });
    jQuery("#sl_aux_model").on("change input", function () { settings.auxModel = jQuery(this).val(); saveSettings(); });
    jQuery("#sl_profile_model").on("change input", function () { settings.profileModel = jQuery(this).val(); saveSettings(); });
    jQuery("#sl_test_aux").on("click", async function () { var b = jQuery(this), s = jQuery("#sl_aux_status"); b.prop("disabled", true).text("测试中..."); try { var url = (jQuery("#sl_aux_url").val() || "").replace(/\/+$/, "") + "/chat/completions", key = jQuery("#sl_aux_key").val(), hd = { "Content-Type": "application/json" }; if (key) hd["Authorization"] = "Bearer " + key; var r = await fetch(url, { method: "POST", headers: hd, body: JSON.stringify({ model: jQuery("#sl_aux_model").val() || "default", messages: [{ role: "user", content: "hi" }], max_tokens: 3, stream: false }) }); if (r.ok) { s.css({ color: CAT.green }).text("连接成功喵~ ✨"); toast("success", "AI助理连接成功~"); } else { var t = await r.text().catch(function () { return ""; }); s.css({ color: CAT.red }).text("HTTP " + r.status); toast("error", "连接失败: " + r.status); } } catch (e) { s.css({ color: CAT.red }).text(e.message); toast("error", "连不上喵…"); } b.prop("disabled", false).text("🔌 测试连接"); });
  } else if (type === "comfy") {
    var h = '<div style="margin-bottom:8px;"><div style="font-size:11px;color:' + CAT.sub + ';margin-bottom:2px;">ComfyUI 地址</div><input id="sl_comfy_url" type="text" value="' + escAttr(settings.cUrl || "http://localhost:8181") + '" style="' + f + '"></div>';
    h += '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;"><button id="sl_test_comfy" style="' + sbtn(CAT.accent) + '">🔌 测试连接</button><span id="sl_comfy_status" style="font-size:11px;color:' + CAT.sub + ';"></span></div>';
    h += '<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;"><input id="sl_wf_name" type="text" value="' + escAttr(settings.cWfName || "") + '" placeholder="工作流名称（可选）" style="flex:1;padding:6px 8px;border:1px solid ' + CAT.line + ';border-radius:6px;font-size:11px;background:' + CAT.card + ';color:' + CAT.text + ';"></div>';
    h += '<div style="display:flex;gap:4px;margin-bottom:4px;"><button id="sl_wf_load" style="' + sbtn(CAT.sub) + 'font-size:10px;">📂 加载</button><button id="sl_wf_save_as" style="' + sbtn(CAT.green) + 'font-size:10px;">💾 另存</button><button id="sl_wf_del" style="' + sbtn(CAT.red) + 'font-size:10px;">🗑 删除</button></div>';
    h += '<div style="font-size:11px;color:' + CAT.sub + ';margin-bottom:2px;">工作流 JSON</div><textarea id="sl_comfy_wf" rows="5" style="width:100%;padding:8px;border:1px solid ' + CAT.line + ';border-radius:8px;background:' + CAT.card + ';font-family:monospace;font-size:11px;color:' + CAT.text + ';resize:vertical;box-sizing:border-box;">' + esc(settings.cWf || "") + "</textarea>";
    h += '<div style="display:flex;gap:6px;margin:6px 0;"><button id="sl_wf_import_btn" style="' + sbtn(CAT.sub) + 'font-size:10px;">📁 导入JSON</button><input type="file" id="sl_wf_import" accept=".json" style="display:none;"><button id="sl_analyze_wf" style="' + sbtn(CAT.accent) + '">🔍 解析节点</button><button id="sl_save_wf" style="' + sbtn(CAT.green) + '">💾 保存工作流</button></div>';
    h += '<div id="sl_node_list" style="font-size:10px;color:' + CAT.sub + ';max-height:200px;overflow-y:auto;margin-bottom:8px;"></div>';
    h += '<div style="font-size:11px;color:' + CAT.sub + ';margin-bottom:4px;">画风预设</div><select id="sl_style_preset" style="' + f + 'margin-bottom:8px;"><option value="">不使用预设</option>';
    for (var sk in STYLE_PRESETS) if (sk) h += '<option value="' + escAttr(sk) + '"' + (settings.stylePreset === sk ? " selected" : "") + ">" + esc(sk) + "</option>";
    h += "</select>";
    h += '<div style="font-size:11px;color:' + CAT.sub + ';margin-bottom:2px;">负面提示词</div><input id="sl_neg" type="text" value="' + escAttr(settings.neg || "") + '" style="' + f + '" placeholder="worst quality, lowres...">';
    body.html(h);
    jQuery("#sl_comfy_url").on("change input", function () { settings.cUrl = jQuery(this).val(); saveSettings(); });
    jQuery("#sl_test_comfy").on("click", async function () { var b = jQuery(this), s = jQuery("#sl_comfy_status"); b.prop("disabled", true).text("测试中..."); try { var r = await fetch("/api/sd/comfy/ping", { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, getSTHeaders()), body: JSON.stringify({ url: jQuery("#sl_comfy_url").val() }) }); if (r.ok) { var d = await r.json().catch(function () { return {}; }); s.css({ color: CAT.green }).text("已连接" + (d.device ? " (" + d.device + ")" : "")); toast("success", "ComfyUI 连上啦~ ✨"); } else { var txt = await r.text().catch(function () { return ""; }); s.css({ color: CAT.red }).text("HTTP " + r.status); toast("error", "连接失败喵~"); } } catch (e) { s.css({ color: CAT.red }).text("连不上"); toast("error", "连不上喵…"); } b.prop("disabled", false).text("🔌 测试连接"); });
    jQuery("#sl_analyze_wf").on("click", function () {
      var raw = jQuery("#sl_comfy_wf").val(); if (!raw) { toast("info", "请先粘贴工作流 JSON 喵~"); return; }
      try { var wf = JSON.parse(raw), nodes = [], params = {}; for (var nid in wf) { var nd = wf[nid]; if (!nd || !nd.class_type) continue; nodes.push(nd.class_type); if (/KSampler/i.test(nd.class_type) && nd.inputs) { if (nd.inputs.steps != null) params.steps = nd.inputs.steps; if (nd.inputs.cfg != null) params.cfg = nd.inputs.cfg; if (nd.inputs.seed != null) params.seed = nd.inputs.seed; if (nd.inputs.denoise != null) params.denoise = nd.inputs.denoise; } if (/EmptyLatent|Latent/i.test(nd.class_type) && nd.inputs) { if (nd.inputs.width != null) params.width = nd.inputs.width; if (nd.inputs.height != null) params.height = nd.inputs.height; if (nd.inputs.batch_size != null) params.batch = nd.inputs.batch_size; } }
        var nh = '<span style="color:' + CAT.green + ';">✅ ' + nodes.length + " 个节点：</span> " + nodes.map(function (n) { return '<span style="display:inline-block;background:' + CAT.bg + ';padding:1px 6px;border-radius:3px;margin:1px;font-size:9px;">' + n + "</span>"; }).join(" "), ph = "", pk = Object.keys(params);
        if (pk.length) { var labels = { steps: "步数", cfg: "CFG", seed: "种子", denoise: "降噪", width: "宽度", height: "高度", batch: "批次" }; ph += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:6px;">'; for (var pi = 0; pi < pk.length; pi++) { var k = pk[pi], v = params[k]; ph += '<div><div style="font-size:10px;color:' + CAT.sub + ';margin-bottom:2px;">' + esc(labels[k] || k) + '</div><input class="sl_wf_param" data-pk="' + escAttr(k) + '" value="' + escAttr(v) + '" style="width:100%;padding:6px 8px;border:1px solid ' + CAT.line + ';border-radius:6px;font-size:12px;background:' + CAT.card + ';color:' + CAT.text + ';box-sizing:border-box;"></div>'; } ph += "</div>"; } else ph = '<div style="font-size:10px;color:' + CAT.mute + ';margin-top:4px;">没有可编辑参数喵~</div>';
        jQuery("#sl_node_list").html(nh + ph);
        jQuery(".sl_wf_param").off("change input").on("change input", function () { try { var raw2 = jQuery("#sl_comfy_wf").val(), wf2 = JSON.parse(raw2), pk2 = jQuery(this).data("pk"), nv = jQuery(this).val(); for (var nid2 in wf2) { var nd2 = wf2[nid2]; if (!nd2 || !nd2.inputs) continue; var cmap = { steps: /KSampler/i, cfg: /KSampler/i, seed: /KSampler/i, denoise: /KSampler/i, width: /EmptyLatent|Latent/i, height: /EmptyLatent|Latent/i, batch: /EmptyLatent|Latent/i }; if (cmap[pk2] && cmap[pk2].test(nd2.class_type) && nd2.inputs[pk2] != null) { nd2.inputs[pk2] = /^\d+$/.test(nv) ? parseInt(nv) : (/^\d+\.\d+$/.test(nv) ? parseFloat(nv) : nv); break; } } jQuery("#sl_comfy_wf").val(JSON.stringify(wf2)); settings.cWf = JSON.stringify(wf2); saveSettings(); } catch (e) { } });
      } catch (e) { jQuery("#sl_node_list").html('<span style="color:' + CAT.red + ';">❌ JSON 格式错误喵~</span>'); }
    });
    jQuery("#sl_save_wf").on("click", function () { var raw = jQuery("#sl_comfy_wf").val(); if (!raw) return; try { JSON.parse(raw); settings.cWf = raw; saveSettings(); toast("success", "工作流保存好啦喵~ ✨"); } catch (e) { toast("error", "JSON 格式不对喵…"); } });
    if (!settings.workflows) settings.workflows = {};
    jQuery("#sl_wf_save_as").on("click", function () { var n = jQuery("#sl_wf_name").val() || ("wf_" + Date.now()); settings.workflows[n] = jQuery("#sl_comfy_wf").val(); settings.cWfName = n; saveSettings(); toast("success", "已保存: " + n); });
    jQuery("#sl_wf_load").on("click", function () { var n = jQuery("#sl_wf_name").val(); if (settings.workflows[n]) { jQuery("#sl_comfy_wf").val(settings.workflows[n]); toast("success", "已加载: " + n); } else toast("info", "输入名称后点加载喵~"); });
    jQuery("#sl_wf_del").on("click", function () { var n = jQuery("#sl_wf_name").val(); if (settings.workflows[n]) { delete settings.workflows[n]; saveSettings(); toast("success", "已删除: " + n); } });
    jQuery("#sl_wf_import_btn").on("click", function () { jQuery("#sl_wf_import").trigger("click"); });
    jQuery("#sl_wf_import").on("change", function () { var file = this.files[0]; if (!file) return; var reader = new FileReader(); reader.onload = function (e) { jQuery("#sl_comfy_wf").val(e.target.result); toast("success", "导入成功喵~ ✨"); }; reader.readAsText(file); });
    jQuery("#sl_style_preset").on("change", function () { settings.stylePreset = jQuery(this).val(); saveSettings(); });
    jQuery("#sl_neg").on("change input", function () { settings.neg = jQuery(this).val(); saveSettings(); });
  } else if (type === "advanced") {
    var h = '<div style="background:' + CAT.card + ';border-radius:10px;padding:12px;margin-bottom:8px;border:1px solid ' + CAT.line + ';">';
    h += '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="checkbox" id="sl_nsfw"' + (settings.nsfwEnhance ? " checked" : "") + '><span style="font-size:12px;color:' + CAT.text + ';">🔞 NSFW 增强模式</span></label>';
    h += '<div style="margin-top:8px;"><label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="radio" name="sl_story" value="narrative"' + (settings.storyMode !== "comic" ? " checked" : "") + '><span style="font-size:12px;color:' + CAT.text + ';">📖 叙事模式</span></label></div><div><label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="radio" name="sl_story" value="comic"' + (settings.storyMode === "comic" ? " checked" : "") + '><span style="font-size:12px;color:' + CAT.text + ';">📱 漫画模式</span></label></div></div>';
    h += '<div style="background:' + CAT.card + ';border-radius:10px;padding:12px;border:1px solid ' + CAT.line + ';">';
    h += '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="checkbox" id="sl_debug"' + (settings.debugMode ? " checked" : "") + '><span style="font-size:12px;color:' + CAT.text + ';">🐛 Debug 模式</span></label></div>';
    body.html(h);
    jQuery("#sl_nsfw").on("change", function () { settings.nsfwEnhance = jQuery(this).is(":checked"); saveSettings(); });
    jQuery("input[name=sl_story]").on("change", function () { settings.storyMode = jQuery(this).val(); saveSettings(); });
    jQuery("#sl_debug").on("change", function () { settings.debugMode = jQuery(this).is(":checked"); saveSettings(); });
  }
}

// ════════════════ 档案 ════════════════
function renderArchiveTab() {
  var body = jQuery("#sl_panel_body"); if (!body.length) return;
  var pf = getProfiles();
  if (!pf || !pf.charName) { body.html('<div style="text-align:center;padding:40px;color:' + CAT.sub + ';font-size:12px;">还没进入聊天喵~<br><br>先去聊天窗口再回来看看吧~</div>'); return; }
  var cast = pf.root[pf.charName].cast || {};
  var meta = pf.root[pf.charName].meta || {};
  var dynamics = pf.chat.dynamics || {};
  var npcs = pf.chat.npcs || {};
  var hasCast = Object.keys(cast).length > 0;
  var isWorld = meta.cardType === "世界观卡";
  var h = "";

  // State 1: unscanned
  if (!hasCast && !isWorld) {
    h = '<div style="background:' + CAT.card + ';border-radius:12px;padding:16px;border:1px solid ' + CAT.line + ';">';
    h += '<div style="font-weight:700;font-size:14px;color:' + CAT.text + ';margin-bottom:12px;">📋 角色卡档案</div>';
    h += '<div style="font-size:11px;color:' + CAT.mute + ';margin-bottom:12px;">尚未扫描喵~ 点击下方按钮开始扫描角色卡外貌信息</div>';
    h += '<button id="sl_btn_scan_cast3" style="' + sbtn(CAT.accent) + '">🔍 扫描角色卡档案喵~</button></div>';
    h += userCard();
    body.html(h); bindArchiveEvents(body); return;
  }

  // State 2: world card
  if (isWorld) {
    h = '<div style="background:' + CAT.card + ';border-radius:12px;padding:16px;border:1px solid ' + CAT.line + ';margin-bottom:10px;">';
    h += '<div style="font-weight:700;font-size:14px;color:' + CAT.text + ';margin-bottom:4px;">🌐 世界设定卡</div>';
    h += '<div style="font-size:11px;color:' + CAT.sub + ';">此卡为世界观卡，角色由聊天中动态生成</div>';
    if (meta.coreChar) h += '<div style="font-size:10px;color:' + CAT.accent + ';margin-top:4px;">核心角色: ' + esc(meta.coreChar) + '</div>';
    h += '<button id="sl_btn_scan_cast3" style="' + sbtn(CAT.accent) + 'margin-top:10px;">🔄 重新扫描</button></div>';
    h += '<div style="font-weight:700;font-size:12px;color:' + CAT.text + ';margin-bottom:6px;">👥 本聊天角色档案</div>';
    if (Object.keys(npcs).length) {
      for (var n in npcs) { var npc = npcs[n]; h += '<div style="background:' + CAT.card + ';border-radius:10px;padding:10px;margin-bottom:6px;border:1px solid ' + CAT.line + ';">'; h += '<div style="font-weight:700;font-size:11px;color:' + CAT.text + ';">' + esc(n) + ' <span style="font-weight:400;font-size:10px;color:' + CAT.sub + ';">出现' + (npc.appearances || 1) + '次</span></div>'; if (npc.static) h += '<div style="font-size:10px;color:' + CAT.text + ';white-space:pre-wrap;">' + esc(npc.static).substring(0, 150) + '</div>'; h += '</div>'; }
    } else { h += '<div style="font-size:10px;color:' + CAT.mute + ';padding:8px;">聊天中出现的角色会自动出现在这里喵~</div>'; }
    h += userCard();
    body.html(h); bindArchiveEvents(body); return;
  }

  // State 3: character card — static + dynamic sub-tabs
  h += '<div style="display:flex;gap:4px;margin-bottom:10px;border-bottom:2px solid ' + CAT.line + ';">';
  h += '<button class="sl_arch_st active" data-ast="0" style="padding:8px 16px;border:none;border-radius:8px 8px 0 0;cursor:pointer;font-size:11px;font-weight:600;background:' + CAT.accent + ';color:#fff;">📋 静态档案</button>';
  h += '<button class="sl_arch_st" data-ast="1" style="padding:8px 16px;border:none;border-radius:8px 8px 0 0;cursor:pointer;font-size:11px;font-weight:400;background:transparent;color:' + CAT.sub + ';">💬 动态档案</button></div>';
  h += '<div id="sl_arch_static">';
  for (var ck in cast) {
    if (ck === "User") continue;
    var cv = cast[ck], anchor = cv.static || "", bodyT = cv.body || "", purl = cv.portrait || "";
    h += '<div style="background:' + CAT.card + ';border-radius:10px;padding:10px;margin-bottom:8px;border:1px solid ' + CAT.line + ';">';
    h += '<div style="display:flex;gap:10px;align-items:flex-start;">';
    h += '<div id="sl_port_' + escAttr(ck).replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, "_") + '" style="width:80px;height:110px;border-radius:6px;background:' + CAT.bg + ';display:flex;align-items:center;justify-content:center;border:2px dashed ' + CAT.line + ';font-size:10px;color:' + CAT.sub + ';text-align:center;flex-shrink:0;' + (purl ? "background-image:url(" + purl + ");background-size:cover;background-position:top center;border:2px solid " + CAT.accent + ";color:transparent;" : "") + '">' + (purl ? "" : "立绘") + "</div>";
    h += '<div style="flex:1;min-width:0;"><div style="font-weight:700;font-size:12px;color:' + CAT.text + ';margin-bottom:4px;">' + esc(ck) + "</div>";
    if (anchor) h += '<div style="font-size:10px;color:' + CAT.text + ';margin-bottom:4px;">' + esc(anchor).substring(0, 120) + (anchor.length > 120 ? "..." : "") + "</div>";
    if (bodyT) h += '<div style="font-size:9px;color:' + CAT.sub + ';">身形: ' + esc(bodyT).substring(0, 60) + "</div>";
    h += '<div style="display:flex;gap:4px;margin-top:4px;flex-wrap:wrap;"><button class="sl_port_btn" data-char="' + escAttr(ck) + '" style="' + sbtn(CAT.accent) + 'font-size:9px;">📷 生成立绘</button><button class="sl_edit_btn" data-char="' + escAttr(ck) + '" style="' + sbtn(CAT.sub) + 'font-size:9px;">✏️ 编辑</button><button class="sl_refine_btn" data-char="' + escAttr(ck) + '" style="' + sbtn(CAT.yellow) + 'font-size:9px;">✨ AI润色</button></div>';
    h += '<div class="sl_edit_box" data-char="' + escAttr(ck) + '" style="display:none;margin-top:6px;"><textarea class="sl_edit_ta" data-char="' + escAttr(ck) + '" style="width:100%;min-height:60px;padding:6px;border-radius:6px;border:1px solid ' + CAT.line + ';font-size:10px;background:' + CAT.bg + ';color:' + CAT.text + ';resize:vertical;">' + esc(anchor) + '</textarea><div style="display:flex;gap:4px;margin-top:4px;"><button class="sl_save_btn" data-char="' + escAttr(ck) + '" style="' + sbtn(CAT.green) + 'font-size:9px;">💾 保存</button><button class="sl_cancel_btn" data-char="' + escAttr(ck) + '" style="font-size:9px;padding:4px 10px;border:1px solid ' + CAT.line + ';border-radius:6px;background:transparent;color:' + CAT.sub + ';cursor:pointer;">取消</button></div></div></div></div></div>';
  }
  h += "</div>";
  h += '<div id="sl_arch_dynamic" style="display:none;">';
  if (Object.keys(dynamics).length) {
    for (var dk in dynamics) { if (!dynamics[dk]) continue;
      h += '<div style="background:' + CAT.card + ';border-radius:10px;padding:10px;margin-bottom:8px;border:1px solid ' + CAT.line + ';">';
      h += '<div style="font-weight:700;font-size:12px;color:' + CAT.text + ';">' + esc(dk) + "</div>";
      h += '<div style="font-size:10px;color:' + CAT.text + ';white-space:pre-wrap;margin-bottom:4px;">' + esc(dynamics[dk]) + "</div>";
      h += '<button class="sl_dyn_edit_btn" data-char="' + escAttr(dk) + '" style="' + sbtn(CAT.sub) + 'font-size:9px;">✏️ 编辑</button>';
      h += '<div class="sl_dyn_edit_box" data-char="' + escAttr(dk) + '" style="display:none;margin-top:6px;"><textarea class="sl_dyn_edit_ta" data-char="' + escAttr(dk) + '" style="width:100%;min-height:50px;padding:6px;border-radius:6px;border:1px solid ' + CAT.line + ';font-size:10px;background:' + CAT.bg + ';color:' + CAT.text + ';resize:vertical;">' + esc(dynamics[dk]) + '</textarea><div style="display:flex;gap:4px;margin-top:4px;"><button class="sl_dyn_save_btn" data-char="' + escAttr(dk) + '" style="' + sbtn(CAT.green) + 'font-size:9px;">💾 保存</button><button class="sl_dyn_cancel_btn" data-char="' + escAttr(dk) + '" style="font-size:9px;padding:4px 10px;border:1px solid ' + CAT.line + ';border-radius:6px;background:transparent;color:' + CAT.sub + ';cursor:pointer;">取消</button></div></div></div>';
    }
  } else { h += '<div style="text-align:center;padding:16px;color:' + CAT.mute + ';font-size:11px;">还没聊过天喵~</div>'; }
  h += "</div>";
  h += userCard();
  body.html(h); bindArchiveEvents(body);
}

function userCard() {
  var pf = getProfiles();
  var up = (pf && pf.root[pf.charName] && pf.root[pf.charName].userProfile) || "";
  var h = '<div style="background:' + CAT.card + ';border-radius:12px;padding:12px;margin-top:10px;border:1px solid ' + CAT.line + ';">';
  h += '<div style="font-weight:700;font-size:11px;color:' + CAT.text + ';margin-bottom:8px;">👤 User 设定</div>';
  if (up) h += '<div style="font-size:10px;color:' + CAT.text + ';margin-bottom:6px;white-space:pre-wrap;">' + esc(up).substring(0, 200) + "</div>";
  h += '<input id="sl_user_name" type="text" value="' + escAttr(settings.userName || "") + '" style="padding:6px 8px;border-radius:6px;border:1px solid ' + CAT.line + ';font-size:11px;width:100%;box-sizing:border-box;background:' + CAT.card + ';color:' + CAT.text + ';margin-bottom:8px;" placeholder="你的名字">';
  h += '<input id="sl_user_desc" type="text" value="' + escAttr(settings.userDesc || "") + '" style="padding:6px 8px;border-radius:6px;border:1px solid ' + CAT.line + ';font-size:11px;width:100%;box-sizing:border-box;background:' + CAT.card + ';color:' + CAT.text + ';" placeholder="外貌描述">';
  h += "</div>";
  return h;
}

function bindArchiveEvents(b) {
  b.off("click", "#sl_btn_scan_cast3").on("click", "#sl_btn_scan_cast3", async function () { var btn = jQuery(this); btn.prop("disabled", true).text("扫描中..."); try { await scanCharacterProfile(); toast("success", "扫描完成喵~ ✨"); renderArchiveTab(); refreshCompactBar(); } catch (e) { toast("error", "扫描失败喵…"); } btn.prop("disabled", false).text("🔍 扫描角色卡档案喵~"); });
  b.off("change input", "#sl_user_name,#sl_user_desc").on("change input", "#sl_user_name,#sl_user_desc", function () { settings.userName = b.find("#sl_user_name").val(); settings.userDesc = b.find("#sl_user_desc").val(); saveSettings(); });
  b.off("click", ".sl_arch_st").on("click", ".sl_arch_st", function () { var st = parseInt(jQuery(this).data("ast")); b.find(".sl_arch_st").css({ background: "transparent", color: CAT.sub, fontWeight: "400" }); jQuery(this).css({ background: CAT.accent, color: "#fff", fontWeight: "600" }); b.find("#sl_arch_static").toggle(st === 0); b.find("#sl_arch_dynamic").toggle(st === 1); });
  b.off("click", ".sl_edit_btn").on("click", ".sl_edit_btn", function () { b.find(".sl_edit_box[data-char=\"" + jQuery(this).data("char") + "\"]").toggle(); });
  b.off("click", ".sl_cancel_btn").on("click", ".sl_cancel_btn", function () { b.find(".sl_edit_box[data-char=\"" + jQuery(this).data("char") + "\"]").hide(); });
  b.off("click", ".sl_save_btn").on("click", ".sl_save_btn", function () { var cn = jQuery(this).data("char"), nt = b.find(".sl_edit_ta[data-char=\"" + cn + "\"]").val(), pf = getProfiles(); if (pf && pf.root[pf.charName] && pf.root[pf.charName].cast && pf.root[pf.charName].cast[cn]) { pf.root[pf.charName].cast[cn].static = nt; pf.root[pf.charName].cast[cn].anchor = nt.slice(0, 80); saveSettings(); toast("success", cn + " 保存好啦喵~ ✨"); renderArchiveTab(); } });
  b.off("click", ".sl_refine_btn").on("click", ".sl_refine_btn", async function () { var cn = jQuery(this).data("char"), btn = jQuery(this), pf = getProfiles(), cast = pf && pf.root[pf.charName] && pf.root[pf.charName].cast; if (!cast || !cast[cn]) { toast("error", "没有档案喵…"); return; } var orig = cast[cn].static || "", edit = b.find(".sl_edit_ta[data-char=\"" + cn + "\"]").val() || orig; btn.prop("disabled", true).text("润色中..."); try { var r = await refineStaticProfile(pf.charName, cn, orig, edit); if (r) { cast[cn].static = r.rigid; cast[cn].body = r.body; cast[cn].anchor = r.rigid.slice(0, 80); saveSettings(); toast("success", cn + " 润色完成喵~ ✨"); renderArchiveTab(); } else toast("error", "润色失败喵… (╥﹏╥)"); } catch (e) { toast("error", "润色出错喵…"); } btn.prop("disabled", false).text("✨ AI润色"); });
  b.off("click", ".sl_port_btn").on("click", ".sl_port_btn", async function () { var cn = jQuery(this).data("char"), btn = jQuery(this), pf = getProfiles(), cast = pf && pf.root[pf.charName] && pf.root[pf.charName].cast; if (!cast || !cast[cn] || !cast[cn].static) { toast("error", "没有静态档案喵…"); return; } var anchor = cast[cn].static, bodyT = cast[cn].body || "", prompt = anchor + (bodyT ? ", " + bodyT : "") + ", standing, front view, full body, simple background, neutral expression"; btn.prop("disabled", true).text("生成中..."); try { var wf = JSON.parse(settings.cWf || "{}"); if (!Object.keys(wf).length) { toast("error", "工作流空空如也喵~"); btn.prop("disabled", false).text("📷 生成立绘"); return; } var result = await generateImage(wf, prompt); if (result && result.url) { cast[cn].portrait = result.url; saveSettings(); b.find("#sl_port_" + cn.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, "_")).css({ backgroundImage: "url(" + result.url + ")", backgroundSize: "cover", backgroundPosition: "top center", border: "2px solid " + CAT.accent, color: "transparent" }).html(""); toast("success", cn + " 立绘生成好啦喵~ ✨"); } } catch (e) { toast("error", "立绘生成失败喵… (╥﹏╥)"); } btn.prop("disabled", false).text("📷 生成立绘"); });
  b.off("click", ".sl_dyn_edit_btn").on("click", ".sl_dyn_edit_btn", function () { b.find(".sl_dyn_edit_box[data-char=\"" + jQuery(this).data("char") + "\"]").toggle(); });
  b.off("click", ".sl_dyn_cancel_btn").on("click", ".sl_dyn_cancel_btn", function () { b.find(".sl_dyn_edit_box[data-char=\"" + jQuery(this).data("char") + "\"]").hide(); });
  b.off("click", ".sl_dyn_save_btn").on("click", ".sl_dyn_save_btn", function () { var cn = jQuery(this).data("char"), nt = b.find(".sl_dyn_edit_ta[data-char=\"" + cn + "\"]").val(), pf = getProfiles(); if (pf && pf.chat && pf.chat.dynamics) { pf.chat.dynamics[cn] = nt; saveSettings(); toast("success", cn + " 动态保存啦喵~ ✨"); renderArchiveTab(); } });
  b.off("click", "[id^=sl_port_]").on("click", "[id^=sl_port_]", function () { var bg = jQuery(this).css("background-image"); if (!bg || bg === "none") return; var url = bg.slice(bg.indexOf("(")+1,bg.lastIndexOf(")")).replace(/["']/g,"");
        jQuery('<div style="position:fixed;z-index:30001;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;cursor:pointer;"><img src="' + url + '" style="max-width:90vw;max-height:90vh;border-radius:12px;box-shadow:0 4px 30px rgba(0,0,0,0.5);"></div>').appendTo("body").on("click", function () { jQuery(this).remove(); }); });
}

// ════════════════ 日志 ════════════════
function showLogViewer() { var t = slLogDump() || "暂无日志喵~"; var h = '<div style="position:fixed;z-index:40000;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;"><div style="background:' + CAT.card + ';border-radius:' + CAT.radius + ';width:90vw;max-width:700px;max-height:80vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.3);"><div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid ' + CAT.line + ';"><span style="font-weight:700;font-size:14px;color:' + CAT.text + ';">📋 插件日志 (' + getLogCount() + ' 条)</span><div style="display:flex;gap:6px;"><button id="sl_log_clear" style="' + sbtn(CAT.red) + 'font-size:11px;">🗑 清空</button><button id="sl_log_close" style="border:none;background:none;cursor:pointer;font-size:18px;color:' + CAT.mute + ';">✕</button></div></div><div style="flex:1;overflow-y:auto;padding:12px;font-family:monospace;font-size:11px;color:' + CAT.text + ';white-space:pre-wrap;line-height:1.5;">' + esc(t) + "</div></div></div>"; var m = jQuery(h).appendTo("body"); jQuery("#sl_log_close").on("click", function () { m.remove(); }); jQuery("#sl_log_clear").on("click", function () { slClearLogs(); m.remove(); toast("success", "日志已清空喵~ 🧹"); }); m.on("click", function (e) { if (e.target === this) m.remove(); }); }

export function buildUI(extSettings) { slLog("=^_^= UI v2.1 start"); if (settings.uiTheme) applyTheme(settings.uiTheme); createCompactBar(); createExpandedPanel(); }
