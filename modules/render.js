// ── SillyImage Lab 渲染 ──
import { slLog, slErr } from './log.js';
import { settings, COLORS, escapeHtml, getSTContext, saveSettings, getActiveMode } from './settings.js';

// ── 增强文本主题 CSS ──
export function getThemeCSS() {
    var t = settings.enhancedTheme || 'default';
    switch (t) {
        case 'book':
            return {
                background: '#ede4d3',
                'border-left': '3px solid #8b7355',
                'border-right': '1px solid #c4b698',
                padding: '14px 20px',
                'border-radius': '6px',
                'line-height': '1.9',
                color: '#3d2b1f',
                'font-size': '13px',
                'font-family': 'Georgia, "Noto Serif SC", serif',
                overflow: 'visible'
            };
        case 'minimal':
            return {
                background: 'transparent',
                'border-left': 'none',
                'border-bottom': '1px solid #e0e0e0',
                padding: '8px 0',
                'border-radius': '0',
                'line-height': '1.8',
                color: COLORS.text,
                'font-size': '13px',
                overflow: 'visible'
            };
        case 'dark':
            return {
                background: '#111',
                'border-left': '3px solid #5af',
                padding: '12px 16px',
                'border-radius': '10px',
                'line-height': '1.8',
                color: '#fff',
                'font-size': '13px',
                overflow: 'visible'
            };
        case 'cat':
            return {
                background: 'linear-gradient(135deg, #fff5f5 0%, #ffe8ec 100%)',
                'border-left': '4px solid #ff9eb5',
                'border-top': '2px solid #ffb8c9',
                'border-right': '2px solid #ffb8c9',
                'border-bottom': '2px solid #ffb8c9',
                padding: '16px 20px',
                'border-radius': '16px',
                'line-height': '1.9',
                color: '#3d2b3d',
                'font-size': '13px',
                overflow: 'visible',
                'box-shadow': '0 2px 12px rgba(255,158,181,0.2), inset 0 0 0 1px rgba(255,158,181,0.15)',
                position: 'relative',
                'font-family': '"Noto Sans SC", "Segoe UI Emoji", sans-serif'
            };
        default: // 'default'
            return {
                background: '#f5f0eb',
                'border-left': '3px solid #5fa88c',
                padding: '12px 16px',
                'border-radius': '10px',
                'line-height': '1.8',
                color: '#2d3e4f',
                'font-size': '13px',
                overflow: 'visible'
            };
    }
}
import { imgCacheGet, imgCacheSet } from './cache.js';
import { extractImagePrompt, extractBodyContent, hasBodyMarker, cleanAnimePrompt } from './text-utils.js';
import { resolveFacePrompt } from './pipeline/profile.js';
import { generateImage } from './comfyui.js';

// ── 构造 img 卡片 HTML ──
export function buildImgCard(scene, fullPrompt, cachedImage) {
    return '<div class="sl_img_block" style="margin:8px 0;padding:10px 12px;border-radius:10px;background:' + COLORS.card + ';border:1px solid ' + COLORS.line + ';" title="' + escapeHtml(fullPrompt) + '">' +
        '<div style="font-size:11px;color:' + COLORS.sub + ';margin-bottom:4px;">' + escapeHtml(scene.slice(0, 100)) + '</div>' +
        (cachedImage ? '<img src="' + escapeHtml(cachedImage) + '" style="max-width:100%;border-radius:12px;margin-top:6px;display:block;">' : '') +
        '<span class="sl_img_btn" data-prompt="' + escapeHtml(fullPrompt) + '" style="display:inline-block;padding:5px 14px;margin-top:4px;background:' + (cachedImage ? COLORS.card : COLORS.blue) + ';color:' + (cachedImage ? COLORS.text : '#fff') + ';border-radius:8px;cursor:pointer;font-size:11px;font-weight:600;">' + (cachedImage ? '\u21bb \u91cd\u65b0\u751f\u6210' : '\u2726 \u751f\u6210\u56fe\u7247') + '</span>' +
        (fullPrompt !== scene ? '<div style="font-size:10px;color:#aeaeb2;font-family:Consolas,monospace;line-height:1.4;margin-top:6px;padding-top:4px;border-top:1px dotted ' + COLORS.line + ';word-break:break-all;">🐱 ' + escapeHtml(fullPrompt) + '</div>' : '') +
        '</div>';
}

