// ── SillyImage Lab 紧凑状态条 ──
import { CAT, getCatStatusFace } from './theme.js';
import { toast, chkProf } from './utils.js';
import { settings, saveSettings } from '../settings.js';
import { getCharacterName, scanCharacterProfile } from '../pipeline/profile.js';
import { getScannerStatus } from '../scanner.js';
import { getQueueLength } from '../queue.js';
import * as panel from './panel.js';  // 循环依赖：仅函数体内引用，运行时安全

var _compactEl = null, _compactTimer = null, _compDragMoved = false;

export function getCompactEl() { return _compactEl; }

// [AI-Fix] 插件开关：compact 相关状态集中管理，供 tabs 调用
export function setPluginEnabled(enabled) {
    if (enabled) {
        if (_compactEl) _compactEl.show();
        if (!_compactTimer) { _compactTimer = setInterval(refreshCompactBar, 3000); }
    } else {
        if (_compactEl) _compactEl.hide();
        if (_compactTimer) { clearInterval(_compactTimer); _compactTimer = null; }
    }
}

// [AI-Fix] 主题切换时重建紧凑条（原逻辑内联在 renderHomeTab，拆出后集中管理）
export function rebuildCompactBar() {
    if (_compactEl) { clearInterval(_compactTimer); _compactEl.remove(); _compactEl = null; _compactTimer = null; }
    createCompactBar();
}
export function createCompactBar() {
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
  (function () { var dragging = false, sx, sy, ox, oy; jQuery("#sl_comp_header").on("mousedown touchstart", function (e) { if (jQuery(e.target).is("button")) return; e.preventDefault(); dragging = true; _compDragMoved = false; var p = (e.touches || [e])[0]; sx = p.clientX; sy = p.clientY; var o = _compactEl.offset(); ox = o.left; oy = o.top; _compactEl.css({ right: "auto", bottom: "auto", left: ox + "px", top: oy + "px" }); }).on("dblclick", function(e) { e.preventDefault(); _compactEl.css({ left: "auto", top: "auto", right: "16px", bottom: "16px" }); try { localStorage.removeItem("sl_compact_pos"); } catch(e){} }); jQuery(document).on("mousemove touchmove", function (e) { if (!dragging) return; var p = (e.touches || [e])[0]; if (Math.abs(p.clientX - sx) > 2 || Math.abs(p.clientY - sy) > 2) _compDragMoved = true; var newLeft = ox + p.clientX - sx, newTop = oy + p.clientY - sy; var maxX = window.innerWidth - _compactEl.outerWidth(), maxY = window.innerHeight - _compactEl.outerHeight(); newLeft = Math.max(0, Math.min(newLeft, maxX)); newTop = Math.max(0, Math.min(newTop, maxY)); _compactEl.css({ left: newLeft + "px", top: newTop + "px" }); }).on("mouseup touchend", function () { if (!dragging) return; dragging = false; if (_compDragMoved) { var o = _compactEl.offset(); var maxX2 = window.innerWidth - _compactEl.outerWidth(), maxY2 = window.innerHeight - _compactEl.outerHeight(); var clX = Math.max(0, Math.min(o.left, maxX2)), clY = Math.max(0, Math.min(o.top, maxY2)); _compactEl.css({ left: clX + "px", top: clY + "px" }); try { localStorage.setItem("sl_compact_pos", JSON.stringify({ x: clX, y: clY })); } catch (e) { } } }); })();
  jQuery("#sl_comp_header").on("click", function (e) { var was = _compDragMoved; _compDragMoved = false; if (jQuery(e.target).is("button") || was) return; panel.togglePanel(); });
  jQuery("#sl_comp_panel_btn").on("click", function (e) { e.stopPropagation(); panel.togglePanel(); });
  jQuery("#sl_comp_gen").on("click", function (e) { e.stopPropagation(); triggerGenAll(); });
  jQuery("#sl_comp_auto").on("click", function (e) { e.stopPropagation(); settings.autoGen = settings.autoGen === 1 ? 0 : 1; saveSettings(); refreshCompactBar(); });
  jQuery("#sl_comp_scan").on("click", async function (e) { e.stopPropagation(); var b = jQuery(this); b.prop("disabled", true).text("扫描中..."); try { await scanCharacterProfile(); toast("success", "扫描完成喵~ ✨"); } catch (e2) { toast("error", "扫描失败喵…"); } b.prop("disabled", false).text("🔍扫描"); refreshCompactBar(); });
  _compactTimer = setInterval(refreshCompactBar, 3000); refreshCompactBar();
}
export function refreshCompactBar() {
  if (!_compactEl || !_compactEl.is(":visible")) return;
  var cn = getCharacterName() || "", hasChat = !!cn;
  jQuery("#sl_comp_char").text(hasChat ? cn : "未进入聊天");
  jQuery("#sl_comp_model").text(hasChat ? ((settings.modelType === "anime" || settings.modelType === "anime_tag") ? "🎬Anime" : "🖼️ZIT") : "");
  var hp = chkProf();
  if (!hasChat) { jQuery("#sl_comp_profile").text("").hide(); jQuery("#sl_comp_scan").hide(); }
  else if (hp) { jQuery("#sl_comp_profile").text("📋✅已扫描" + (function(){try{var p=JSON.parse(localStorage.sillab_settings);var cn=Object.keys(p.profiles||{})[0];var m=p.profiles[cn]&&p.profiles[cn].meta&&p.profiles[cn].meta.modelMode;return m?(" 🔒"+({zit:"ZIT",anime:"Anime",anime_tag:"Tag"}[m]||m)):"";}catch(e){return"";}})()).css("color", CAT.green).show(); jQuery("#sl_comp_scan").hide(); }
  else { jQuery("#sl_comp_profile").text("📋❌未扫描").css("color", CAT.red).show(); jQuery("#sl_comp_scan").show(); }
  var ss = getScannerStatus(), sm = { off: "已关闭", idle: "空闲", waiting_body: "等待正文", waiting_end: "AI回复中", scanning: "分析中" };
  jQuery("#sl_comp_status").text(sm[ss] || ss);
  var ql = getQueueLength();
  jQuery("#sl_comp_queue_txt").text("排队 " + ql);
  jQuery("#sl_comp_mode").text(settings.autoGen === 1 ? "⚡自动" : "🖐手动");
  jQuery("#sl_comp_auto").text(settings.autoGen === 1 ? "⚡自动" : "🖐手动");
  var cs = "idle"; if (ss === "scanning") cs = "scanning"; else if (ql > 0) cs = ql > 5 ? "busy" : "queuing";
  jQuery("#sl_cat_icon").text(getCatStatusFace(cs));
  // [AI-Fix] 动态更新事件文字（原来永远显示「就绪」）
  var evText = "« 就绪 »";
  if (ss === "scanning") evText = "分析中喵…";
  else if (ql > 0) evText = "排队 " + ql + " 张";
  jQuery("#sl_comp_event").text(evText);
}
export function triggerGenAll() { var c = 0; jQuery(".sl_img_btn[data-prompt]").each(function () { var b = jQuery(this); if (b.text().indexOf("排队") < 0 && b.text().indexOf("🔄") < 0 && b.text().indexOf("生成图片") >= 0) { b.trigger("click"); c++; } }); if (c === 0) toast("info", "没有待生成的图片喵~"); else toast("success", "已排队 " + c + " 张图片喵~ ✨"); }