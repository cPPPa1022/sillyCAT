// ── SillyImage Lab 三个 Tab（首页 / 设置 / 档案） ──
import { CAT, CAT_THEMES, TEXT_THEMES, applyTheme } from './theme.js';
import { toast, esc, escAttr, sbtn, fi, chkProf } from './utils.js';
import { settings, saveSettings } from '../settings.js';
import { slLogDump, getLogCount, slClearLogs } from '../log.js';
import { getProfiles, scanCharacterProfile, getCharacterName, deleteCharacterProfile } from '../pipeline/profile.js';
import { startPolling, stopPolling, getScannerStatus } from '../scanner.js';
import { getQueueLength } from '../queue.js';
import { generateImage } from '../comfyui.js';
import { cleanAnimePrompt } from '../text-utils.js';
import { openSubPanel } from './sub-panels.js';
import * as compact from './compact-bar.js';
import * as panel from './panel.js';
export function renderHomeTab() {
  var body = jQuery("#sl_panel_body"); if (!body.length) return;
  var cn = getCharacterName() || "未选择角色", hp = chkProf(), ss = getScannerStatus(), ql = getQueueLength(),
    ha = !!(settings.auxUrl && settings.auxModel), hc = !!settings.cUrl, hw = !!(settings.cWf && settings.cWf.length > 50), allReady = ha && hc && hw && hp, h = "";
  if (!allReady) { var steps = [{ l: "连接 AI助理", ok: ha }, { l: "连接 ComfyUI", ok: hc }, { l: "导入工作流", ok: hw }, { l: "扫描角色卡", ok: hp }]; h += '<div style="background:' + CAT.card + ';border-radius:12px;padding:12px 14px;margin-bottom:10px;border:2px solid ' + CAT.accent + ';">'; h += '<div style="font-weight:700;font-size:13px;margin-bottom:6px;">=^_^= 欢迎喵~ 完成下面几步就能用啦</div>'; for (var i = 0; i < steps.length; i++)h += '<div style="padding:2px 0;font-size:11px;color:' + (steps[i].ok ? CAT.green : CAT.sub) + ';">' + (steps[i].ok ? "✅" : "☐") + " " + steps[i].l + "</div>"; h += '<button id="sl_goto_settings" style="margin-top:6px;padding:6px 14px;border:none;border-radius:8px;background:' + CAT.accent + ';color:#fff;cursor:pointer;font-size:11px;font-weight:600;">去设置 →</button></div>'; }
  h += '<div style="background:' + CAT.card + ';border-radius:12px;padding:12px 14px;margin-bottom:10px;border:1px solid ' + CAT.line + ';">';
  h += '<div style="font-weight:700;font-size:14px;color:' + CAT.text + ';margin-bottom:4px;">👤 ' + esc(cn) + "</div>";
  h += '<div style="font-size:11px;color:' + CAT.sub + ';">' + ((settings.modelType === "anime" || settings.modelType === "anime_tag") ? "🎬Anime" : "🖼️ZIT") + " · " + (settings.autoGen === 1 ? "⚡自动" : "🖐手动") + " · 档案：" + (hp ? "✅已扫描" : "❌未扫描") + " · 排队：" + ql + "张</div></div>";
  h += '<div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;"><button id="sl_btn_scan_cast" style="' + sbtn(CAT.accent) + '">🔍 扫描角色喵~</button><button id="sl_btn_gen_all" style="' + sbtn(CAT.green) + '">⚡ 一键排图</button><button id="sl_btn_reset_plugin" style="' + sbtn(CAT.red) + '">🧹 重置插件</button></div>';
  h += '<div style="background:' + CAT.card + ';border-radius:12px;padding:12px 14px;margin-bottom:8px;border:1px solid ' + CAT.line + ';">';
  h += '<div style="font-size:11px;color:' + CAT.sub + ';margin-bottom:6px;">🎨 外观</div><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;"><span style="font-size:11px;color:' + CAT.text + ';">插件主题</span><select id="sl_ui_theme" style="' + fi() + 'width:auto;min-width:100px;">';
  for (var tk in CAT_THEMES) h += '<option value="' + escAttr(tk) + '"' + (settings.uiTheme === tk ? " selected" : "") + ">" + tk + "</option>";
  h += '</select><span style="font-size:11px;color:' + CAT.text + ';margin-left:8px;">文本渲染</span><select id="sl_text_theme" style="' + fi() + 'width:auto;min-width:100px;">';
  for (var tk2 in TEXT_THEMES) h += '<option value="' + escAttr(tk2) + '"' + (settings.enhancedTheme === tk2 ? " selected" : "") + ">" + tk2 + "</option>";
  h += "</select></div></div>";
  var sm2 = { off: "已关闭", idle: "空闲", waiting_body: "等待正文", waiting_end: "AI回复中", scanning: "分析中喵~" };
  h += '<div style="font-size:10px;color:' + CAT.mute + ';text-align:center;">📊 ' + (sm2[ss] || ss) + " · 📥 排队 " + ql + " 张" + (allReady ? "" : " · ⚠ 配置未完成") + "</div>";
  body.html(h);
  body.off("click", "#sl_goto_settings").on("click", "#sl_goto_settings", function () { panel.getPanelEl().find('.sl_tab_btn[data-tab="settings"]').trigger("click"); });
  body.off("click", "#sl_btn_scan_cast").on("click", "#sl_btn_scan_cast", async function () { var b = jQuery(this); b.prop("disabled", true).text("扫描中..."); try { var sr = await scanCharacterProfile(); if (sr) { toast("success", "扫描完成喵~ ✨"); } else { toast("error", "扫描没成功喵… (╥﹏╥)"); } renderHomeTab(); compact.refreshCompactBar(); } catch (e) { toast("error", "扫描失败喵… (╥﹏╥)"); } b.prop("disabled", false).text("🔍 扫描角色喵~"); });
  body.off("click", "#sl_btn_gen_all").on("click", "#sl_btn_gen_all", compact.triggerGenAll);
  body.off("click", "#sl_btn_reset_plugin").on("click", "#sl_btn_reset_plugin", function () { if (!confirm("⚠ 确定要重置插件喵？\\n\\n这会清除：\\n· 所有角色卡档案\\n· 消息缓存\\n· 图片缓存\\n· 插件设置恢复默认\\n\\n酒馆不会关闭，但插件会回到刚装好的状态哦~")) return; try { var ks=Object.keys(localStorage); for(var i=0;i<ks.length;i++){ if(ks[i].indexOf('sillab')===0||ks[i].indexOf('slimg')===0||ks[i].indexOf('sl_')===0) localStorage.removeItem(ks[i]); } toast("success","重置好啦喵~ 刷新页面生效 ✨"); setTimeout(function(){location.reload();},1500); } catch(e){ toast("error","清除失败喵…"); } });
  body.off("change", "#sl_ui_theme").on("change", "#sl_ui_theme", function () { var name = jQuery(this).val(); panel.hidePanel(); settings.uiTheme = name; applyTheme(name); saveSettings(); compact.rebuildCompactBar(); panel.showPanel(); });
  body.off("change", "#sl_text_theme").on("change", "#sl_text_theme", function () { settings.enhancedTheme = jQuery(this).val(); saveSettings(); });
}
export function renderSettingsTab() {
  var body = jQuery("#sl_panel_body"), f = fi(), h = "";
  h += '<div style="background:' + CAT.card + ';border-radius:10px;padding:10px 14px;margin-bottom:10px;border:1px solid ' + CAT.line + ';"><label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="checkbox" id="sl_plugin_on"' + (settings.pluginOn !== false ? " checked" : "") + '><span style="font-size:12px;color:' + CAT.text + ';">✅ 插件开启</span></label></div>';
  h += '<div style="background:' + CAT.card + ';border-radius:12px;padding:12px 14px;margin-bottom:10px;border:1px solid ' + CAT.line + ';">';
  h += '<div style="font-size:11px;color:' + CAT.sub + ';margin-bottom:2px;">模型类型</div><select id="sl_model_type" style="' + f + '"><option value="zit"' + (settings.modelType === "zit" ? " selected" : "") + '>🖼️ ZIT</option><option value="anime"' + (settings.modelType === "anime" ? " selected" : "") + '>🎬 Anime</option><option value="anime_tag"' + (settings.modelType === "anime_tag" ? " selected" : "") + '>🏷️ Anime Tag</option></select></div>';
  h += '<div style="background:' + CAT.card + ';border-radius:12px;padding:12px 14px;margin-bottom:10px;border:1px solid ' + CAT.line + ';">';
  h += '<div style="font-size:11px;color:' + CAT.sub + ';margin-bottom:2px;">📝 前置提示词</div><input id="sl_prompt_prefix" type="text" value="' + escAttr(settings.promptPrefix || "") + '" style="' + f + '" placeholder="留空则不生效"></div>';
  h += '<div id="sl_anime_opts" style="background:' + CAT.card + ';border-radius:12px;padding:12px 14px;margin-bottom:10px;border:1px solid ' + CAT.line + ';' + (settings.modelType === "anime" || settings.modelType === "anime_tag" ? "" : "display:none;") + '">';
  h += '<div style="font-size:11px;color:' + CAT.sub + ';margin-bottom:2px;">质量前缀</div><input id="sl_anime_prefix" type="text" value="' + escAttr(settings.animeQualityPrefix || "") + '" style="' + f + 'margin-bottom:6px;">';
  h += '<div style="font-size:11px;color:' + CAT.sub + ';margin-bottom:2px;">艺术家标签</div><input id="sl_anime_artist" type="text" value="' + escAttr(settings.animeArtist || "") + '" style="' + f + '" placeholder="留空则不使用"></div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;"><button class="sl_open_sub" data-sub="aux" style="' + sbtn(CAT.accent) + '">🧠 AI助理</button><button class="sl_open_sub" data-sub="comfy" style="' + sbtn(CAT.accent) + '">🎨 ComfyUI & 工作流</button></div>';
  h += '<button class="sl_open_sub" data-sub="advanced" style="width:100%;' + sbtn(CAT.sub) + '">⚙️ 高级选项</button>';
  h += '<div style="margin-top:12px;"><button id="sl_save_settings" style="width:100%;' + sbtn(CAT.accent) + 'font-size:14px;">💾 保存全部设置喵~</button></div>';
  body.html(h); bindSettingsEvents(body);
}
export function bindSettingsEvents(b) {
  b.off("change", "#sl_plugin_on").on("change", "#sl_plugin_on", function () { settings.pluginOn = jQuery(this).is(":checked"); saveSettings(); if (settings.pluginOn) { startPolling(); compact.setPluginEnabled(true); } else { stopPolling(); compact.setPluginEnabled(false); } });
  b.off("change", "#sl_model_type").on("change", "#sl_model_type", function () { settings.modelType = jQuery(this).val(); jQuery("#sl_anime_opts").toggle(settings.modelType === "anime" || settings.modelType === "anime_tag"); saveSettings(); });
  b.off("change input", "#sl_prompt_prefix").on("change input", "#sl_prompt_prefix", function () { settings.promptPrefix = jQuery(this).val(); saveSettings(); });
  b.off("change input", "#sl_anime_prefix").on("change input", "#sl_anime_prefix", function () { settings.animeQualityPrefix = jQuery(this).val(); saveSettings(); });
  b.off("change input", "#sl_anime_artist").on("change input", "#sl_anime_artist", function () { settings.animeArtist = jQuery(this).val(); saveSettings(); });
  b.off("click", "#sl_save_settings").on("click", "#sl_save_settings", function () { settings.promptPrefix = jQuery("#sl_prompt_prefix").val(); saveSettings(); toast("success", "全部保存好啦喵~ ✨"); });
  b.off("click", ".sl_open_sub").on("click", ".sl_open_sub", function () { openSubPanel(jQuery(this).data("sub")); });
}
export function renderArchiveTab() {
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
    h += '<div style="font-size:11px;color:' + CAT.mute + ';margin-bottom:12px;">尚未扫描喵~ 选好画风再点扫描，选完就锁定啦 (｡•̀ᴗ-́)و</div><div style="margin-bottom:10px;"><span style="font-size:11px;color:CAT.sub;">🎨 画风模式</span><select id="sl_scan_mode" style="width:100%;margin-top:4px;padding:8px 10px;border:CAT.borderStyle CAT.line;border-radius:8px;background:CAT.card;font-size:12px;color:CAT.text;"><option value="zit">🖼️ 中文模式 — Z-Image Turbo / 原生中文最优</option><option value="anime">🎬 英文自然语言 — Anima 系列 / 标签+自然语句</option><option value="anime_tag">🏷️ 英文标签模式 — Pony/SDXL / 纯标签链</option></select></div>';
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
      h += '<div style="margin-top:8px;"><button id="sl_btn_clear_cast" style="' + sbtn(CAT.red) + 'font-size:10px;">🗑 清除本卡档案</button></div>';
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
    h += '<div style="display:flex;gap:4px;margin-top:4px;flex-wrap:wrap;"><button class="sl_port_btn" data-char="' + escAttr(ck) + '" style="' + sbtn(CAT.accent) + 'font-size:9px;">📷 生成立绘</button></div>';
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
    h += '<div style="margin-top:8px;"><button id="sl_btn_clear_cast" style="' + sbtn(CAT.red) + 'font-size:10px;">🗑 清除本卡档案</button></div>';
  h += userCard();
  body.html(h); bindArchiveEvents(body);
}
export function userCard() {
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
export function bindArchiveEvents(b) {
  b.off("click", "#sl_btn_clear_cast").on("click", "#sl_btn_clear_cast", function(){if(!confirm("确定要清除当前角色卡档案喵？聊天记录不受影响~"))return;deleteCharacterProfile(false);toast("warning","档案清除啦~ 需要重新扫描喵 (｡•́︿•̀｡)");renderArchiveTab();compact.refreshCompactBar();});
  b.off("click", "#sl_btn_scan_cast3").on("click", "#sl_btn_scan_cast3", async function () { var btn = jQuery(this); btn.prop("disabled", true).text("扫描中..."); try { var scanMode = jQuery('#sl_scan_mode').val() || 'zit'; await scanCharacterProfile(scanMode); toast("success", "扫描完成喵~ 🔒 已锁定"); renderArchiveTab(); compact.refreshCompactBar(); } catch (e) { toast("error", "扫描失败喵…"); } btn.prop("disabled", false).text("🔍 扫描角色卡档案喵~"); });
  b.off("change input", "#sl_user_name,#sl_user_desc").on("change input", "#sl_user_name,#sl_user_desc", function () { settings.userName = b.find("#sl_user_name").val(); settings.userDesc = b.find("#sl_user_desc").val(); saveSettings(); });
  b.off("click", ".sl_arch_st").on("click", ".sl_arch_st", function () { var st = parseInt(jQuery(this).data("ast")); b.find(".sl_arch_st").css({ background: "transparent", color: CAT.sub, fontWeight: "400" }); jQuery(this).css({ background: CAT.accent, color: "#fff", fontWeight: "600" }); b.find("#sl_arch_static").toggle(st === 0); b.find("#sl_arch_dynamic").toggle(st === 1); });
  b.off("click", ".sl_edit_btn").on("click", ".sl_edit_btn", function () { b.find(".sl_edit_box[data-char=\"" + jQuery(this).data("char") + "\"]").toggle(); });
  b.off("click", ".sl_cancel_btn").on("click", ".sl_cancel_btn", function () { b.find(".sl_edit_box[data-char=\"" + jQuery(this).data("char") + "\"]").hide(); });
  b.off("click", ".sl_save_btn").on("click", ".sl_save_btn", function () { var cn = jQuery(this).data("char"), nt = b.find(".sl_edit_ta[data-char=\"" + cn + "\"]").val(), pf = getProfiles(); if (pf && pf.root[pf.charName] && pf.root[pf.charName].cast && pf.root[pf.charName].cast[cn]) { pf.root[pf.charName].cast[cn].static = nt; pf.root[pf.charName].cast[cn].anchor = nt.slice(0, 80); saveSettings(); toast("success", cn + " 保存好啦喵~ ✨"); renderArchiveTab(); } });
    // AI润色已移除
  
  b.off("click", ".sl_port_btn").on("click", ".sl_port_btn", async function () { var cn = jQuery(this).data("char"), btn = jQuery(this), pf = getProfiles(), cast = pf && pf.root[pf.charName] && pf.root[pf.charName].cast; if (!cast || !cast[cn] || !cast[cn].static) { toast("error", "没有静态档案喵…"); return; } var anchor = cast[cn].static; var bm=(pf&&pf.root[pf.charName]&&pf.root[pf.charName].meta&&pf.root[pf.charName].meta.modelMode)||settings.modelType; if(bm==="anime"&&cast[cn].enPrompt)anchor=cast[cn].enPrompt; else if(bm==="anime_tag"&&cast[cn].enTags)anchor=cast[cn].enTags; var bodyT = cast[cn].body || "", prompt = anchor + ((bm==="anime"||bm==="anime_tag")?"":(bodyT?", "+bodyT:"")) + ", standing, front view, full body, simple background, neutral expression"; if (bm === "anime" || bm === "anime_tag") prompt = cleanAnimePrompt(prompt); btn.prop("disabled", true).text("生成中..."); try { var wf = JSON.parse(settings.cWf || "{}"); if (!Object.keys(wf).length) { toast("error", "工作流空空如也喵~"); btn.prop("disabled", false).text("📷 生成立绘"); return; } var result = await generateImage(wf, prompt); if (result && result.url) { cast[cn].portrait = result.url; saveSettings(); b.find("#sl_port_" + cn.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, "_")).css({ backgroundImage: "url(" + result.url + ")", backgroundSize: "cover", backgroundPosition: "top center", border: "2px solid " + CAT.accent, color: "transparent" }).html(""); toast("success", cn + " 立绘生成好啦喵~ ✨"); } } catch (e) { toast("error", "立绘生成失败喵… (╥﹏╥)"); } btn.prop("disabled", false).text("📷 生成立绘"); });
  b.off("click", ".sl_dyn_edit_btn").on("click", ".sl_dyn_edit_btn", function () { b.find(".sl_dyn_edit_box[data-char=\"" + jQuery(this).data("char") + "\"]").toggle(); });
  b.off("click", ".sl_dyn_cancel_btn").on("click", ".sl_dyn_cancel_btn", function () { b.find(".sl_dyn_edit_box[data-char=\"" + jQuery(this).data("char") + "\"]").hide(); });
  b.off("click", ".sl_dyn_save_btn").on("click", ".sl_dyn_save_btn", function () { var cn = jQuery(this).data("char"), nt = b.find(".sl_dyn_edit_ta[data-char=\"" + cn + "\"]").val(), pf = getProfiles(); if (pf && pf.chat && pf.chat.dynamics) { pf.chat.dynamics[cn] = nt; saveSettings(); toast("success", cn + " 动态保存啦喵~ ✨"); renderArchiveTab(); } });
  b.off("click", "[id^=sl_port_]").on("click", "[id^=sl_port_]", function () { var bg = jQuery(this).css("background-image"); if (!bg || bg === "none") return; var url = bg.slice(bg.indexOf("(")+1,bg.lastIndexOf(")")).replace(/["']/g,"");
        jQuery('<div style="position:fixed;z-index:30001;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;cursor:pointer;"><img src="' + url + '" style="max-width:90vw;max-height:90vh;border-radius:12px;box-shadow:0 4px 30px rgba(0,0,0,0.5);"></div>').appendTo("body").on("click", function () { jQuery(this).remove(); }); });
}
export function showLogViewer() { var t = slLogDump() || "暂无日志喵~"; var h = '<div style="position:fixed;z-index:40000;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;"><div style="background:' + CAT.card + ';border-radius:' + CAT.radius + ';width:90vw;max-width:700px;max-height:80vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.3);"><div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid ' + CAT.line + ';"><span style="font-weight:700;font-size:14px;color:' + CAT.text + ';">📋 插件日志 (' + getLogCount() + ' 条)</span><div style="display:flex;gap:6px;"><button id="sl_log_clear" style="' + sbtn(CAT.red) + 'font-size:11px;">🗑 清空</button><button id="sl_log_close" style="border:none;background:none;cursor:pointer;font-size:18px;color:' + CAT.mute + ';">✕</button></div></div><div style="flex:1;overflow-y:auto;padding:12px;font-family:monospace;font-size:11px;color:' + CAT.text + ';white-space:pre-wrap;line-height:1.5;">' + esc(t) + "</div></div></div>"; var m = jQuery(h).appendTo("body"); jQuery("#sl_log_close").on("click", function () { m.remove(); }); jQuery("#sl_log_clear").on("click", function () { slClearLogs(); m.remove(); toast("success", "日志已清空喵~ 🧹"); }); m.on("click", function (e) { if (e.target === this) m.remove(); }); }