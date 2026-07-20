// ── SillyImage Lab v2.0 — 入口文件 ──
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
window.SILLYLAB_VERSION = 'v2.1.0';
slLog('LOADED v2.1.0');

// ── 初始化设置 ──
initSettings(getContext, extension_settings);
try {
    var saved = localStorage.getItem('sillab_settings');
    if (saved) {
        var parsed = JSON.parse(saved);
        Object.assign(settings, getDefaults(), parsed);
        slLog('从 localStorage 加载设置');
    } else {
        Object.assign(settings, getDefaults(), extension_settings.sillab || {});
        saveSettings();
        slLog('从 extension_settings 迁移设置');
    }
} catch (e) {
    Object.assign(settings, getDefaults());
    slLog('设置加载失败，使用默认值: ' + e.message);
}

// ── 清旧缓存哨兵 ──
try {
    localStorage.removeItem('slimg_v2_deployed');
    localStorage.removeItem('slimg_cache');
    localStorage.removeItem('sillab_clean_v102');
} catch (e) {}

if (!localStorage.getItem('sillab_clean_v210')) {
    try {
        localStorage.removeItem('slimg_cache');
        if (typeof extension_settings !== 'undefined') { delete extension_settings.sillab; }
        Object.assign(settings, getDefaults());
        try { saveSettings(); } catch (e) {}
        slLog('🧹 v2.1.0 全新部署喵~ 缓存清空啦 ✨🧹');
    } catch (e) { slLog('清缓存跳过: ' + e.message); }
    localStorage.setItem('sillab_clean_v210', '1');
}

slLog('v2.1.0 init');

// ── 注册斜杠命令 ──
SlashCommandParser.addCommandObject(SlashCommand.fromProps({name:'sillylab',callback:function(){var cb=jQuery('#sl_compact');if(cb.length){cb.trigger('click');}else{toastr.info('插件面板尚未初始化喵~');}}}));

// ── 版本检测 + 公告 ──
(function checkUpdateAndAnnounce() {
    var GIT_BASE = 'https://raw.githubusercontent.com/cPPPa1022/sillyCAT/main/';
    var localVer = '2.1.0';

    // 版本检测
    fetch(GIT_BASE + 'manifest.json?t=' + Date.now())
        .then(function(r) { if(!r.ok)throw new Error('HTTP '+r.status); return r.json(); })
        .then(function(remote) {
            var remoteVer = remote.version || '';
            if (remoteVer && remoteVer !== localVer) {
                window.SILLYLAB_UPDATE = { version: remoteVer };
                slLog('发现新版本: ' + remoteVer + ' (当前: ' + localVer + ')');
            } else {
                slLog('版本已是最新: ' + localVer);
            }
        })
        .catch(function(e) { slLog('版本检测跳过: ' + (e.message||'').slice(0,50)); });

    // 公告
    fetch(GIT_BASE + 'announcement.txt?t=' + Date.now())
        .then(function(r) { if(!r.ok)throw new Error('HTTP '+r.status); return r.text(); })
        .then(function(txt) {
            if (txt && txt.trim()) {
                window.SILLYLAB_ANNOUNCEMENT = txt.trim();
                slLog('公告已加载: ' + txt.slice(0,50) + '...');
            }
        })
        .catch(function(e) { slLog('公告加载跳过: ' + (e.message||'').slice(0,50)); });
})();

// ── 启动💬 提示词📂 加载 ──
var PROMPTS_BASE = '';
try { PROMPTS_BASE = new URL('prompts/', import.meta.url).href; } catch (e) {}
if (PROMPTS_BASE) { slLog('提示词加载器: 📥 从 ' + PROMPTS_BASE + ' 加载'); /* [AI-Fix] loadPrompts 是 async 函数，原代码未 await 也未被 .catch()，提示词加载失败时产生 Unhandled Promise Rejection。加 catch 防止静默失败。 */ loadPrompts(PROMPTS_BASE).catch(function(e) { slErr('提示词加载失败: ' + (e.message||'').slice(0,80)); }); }
else { slLog('提示词加载器: 呜呜 import.meta.url 不可用喵~ (╥﹏╥)'); }

// ── 注入 render 模块的生图排队 ──
setEnqueueGen(enqueueGen);

// ── 构建 UI ──
try { buildUI(extension_settings); slLog('v2.1.0 UI OK'); } catch (e) { slErr('buildUI失败: ' + e.message); console.error('[sillab] buildUI失败:', e); }

// ── 启动轮询 + 事件钩子 ──
startPolling();
