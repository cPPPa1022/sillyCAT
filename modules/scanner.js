// ── SillyImage Lab 消息扫描与触发 ──
import { slLog, slErr } from './log.js';
import { settings, getSTContext, escapeHtml, saveSettings } from './settings.js';
import { extractBodyText, hasBodyMarker } from './text-utils.js';
import { getChatId, runAuxPipeline } from './pipeline.js';
import { renderBodyEnhanced, renderEnhanced, setRestoreDeps, restoreImageBlocks } from './render.js';

// 注入 render 模块需要的依赖
import { getChatId as pipelineGetChatId } from './pipeline.js';
setRestoreDeps(pipelineGetChatId, getSTContext);

// ── 扫描会话管理 ──
var scanSession = null;
var sessionIdCounter = 0;

function startScanSession(msgElement, mesId, chatId) {
    // 同一条消息已有进行中的会话 → 不重复启动
    if (scanSession && scanSession.mesid === mesId && scanSession.phase !== 'done') return;
    sessionIdCounter++;
    var sessionId = sessionIdCounter;
    if (scanSession) {
        clearTimeout(scanSession.timer);
        slLog('扫描会话 #' + scanSession.id + ' 被 #' + sessionId + ' 替代');
    }
    scanSession = { id: sessionId, msgEl: msgElement, mesid: mesId, chatId: chatId, phase: 'wait_marker', timer: null, tries: 0 };
    // 标记会话已启动（和 sl_aux_scanned 分开，避免 auxImageScan 误判）
    msgElement.data('sl_session_started', 1);
    slLog('扫描会话 #' + sessionId + ' 启动');
    scheduleMarkerCheck(sessionId);
}

function scheduleMarkerCheck(sessionId) {
    var session = scanSession;
    if (!session || session.id !== sessionId) return;
    clearTimeout(session.timer);
    session.timer = setTimeout(function() { doMarkerCheck(sessionId); }, 5000);
}

function doMarkerCheck(sessionId) {
    var session = scanSession;
    if (!session || session.id !== sessionId) return;
    session.tries++;
    var text = session.msgEl.text();
    var clean = text.replace(/<think[\s\S]*?<\/think>/gi, '')
        .replace(/<fox_selc>[\s\S]*?<\/fox_selc>/gi, '')
        .replace(/<fox_tip>[\s\S]*?<\/fox_tip>/gi, '')
        .replace(/<CEstuff>[\s\S]*?<\/CEstuff>/gi, '')
        .replace(/<catsay>[\s\S]*?<\/catsay>/gi, '');
    var startIdx = clean.indexOf('正文###');
    var endIdx = clean.indexOf('结尾###', startIdx + 1);
    if (startIdx >= 0 && endIdx > startIdx) {
        session.phase = 'done';
        slLog('扫描 #' + sessionId + ' 检测到完整标记，提取正文(' + (endIdx - startIdx - 5) + '字)');
        var bodyText = text.slice(startIdx + 5, endIdx);
        var minBody = settings.storyMode === 'comic' ? 20 : 80;
        if (bodyText.length >= minBody) {
            slLog('触发管线(标记模式)');
            runAuxImageScan(session.msgEl);
        } else { slLog('正文过短(' + bodyText.length + ')，跳过'); }
        return;
    }
    if (startIdx >= 0 && endIdx < 0) {
        session.phase = 'wait_end';
        slLog('扫描 #' + sessionId + ' 检测到 正文###，等待 结尾###');
        scheduleEndCheck(sessionId);
        return;
    }
    if (session.tries < 3) {
        slLog('扫描 #' + sessionId + ' 第' + session.tries + '次未检测到标记');
        scheduleMarkerCheck(sessionId);
    } else {
        session.phase = 'done';
        slLog('扫描 #' + sessionId + ' 3次未检测到标记，使用回退 8s');
        var backupText = extractBodyText(text);
        if (backupText.length >= (settings.storyMode === 'comic' ? 20 : 80)) {
            clearTimeout(session.timer);
            session.timer = setTimeout(function() {
                slLog('触发管线(回退模式)');
                runAuxImageScan(session.msgEl);
            }, 8000);
        }
    }
}