// ── 纯渲染 enhanced 正文为 HTML ──
export function renderEnhancedBodyHtml(enhanced) {
    var imageScenes = [];
    var pid = 0;
    var safe = enhanced.replace(/\[image:\s*[\s\S]*?\]/g, function(m) {
        var match = m.match(/\[image:\s*([\s\S]*?)\]/);
        var scene = (match && match[1]) ? match[1].trim() : '';
        imageScenes.push(scene);
        return '__SLIMG' + (pid++) + '__';
    });
    safe = safe.replace(/\n?\s*【💬 💬 提示词】[^\n]*\n?/g, '\n');
    safe = safe.replace(/\n?\s*【提示词[】:：][^\n]*【\/提示词】/g, '\n');
    safe = safe.replace(/\n?\s*【提示词[】:：][\s\S]*?【\/提示词】/g, '\n');
    safe = safe.replace(/\n?\s*【提示词[】:：][^\n]*/g, '\n');
    safe = safe.replace(/\n{1,2}/g, '\n\n');
    return safe.split('\n').map(function(line) { return escapeHtml(line); }).join('<br>')
        .replace(/__SLIMG(\d+)__/g, function(_, n) {
            var scene = imageScenes[+n] || '';
            var imageTag = '[image: ' + scene + ']';
            var fullPrompt = resolveFacePrompt(extractImagePrompt(enhanced, imageTag) || scene);
            if (getActiveMode() === 'anime' || getActiveMode() === 'anime_tag') fullPrompt = cleanAnimePrompt(fullPrompt);  // 使用 getActiveMode 统一查询锁定的模式
            return buildImgCard(scene, fullPrompt, imgCacheGet(fullPrompt));
        });
}

// ── 正文###...结尾### 区间渲染 ──
export function renderBodyEnhanced(element, enhanced, startIdx, endIdx) {
    // 外部传入了纯文本定位 → 用纯文本切分重建
    if (startIdx !== undefined && endIdx !== undefined) {
        var html2 = element.html();
        var bodyIdx = html2.indexOf('正文###');
        if (bodyIdx === -1) { renderEnhanced(element, enhanced); return; }
        var beforeHtml = html2.slice(0, bodyIdx);
        var afterHtml = html2.slice(html2.indexOf('结尾###', bodyIdx + 1) + 5);
        var rebuilt = beforeHtml + renderEnhancedBodyHtml(enhanced) + afterHtml;
        element.html(rebuilt);
    } else {
        // 旧逻辑：HTML 地图找标记
        var html = element.html();
        startIdx = html.indexOf('正文###');
        endIdx = html.indexOf('结尾###', startIdx + 1);
        if (startIdx === -1 || endIdx === -1) { renderEnhanced(element, enhanced); return; }
        
    var cssStr = Object.keys(getThemeCSS()).map(function(k) { return k + ":" + getThemeCSS()[k]; }).join(";");
    element.html(html.slice(0, startIdx) + '<div class="sl_enhanced" style="' + cssStr + '">' + renderEnhancedBodyHtml(enhanced) + '</div>' + html.slice(endIdx + 5));

    }
    element.css(getThemeCSS());
    element.addClass('sl_enhanced');
    // 小猫模式装饰
    if (settings.enhancedTheme === 'cat' && !element.find('.sl_cat_deco').length) {
        element.prepend('<div class="sl_cat_deco" style="font-size:20px;line-height:1;margin-bottom:4px;opacity:0.5;user-select:none;">🐱<span style="font-size:10px;margin-left:4px;color:#ff9eb5;">meow~</span></div>');
    }
    if (settings.autoGen === 1 && !_restoringBlocks) { setTimeout(function() { element.find('.sl_img_btn').each(function() { var b = jQuery(this); if (b.text().indexOf('生成图片') >= 0) b.trigger('click'); }); }, 600); }
}

// ── 全量渲染（无标记 fallback） ──
export function renderEnhanced(element, text) {
    var protect = {}, pid = 0;
    var safe = text.replace(/\[image:\s*[\s\S]*?\]/g, function(m) {
        var key = '__SLIMG' + (pid++) + '__';
        protect[key] = m;
        return key;
    });
    safe = safe.replace(/\n?\s*【💬 💬 提示词】[^\n]*\n?/g, '\n');
    safe = safe.replace(/\n?\s*【提示词】[^\n]*\n?/g, '\n');
    safe = safe.replace(/\n{1,2}/g, '\n\n');
    element.html(safe.split('\n').map(function(l) { return escapeHtml(l); }).join('<br>')
        .replace(/__SLIMG(\d+)__/g, function(_, n) { return protect['__SLIMG' + n + '__']; }));
    scanDom(element);
    element.css(getThemeCSS());
    if (settings.enhancedTheme === 'cat' && !element.find('.sl_cat_deco').length) {
        element.prepend('<div class="sl_cat_deco" style="font-size:20px;line-height:1;margin-bottom:4px;opacity:0.5;user-select:none;">🐱<span style="font-size:10px;margin-left:4px;color:#ff9eb5;">meow~</span></div>');
    }
    element.addClass('sl_enhanced');
    if (settings.autoGen === 1 && !_restoringBlocks) { setTimeout(function() { element.find('.sl_img_btn').each(function() { var b = jQuery(this); if (b.text().indexOf('生成图片') >= 0) b.trigger('click'); }); }, 600); }
}

