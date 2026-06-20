// 🐱 偷懒小猫生图工具 v1.0.3 — UI 面板
import { slLog, slErr, slLogDump, getLogCount } from './log.js';
import { settings, getDefaults, COLORS, INPUT_STYLE, BUTTON_STYLE, getSTContext, getSTHeaders, escapeHtml, saveSettings } from './settings.js';
import { loadWorkflowList, loadWorkflow, saveWorkflow, deleteWorkflow, fetchComfyModels, generateImage } from './comfyui.js';
import { getProfiles, scanCharacterProfile, getCharacterName, deleteCharacterProfile } from './pipeline.js';
import { hasCastCache, stopPolling, getScannerStatus } from './scanner.js';
import { exportProfiles } from './export.js';
import { getQueueLength } from './queue.js';
import { getThemeCSS } from './render.js';

var _extSettings = null;

export function buildUI(extSettings) {
    _extSettings = extSettings;

    // ── 触发按钮 ──
    var triggerPos = { x: null, y: null };
    try {
        var saved = localStorage.getItem('sl_trigger_pos');
        if (saved) triggerPos = JSON.parse(saved);
    } catch(e) {}
    var tRight = triggerPos.x != null ? 'auto' : '24px';
    var tBottom = triggerPos.y != null ? 'auto' : '120px';
    var tLeft = triggerPos.x != null ? triggerPos.x + 'px' : 'auto';
    var tTop = triggerPos.y != null ? triggerPos.y + 'px' : 'auto';

    var triggerBtn = jQuery('<div style="position:fixed;z-index:9999;padding:6px 14px;border-radius:24px;background:' + COLORS.blue + ';color:#fff;display:flex;align-items:center;justify-content:center;cursor:move;font-size:13px;font-weight:600;box-shadow:0 2px 12px rgba(0,0,0,0.15);white-space:nowrap;user-select:none;right:' + tRight + ';bottom:' + tBottom + ';left:' + tLeft + ';top:' + tTop + ';">(=^ω^=)</div>').appendTo('body');

    // 拖动 + 点击
    (function() {
        var dragStart = false, sx, sy, ox, oy, moved = false;
        triggerBtn.on('mousedown', function(e) {
            dragStart = true; moved = false;
            var o = triggerBtn.offset();
            sx = e.clientX; sy = e.clientY; ox = o.left; oy = o.top;
            triggerBtn.css({ right: 'auto', bottom: 'auto', left: ox + 'px', top: oy + 'px' });
        });
        jQuery(document).on('mousemove', function(e) {
            if (!dragStart) return;
            var dx = e.clientX - sx, dy = e.clientY - sy;
            if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
            triggerBtn.css({ left: (ox + dx) + 'px', top: (oy + dy) + 'px' });
        }).on('mouseup', function() {
            if (!dragStart) return;
            dragStart = false;
            if (moved) {
                var o = triggerBtn.offset();
                try { localStorage.setItem('sl_trigger_pos', JSON.stringify({ x: o.left, y: o.top })); } catch(e) {}
                return;
            }
            // 没拖动 → 算点击
            if (jQuery('#sl_overlay').is(':visible')) {
                jQuery('#sl_overlay').fadeOut(200, function() { miniWin.fadeIn(200, function() { startMiniRefresh(); }); });
            } else if (miniWin.is(':visible')) {
                miniWin.fadeOut(200, function() { stopMiniRefresh(); jQuery('#sl_overlay').fadeIn(200); });
            } else {
                miniWin.fadeIn(200, function() { startMiniRefresh(); });
            }
        });
    })();

    // ── 遮罩 ──
    var overlay = jQuery('<div id="sl_overlay" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;z-index:9998;background:rgba(0,0,0,0.4);"></div>').appendTo('body');
    overlay.on('click', function(e) { if (e.target === overlay[0]) { jQuery('#sl_overlay').fadeOut(200, function() { miniWin.fadeIn(200, function() { startMiniRefresh(); }); }); } });

    // ── 小窗模式（独立浮动，默认隐藏） ──
    var miniPos = { x: null, y: null };
    try {
        var saved = localStorage.getItem('sl_mini_pos');
        if (saved) miniPos = JSON.parse(saved);
    } catch(e) {}
    var miniX = miniPos.x != null ? miniPos.x : 'auto';
    var miniY = miniPos.y != null ? miniPos.y : 'auto';
    var miniRight = (miniX === 'auto' || miniY === 'auto') ? '20px' : 'auto';
    var miniBottom = (miniX === 'auto' || miniY === 'auto') ? '120px' : 'auto';
    var miniLeft = miniX !== 'auto' ? miniX + 'px' : 'auto';
    var miniTop = miniY !== 'auto' ? miniY + 'px' : 'auto';

    var miniWin = jQuery(
        '<div id="sl_mini" style="display:none;position:fixed;z-index:10000;background:' + COLORS.page + ';border-radius:14px;box-shadow:0 4px 24px rgba(0,0,0,0.18);border:1px solid ' + COLORS.line + ';padding:12px 16px;min-width:280px;max-width:420px;font-size:12px;cursor:move;bottom:' + miniBottom + ';right:' + miniRight + ';left:' + miniLeft + ';top:' + miniTop + ';user-select:none;">' +
        '  <div id="sl_mini_header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;font-weight:700;font-size:14px;color:' + COLORS.text + ';">' +
        '    <span>🐱 偷懒小猫</span>' +
        '    <div style="display:flex;gap:6px;">' +
        '      <button id="sl_mini_expand" style="' + BUTTON_STYLE + 'background:transparent;color:' + COLORS.sub + ';border:1px solid ' + COLORS.line + ';font-size:11px;">🔧 展开</button>' +
        '      <span id="sl_mini_close" style="cursor:pointer;color:' + COLORS.mute + ';font-size:16px;line-height:1;">✕</span>' +
        '    </div>' +
        '  </div>' +
        '  <div id="sl_mini_body" style="color:' + COLORS.sub + ';line-height:1.6;">' +
        '    <div style="margin-bottom:4px;">👤 <span id="sl_mini_char">--</span></div>' +
        '    <div style="margin-bottom:4px;">📊 <span id="sl_mini_status">--</span></div>' +
        '    <div style="margin-bottom:4px;">📋 档案：<span id="sl_mini_profile">--</span></div>' +
        '    <div style="margin-bottom:8px;">📥 排队：<span id="sl_mini_queue">0</span></div>' +
        '  </div>' +
        '  <div style="display:flex;gap:6px;align-items:center;">' +
        '    <select id="sl_mini_auto" style="padding:4px 8px;border-radius:6px;border:1px solid ' + COLORS.line + ';font-size:11px;background:' + COLORS.page + ';color:' + COLORS.text + ';cursor:pointer;"><option value="1"' + (settings.autoGen === 1 ? ' selected' : '') + '>自动</option><option value="0"' + (settings.autoGen !== 1 ? ' selected' : '') + '>手动</option></select>' +
        '    <button id="sl_mini_gen" style="' + BUTTON_STYLE + 'background:' + COLORS.orange + ';color:#fff;font-size:11px;">⚡ 生图</button>' +
        '    <button id="sl_mini_gen_all" style="' + BUTTON_STYLE + 'background:' + COLORS.blue + ';color:#fff;font-size:11px;">📥 一键排图</button>' +
        '  </div>' +
        '</div>'
    ).appendTo('body');

    // 小窗拖动逻辑
    (function setupMiniDrag() {
        var dragging = false, startX, startY, origLeft, origTop;
        var header = jQuery('#sl_mini_header');
        header.on('mousedown', function(e) {
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'SPAN') return;
            dragging = true;
            var offset = miniWin.offset();
            startX = e.clientX; startY = e.clientY;
            origLeft = offset.left; origTop = offset.top;
            miniWin.css({ right: 'auto', bottom: 'auto', left: origLeft + 'px', top: origTop + 'px' });
            header.css('cursor', 'grabbing');
        });
        jQuery(document).on('mousemove', function(e) {
            if (!dragging) return;
            var dx = e.clientX - startX, dy = e.clientY - startY;
            miniWin.css({ left: (origLeft + dx) + 'px', top: (origTop + dy) + 'px' });
        }).on('mouseup', function() {
            if (dragging) {
                dragging = false;
                header.css('cursor', 'move');
                var pos = miniWin.offset();
                try { localStorage.setItem('sl_mini_pos', JSON.stringify({ x: pos.left, y: pos.top })); } catch(e) {}
            }
        });
    })();

    // 小窗刷新状态定时器
    var miniRefreshTimer = null;
    function startMiniRefresh() {
        if (miniRefreshTimer) return;
        miniRefreshTimer = setInterval(refreshMiniStatus, 2000);
        refreshMiniStatus();
    }
    function stopMiniRefresh() {
        if (miniRefreshTimer) { clearInterval(miniRefreshTimer); miniRefreshTimer = null; }
    }
    function refreshMiniStatus() {
        if (!miniWin.is(':visible')) return;
        jQuery('#sl_mini_char').text(getCharacterName() || '--');
        var s = getScannerStatus();
        var map = { 'off': '已关闭', 'idle': '空闲', 'waiting_body': '等待正文中...', 'waiting_end': '已收到正文，等待AI回复', 'scanning': '分析中...' };
        jQuery('#sl_mini_status').text(map[s] || s);
        jQuery('#sl_mini_profile').text(hasCastCache() ? '✅' : '❌');
        jQuery('#sl_mini_queue').text(getQueueLength());
    }

    // ── 主面板（960px, 加大圆角） ──
    var modalPos = { x: null, y: null };
    try {
        var saved = localStorage.getItem('sl_modal_pos');
        if (saved) modalPos = JSON.parse(saved);
    } catch(e) {}
    var mLeft = modalPos.x != null ? modalPos.x + 'px' : '50%';
    var mTop = modalPos.y != null ? modalPos.y + 'px' : '50%';
    var mTrans = modalPos.x != null && modalPos.y != null ? 'none' : 'translate(-50%,-50%)';

    var modal = jQuery(
        '<div style="position:fixed;z-index:9999;width:960px;max-width:96vw;max-height:92vh;border-radius:18px;overflow:hidden;border:1px solid ' + COLORS.line + ';display:flex;flex-direction:column;background:' + COLORS.page + ';box-shadow:0 8px 40px rgba(0,0,0,0.18);left:' + mLeft + ';top:' + mTop + ';transform:' + mTrans + ';"></div>'
    ).appendTo(overlay);

    // ── 头部（渐变背景） ──
    modal.append(
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:2px solid ' + COLORS.blue + ';background:linear-gradient(135deg,' + COLORS.page + ' 0%,' + COLORS.card + ' 100%);min-height:52px;border-radius:18px 18px 0 0;flex-shrink:0;">' +
        '  <span style="font-size:16px;font-weight:700;color:' + COLORS.text + ';">🐱 自定义的偷懒小猫生图工具 v1.1.0</span>' +
        '  <div style="display:flex;align-items:center;gap:8px;">' +
        '    <button id="sl_btn_log" style="' + BUTTON_STYLE + 'background:transparent;color:' + COLORS.sub + ';border:1px solid ' + COLORS.line + ';font-size:13px;" title="查看日志喵~">📋</button>' +
        '    <button id="sl_btn_mini" style="' + BUTTON_STYLE + 'background:transparent;color:' + COLORS.sub + ';border:1px solid ' + COLORS.line + ';font-size:13px;" title="切换到小窗模式">📱</button>' +
        '    <span id="sl_close_btn" style="cursor:pointer;font-size:20px;color:' + COLORS.mute + ';line-height:1;transition:all .15s;width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:50%;" title="关闭面板喵~">✕</span>' +
        '  </div>' +
        '</div>'
    );

    // ── Tab 栏（顶部横排，加大） ──
    modal.append(
        '<div style="display:flex;gap:0;padding:0 20px;background:' + COLORS.card + ';border-bottom:1px solid ' + COLORS.line + ';min-height:48px;align-items:flex-end;overflow-x:auto;flex-shrink:0;">' +
        '  <button class="sl_tb" data-t="1" style="padding:12px 24px;border:none;border-radius:12px 12px 0 0;cursor:pointer;font-size:13px;font-weight:600;background:' + COLORS.blue + ';color:#fff;transition:all .2s;margin-bottom:-1px;">⚙️ 通用</button>' +
        '  <button class="sl_tb" data-t="2" style="padding:12px 24px;border:none;border-radius:12px 12px 0 0;cursor:pointer;font-size:13px;font-weight:600;background:transparent;color:' + COLORS.sub + ';transition:all .2s;margin-bottom:-1px;">🧠 辅助LLM</button>' +
        '  <button class="sl_tb" data-t="3" style="padding:12px 24px;border:none;border-radius:12px 12px 0 0;cursor:pointer;font-size:13px;font-weight:600;background:transparent;color:' + COLORS.sub + ';transition:all .2s;margin-bottom:-1px;">🎨 画风预设</button>' +
        '  <button class="sl_tb" data-t="4" style="padding:12px 24px;border:none;border-radius:12px 12px 0 0;cursor:pointer;font-size:13px;font-weight:600;background:transparent;color:' + COLORS.sub + ';transition:all .2s;margin-bottom:-1px;">🔧 ComfyUI</button>' +
        '  <button class="sl_tb" data-t="5" style="padding:12px 24px;border:none;border-radius:12px 12px 0 0;cursor:pointer;font-size:13px;font-weight:600;background:transparent;color:' + COLORS.sub + ';transition:all .2s;margin-bottom:-1px;">📋 档案</button>' +
        '  <button class="sl_tb" data-t="6" style="padding:12px 24px;border:none;border-radius:12px 12px 0 0;cursor:pointer;font-size:13px;font-weight:600;background:transparent;color:' + COLORS.sub + ';transition:all .2s;margin-bottom:-1px;">🖼️ 图库</button>' +
        '</div>'
    );

    // ── 内容区 ──
    modal.append('<div id="sl_body" style="flex:1;overflow-y:auto;padding:20px 24px;"></div>');

    // ── 底部 ──
    modal.append(
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 20px;border-top:2px solid ' + COLORS.line + ';background:' + COLORS.page + ';">' +
        '  <span style="font-size:10px;color:' + COLORS.mute + ';">喵~ v1.1.0 (｡>ω<｡)</span>' +
        '  <div style="display:flex;gap:8px;">' +
        '    <button id="sl_btn_secondary" style="' + BUTTON_STYLE + 'background:' + COLORS.page + ';color:' + COLORS.blue + ';border:1px solid ' + COLORS.blue + ';">💾 保存设置喵~</button>' +
        '    <button id="sl_btn_primary" style="' + BUTTON_STYLE + 'background:' + COLORS.blue + ';color:#fff;">生成</button>' +
        '  </div>' +
        '</div>'
    );

    // ══ Tab 内容函数 ══

    function tabGeneral() {
        var h = '';
        // 开关
        h += '<label style="display:flex;align-items:center;gap:10px;padding:12px 16px;cursor:pointer;font-size:13px;color:' + COLORS.text + ';background:' + COLORS.card + ';border-radius:12px;margin-bottom:16px;">';
        h += '<input type="checkbox" id="sl_cb_pluginOn"' + (settings.pluginOn !== false ? ' checked' : '') + ' style="accent-color:' + COLORS.blue + ';width:18px;height:18px;">';
        h += '<div><div style="font-weight:600;">🔌 启用偷懒小猫</div><div style="font-size:11px;color:' + COLORS.sub + ';margin-top:3px;">关掉后小猫就睡觉了喵~ 不扫描不渲染，已有图片不会丢 (｡•̀ᴗ-)✧</div></div>';
        h += '</label>';
        // 公告栏
        h += '<div id="sl_announce" style="background:' + COLORS.card + ';border-left:3px solid ' + COLORS.blue + ';border-radius:10px;padding:10px 14px;margin-bottom:16px;display:none;"></div>';
        // 当前角色卡
        h += '<div style="font-size:12px;font-weight:700;color:' + COLORS.sub + ';margin-bottom:6px;">👤 当前角色卡</div>';
        h += '<div style="background:' + COLORS.card + ';border-radius:10px;padding:10px 14px;margin-bottom:16px;">';
        h += '<span style="font-size:14px;color:' + COLORS.text + ';">' + escapeHtml(getCharacterName() || '喵？还没进入聊天 (｡•́︿•̀｡)') + '</span>';
        h += '</div>';
        // 增强文本主题
        h += '<div style="margin-bottom:16px;">';
        h += '<div style="font-size:12px;font-weight:700;color:' + COLORS.sub + ';margin-bottom:6px;">🎨 增强文本主题</div>';
        var themes = { default:'📄 默认', book:'📜 书卷', minimal:'◻️ 简洁', dark:'🌙 黑夜', cat:'🐾 小猫' };
        h += '<div style="display:flex;gap:6px;flex-wrap:wrap;">';
        for (var tk in themes) {
            h += '<span class="sl_theme_opt" data-t="' + tk + '" style="display:inline-block;padding:5px 12px;border-radius:8px;cursor:pointer;font-size:11px;font-weight:600;background:' + (settings.enhancedTheme === tk ? COLORS.blue : COLORS.card) + ';color:' + (settings.enhancedTheme === tk ? '#fff' : COLORS.text) + ';border:1px solid ' + (settings.enhancedTheme === tk ? COLORS.blue : COLORS.line) + ';transition:.2s;">' + themes[tk] + '</span>';
        }
        h += '</div></div>';
        // 一键生图
        h += '<div style="margin-bottom:16px;">';
        h += '<button id="sl_btn_gen_all" style="' + BUTTON_STYLE + 'background:' + COLORS.orange + ';color:#fff;">⚡ 一键生图（未生成图片一起排上）</button>';
        h += '</div>';
        // 清除缓存
        h += '<div style="padding-top:16px;border-top:1px solid ' + COLORS.line + ';">';
        h += '<button id="sl_btn_clear_all" style="' + BUTTON_STYLE + 'background:' + COLORS.red + ';color:#fff;">⚠️ 清除全部缓存喵~</button>';
        h += '<div style="font-size:10px;color:' + COLORS.mute + ';margin-top:6px;">清空后一切归零喵~ 需要重新配置 API 等 (｡•́︿•̀｡)</div>';
        h += '</div>';
        return h;
    }

    function tabAux() {
        var h = '';
        // 模型提供商
        h += '<div style="margin-bottom:14px;"><span style="font-size:11px;color:' + COLORS.sub + ';display:block;margin-bottom:4px;">🤖 模型提供商</span><select id="sl_aux_provider" style="' + INPUT_STYLE + 'min-height:36px;"><option value="deepseek"' + (settings.auxProvider !== 'gemini' ? ' selected' : '') + '>DeepSeek (OpenAI 兼容)</option><option value="gemini"' + (settings.auxProvider === 'gemini' ? ' selected' : '') + '>Gemini (OpenAI 兼容中转)</option></select></div>';
        h += '<div style="margin-bottom:14px;"><span style="font-size:11px;color:' + COLORS.sub + ';display:block;margin-bottom:4px;">📍 API 地址</span><input id="sl_in_auxUrl" type="text" value="' + escapeHtml(settings.auxUrl || '') + '" style="' + INPUT_STYLE + '" placeholder="https://api.deepseek.com/v1"></div>';
        h += '<div style="margin-bottom:14px;"><span style="font-size:11px;color:' + COLORS.sub + ';display:block;margin-bottom:4px;">🔑 API Key</span><input id="sl_in_auxKey" type="password" value="' + escapeHtml(settings.auxKey || '') + '" style="' + INPUT_STYLE + '" placeholder="sk-..."></div>';
        h += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;"><button id="sl_aux_connect" style="' + BUTTON_STYLE + 'background:' + COLORS.blue + ';color:#fff;">🔗 连接并拉取模型喵~</button><span id="sl_aux_st" style="font-size:12px;color:' + COLORS.sub + ';"></span></div>';
        h += '<div style="margin-bottom:12px;"><span style="font-size:11px;color:' + COLORS.sub + ';display:block;margin-bottom:4px;">📊 管线模型（Flash — 每轮分析喵~）</span><select id="sl_in_auxModel" style="' + INPUT_STYLE + 'min-height:36px;" disabled><option>请先连接 API 喵~</option></select></div>';
        h += '<div style="margin-bottom:16px;"><span style="font-size:11px;color:' + COLORS.sub + ';display:block;margin-bottom:4px;">📝 档案提取模型（Pro — 每张卡只跑一次喵~）</span><select id="sl_in_profileModel" style="' + INPUT_STYLE + 'min-height:36px;" disabled><option>请先连接 API 喵~</option></select></div>';
        h += '<div style="display:flex;align-items:center;gap:10px;margin-top:4px;"><button id="sl_ta" style="' + BUTTON_STYLE + 'background:' + COLORS.blue + ';color:#fff;" disabled>🧪 测试对话喵~</button><span style="font-size:11px;color:' + COLORS.mute + ';">发条消息看看 API 还能不能跑喵~</span></div>';
        h += '<div id="sl_aux_result" style="margin-top:10px;padding:10px 12px;border-radius:10px;background:' + COLORS.card + ';font-size:12px;color:' + COLORS.sub + ';display:none;"></div>';
        return h;
    }

    function tabStyle() {
        var h = '';
        // 模式切换
        h += '<div style="margin-bottom:16px;">';
        h += '<div style="font-size:12px;font-weight:700;color:' + COLORS.sub + ';margin-bottom:8px;">📖 生成模式</div>';
        h += '<div style="display:flex;gap:8px;">';
        var isNar = settings.storyMode === 'narrative';
        var isComic = settings.storyMode === 'comic';
        h += '<label style="flex:1;display:flex;align-items:center;gap:8px;padding:10px 14px;cursor:pointer;font-size:13px;background:' + (isNar ? COLORS.blue : COLORS.card) + ';border-radius:10px;color:' + (isNar ? '#fff' : COLORS.text) + ';">';
        h += '<input type="radio" name="sl_story_mode" value="narrative"' + (isNar ? ' checked' : '') + ' style="accent-color:' + COLORS.blue + ';">';
        h += '<div><div style="font-weight:600;">📖 叙事模式</div><div style="font-size:10px;opacity:0.8;">原文完整保留 · 偶尔插图</div></div>';
        h += '</label>';
        h += '<label style="flex:1;display:flex;align-items:center;gap:8px;padding:10px 14px;cursor:pointer;font-size:13px;background:' + (isComic ? COLORS.blue : COLORS.card) + ';border-radius:10px;color:' + (isComic ? '#fff' : COLORS.text) + ';">';
        h += '<input type="radio" name="sl_story_mode" value="comic"' + (isComic ? ' checked' : '') + ' style="accent-color:' + COLORS.blue + ';">';
        h += '<div><div style="font-weight:600;">📱 漫画模式</div><div style="font-size:10px;opacity:0.8;">一段一图 · 对话气泡</div></div>';
        h += '</label>';
        h += '</div></div>';
        // 画风预设
        h += '<div style="margin-top:16px;padding-top:12px;border-top:1px solid ' + COLORS.line + ';">';
        h += '<div style="font-size:11px;font-weight:700;color:' + COLORS.sub + ';margin-bottom:8px;">🎨 画风预设</div>';
        h += '<select id="sl_style_preset" style="width:100%;padding:8px 12px;border-radius:8px;border:1px solid ' + COLORS.line + ';font-size:12px;background:' + COLORS.page + ';color:' + COLORS.text + ';">';
        h += '<optgroup label="写实摄影">';
        h += '<option value=""' + (settings.stylePreset === '' ? ' selected' : '') + '>无（默认真人写实）</option>';
        h += '<option value="柯达金200胶片质感，暖黄色调，细腻胶片颗粒，复古写实质感"' + (settings.stylePreset === '柯达金200胶片质感，暖黄色调，细腻胶片颗粒，复古写实质感' ? ' selected' : '') + '>胶片质感写真</option>';
        h += '</optgroup>';
        h += '<optgroup label="传统手绘艺术">';
        h += '<option value="水墨写意画，宣纸质感，墨色浓淡晕染，大面积留白，东方写意意境"' + (settings.stylePreset === '水墨写意画，宣纸质感，墨色浓淡晕染，大面积留白，东方写意意境' ? ' selected' : '') + '>水墨写意</option>';
        h += '<option value="水彩画风格，半透明叠色水痕，水彩纸纹理，自然晕染过渡"' + (settings.stylePreset === '水彩画风格，半透明叠色水痕，水彩纸纹理，自然晕染过渡' ? ' selected' : '') + '>水彩晕染</option>';
        h += '<option value="厚涂油画风格，刮刀笔触肌理，亚麻布纹理，厚重色彩堆叠"' + (settings.stylePreset === '厚涂油画风格，刮刀笔触肌理，亚麻布纹理，厚重色彩堆叠' ? ' selected' : '') + '>油画厚涂</option>';
        h += '<option value="铅笔素描风格，细腻排线塑造，黑白灰层次分明，素描纸质感，手绘质感"' + (settings.stylePreset === '铅笔素描风格，细腻排线塑造，黑白灰层次分明，素描纸质感，手绘质感' ? ' selected' : '') + '>铅笔素描</option>';
        h += '</optgroup>';
        h += '<optgroup label="二次元动漫">';
        h += '<option value="Anime 赛璐璐：赛璐珞胶片质感，清晰黑色轮廓线，纯色平涂色块，硬边分层阴影"' + (settings.stylePreset === 'Anime 赛璐璐：赛璐珞胶片质感，清晰黑色轮廓线，纯色平涂色块，硬边分层阴影' ? ' selected' : '') + '>赛璐璐平涂</option>';
        h += '<option value="Anime 日系轻小说：anime style，2D，赛璐璐上色，细腻线稿，柔光，精致眼部高光，通透清新"' + (settings.stylePreset === 'Anime 日系轻小说：anime style，2D，赛璐璐上色，细腻线稿，柔光，精致眼部高光，通透清新' ? ' selected' : '') + '>日系轻小说插画</option>';
        h += '<option value="Anime 日本动画：anime style，2D，cel shading，vibrant colors，clean lineart，anime key visual"' + (settings.stylePreset === 'Anime 日本动画：anime style，2D，cel shading，vibrant colors，clean lineart，anime key visual' ? ' selected' : '') + '>日本动漫（综合）</option>';
        h += '<option value="Anime 精致平涂：日本アニメスタイル，セル画調，くっきり黒線，フラット彩色，鮮やかな色彩，ベタ塗り色面，クリーンな線画"' + (settings.stylePreset === 'Anime 精致平涂：日本アニメスタイル，セル画調，くっきり黒線，フラット彩色，鮮やかな色彩，ベタ塗り色面，クリーンな線画' ? ' selected' : '') + '>二次元精致</option>';
        h += '<option value="Anime 立体精致：日本アニメスタイル，厚塗り×セル画混合，立体感ある陰影，柔らかな明暗グラデーション，繊細な線画，透明感"' + (settings.stylePreset === 'Anime 立体精致：日本アニメスタイル，厚塗り×セル画混合，立体感ある陰影，柔らかな明暗グラデーション，繊細な線画，透明感' ? ' selected' : '') + '>二次元立体精致</option>';
        h += '<option value="monochrome manga style，black and white，screentone shading，ink lines，hand-drawn comic，speed lines，crosshatch，黑白漫画"' + (settings.stylePreset === 'monochrome manga style，black and white，screentone shading，ink lines，hand-drawn comic，speed lines，crosshatch，黑白漫画' ? ' selected' : '') + '>日本黑白漫画</option>';
        h += '<option value="Anime Q版萌系：大头小身比例，圆润简洁线条，扁平化可爱造型，明快纯色块"' + (settings.stylePreset === 'Anime Q版萌系：大头小身比例，圆润简洁线条，扁平化可爱造型，明快纯色块' ? ' selected' : '') + '>Q版萌系</option>';
        h += '</optgroup>';
        h += '<optgroup label="跨界与渲染">';
        h += '<option value="Anime 2.5D立体：保留赛璐璐平涂色块边界，硬边分层阴影，低多边形立体造型"' + (settings.stylePreset === 'Anime 2.5D立体：保留赛璐璐平涂色块边界，硬边分层阴影，低多边形立体造型' ? ' selected' : '') + '>2.5D立体插画</option>';
        h += '<option value="国风厚涂插画，工笔白描线稿，东方人物骨相，典雅国风配色，水墨质感厚涂"' + (settings.stylePreset === '国风厚涂插画，工笔白描线稿，东方人物骨相，典雅国风配色，水墨质感厚涂' ? ' selected' : '') + '>国风厚涂</option>';
        h += '<option value="皮克斯卡通3D风格，柔和全局光照，次表面散射质感，哑光黏土质感，圆润卡通造型"' + (settings.stylePreset === '皮克斯卡通3D风格，柔和全局光照，次表面散射质感，哑光黏土质感，圆润卡通造型' ? ' selected' : '') + '>皮克斯卡通3D</option>';
        h += '<option value="写实3D渲染，PBR物理级材质，全局光照，真实织物与皮肤纹理，超写实质感"' + (settings.stylePreset === '写实3D渲染，PBR物理级材质，全局光照，真实织物与皮肤纹理，超写实质感' ? ' selected' : '') + '>PBR写实3D</option>';
        h += '</optgroup>';
        h += '<optgroup label="复古动画">';
        h += '<option value="Anime 昭和赛璐璐：粗黑硬朗轮廓线，复古低饱和配色，大块平涂填色，轻微胶片颗粒"' + (settings.stylePreset === 'Anime 昭和赛璐璐：粗黑硬朗轮廓线，复古低饱和配色，大块平涂填色，轻微胶片颗粒' ? ' selected' : '') + '>昭和复古赛璐璐</option>';
        h += '<option value="Anime 90年代少年漫：硬朗墨线，网点纸阴影质感，写实人物比例，手绘漫画质感"' + (settings.stylePreset === 'Anime 90年代少年漫：硬朗墨线，网点纸阴影质感，写实人物比例，手绘漫画质感' ? ' selected' : '') + '>90年代少年漫画</option>';
        h += '<option value="Anime 90年代魔法少女：大眼睛精致高光，柔和流畅线条，明亮复古配色，赛璐璐平涂"' + (settings.stylePreset === 'Anime 90年代魔法少女：大眼睛精致高光，柔和流畅线条，明亮复古配色，赛璐璐平涂' ? ' selected' : '') + '>90年代魔法少女动画</option>';
        h += '</optgroup>';
        h += '</select>';
        h += '<div style="font-size:10px;color:' + COLORS.mute + ';margin-top:4px;">💡 只推荐使用原版 Z-Image Turbo 模型，使用 LoRA 可能导致异常。</div>';
        h += '</div>';
        h += '<div style="margin-top:12px;padding-top:12px;border-top:1px solid ' + COLORS.line + ';">';
        h += '<div style="display:flex;align-items:center;justify-content:space-between;">';
        h += '<span style="font-size:11px;font-weight:700;color:' + COLORS.sub + ';">🔞 NSFW 强化</span>';
        h += '<span id="sl_nsfw_btn" style="display:inline-block;padding:4px 12px;border-radius:12px;font-size:11px;font-weight:600;cursor:pointer;background:' + (settings.nsfwEnhance ? COLORS.blue : COLORS.mute) + ';color:#fff;user-select:none;transition:.2s;">' + (settings.nsfwEnhance ? '✔ 已开启' : '✖ 已关闭') + '</span>';
        h += '</div>';
        h += '<div style="font-size:10px;color:' + COLORS.mute + ';margin-top:4px;">开启后生图提示词会更强调身体曲线、肌肤质感、诱惑表情等色气表现</div>';
        h += '</div>';
        return h;
    }

    function tabWorkflow() {
        var h = '';
        h += '<div style="margin-bottom:12px;"><span style="font-size:10px;color:' + COLORS.sub + ';display:block;margin-bottom:3px;">🖥️ ComfyUI 地址</span><input id="sl_in_cUrl" type="text" value="' + escapeHtml(settings.cUrl) + '" style="' + INPUT_STYLE + '"></div>';
        h += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;"><button id="sl_tc" style="' + BUTTON_STYLE + 'background:' + COLORS.blue + ';color:#fff;">🧪 测试连接喵~</button> <span id="sl_cst" style="font-size:12px;"></span></div>';
        h += '<div style="padding-top:4px;border-top:1px solid ' + COLORS.line + ';"></div>';
        h += '<textarea id="sl_wf" rows="7" style="' + INPUT_STYLE + 'background:' + COLORS.input + ';resize:vertical;font-family:monospace;font-size:12px;line-height:1.5;margin-bottom:12px;margin-top:12px;" placeholder="把 ComfyUI 导出的 JSON 粘贴到这里喵~">' + escapeHtml(settings.cWf) + '</textarea>';
        h += '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center;">';
        h += '<button id="sl_import" style="' + BUTTON_STYLE + 'background:' + COLORS.blue + ';color:#fff;">📂 导入文件</button>';
        h += '<button id="sl_graph" style="' + BUTTON_STYLE + 'background:' + COLORS.page + ';color:' + COLORS.blue + ';border:1px solid ' + COLORS.blue + ';">🔍 节点图</button>';
        h += '<span style="flex:1;"></span>';
        h += '<select id="sl_wf_sel" style="padding:7px 10px;border-radius:8px;border:1px solid ' + COLORS.line + ';background:' + COLORS.page + ';color:' + COLORS.text + ';font-size:12px;min-width:130px;"><option>加载中喵...</option></select>';
        h += '<button id="sl_wfload" style="' + BUTTON_STYLE + ';background:' + COLORS.page + ';color:' + COLORS.blue + ';border:1px solid ' + COLORS.blue + ';">📂 加载</button>';
        h += '<button id="sl_wfsave" style="' + BUTTON_STYLE + 'background:' + COLORS.blue + ';color:#fff;">💾 保存</button>';
        h += '<button id="sl_wfdel" style="' + BUTTON_STYLE + 'background:' + COLORS.red + ';color:#fff;">🗑 删除</button>';
        h += '</div><div id="sl_model_panel" style="margin-bottom:12px;"></div>';
        h += '<div style="font-size:11px;font-weight:700;color:' + COLORS.sub + ';margin-bottom:8px;margin-top:16px;">⚡ 快速参数喵~</div>';
        h += '<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;margin-bottom:12px;">';
        h += '<div><span style="font-size:10px;color:' + COLORS.mute + ';display:block;margin-bottom:3px;">📏 宽度</span><input id="sl_md_w" type="number" style="' + INPUT_STYLE + 'background:' + COLORS.input + ';width:76px;" placeholder="不变"></div>';
        h += '<div><span style="font-size:10px;color:' + COLORS.mute + ';display:block;margin-bottom:3px;">📐 高度</span><input id="sl_md_h" type="number" style="' + INPUT_STYLE + 'background:' + COLORS.input + ';width:76px;" placeholder="不变"></div>';
        h += '<div><span style="font-size:10px;color:' + COLORS.mute + ';display:block;margin-bottom:3px;">🪜 步数</span><input id="sl_md_steps" type="number" style="' + INPUT_STYLE + 'background:' + COLORS.input + ';width:68px;" placeholder="不变"></div>';
        h += '<div><span style="font-size:10px;color:' + COLORS.mute + ';display:block;margin-bottom:3px;">CFG</span><input id="sl_md_cfg" type="number" step="0.1" style="' + INPUT_STYLE + 'background:' + COLORS.input + ';width:68px;" placeholder="不变"></div>';
        h += '<div><span style="font-size:10px;color:' + COLORS.mute + ';display:block;margin-bottom:3px;">🎲 种子</span><input id="sl_md_seed" type="number" value="-1" style="' + INPUT_STYLE + 'background:' + COLORS.input + ';width:84px;"></div>';
        h += '</div><div id="sl_preview" style="border-radius:12px;overflow:hidden;margin-bottom:12px;"></div><span id="sl_qst" style="font-size:12px;"></span>';
        h += '<div id="sl_wfsavename" style="display:none;margin-top:8px;"><div style="display:flex;gap:8px;"><input id="sl_wfname" style="flex:1;' + INPUT_STYLE + '" placeholder="我的工作流喵.json 🐾"><button id="sl_wfok" style="' + BUTTON_STYLE + 'background:' + COLORS.blue + ';color:#fff;">好哒喵~ ✓</button><button id="sl_wfcancel" style="' + BUTTON_STYLE + 'background:' + COLORS.page + ';color:' + COLORS.blue + ';border:1px solid ' + COLORS.blue + ';">算了喵~ ✕</button></div></div>';
        h += '<input type="file" id="sl_file_picker" accept=".json" style="display:none;">';
        return h;
    }

    function tabGallery() {
        var h = '';
        h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">';
        h += '<div style="font-size:13px;font-weight:700;color:' + COLORS.text + ';">🖼️ 所有生图记录</div>';
        h += '<button id="sl_btn_clear_imgs" style="' + BUTTON_STYLE + 'background:' + COLORS.red + ';color:#fff;">🗑 清空全部图片</button>';
        h += '</div>';

        var entries = [];
        try {
            var raw = localStorage.getItem('slimg_cache');
            if (raw) {
                var cache = JSON.parse(raw);
                for (var prompt in cache) {
                    if (cache[prompt] && !cache[prompt].startsWith('data:')) {
                        entries.push({ prompt: prompt, url: cache[prompt] });
                    }
                }
            }
        } catch (e) {}

        if (!entries.length) {
            h += '<div style="text-align:center;padding:40px 20px;color:' + COLORS.mute + ';font-size:13px;">🐱 还没有生过图喵~ 去聊天里试试吧 (｡•̀ᴗ-)✧</div>';
        } else {
            h += '<div style="font-size:11px;color:' + COLORS.sub + ';margin-bottom:8px;">共 ' + entries.length + ' 张</div>';
            h += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;">';
            for (var i = 0; i < entries.length; i++) {
                var entry = entries[i];
                var shortPrompt = entry.prompt.length > 80 ? entry.prompt.slice(0, 77) + '…' : entry.prompt;
                h += '<div style="background:' + COLORS.card + ';border-radius:10px;overflow:hidden;border:1px solid ' + COLORS.line + ';">';
                h += '<img src="' + escapeHtml(entry.url) + '" style="width:100%;aspect-ratio:1;object-fit:cover;display:block;" loading="lazy">';
                h += '<div style="padding:8px 10px;">';
                h += '<div style="font-size:10px;color:' + COLORS.sub + ';word-break:break-all;line-height:1.35;font-family:Consolas,monospace;" title="' + escapeHtml(entry.prompt) + '">' + escapeHtml(shortPrompt) + '</div>';
                h += '<div style="font-size:10px;color:' + COLORS.mute + ';margin-top:4px;">#' + (i + 1) + '</div>';
                h += '</div></div>';
            }
            h += '</div>';
        }
        return h;
    }

    function tabProfiles() {
        var pf = getProfiles();
        if (!pf || !pf.charName) return '<div style="font-size:13px;color:' + COLORS.sub + ';padding:16px;text-align:center;">🐱 还没进入聊天喵~ 先去聊天窗口吧 (｡•̀ᴗ-)✧</div>';

        var cast = pf.root[pf.charName].cast || {};
        var dynamics = pf.chat.dynamics || {};
        var npcs = pf.chat.npcs || {};
        var userProfileText = pf.root[pf.charName].userProfile || '';
        var h = '';

        // 角色名 + 扫描按钮
        h += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">';
        h += '<span style="font-size:15px;font-weight:700;color:' + COLORS.text + ';">👤 ' + escapeHtml(pf.charName) + '</span>';
        h += '<button id="sl_btn_scan_cast" style="' + BUTTON_STYLE + 'background:' + COLORS.blue + ';color:#fff;">🔍 扫描角色卡档案喵~</button>';
        h += '<span id="sl_scan_status" style="font-size:11px;color:' + COLORS.sub + ';">' + (Object.keys(cast).length ? '✓ 已扫描喵~ (' + Object.keys(cast).length + '角色)' : (pf.root[pf.charName].meta?.cardType === '世界观卡' ? '✓ 已扫描喵~ (世界观卡' + (pf.root[pf.charName].meta?.coreChar ? '·核心:' + escapeHtml(pf.root[pf.charName].meta.coreChar) : '') + ')' : '')) + '</span>';
        h += '</div>';

        // 角色卡档案
        h += '<div style="font-size:12px;font-weight:700;color:' + COLORS.sub + ';margin-bottom:6px;">📜 角色卡档案（亘古不变）</div>';
        if (Object.keys(cast).length) {
            for (var ck in cast) {
                var cv = cast[ck];
                h += '<div style="background:' + COLORS.card + ';border-radius:10px;padding:10px 14px;margin-bottom:8px;">';
                h += '<div style="font-weight:700;font-size:13px;color:' + COLORS.text + ';margin-bottom:4px;">' + escapeHtml(ck) + '</div>';
                if (cv.static) h += '<div style="font-size:11px;color:' + COLORS.text + ';white-space:pre-wrap;word-break:break-word;">' + escapeHtml(cv.static) + '</div>';
                h += '</div>';
            }
        } else if (pf.root[pf.charName].meta?.cardType === '世界观卡') {
            var coreChar = pf.root[pf.charName].meta?.coreChar || '';
            var styleTag = pf.root[pf.charName].meta?.styleTag || '';
            if (coreChar) {
                h += '<div style="background:' + COLORS.card + ';border-radius:10px;padding:10px 14px;margin-bottom:8px;">';
                h += '<div style="font-size:12px;color:' + COLORS.sub + ';">🌐 此卡为世界观卡/场景卡（核心角色：' + escapeHtml(coreChar) + '）</div>';
                h += '<div style="font-size:11px;color:' + COLORS.mute + ';margin-top:4px;">世界书中有具体角色已提取；其余出场角色由对话生成</div>';
                if (styleTag) h += '<div style="font-size:10px;color:' + COLORS.blue + ';margin-top:2px;">🎨 ' + escapeHtml(styleTag) + '</div>';
                h += '</div>';
            } else {
                h += '<div style="background:' + COLORS.card + ';border-radius:10px;padding:10px 14px;margin-bottom:8px;">';
                h += '<div style="font-size:12px;color:' + COLORS.sub + ';">🌐 此卡为世界观卡/场景卡，无固定角色信息</div>';
                h += '<div style="font-size:11px;color:' + COLORS.mute + ';margin-top:4px;">出场角色由对话生成，首次出现时自动赋予外貌骨架</div>';
                if (styleTag) h += '<div style="font-size:10px;color:' + COLORS.blue + ';margin-top:2px;">🎨 ' + escapeHtml(styleTag) + '</div>';
                h += '</div>';
            }
        } else {
            h += '<div style="font-size:12px;color:' + COLORS.mute + ';padding:6px 0;">还没有扫描喵~ 点上面按钮扫描吧 (｡•̀ᴗ-)✧</div>';
        }

        // User 档案
        h += '<div style="font-size:12px;font-weight:700;color:' + COLORS.sub + ';margin-top:16px;margin-bottom:6px;">👤 User 档案（随角色卡绑定）</div>';
        h += '<div style="background:' + COLORS.card + ';border-radius:10px;padding:10px 14px;margin-bottom:8px;">';
        if (userProfileText) {
            h += '<div style="font-size:11px;color:' + COLORS.text + ';white-space:pre-wrap;word-break:break-word;">' + escapeHtml(userProfileText) + '</div>';
        } else {
            h += '<div style="font-size:12px;color:' + COLORS.mute + ';">扫描角色卡时自动生成喵~ (｡•̀ᴗ-)✧</div>';
        }
        h += '</div>';

        // User 姓名 + 描述
        h += '<div style="font-size:12px;font-weight:700;color:' + COLORS.sub + ';margin-bottom:4px;">📛 User 姓名</div>';
        h += '<input id="sl_in_userName" type="text" value="' + escapeHtml(settings.userName || '') + '" style="' + INPUT_STYLE + 'font-size:12px;margin-bottom:4px;" placeholder="你的 persona 名字是什么喵？（比如：张三）">';
        h += '<div style="font-size:10px;color:' + COLORS.red + ';margin-bottom:10px;">⚠️ 必须和 persona 名一模一样喵~ 不然认不出你 (｡ŏ﹏ŏ)</div>';
        h += '<div style="font-size:12px;font-weight:700;color:' + COLORS.sub + ';margin-bottom:4px;">📝 User 外貌描述</div>';
        h += '<textarea id="sl_in_userDesc" style="' + INPUT_STYLE + 'resize:vertical;min-height:60px;font-size:12px;margin-bottom:8px;" placeholder="选填喵~ 外貌描述会发给 Pro 生成档案。比如：身高180cm，宽厚胸膛... (｡•̀ᴗ-)✧">' + escapeHtml(settings.userDesc || '') + '</textarea>';
        h += '<div style="font-size:10px;color:' + COLORS.mute + ';margin-bottom:16px;">每张角色卡可以有不同的 User 设定喵~ 换卡就换设定 ✨</div>';

        // 聊天档案
        h += '<div style="font-size:12px;font-weight:700;color:' + COLORS.sub + ';margin-bottom:6px;">💬 聊天动态</div>';
        if (Object.keys(dynamics).length) {
            for (var dk in dynamics) {
                if (dynamics[dk]) {
                    h += '<div style="background:' + COLORS.card + ';border-radius:8px;padding:8px 12px;margin-bottom:4px;font-size:12px;">';
                    h += '<span style="font-weight:700;color:' + COLORS.text + ';">' + escapeHtml(dk) + '</span>';
                    h += '<span style="color:' + COLORS.blue + ';margin-left:8px;">' + escapeHtml(dynamics[dk]) + '</span>';
                    h += '</div>';
                }
            }
        } else {
            h += '<div style="font-size:12px;color:' + COLORS.mute + ';padding:4px 0;">还没聊过天喵~ (｡•́︿•̀｡)</div>';
        }
        if (Object.keys(npcs).length) {
            h += '<div style="font-size:12px;font-weight:700;color:' + COLORS.sub + ';margin-top:12px;margin-bottom:6px;">👥 NPC 列表</div>';
            for (var n in npcs) {
                var npc = npcs[n];
                h += '<div style="background:' + COLORS.card + ';border-radius:8px;padding:8px 12px;margin-bottom:4px;">';
                h += '<div style="font-weight:700;font-size:12px;color:' + COLORS.text + ';">' + escapeHtml(n) + ' <span style="font-weight:400;font-size:11px;color:' + COLORS.sub + ';">出现' + (npc.appearances || 1) + '次</span></div>';
                if (npc.static) h += '<div style="font-size:11px;color:' + COLORS.text + ';margin-top:2px;">' + escapeHtml(npc.static) + '</div>';
                if (npc.dynamic) h += '<div style="font-size:11px;color:' + COLORS.blue + ';margin-top:2px;">' + escapeHtml(npc.dynamic) + '</div>';
                h += '</div>';
            }
        }

        // 操作按钮
        h += '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:16px;padding-top:12px;border-top:1px solid ' + COLORS.line + ';">';
        h += '<button id="sl_btn_export_cast" style="' + BUTTON_STYLE + 'background:' + COLORS.blue + ';color:#fff;">📥 导出角色卡档案喵~</button>';
        h += '<button id="sl_btn_export_chat" style="' + BUTTON_STYLE + 'background:' + COLORS.page + ';color:' + COLORS.blue + ';border:1px solid ' + COLORS.blue + ';">📥 导出全部档案喵~</button>';
        h += '<button id="sl_btn_clear_profiles" style="' + BUTTON_STYLE + 'background:' + COLORS.page + ';color:' + COLORS.red + ';border:1px solid ' + COLORS.red + ';">🗑️ 清空聊天动态喵~</button>';
        h += '</div>';
        h += '<div style="margin-top:16px;padding-top:12px;border-top:1px solid ' + COLORS.red + ';">';
        h += '<button id="sl_btn_delete_profile" style="' + BUTTON_STYLE + 'background:' + COLORS.red + ';color:#fff;">⚠️ 删除角色卡档案喵… (´;ω;`)</button>';
        h += '<div style="font-size:10px;color:' + COLORS.mute + ';margin-top:4px;">🐱 偷懒的小猫可还没测出所有 bug 喵…</div>';
        h += '</div>';
        return h;
    }

    // ══ 辅助函数 ══

    function selN(nid, k, list, cur) {
        if (!list || !list.length) return '<input data-nid="' + nid + '" data-key="' + k + '" value="' + escapeHtml(cur || '') + '" style="' + INPUT_STYLE + 'background:' + COLORS.input + ';font-size:12px;" placeholder="手动输入喵~">';
        var o = '<option value="">—</option>';
        for (var x of list) o += '<option value="' + escapeHtml(x) + '"' + (x === cur ? ' selected' : '') + '>' + escapeHtml(x) + '</option>';
        return '<select data-nid="' + nid + '" data-key="' + k + '" style="' + INPUT_STYLE + 'background:' + COLORS.input + ';font-size:12px;">' + o + '</select>';
    }

    function syncParams(wf) {
        try {
            for (var nid in wf) {
                var nd = wf[nid];
                if (!nd || !nd.inputs) continue;
                var cls = nd.class_type || '';
                if (/latent|empty/i.test(cls)) {
                    for (var k in nd.inputs) {
                        var v = nd.inputs[k];
                        if (/width/i.test(k) && !/height/i.test(k)) jQuery('#sl_md_w').val(parseInt(v) || '');
                        if (/height/i.test(k)) jQuery('#sl_md_h').val(parseInt(v) || '');
                    }
                }
                if (/ksampler|sampler\b/i.test(cls) && !/scheduler|schedule|upscale/i.test(cls)) {
                    for (var k in nd.inputs) {
                        var v = nd.inputs[k];
                        if (/steps/i.test(k)) jQuery('#sl_md_steps').val(parseInt(v) || '');
                        if (/^cfg$/i.test(k)) jQuery('#sl_md_cfg').val(parseFloat(v) || '');
                    }
                }
            }
        } catch(e) {}
    }

    function loadModelPanel() {
        try {
            var p = jQuery('#sl_model_panel');
            if (!settings.cWf) { p.html('<span style="color:' + COLORS.mute + ';font-size:12px;">还没有工作流喵~ 先导入 JSON 吧 (｡•́︿•̀｡)</span>'); return; }
            var wf = JSON.parse(settings.cWf);
            var groups = { unet: [], clip: [], vae: [], lora: [] };
            for (var nid in wf) {
                var nd = wf[nid];
                if (!nd || !nd.inputs) continue;
                for (var k in nd.inputs) {
                    var val = nd.inputs[k];
                    if (!val) continue;
                    if (/checkpoint|ckpt_name|unet_name|model_path|gguf_name/.test(k) && /loader|checkpoint/i.test(nd.class_type || '')) groups.unet.push({ nid: nid, k: k, val: val });
                    else if (/clip_name\d*|text_encoder/.test(k)) groups.clip.push({ nid: nid, k: k, val: val });
                    else if (/vae_name/.test(k)) groups.vae.push({ nid: nid, k: k, val: val });
                    else if (/lora_name/.test(k)) groups.lora.push({ nid: nid, k: k, val: val });
                }
            }
            syncParams(wf);
            var h = '';
            var prompts = [];
            for (var nid in wf) {
                var nd = wf[nid];
                if (!nd) continue;
                if (/CLIPTextEncode|TextEncode/i.test(nd.class_type || '')) prompts.push({ nid: nid, title: nd._meta && nd._meta.title || nd.class_type || nid, inputs: nd.inputs || {} });
            }
            if (prompts.length) {
                h += '<div style="margin-bottom:10px;"><div style="font-size:11px;font-weight:700;color:' + COLORS.sub + ';margin-bottom:6px;">💬 提示词</div>';
                for (var pr of prompts) {
                    for (var pk in pr.inputs) {
                        if (/text|prompt|positive|clip_l|t5xxl|clip_g/i.test(pk) && !/negative/i.test(pk)) {
                            var pv = pr.inputs[pk], txt = Array.isArray(pv) ? pv[0] : pv;
                            if (typeof txt !== 'string') txt = '';
                            h += '<div style="margin-bottom:6px;"><input class="sl_wf_prompt" data-nid="' + pr.nid + '" data-key="' + pk + '" value="' + escapeHtml(txt) + '" style="' + INPUT_STYLE + 'background:' + COLORS.input + ';font-size:12px;" placeholder="' + escapeHtml(pr.title) + '"></div>';
                        }
                    }
                }
                h += '</div>';
            }
            function rG(list, cat, label) {
                if (!list.length) return '';
                var seen = {}, out = '', lst = (settings.models || {})[cat] || [];
                for (var u of list) {
                    var lbl = escapeHtml(((wf[u.nid] || {})._meta || {}).title || wf[u.nid] && wf[u.nid].class_type || u.nid) + ' · ' + escapeHtml(u.k);
                    if (seen[lbl]) continue;
                    seen[lbl] = true;
                    var cur = Array.isArray(u.val) ? u.val[0] : u.val;
                    if (typeof cur !== 'string') cur = '';
                    out += '<div style="margin-bottom:4px;">' + selN(u.nid, u.k, lst, cur) + '</div>';
                }
                return '<div style="margin-bottom:8px;"><div style="font-size:11px;font-weight:700;color:' + COLORS.sub + ';margin-bottom:6px;">' + label + '</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 8px;">' + out + '</div></div>';
            }
            h += rG(groups.unet, 'unet', 'UNET');
            h += rG(groups.clip, 'clip', 'CLIP');
            h += rG(groups.vae, 'vae', 'VAE');
            h += rG(groups.lora, 'lora', 'LoRA');
            p.html(h || '<span style="color:' + COLORS.mute + ';font-size:12px;">没有找到可以调的参数喵~ (｡•́︿•̀｡)</span>');
            p.find('[data-nid],.sl_wf_prompt').on('change input', function() {
                try {
                    if (!settings.cWf) return;
                    var nid = jQuery(this).data('nid'), key = jQuery(this).data('key'), val = jQuery(this).val();
                    if (!nid || !key || val === '') return;
                    var wf = JSON.parse(settings.cWf);
                    if (wf[nid] && wf[nid].inputs && wf[nid].inputs[key] !== undefined) {
                        var o = wf[nid].inputs[key];
                        wf[nid].inputs[key] = Array.isArray(o) && o.length === 2 ? [val, o[1]] : val;
                        settings.cWf = JSON.stringify(wf);
                        jQuery('#sl_wf').val(settings.cWf);
                        saveSettings();
                    }
                } catch(e) {}
            });
        } catch(e) { slErr('loadModelPanel:', e.message); }
    }

    function renderGraph() {
        if (!settings.cWf) return;
        try {
            var wf = JSON.parse(settings.cWf);
            var nodes = [], nodeMap = {}, edges = [];
            for (var nid in wf) {
                var nd = wf[nid];
                if (!nd) continue;
                var cls = nd.class_type || '?', clr = COLORS.sub;
                if (/clip.?text.?enc/i.test(cls)) clr = COLORS.blue;
                else if (/loader|checkpoint/i.test(cls)) clr = COLORS.green;
                else if (/sampler/i.test(cls)) clr = COLORS.orange;
                else if (/save|decode|preview/i.test(cls)) clr = '#5e5ce6';
                else if (/latent|empty/i.test(cls)) clr = '#ac8e68';
                nodes.push({ id: nid, title: (nd._meta && nd._meta.title) || cls || nid, cls: cls, clr: clr, inputs: nd.inputs || {} });
                nodeMap[nid] = true;
            }
            for (var nid in wf) {
                var nd = wf[nid];
                if (!nd || !nd.inputs) continue;
                for (var k in nd.inputs) {
                    var v = nd.inputs[k];
                    if (Array.isArray(v) && v.length === 2 && typeof v[0] === 'string' && nodeMap[v[0]]) edges.push({ from: v[0], to: nid });
                }
            }
            var levels = {}, maxLvl = 0;
            function go(id, d) {
                if (levels[id] !== undefined && levels[id] >= d) return;
                levels[id] = d;
                if (d > maxLvl) maxLvl = d;
                for (var e of edges) if (e.from === id) go(e.to, d + 1);
            }
            var roots = nodes.filter(function(nd) { return !edges.some(function(e) { return e.to === nd.id; }); });
            for (var r of roots) go(r.id, 0);
            for (var nd of nodes) { if (levels[nd.id] === undefined) levels[nd.id] = 0; }
            var cGap = 190, rGap = 46, px = 20, py = 16, cols = {};
            for (var n in levels) { var lvl = levels[n]; if (!cols[lvl]) cols[lvl] = []; cols[lvl].push(n); }
            var pos = {};
            for (var l = 0; l <= maxLvl; l++) {
                var cn = (cols[l] || []).sort();
                for (var ri = 0; ri < cn.length; ri++) pos[cn[ri]] = { x: px + l * cGap, y: py + ri * rGap };
            }
            var sw = px + (maxLvl + 1) * cGap + 80, sh = Math.max(py + nodes.length * rGap + 40, 60);
            var svg = '<svg width="' + sw + '" height="' + sh + '" style="display:block;">';
            for (var e of edges) {
                var fp = pos[e.from], tp = pos[e.to];
                if (!fp || !tp) continue;
                var ec = (nodes.find(function(x) { return x.id === e.from; }) || {}).clr || COLORS.line;
                svg += '<line x1="' + (fp.x + 145) + '" y1="' + (fp.y + 14) + '" x2="' + tp.x + '" y2="' + (tp.y + 14) + '" stroke="' + ec + '" stroke-width="1.5" opacity="0.25"/>';
            }
            for (var nd of nodes) {
                var p = pos[nd.id];
                if (!p) continue;
                svg += '<rect id="sl_gr_' + nd.id + '" x="' + p.x + '" y="' + p.y + '" width="145" height="28" rx="8" fill="#f5f5f7" stroke="' + nd.clr + '" stroke-width="1.5" style="cursor:pointer;"/>';
                svg += '<text x="' + (p.x + 10) + '" y="' + (p.y + 19) + '" font-size="10" fill="#1d1d1f" font-weight="600" font-family="system-ui" style="pointer-events:none;">' + escapeHtml(nd.title.slice(0, 22)) + '</text>';
            }
            svg += '</svg>';
            var gov = jQuery('#sl_gov');
            if (!gov.length) {
                jQuery('<div id="sl_gov" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;z-index:10001;background:rgba(0,0,0,0.35);"><div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:90vw;max-width:960px;height:85vh;border-radius:12px;overflow:hidden;border:1px solid ' + COLORS.line + ';display:flex;flex-direction:column;background:' + COLORS.page + ';"><div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid ' + COLORS.line + ';background:' + COLORS.page + ';"><span style="font-size:14px;font-weight:700;color:' + COLORS.text + ';">🔍 节点图</span><span onclick="jQuery(\'#sl_gov\').fadeOut(200)" style="cursor:pointer;font-size:16px;color:' + COLORS.mute + ';line-height:1;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:6px;">✕</span></div><div id="sl_gsvg" style="flex:1;overflow:auto;padding:20px;"></div><div id="sl_gedit" style="padding:12px 16px;border-top:1px solid ' + COLORS.line + ';max-height:180px;overflow-y:auto;color:' + COLORS.text + ';background:' + COLORS.card + ';"></div></div></div>').appendTo('body');
                gov = jQuery('#sl_gov');
            }
            jQuery('#sl_gsvg').html(svg);
            jQuery('#sl_gedit').html('<span style="color:' + COLORS.mute + ';">戳节点看参数喵~ (｡•̀ᴗ-)✧</span>');
            gov.fadeIn(200);
            for (var nd of nodes) {
                (function(node) {
                    jQuery('#sl_gr_' + node.id).on('click', function(e) {
                        e.stopPropagation();
                        var te = jQuery('#sl_gedit');
                        te.empty();
                        var keys = Object.keys(node.inputs);
                        te.append('<div style="font-weight:600;font-size:13px;color:' + COLORS.text + ';margin-bottom:4px;">' + escapeHtml(node.title) + ' <span style="font-weight:400;font-size:11px;color:' + COLORS.sub + ';">' + escapeHtml(node.cls) + '</span></div>');
                        if (!keys.length) te.append('<span style="color:' + COLORS.mute + ';">无参数喵~</span>');
                        for (var j = 0; j < keys.length; j++) {
                            var k = keys[j], val = node.inputs[k];
                            te.append('<div style="display:flex;align-items:center;gap:8px;padding:3px 0;border-bottom:1px solid ' + COLORS.line + ';"><span style="font-size:11px;color:' + COLORS.sub + ';width:110px;flex-shrink:0;">' + escapeHtml(k) + '</span><span style="font-size:11px;color:' + COLORS.text + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:monospace;">' + escapeHtml(JSON.stringify(val).slice(0, 90)) + '</span></div>');
                        }
                    });
                })(nd);
            }
        } catch(e) {}
    }

    function runGen() {
        if (!settings.cWf) { toastr.error('要先导入工作流 JSON 才行喵~ (｡•́︿•̀｡)'); return; }
        var wf;
        try { wf = JSON.parse(settings.cWf); } catch(e) { toastr.error('JSON 格式不对喵~ 检查一下 (｡ŏ﹏ŏ)'); return; }
        jQuery('#sl_model_panel').find('[data-nid]').each(function() {
            var n = jQuery(this), nid = n.data('nid'), key = n.data('key'), val = n.val();
            if (!nid || !key || !wf[nid] || !wf[nid].inputs || val === '') return;
            var o = wf[nid].inputs[key];
            if (o !== undefined) wf[nid].inputs[key] = Array.isArray(o) && o.length === 2 && typeof o[1] === 'number' ? [val, o[1]] : val;
        });
        var ov = { w: jQuery('#sl_md_w').val(), h: jQuery('#sl_md_h').val(), steps: jQuery('#sl_md_steps').val(), cfg: jQuery('#sl_md_cfg').val(), seed: jQuery('#sl_md_seed').val() };
        for (var nid in wf) {
            var nd = wf[nid];
            if (!nd || !nd.inputs) continue;
            var cls = nd.class_type || '';
            var isS = /ksampler|sampler\b/i.test(cls) && !/scheduler|schedule|upscale/i.test(cls), isL = /latent|empty/i.test(cls);
            if (!isS && !isL) continue;
            for (var k in nd.inputs) {
                var o = nd.inputs[k];
                if (isL && /width/i.test(k) && !/height/i.test(k) && ov.w !== '') nd.inputs[k] = parseInt(ov.w);
                if (isL && /height/i.test(k) && ov.h !== '') nd.inputs[k] = parseInt(ov.h);
                if (isS && /steps/i.test(k) && ov.steps !== '') nd.inputs[k] = parseInt(ov.steps);
                if (isS && /^cfg$/i.test(k) && ov.cfg !== '') nd.inputs[k] = parseFloat(ov.cfg);
                if (isS && /seed|noise_seed/i.test(k) && ov.seed !== '-1' && ov.seed !== '') {
                    nd.inputs[k] = Array.isArray(o) && o.length === 2 ? [parseInt(ov.seed), o[1]] : parseInt(ov.seed);
                }
            }
        }
        var prompt = jQuery('#sl_model_panel').find('.sl_wf_prompt').first().val();
        if (!prompt) prompt = 'masterpiece, best quality';
        var s = jQuery('#sl_qst');
        s.text('生成中喵…').css('color', COLORS.sub);
        jQuery('#sl_preview').empty();
        generateImage(wf, prompt).then(function(r) {
            s.text('✓ 完成喵~').css('color', COLORS.green);
            jQuery('#sl_preview').html('<img src="' + r.url + '" style="max-width:100%;border-radius:12px;">');
            // 回写修改后的工作流（含注入的prompt/seed/尺寸）
            settings.cWf = JSON.stringify(wf);
            jQuery('#sl_wf').val(settings.cWf);
            saveSettings();
        }).catch(function(e) {
            s.text('✕ ' + e.message).css('color', COLORS.red);
        });
    }

    function setFooter(priLabel, priFn, secLabel, secFn) {
        jQuery('#sl_btn_primary').text(priLabel || '生成').off('click').on('click', priFn || function() {});
        jQuery('#sl_btn_secondary').text(secLabel || '💾 保存设置喵~').off('click').on('click', secFn || function() { saveSettings(); toastr.success('保存好啦喵~ ✨'); });
    }

    function initWorkflowTab(b) {
        loadWorkflowList();
        b.find('#sl_import').on('click', function() {
            jQuery('#sl_file_picker').trigger('click');
        });
        // 文件选择器：选本地 .json 文件
        jQuery('#sl_file_picker').off('change').on('change', function(e) {
            var file = e.target.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function(ev) {
                var w = ev.target.result;
                try { JSON.parse(w); } catch(ex) { toastr.error('JSON 格式不对喵~ 检查一下 (｡ŏ﹏ŏ)'); return; }
                jQuery('#sl_wf').val(w);
                settings.cWf = w;
                // 用导入文件名自动保存为新工作流
                var fname = file.name;
                if (!/\.json$/i.test(fname)) fname += '.json';
                settings.cWfName = fname;
                saveWorkflow(fname, w).then(function() { loadWorkflowList(); toastr.success('导入并保存喵~ 📥✨ ' + fname); }).catch(function(e) { toastr.error('保存失败喵~ ' + e.message); });
                saveSettings();
                loadModelPanel();
            };
            reader.readAsText(file);
            jQuery(this).val('');
        });
        b.find('#sl_wfload').on('click', function() {
            var n = jQuery('#sl_wf_sel').val();
            if (!n) return;
            loadWorkflow(n).then(function() { loadModelPanel(); });
        });
        b.find('#sl_wfsave').on('click', function() {
            // 先同步模型面板改动到 settings.cWf + 文本框
            var w = settings.cWf;
            jQuery('#sl_wf').val(w);
            if (!w) return;
            try { JSON.parse(w); } catch(e) { toastr.error('JSON 格式不对喵~ 检查一下 (｡ŏ﹏ŏ)'); return; }
            if (settings.cWfName) {
                // 已有工作流名 → 覆盖保存
                saveWorkflow(settings.cWfName, w).then(function() { loadWorkflowList(); toastr.success('保存好啦喵~ ✨'); }).catch(function(e) { toastr.error('保存失败喵~ ' + e.message); });
            } else {
                // 无工作流名 → 弹出另存为
                jQuery('#sl_wfsavename').show();
                jQuery('#sl_wfname').val('new_workflow.json');
            }
        });
        b.find('#sl_wfcancel').on('click', function() { jQuery('#sl_wfsavename').hide(); });
        b.find('#sl_wfdel').on('click', function() {
            var n = jQuery('#sl_wf_sel').val();
            if (!n) { toastr.error('请先选择一个工作流喵~'); return; }
            if (!confirm('确定要删除 "' + n + '" 吗喵~？')) return;
            deleteWorkflow(n).then(function() {
                loadWorkflowList();
                toastr.success('删除成功喵~ 🗑');
                // 如果删除的是当前加载的，清空文本框
                if (settings.cWfName === n) {
                    settings.cWfName = '';
                    settings.cWf = '';
                    saveSettings();
                    jQuery('#sl_wf').val('');
                }
            }).catch(function(e) { toastr.error('删除失败喵~ ' + e.message); });
        });
        b.find('#sl_wfok').on('click', function() {
            var n = jQuery('#sl_wfname').val().trim();
            if (!n) return;
            if (!/\.json$/i.test(n)) n += '.json';
            var w = jQuery('#sl_wf').val() || settings.cWf;
            try { JSON.parse(w); } catch(e) { toastr.error('JSON 格式不对喵~ 检查一下 (｡ŏ﹏ŏ)'); return; }
            saveWorkflow(n, w).then(function() { loadWorkflowList(); jQuery('#sl_wfsavename').hide(); toastr.success('保存好啦喵~ ✨'); }).catch(function(e) { jQuery('#sl_wfsavename').hide(); toastr.error('保存失败喵~ ' + e.message); });
        });
        b.find('#sl_graph').on('click', function() { renderGraph(); });
        // 尺寸/步数/CFG/种子立即保存
        b.find('#sl_md_w, #sl_md_h, #sl_md_steps, #sl_md_cfg, #sl_md_seed').on('change input', function() {
            try {
                if (!settings.cWf) return;
                var wf = JSON.parse(settings.cWf);
                var ov = { w: jQuery('#sl_md_w').val(), h: jQuery('#sl_md_h').val(), steps: jQuery('#sl_md_steps').val(), cfg: jQuery('#sl_md_cfg').val(), seed: jQuery('#sl_md_seed').val() };
                for (var nid in wf) {
                    var nd = wf[nid];
                    if (!nd || !nd.inputs) continue;
                    var cls = nd.class_type || '';
                    var isS = /ksampler|sampler\b/i.test(cls) && !/scheduler|schedule|upscale/i.test(cls);
                    var isL = /latent|empty/i.test(cls);
                    if (!isS && !isL) continue;
                    for (var k in nd.inputs) {
                        var o = nd.inputs[k];
                        if (isL && /width/i.test(k) && !/height/i.test(k) && ov.w !== '') nd.inputs[k] = parseInt(ov.w);
                        if (isL && /height/i.test(k) && ov.h !== '') nd.inputs[k] = parseInt(ov.h);
                        if (isS && /steps/i.test(k) && ov.steps !== '') nd.inputs[k] = parseInt(ov.steps);
                        if (isS && /^cfg$/i.test(k) && ov.cfg !== '') nd.inputs[k] = parseFloat(ov.cfg);
                        if (isS && /seed|noise_seed/i.test(k) && ov.seed !== '-1' && ov.seed !== '') {
                            nd.inputs[k] = Array.isArray(o) && o.length === 2 ? [parseInt(ov.seed), o[1]] : parseInt(ov.seed);
                        }
                    }
                }
                settings.cWf = JSON.stringify(wf);
                jQuery('#sl_wf').val(settings.cWf);
                saveSettings();
            } catch(e) {}
        });
    }

    // ══ Tab 切换 ══

    var currentTab = 1;

    function switchTab(n) {
        try {
        currentTab = n;
        jQuery('.sl_tb').css({ background: 'transparent', color: COLORS.sub });
        jQuery('.sl_tb[data-t="' + n + '"]').css({ background: COLORS.blue, color: '#fff' });
        var html = n === 1 ? tabGeneral() : n === 2 ? tabAux() : n === 3 ? tabStyle() : n === 4 ? tabWorkflow() : n === 5 ? tabProfiles() : tabGallery();
        jQuery('#sl_body').html(html);
        var b = jQuery('#sl_body');

        if (n === 1) {
            // 通用 tab
            b.find('#sl_btn_clear_all').on('click', function() {
                if (!confirm('真的要把所有缓存和配置都删掉吗喵？(｡•́︿•̀｡)')) return;
                try {
                    localStorage.removeItem('slimg_cache');
                    if (_extSettings) { delete _extSettings.sillab; }
                    stopPolling();
                    Object.assign(settings, getDefaults());
                    try { saveSettings(); } catch(e) {}
                    switchTab(1);
                    toastr.success('缓存全部清空啦喵~ 🧹✨');
                } catch(e) { toastr.error('呜呜清空失败了喵~ (╥﹏╥) ' + e.message); }
            });
            setFooter('💾 保存设置喵~', function() { saveSettings(); toastr.success('保存好啦喵~ ✨'); }, '重置', function() { Object.assign(settings, getDefaults()); saveSettings(); switchTab(1); toastr.success('重置好啦喵~ 🔄'); });
        } else if (n === 2) {
            // 辅助LLM tab
            if (settings.auxModels && settings.auxModels.length) {
                var sel = b.find('#sl_in_auxModel'), psel = b.find('#sl_in_profileModel'), testBtn = b.find('#sl_ta');
                sel.empty(); sel.prop('disabled', 0);
                psel.empty(); psel.prop('disabled', 0);
                testBtn.prop('disabled', 0);
                settings.auxModels.forEach(function(m) {
                    sel.append('<option value="' + escapeHtml(m.id) + '"' + (m.id === settings.auxModel ? ' selected' : '') + '>' + escapeHtml(m.id) + '</option>');
                    psel.append('<option value="' + escapeHtml(m.id) + '"' + (m.id === settings.profileModel ? ' selected' : '') + '>' + escapeHtml(m.id) + '</option>');
                });
                jQuery('#sl_aux_st').text('✓ 已连接喵~ ' + settings.auxModels.length + ' 个模型').css('color', COLORS.green);
                jQuery('#sl_in_auxUrl').val(settings.auxUrl || '');
                jQuery('#sl_in_auxKey').val(settings.auxKey || '');
            }
            b.find('#sl_aux_connect').on('click', async function() {
                var btn = jQuery(this), st = jQuery('#sl_aux_st'), sel = b.find('#sl_in_auxModel'), psel = b.find('#sl_in_profileModel'), testBtn = b.find('#sl_ta');
                var url = (b.find('#sl_in_auxUrl').val() || '').replace(/\/+$/, '');
                var key = b.find('#sl_in_auxKey').val() || '';
                if (!url) { st.text('请填写地址喵~').css('color', COLORS.red); return; }
                btn.prop('disabled', 1);
                st.text('获取模型列表喵…').css('color', COLORS.sub);
                sel.prop('disabled', 1).html('<option>加载中喵…</option>');
                psel.prop('disabled', 1).html('<option>加载中喵…</option>');
                testBtn.prop('disabled', 1);
                try {
                    var r = await fetch(url.replace(/\/+$/, '') + '/models', { method: 'GET', headers: { 'Authorization': 'Bearer ' + (key || ''), 'Content-Type': 'application/json' } });
                    if (!r.ok) { var et = await r.text().catch(function() { return ''; }); throw new Error(et.slice(0, 300)); }
                    var d = await r.json();
                    var models = (d.data || d.models || []).map(function(m) { return typeof m === "string" ? { id: m } : { id: m.id }; }).filter(function(m) { return m && m.id; });
                    settings.auxModels = models;
                    settings.auxUrl = url;
                    settings.auxKey = key;
                    sel.empty(); psel.empty();
                    models.forEach(function(m) {
                        sel.append('<option value="' + escapeHtml(m.id) + '"' + (m.id === settings.auxModel ? ' selected' : '') + '>' + escapeHtml(m.id) + '</option>');
                        psel.append('<option value="' + escapeHtml(m.id) + '"' + (m.id === settings.profileModel ? ' selected' : '') + '>' + escapeHtml(m.id) + '</option>');
                    });
                    sel.prop('disabled', 0); psel.prop('disabled', 0); testBtn.prop('disabled', 0);
                    settings.auxModel = sel.val();
                    settings.profileModel = psel.val();
                    st.text('✓ 已连接喵~ ' + models.length + ' 个模型').css('color', COLORS.green);
                    saveSettings();
                } catch(e) {
                    st.text('✕ ' + e.message).css('color', COLORS.red);
                    sel.html('<option>连接失败喵… (╥﹏╥)</option>').prop('disabled', 1);
                }
                btn.prop('disabled', 0);
            });
            b.find('#sl_in_auxModel').on('change', function() { settings.auxModel = jQuery(this).val(); saveSettings(); });
            b.find('#sl_in_profileModel').on('change', function() { settings.profileModel = jQuery(this).val(); saveSettings(); });
            b.find('#sl_ta').on('click', async function() {
                var btn = jQuery(this), st = jQuery('#sl_aux_st'), res = jQuery('#sl_aux_result');
                var url = (b.find('#sl_in_auxUrl').val() || settings.auxUrl || '').replace(/\/+$/, '');
                var key = (b.find('#sl_in_auxKey').val() || settings.auxKey || '');
                var model = b.find('#sl_in_auxModel').val() || settings.auxModel;
                if (!url) { toastr.error('先连接 API 喵~ (｡•́︿•̀｡)'); return; }
                btn.prop('disabled', 1);
                st.text('测试中喵…').css('color', COLORS.sub);
                res.hide();
                try {
                    var ep = url;
                    if (!/\/chat\/completions$/.test(ep)) ep += '/chat/completions';
                    var h = { 'Content-Type': 'application/json' };
                    if (key) h['Authorization'] = 'Bearer ' + key;
                    var body = { messages: [{ role: 'user', content: '这是测试，请回复"1"即可' }], max_tokens: 50, temperature: 0, stream: false };
                    if (model) body.model = model;
                    var r = await fetch(ep, { method: 'POST', headers: h, body: JSON.stringify(body) });
                    if (!r.ok) { var et = await r.text().catch(function() { return ''; }); throw new Error('HTTP ' + r.status + (et ? ' — ' + et.slice(0, 200) : '') + ' [' + ep + ']'); }
                    var d = await r.json();
                    var msg = d && d.choices && d.choices[0] && d.choices[0].message || {};
                    var content = (msg.content || msg.reasoning_content || '').trim();
                    var passed = content.length > 0;
                    st.text(passed ? '✓ 通过喵~ ✨' : '✕ 空回复喵…').css('color', passed ? COLORS.green : COLORS.red);
                    res.show().html('<div style="display:flex;gap:12px;flex-wrap:wrap;"><div><span style="color:' + COLORS.sub + ';">模型喵:</span> <code style="color:' + COLORS.text + ';">' + escapeHtml(model || '(默认喵~)') + '</code></div><div><span style="color:' + COLORS.sub + ';">回复喵:</span> <code style="color:' + (passed ? COLORS.green : COLORS.red) + ';">' + (content ? escapeHtml(content) : '(空空如也喵)') + '</code></div></div>').css('color', COLORS.text);
                } catch(e) {
                    st.text('✕ ' + e.message).css('color', COLORS.red);
                    res.show().html('<span style="color:' + COLORS.red + ';">' + escapeHtml(e.message) + '</span>').css('color', COLORS.text);
                }
                btn.prop('disabled', 0);
            });
            setFooter('连接', function() { b.find('#sl_aux_connect').trigger('click'); }, '测试', function() { b.find('#sl_ta').trigger('click'); });
        } else if (n === 3) {
            // 画风预设 tab（sl_style_preset 由全局 handler 处理）
            b.find('#sl_nsfw_btn').on('click', function() {
                try {
                    settings.nsfwEnhance = !settings.nsfwEnhance;
                    saveSettings();
                    jQuery(this).text(settings.nsfwEnhance ? '✔ 已开启' : '✖ 已关闭')
                        .css('background', settings.nsfwEnhance ? COLORS.blue : COLORS.mute);
                } catch(e) { slErr('NSFW按钮异常: ' + e.message); }
            });
            setFooter('💾 保存设置喵~', function() { saveSettings(); toastr.success('保存好啦喵~ ✨'); }, '🔄 重置', function() { Object.assign(settings, getDefaults()); saveSettings(); switchTab(3); toastr.success('重置好啦喵~ 🔄'); });
        } else if (n === 4) {
            // ComfyUI tab
            b.find('#sl_tc').on('click', async function() {
                var btn = jQuery(this), s = jQuery('#sl_cst');
                btn.prop('disabled', 1);
                s.text('测试中喵…').css('color', COLORS.sub);
                try {
                    var r = await fetch('/api/sd/comfy/ping', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, getSTHeaders()), body: JSON.stringify({ url: settings.cUrl }) });
                    if (!r.ok) throw new Error('HTTP ' + r.status);
                    s.text('✓ 已连接喵~').css('color', COLORS.green);
                } catch(e) {
                    s.text('✕ ' + e.message).css('color', COLORS.red);
                }
                btn.prop('disabled', 0);
            });
            initWorkflowTab(b);
            setFooter('🖼️ 预览喵~', function() { runGen(); }, '💾 保存工作流', function() { b.find('#sl_wfsave').trigger('click'); });
        } else if (n === 5) {
            // 档案 tab
            b.find('#sl_btn_scan_cast').on('click', async function() { await scanCharacterProfile(); switchTab(5); });
            b.find('#sl_in_userName').on('change input', function() { settings.userName = jQuery(this).val(); saveSettings(); });
            b.find('#sl_in_userDesc').on('change input', function() { settings.userDesc = jQuery(this).val(); saveSettings(); });
            b.find('#sl_btn_export_cast').on('click', function() { exportProfiles('cast'); });
            b.find('#sl_btn_export_chat').on('click', function() { exportProfiles('chat'); });
            b.find('#sl_btn_clear_profiles').on('click', function() {
                var pf = getProfiles();
                if (pf && pf.chat) { pf.chat.dynamics = {}; pf.chat.present = []; pf.chat.npcs = {}; saveSettings(); switchTab(5); toastr.success('聊天动态清空啦喵~ 🧹'); }
            });
            b.find('#sl_btn_delete_profile').on('click', function() {
                var pf = getProfiles();
                if (!pf || !pf.charName) { toastr.error('还没进入聊天喵~ (｡•́︿•̀｡)'); return; }
                var cast = pf.root[pf.charName].cast || {};
                if (!Object.keys(cast).length) { toastr.error('还没有档案可以删喵~ 先去扫描吧 (｡•́︿•̀｡)'); return; }
                var msg = '🐱 此操作将删除当前角色卡的：\n\n· 角色卡档案（所有cast角色）\n· User 档案\n· 全部聊天缓存\n· 全部图片缓存\n· 当前DOM渲染的图片卡片\n\n删除后需重新扫描并重新生成图片喵…\n\n🐱 偷懒的小猫还没测出所有 bug 喵…';
                if (!confirm(msg)) return;
                if (!confirm('🐱 真的确定要全部删掉吗喵？这个操作回不来的喵！')) return;
                deleteCharacterProfile(true);
                toastr.warning('档案全部删掉了喵… 需要重新扫描 (｡•́︿•̀｡)');
                setTimeout(function() { toastr.info('请点击上方「扫描角色卡档案」重新生成喵~ (｡•̀ᴗ-)✧'); }, 1000);
                switchTab(5);
            });
            setFooter('🔄 刷新档案喵~', function() { switchTab(5); }, '🗑️ 清空档案喵~', function() { b.find('#sl_btn_clear_profiles').trigger('click'); });
        } else if (n === 6) {
            // 图库 tab
            b.find('#sl_btn_clear_imgs').on('click', function() {
                if (!confirm('确定要清空全部图片缓存吗喵？(｡•́︿•̀｡)\n\n此操作不会删除聊天记录，但已生成的图片卡片会变回生成按钮。')) return;
                localStorage.removeItem('slimg_cache');
                jQuery('#sl_body').find('img').each(function() { this.src = ''; });
                switchTab(6);
                toastr.success('全部图片缓存清空啦喵~ 🧹✨');
            });
            setFooter('🔄 刷新图库喵~', function() { switchTab(6); }, '🖼️ 图库喵~', null);
        } else {
            setFooter('💾 保存设置喵~', function() { saveSettings(); toastr.success('保存好啦喵~ ✨'); }, '重置', function() { Object.assign(settings, getDefaults()); saveSettings(); switchTab(1); toastr.success('重置好啦喵~ 🔄'); });
        }
        } catch(e) { slErr('switchTab异常: ' + e.message); }
    }

    // ══ 全局绑定（一次性，事件委托到 document，不受 DOM 重建影响） ══
    jQuery(document).on('change blur', '#sl_style_preset, input[name="sl_story_mode"], [id^="sl_cb_"], [id^="sl_in_"]', function() {
        try {
            var rawId = this.id;
            if (rawId === 'sl_style_preset') {
                settings.stylePreset = this.value;
                console.log('[sillab] 画风预设选择: 「' + this.value + '」');
                saveSettings();
            } else if (rawId.indexOf('sl_cb_') === 0) {
                var id = rawId.replace('sl_cb_', '');
                if (this.type === 'checkbox') settings[id] = this.checked;
                else settings[id] = this.value;
                saveSettings();
            } else if (rawId.indexOf('sl_in_') === 0) {
                var id = rawId.replace('sl_in_', '');
                settings[id] = this.value;
                saveSettings();
            } else if (this.name === 'sl_story_mode') {
                settings.storyMode = this.value;
                saveSettings();
            }
        } catch(e) { console.log('全局UI保存异常: ' + e.message); }
    });

    jQuery('.sl_tb').on('click', function() { switchTab(parseInt(jQuery(this).data('t'))); });
    jQuery('#sl_close_btn').on('click', function() { jQuery('#sl_overlay').fadeOut(200, function() { miniWin.fadeIn(200, function() { startMiniRefresh(); }); }); });
    jQuery('#sl_btn_mini').on('click', function() { jQuery('#sl_overlay').fadeOut(200, function() { miniWin.fadeIn(200, function() { startMiniRefresh(); }); }); });
    // 弹窗拖动
    (function() {
        var md = false, sx, sy, ol, ot;
        var hdr = jQuery('#sl_overlay > div > div:first-child');
        if (!hdr.length) return;
        hdr.css('cursor', 'grab').on('mousedown', function(e) {
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'SPAN') return;
            var m = jQuery('#sl_overlay > div');
            var o = m.offset();
            sx = e.clientX; sy = e.clientY; ol = o.left; ot = o.top;
            m.css({ left: ol + 'px', top: ot + 'px', transform: 'none' });
            md = true; hdr.css('cursor', 'grabbing');
        });
        jQuery(document).on('mousemove', function(e) {
            if (!md) return;
            jQuery('#sl_overlay > div').css({ left: (ol + e.clientX - sx) + 'px', top: (ot + e.clientY - sy) + 'px', transform: 'none' });
        }).on('mouseup', function() {
            if (!md) return;
            md = false; hdr.css('cursor', 'grab');
            var p = jQuery('#sl_overlay > div').offset();
            try { localStorage.setItem('sl_modal_pos', JSON.stringify({ x: p.left, y: p.top })); } catch(e) {}
        });
    })();


    // ══ 日志弹窗 ══
    var logOv = null;
    var logBtn = jQuery('#sl_btn_log');
    logBtn.off('click');
    logBtn.on('click', function(e) {
        e.stopPropagation();
        e.preventDefault();
        // 关
        if (logOv && logOv.parent().length) {
            logOv.remove();
            logOv = null;
            return;
        }
        // 开
        logOv = jQuery(
            '<div class="sl_log_ov" style="position:fixed;top:0;left:0;width:100%;height:100%;z-index:10005;background:rgba(0,0,0,0.5);">' +
            '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:900px;max-width:96vw;height:90vh;border-radius:12px;overflow:hidden;display:flex;flex-direction:column;background:' + COLORS.page + ';border:1px solid ' + COLORS.line + ';">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-bottom:1px solid ' + COLORS.line + ';background:' + COLORS.card + ';">' +
            '<span style="font-weight:700;color:' + COLORS.text + ';">📋 插件日志 (' + getLogCount() + '条)</span>' +
            '<span class="sl_log_x" style="cursor:pointer;font-size:15px;color:' + COLORS.sub + ';padding:4px 10px;border-radius:6px;border:1px solid ' + COLORS.line + ';user-select:none;">🚪 关闭</span>' +
            '</div>' +
            '<textarea readonly class="sl_log_text" style="flex:1;padding:12px;border:none;outline:none;resize:none;font-family:monospace;font-size:12px;line-height:1.6;background:' + COLORS.page + ';color:' + COLORS.text + ';">' + escapeHtml(slLogDump()) + '</textarea>' +
            '</div></div>'
        ).appendTo('body');
        var ov = logOv;
        var ta = ov.find('.sl_log_text');
        // 每2秒自动刷新日志内容
        var refreshTimer = setInterval(function() {
            try {
                if (!ov || !ov.parent().length) { clearInterval(refreshTimer); return; }
                ta.val(escapeHtml(slLogDump()));
                ta.scrollTop(ta[0].scrollHeight);
            } catch(e) { /* 日志面板刷新异常静默处理 */ }
        }, 2000);
        ov.find('.sl_log_x').on('mousedown', function(e2) { e2.stopPropagation(); e2.preventDefault(); clearInterval(refreshTimer); ov.remove(); logOv = null; });
        ov.on('mousedown', function(e2) { if (e2.target === ov[0]) { clearInterval(refreshTimer); ov.remove(); logOv = null; } });
        // 双击复制全部
        ta.on('dblclick', function() { this.select(); document.execCommand('copy'); });
    });

    switchTab(1);

    // ══ v1.1 新增绑定 ══

    // 公告栏渲染
    function renderAnnouncement() {
        var a = jQuery('#sl_announce');
        if (!a.length) return;
        var changelog = 'v1.1.0 更新：小窗模式 | 5主题美化 | DS/Gemini破限切换 | 一键生图 | 公告栏';
        var h = '';
        h += '<div style="font-weight:700;color:' + COLORS.text + ';margin-bottom:4px;">📢 更新公告</div>';
        h += '<div style="font-size:11px;color:' + COLORS.sub + ';margin-bottom:4px;">' + changelog + '</div>';
        a.html(h).show();
    }
    renderAnnouncement();

    // 小窗切换
    jQuery('#sl_mini_expand').on('click', function() {
        miniWin.fadeOut(200, function() {
            stopMiniRefresh();
            jQuery('#sl_overlay').fadeIn(200);
        });
    });
    jQuery('#sl_mini_close').on('click', function() {
        // 关小窗 → 开UI
        miniWin.fadeOut(200, function() { stopMiniRefresh(); jQuery('#sl_overlay').fadeIn(200); });
    });
    // 点击小窗外 → 关闭小窗（排除触发按钮本身）
    jQuery(document).on('mousedown', function(e) {
        if (!miniWin.is(':visible')) return;
        var target = jQuery(e.target);
        if (target.closest('#sl_mini').length || target.is(triggerBtn) || target.closest(triggerBtn).length) return;
        miniWin.fadeOut(200, function() { stopMiniRefresh(); jQuery('#sl_overlay').fadeIn(200); });
    });

    // 小窗自动/手动
    jQuery('#sl_mini_auto').on('change', function() {
        settings.autoGen = parseInt(jQuery(this).val());
        saveSettings();
        jQuery('#sl_cb_autoGen').val(settings.autoGen);
    });

    // 小窗一键生图
    jQuery('#sl_mini_gen').on('click', function() {
        var lastBtn = jQuery('.sl_img_btn[data-prompt]').last();
        if (lastBtn.length && lastBtn.text().indexOf('排队') < 0) {
            lastBtn.trigger('click');
        } else {
            toastr.info('没有待生成的图片按钮喵~');
        }
    });

    // 一键排图（小窗+通用Tab共用）
    function triggerGenAll() {
        var count = 0;
        jQuery('.sl_img_btn[data-prompt]').each(function() {
            var b = jQuery(this);
            if (b.text().indexOf('排队') < 0 && b.text().indexOf('🔄') < 0 && b.text().indexOf('生成图片') >= 0) {
                b.trigger('click');
                count++;
            }
        });
        if (count === 0) toastr.info('没有待生成的图片喵~ 所有按钮都已排上或已完成');
        else toastr.success('已排队 ' + count + ' 张图片喵~');
    }
    jQuery('#sl_mini_gen_all, #sl_btn_gen_all').on('click', triggerGenAll);

    // 增强文本主题切换
    jQuery(document).on('click', '.sl_theme_opt', function() {
        var t = jQuery(this).data('t');
        if (!t) return;
        settings.enhancedTheme = t;
        saveSettings();
        jQuery('.sl_theme_opt').css({ background: COLORS.card, color: COLORS.text, border: '1px solid ' + COLORS.line });
        jQuery(this).css({ background: COLORS.blue, color: '#fff', border: '1px solid ' + COLORS.blue });
        // 刷新已渲染消息的样式
        var css = getThemeCSS();
        jQuery('.sl_enhanced').css(css);
    });

    // 模型提供商切换
    jQuery('#sl_aux_provider').on('change', function() {
        settings.auxProvider = jQuery(this).val();
        saveSettings();
    });

}