function scheduleEndCheck(sessionId) {
    var session = scanSession;
    if (!session || session.id !== sessionId) return;
    clearTimeout(session.timer);
    session.timer = setTimeout(function() { doEndCheck(sessionId); }, 2000);
}

function doEndCheck(sessionId) {
    var session = scanSession;
    if (!session || session.id !== sessionId) return;
    var text = session.msgEl.text();
    var clean = text.replace(/<think[\s\S]*?<\/think>/gi, '')
        .replace(/<fox_selc>[\s\S]*?<\/fox_selc>/gi, '')
        .replace(/<fox_tip>[\s\S]*?<\/fox_tip>/gi, '')
        .replace(/<CEstuff>[\s\S]*?<\/CEstuff>/gi, '')
        .replace(/<catsay>[\s\S]*?<\/catsay>/gi, '');
    var startIdx = clean.indexOf('正文###');
    var endIdx = clean.indexOf('结尾###', startIdx + 1);
    if (endIdx >= 0) {
        session.phase = 'done';
        var bodyText = text.slice(startIdx + 5, endIdx);
        slLog('扫描 #' + sessionId + ' 检测到 结尾###，提取正文(' + bodyText.length + '字)');
        if (bodyText.length >= (settings.storyMode === 'comic' ? 20 : 80)) {
            slLog('触发管线(标记模式)');
            runAuxImageScan(session.msgEl);
        } else { slLog('正文过短(' + bodyText.length + ')，跳过'); }
        return;
    }
    scheduleEndCheck(sessionId);
}