// ── 绑定生图按钮（事件委托：绑定一次永久有效，不受 DOM 重建影响） ──
var _imgBtnBound = false;
function bindImageButtonsGlobal() {
    if (_imgBtnBound) return;
    _imgBtnBound = true;
    jQuery(document).on('click', '.sl_img_btn', async function() {
        var btn = jQuery(this), prompt = btn.data('prompt');
        if (btn.text() === '排队中…') return;
        enqueueGen(btn, prompt);
    });
}
bindImageButtonsGlobal();
// 排队引用由 queue.js / index.js 提供，这里先声明
var _enqueueGen = null;
export function setEnqueueGen(fn) { _enqueueGen = fn; }
function enqueueGen(btn, prompt) { if (_enqueueGen) _enqueueGen(btn, prompt); else { slErr('enqueueGen 未初始化'); } }

// ── 扫描 DOM 中的 [image:] 标记 ──
export function scanDom(messageDiv) {
    if (/sl_img_btn/.test(messageDiv.html()) || /sl_img_block/.test(messageDiv.html())) return;
    var raw = messageDiv.text();
    if (!/\[image:/.test(raw)) return;
    var rawOriginal = raw;
    raw = raw.replace(/\n?\s*【💬 提示词】[^\n]*\n?/g, '\n');
    var parts = raw.split(/(\[image:\s*[\s\S]*?\])/g);
    var html = parts.map(function(part) {
        if (/^\[image:/.test(part)) {
            var match = part.match(/\[image:\s*([\s\S]*?)\]/);
            var scene = (match && match[1]) ? match[1].trim() : '';
            var promptContent = extractImagePrompt(rawOriginal, part) || scene; var fullPrompt = resolveFacePrompt(scene ? scene + ', ' + promptContent : promptContent);
            if (getActiveMode() === 'anime' || getActiveMode() === 'anime_tag') fullPrompt = cleanAnimePrompt(fullPrompt);  // 使用 getActiveMode 统一查询锁定的模式
            return buildImgCard(scene, fullPrompt, imgCacheGet(fullPrompt));
        }
        return escapeHtml(part).replace(/\n/g, '<br>');
    }).join('');
    messageDiv.html(html);
}

// ── 恢复图片块（编辑后） ──
var _getChatId, _getSTContext, _restoringBlocks = false; // 从外部注入的函数
export function setRestoreDeps(getChatIdFn, getContextFn) { _getChatId = getChatIdFn; _getSTContext = getContextFn; }

export function restoreImageBlocks() {
    if (!_getChatId || !_getSTContext) return;
    _restoringBlocks = true;
    // [AI-Fix] 所有早退路径都归零 _restoringBlocks，否则 autoGen 永久停摆
    if (jQuery('.edit_textarea').length || jQuery('#curEditTextarea').length) { _restoringBlocks = false; return; }
    var chatId = _getChatId();
    jQuery('.mes').each(function() {
        var mesEl = jQuery(this).find('.mes_text');
        if (!mesEl.length) return;
        var mesId = jQuery(this).attr('mesid');
        if (!mesId) { mesId = jQuery(this).attr('data-mesid') || jQuery(this).attr('id'); }
        if (!mesId || !mesId.trim()) return;
        if (/sl_img_btn/.test(mesEl.html()) || mesEl.find('.sl_img_block').length) return;
        var key = chatId + '_' + mesId;
        var cached = (settings.msgMap || {})[key];
        if (!cached) {
            var fpPrefix = key + '_';
            for (var kk in (settings.msgMap || {})) {
                if (kk.indexOf(fpPrefix) === 0) { cached = settings.msgMap[kk]; break; }
            }
        }
        // 模糊匹配编辑后的 mesId 变化
        if (!cached) {
            var msgText = mesEl.text().slice(0, 120);
            var msgMap = settings.msgMap || {};
            for (var k in msgMap) {
                if (k.indexOf(chatId + '_') === 0 && msgMap[k] && /\[image:/.test(msgMap[k])) {
                    var cachedText = extractBodyContent(msgMap[k]).slice(0, 120);
                    if (cachedText && msgText && (cachedText.indexOf(msgText.slice(0, 40)) >= 0 || msgText.indexOf(cachedText.slice(0, 40)) >= 0)) {
                        // 多条匹配时选有 结尾### 的完整条目
                        var best = msgMap[k];
                        for (var k2 in msgMap) {
                            if (k2 === k || k2.indexOf(chatId + '_') !== 0) continue;
                            var ct2 = extractBodyContent(msgMap[k2]).slice(0,120);
                            if (ct2 && (ct2.indexOf(msgText.slice(0,40))>=0 || msgText.indexOf(ct2.slice(0,40))>=0) && msgMap[k2].indexOf('结尾###')>=0) { best = msgMap[k2]; break; }
                        }
                        cached = best;
                        slLog('编辑恢复: 模糊匹配', k, '→', mesId);
                        break;
                    }
                }
            }
        }
        if (!cached || !/\[image:/.test(cached)) return;
        var bodyOnly = hasBodyMarker(cached) ? extractBodyContent(cached) : null;
        if (bodyOnly && /\[image:/.test(bodyOnly)) {
            renderBodyEnhanced(mesEl, bodyOnly);
        } else {
            renderEnhanced(mesEl, cached);
        }
    });
    _restoringBlocks = false;
}

