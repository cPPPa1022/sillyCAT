// ── SillyImage Lab 生图排队 ──
import { slLog } from './log.js';
import { settings, COLORS, getSTContext } from './settings.js';
import { imgCacheSet } from './cache.js';
import { generateImage } from './comfyui.js';

var imageQueue = [];
var queueRunning = false;

async function processImageQueue() {
    if (queueRunning || !imageQueue.length) return;
    queueRunning = true;
    var task = imageQueue.shift();
    slLog('排队处理:', task.id, '剩余:', imageQueue.length);
    try {
        var workflow = JSON.parse(settings.cWf);
        var result = await generateImage(workflow, task.prompt);
        imgCacheSet(task.prompt, result.url);
        task.btn.text('\u21bb \u91cd\u65b0\u751f\u6210').css({ background: COLORS.card, color: COLORS.text });
        task.btn.siblings('img').remove();
        var imgEl = jQuery('<img src="' + result.url + '" style="max-width:100%;border-radius:12px;margin-top:6px;display:block;" onload="this.style.display=\'block\'">');
        task.btn.after(imgEl);
        imgEl[0].offsetHeight;
        task.btn.parent()[0].offsetHeight;
        imgCacheSet(task.prompt, result.url);
        getSTContext().saveMetadataDebounced && getSTContext().saveMetadataDebounced();
        // 重新绑定点击，恢复按钮功能
        task.btn.on('click', async function() {
            var b = jQuery(this);
            if (b.text() === '排队中\u2026') return;
            enqueueGen(b, b.data('prompt'));
        });
        slLog('排队完成:', task.id);
    } catch (e) {
        task.btn.text('\u2715 \u91cd\u8bd5').css({ background: COLORS.red, color: '#fff' });
        task.btn.on('click', async function() {
            var b = jQuery(this);
            if (b.text() === '排队中\u2026') return;
            enqueueGen(b, b.data('prompt'));
        });
        slLog('排队失败:', task.id, e.message);
    }
    queueRunning = false;
    processImageQueue();
}

export function enqueueGen(btn, prompt) {
    var id = 'g_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5);
    btn.text('排队中\u2026').css({ background: COLORS.orange, color: '#fff' }).off('click');
    imageQueue.push({ id: id, btn: btn, prompt: prompt });
    slLog('入队:', id, '队列长度:', imageQueue.length);
    processImageQueue();
}

export function getQueueLength() {
    return imageQueue.length;
}