// ── 全量消息恢复 ──
export function scanAllMsgs() {
    try {
        if (!settings.cWf || !settings.autoGen) return;
        if (jQuery('.edit_textarea').length || jQuery('#curEditTextarea').length) return;
        var chatId = getChatId();
        jQuery('.mes').each(function() {
            var mesEl = jQuery(this).find('.mes_text');
            if (!mesEl.length) return;
            var mesId = jQuery(this).attr('mesid');
            if (!mesId) return;
            var cached = findBestCached(chatId, mesId, mesEl.text());
            if (cached && /\[image:/.test(cached)) {
                if (/sl_img_btn/.test(mesEl.html())) return;
                if (hasBodyMarker(cached)) {
                    var bodyContent = cached.slice(cached.indexOf('正文###') + 5, cached.indexOf('结尾###', cached.indexOf('正文###') + 5));
                    renderBodyEnhanced(mesEl, bodyContent);
                } else {
                    renderEnhanced(mesEl, cached);
                }
            }
        });
    } catch (e) {}
}

// ── 管线入口：分析消息 + 增强渲染 ──
export async function runAuxImageScan(messageElement) {
    try {
        slLog('auxImageScan 启动');
        var lastMsg = messageElement || jQuery('.mes_text').last();
        if (!lastMsg.length) { slLog('无消息'); return; }
        if (lastMsg.data('sl_aux_scanned')) { slLog('已扫描过, 跳过'); return; }
        lastMsg.removeData('sl_session_started');
        var rawText = lastMsg.text();
        // 记录文本指纹，用于检测重新生成/swipe
        lastMsg.data('sl_text_fp', getMsgFingerprint(rawText) || rawText.slice(0, 50).replace(/\s/g, ''));
        lastMsg.data('sl_aux_scanned', 1);
        var bodyText = extractBodyText(rawText);
        var minLen = settings.storyMode === 'comic' ? 20 : 80;
        if (bodyText.length < minLen) { slLog('过短(' + bodyText.length + ')'); lastMsg.removeData('sl_aux_scanned'); lastMsg.removeData('sl_session_started'); return; }
        slLog('管线启动, 清洗后: ' + bodyText.length);
        var enhanced = await runAuxPipeline(bodyText);
        if (!enhanced) { slLog('无增强输出'); return; }
        if (!settings.msgMap) settings.msgMap = {};
        var mesContainer = lastMsg.closest('.mes');
        var mesId = mesContainer.length ? mesContainer.attr('mesid') : (Date.now() + '');
        // 重新获取 DOM 引用
        var freshContainer = mesId ? jQuery('.mes[mesid="' + mesId + '"]') : jQuery();
        var freshMsg = freshContainer.length ? freshContainer.find('.mes_text') : lastMsg;
        var key = getMsgKey(getChatId(), mesId, freshMsg.text());
        var rawBody = freshMsg.text();
        var startIdx = rawBody.indexOf('正文###');
        var endIdx = rawBody.indexOf('结尾###', startIdx + 1);
        if (startIdx >= 0 && endIdx > startIdx) {
            var reconstructed = rawBody.slice(0, startIdx) + '正文###' + enhanced + '结尾###' + rawBody.slice(endIdx + 5);
            settings.msgMap[key] = reconstructed;
            renderBodyEnhanced(freshMsg, enhanced, startIdx, endIdx);
            slLog('标记模式: 增强文本已回填到 正文###...结尾### 区间');
        } else {
            settings.msgMap[key] = enhanced;
            renderEnhanced(freshMsg, enhanced);
        }
        var keys = Object.keys(settings.msgMap);
        if (keys.length > 50) { delete settings.msgMap[keys[0]]; }
        saveSettings();
        slLog('增强文本已缓存, key=' + key + ' (共' + keys.length + '条缓存)');
        slLog('管线完成, img块:' + (enhanced.match(/\[image:/g) || []).length);
    } catch (e) { slErr('管线失败: ' + e.message); lastMsg.removeData('sl_session_started'); }
}

// ── 消息指纹（正文###后50字，用于检测🔄 重新生成/swipe切换） ──
function getMsgFingerprint(text) {
    var si = text.indexOf('正文###');
    if (si >= 0) return text.slice(si + 5, si + 55).replace(/\s/g, '');
    return text.slice(0, 50).replace(/\s/g, '');
}
// ── 为消息缓存生成唯一 key（含指纹，支持 swipe 分支独立缓存） ──
function getMsgKey(chid, mesid, text) {
    return chid + '_' + mesid + '_' + getMsgFingerprint(text || '').slice(0, 20);
}
// ── 模糊匹配缓存（支持 swipe 分支 + 编辑恢复） ──
function findBestCached(chid, mesid, text) {
    var msgMap = settings.msgMap || {};
    var key = getMsgKey(chid, mesid, text);
    if (msgMap[key] && /\[image:/.test(msgMap[key])) return msgMap[key];
    var prefix = chid + '_' + mesid + '_';
    for (var k in msgMap) {
        if (k.indexOf(prefix) === 0 && msgMap[k] && /\[image:/.test(msgMap[k])) {
            var cachedText = extractBodyContent(msgMap[k]).slice(0, 40).replace(/\s/g, '');
            var msgText = extractBodyContent(text).slice(0, 40).replace(/\s/g, '');
            if (cachedText && msgText && cachedText === msgText) return msgMap[k];
        }
    }
    return null;
}
// ── 清理某条消息的所有 swipe 分支缓存 ──
function clearMsgCache(chid, mesid) {
    var prefix = chid + '_' + mesid + '_';
    for (var k in (settings.msgMap || {})) {
        if (k.indexOf(prefix) === 0) { delete settings.msgMap[k]; slLog('清理旧缓存: ' + k); }
    }
}

// ── 轮询 + 事件钩子注册 ──
export function startPolling() {
    var poll1 = setInterval(function() { scanAllMsgs(); }, 3000);
    var poll2 = setInterval(function() {
        try {
            if (settings.pluginOn === false) return;
            var all = jQuery('.mes_text');
            if (!all.length) return;
            var last = all.last();
            var rawText = last.text();

            // 只检测正文###，不要求结尾###同时存在（startScanSession 会等结尾###）
            if (rawText.indexOf('正文###') < 0) return;

            // 从 DOM 中获取 mesid：优先 closest->parents 兜底
            var mesContainer = last.closest('.mes');
            if (!mesContainer || !mesContainer.length) mesContainer = last.parents('.mes').first();
            var mesId = mesContainer.length ? mesContainer.attr('mesid') : null;
            if (!mesId) { slLog('轮询: 未获取到mesId, 跳过'); return; }

            var chatId = getChatId();
            if (last.data('sl_session_started')) return;     // 已有扫描会话，等待完成
            if (last.data('sl_aux_scanned')) {
                var oldFp = last.data('sl_text_fp');
                var newFp = getMsgFingerprint(rawText) || rawText.slice(0, 50).replace(/\s/g, '');
                if (oldFp && oldFp !== newFp) {
                    slLog('轮询: 检测到文本变化(重新生成/swipe), 清除旧渲染');
                    last.removeData('sl_aux_scanned');
                    last.removeData('sl_session_started');
                    last.find('.sl_img_block, .sl_img_btn').remove();
                    last.css({background:'', 'border-left':'', padding:'', 'border-radius':'', 'line-height':'', color:'', 'font-size':'', overflow:''});
                } else { return; }
            }

            var bodyText = extractBodyText(rawText);
            if (bodyText.length < (settings.storyMode === 'comic' ? 20 : 80)) { slLog('轮询: 正文过短(' + bodyText.length + '字), 跳过'); return; }

            slLog('轮询: 检测到标记, 启动扫描会话, mesId=' + mesId);
            startScanSession(last, mesId, chatId);
        } catch (e) { slErr('轮询异常: ' + e.message); }
    }, 2000);

    // ST 事件钩子
    setTimeout(function() {
        try {
            var ctx = getSTContext();
            var evSrc = ctx.eventSource;
            var evTypes = ctx.event_types || ctx.eventTypes;
            if (evSrc && evSrc.on && evTypes && evTypes.MESSAGE_UPDATED) {
                evSrc.on(evTypes.MESSAGE_UPDATED, function() {
                    setTimeout(restoreImageBlocks, 300);
                });
                slLog('消息编辑钩子就绪喵~ ✨');
            }
            if (evTypes && evTypes.CHAT_CHANGED) {
                evSrc.on(evTypes.CHAT_CHANGED, function() {
                    slLog('检测到聊天切换喵~ 清理旧会话中… ✨');
                    if (scanSession) { clearTimeout(scanSession.timer); scanSession = null; }
                    var last = jQuery('.mes_text').last();
                    setTimeout(function() { restoreImageBlocks(); scanAllMsgs(); }, 2000);
                });
                slLog('聊天切换钩子就绪喵~ ✨');
            }
        } catch (e) { slErr('事件钩子失败喵~ (╥﹏╥)  ' + e.message); }
    }, 5000);

    // 💾 保存定时器引用以便 OFF 时清除
    startPolling._timers = [poll1, poll2];
}
export function stopPolling() {
    if (startPolling._timers) {
        startPolling._timers.forEach(function(t) { clearInterval(t); });
        startPolling._timers = null;
    }
}
// 检查当前角色卡是否有静态档案缓存
export function hasCastCache() {
    try {
        var pf = getProfiles();
        return pf && Object.keys(pf.root[pf.charName].cast || {}).length > 0;
    } catch(e) { return false; }
}

// 暴露扫描器状态给 UI 小窗
export function getScannerStatus() {
    if (!settings.pluginOn) return 'off';
    if (!scanSession) return 'idle';
    var p = scanSession.phase || '';
    if (p === 'wait_marker') return 'waiting_body';
    if (p === 'wait_end') return 'waiting_end';
    if (p === 'done') return 'idle';
    return 'scanning';
}

// ══════════════════════════════
