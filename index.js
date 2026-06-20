// ── SillyImage Lab v1beta — 入口文件 ──
import { extension_settings, getContext } from '../../../extensions.js';
import { SlashCommandParser } from '../../../slash-commands/SlashCommandParser.js';
import { SlashCommand } from '../../../slash-commands/SlashCommand.js';
import { loadPrompts } from './prompts/loader.js';

import { slLog, slErr, slLogDump, getLogCount } from './modules/log.js';
import { initSettings, settings, getDefaults, COLORS, INPUT_STYLE, BUTTON_STYLE, getSTContext, getSTHeaders, escapeHtml, saveSettings } from './modules/settings.js';
import { buildUI } from './modules/ui.js';
import { setEnqueueGen } from './modules/render.js';
import { enqueueGen } from './modules/queue.js';
import { startPolling, stopPolling, getScannerStatus, hasCastCache } from './modules/scanner.js';

// ── 版本 ──
window.SILLYLAB_VERSION = 'v1.1.0-' + Date.now();
slLog('LOADED v1.1.0');

// ── 初始化设置：从 localStorage 加载（远离 ST 控制范围） ──
initSettings(getContext, extension_settings);
try {
    var saved = localStorage.getItem('sillab_settings');
    if (saved) {
        var parsed = JSON.parse(saved);
        Object.assign(settings, getDefaults(), parsed);
        slLog('从 localStorage 加载设置');
    } else {
        // 首次：从 extension_settings 迁移
        Object.assign(settings, getDefaults(), extension_settings.sillab || {});
        saveSettings();
        slLog('从 extension_settings 迁移设置');
    }
} catch (e) {
    Object.assign(settings, getDefaults());
    slLog('设置加载失败，使用默认值: ' + e.message);
}

// ── 清旧缓存哨兵 ──
// 清掉旧版所有可能的残留 key
try {
    localStorage.removeItem('slimg_v2_deployed');
    localStorage.removeItem('slimg_cache');
    localStorage.removeItem('sillab_clean_v102');
} catch (e) {}

if (!localStorage.getItem('sillab_clean_v110')) {
    try {
        localStorage.removeItem('slimg_cache');
        if (typeof extension_settings !== 'undefined') { delete extension_settings.sillab; }
        Object.assign(settings, getDefaults());
        try { saveSettings(); } catch (e) {}
        slLog('🧹 v1.1.0 全新部署喵~ 缓存清空啦 ✨🧹');
    } catch (e) { slLog('清缓存跳过: ' + e.message); }
    localStorage.setItem('sillab_clean_v110', '1');
}

slLog('v1.1.0 init');

// ── 注册斜杠命令 ──
SlashCommandParser.addCommandObject(SlashCommand.fromProps({
    name: 'sillylab',
    callback: function () {
        var ov = jQuery('#sl_overlay'), mini = jQuery('#sl_mini');
        if (ov.is(':visible')) {
            ov.fadeOut(200, function() { mini.fadeIn(200); });
        } else if (mini.is(':visible')) {
            mini.fadeOut(200, function() { ov.fadeIn(200); });
        } else {
            ov.fadeIn(200);
        }
    }
}));

// ── 启动💬 提示词📂 加载 ──
var PROMPTS_BASE = '';
try { PROMPTS_BASE = new URL('prompts/', import.meta.url).href; } catch (e) {}
if (PROMPTS_BASE) { slLog('提示词加载器: 📥 从 ' + PROMPTS_BASE + ' 加载'); loadPrompts(PROMPTS_BASE); }
else { slLog('提示词加载器: 呜呜 import.meta.url 不可用喵~ (╥﹏╥)'); }

// ── 注入 render 模块的生图排队 ──
setEnqueueGen(enqueueGen);

// ── 构建 UI ──
try { buildUI(extension_settings); slLog('v1.1.0 UI OK'); } catch (e) { slErr('buildUI失败: ' + e.message); }

// ── 启动轮询 + 事件钩子 ──
startPolling();
