// ── SillyImage Lab 提示词加载器 ──
// ES module，被 index.js import 使用
// 从 prompts/ 文件夹异步加载提示词文件，缓存到内存
// 加载失败返回 undefined，调用方使用 fallback

var PROMPTS_CACHE = {};
var PROMPTS_LOADED = false;

export async function loadPrompts(baseUrl) {
    var files = [
        'static-profile/system.txt',
        'static-profile/rules.json',
        'static-profile/examples.json',
        'aux-pipeline/jailbreak-dp.txt',
        'aux-pipeline/jailbreak-gemini.txt',
        'aux-pipeline/task.txt',
        'aux-pipeline/zit-overlay.txt',
        'aux-pipeline/anime-overlay.txt',
        'aux-pipeline/nsfw-overlay.txt',
        'aux-pipeline/comic-overlay.txt',
        'aux-pipeline/worldcard-npc.txt',
        'aux-pipeline/rules.json',
        'aux-pipeline/examples.json',
    ];
    var loaded = 0;
    for (var i = 0; i < files.length; i++) {
        var f = files[i];
        try {
            var url = baseUrl.replace(/\/+$/, '') + '/' + f + '?t=' + Date.now();
            var r = await fetch(url);
            if (!r.ok) throw new Error('HTTP ' + r.status);
            PROMPTS_CACHE[f] = f.endsWith('.json') ? await r.json() : await r.text();
            loaded++;
        } catch (e) {
            console.warn('[SillyLab] 提示词加载跳过: ' + f + ' — ' + (e.message || '').slice(0, 80));
        }
    }
    PROMPTS_LOADED = true;
    var allFailed = (loaded === 0);
    console.warn('[SillyLab] 提示词加载: ' + loaded + '/' + files.length + (allFailed ? ' (全部失败，使用默认值)' : ''));
}

export function getPrompt(path) {
    return PROMPTS_CACHE[path];
}

export function isPromptsLoaded() {
    return PROMPTS_LOADED;
}
