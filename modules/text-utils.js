// ── SillyImage Lab 文本处理工具 ──

// 清洗 AI 模型输出的 XML/思考标签
export function stripAiTags(text) {
    if (!text) return '';
    return text
        .replace(/<think[\s\S]*?<\/think>/gi, '')
        .replace(/<fox_selc>[\s\S]*?<\/fox_selc>/gi, '')
        .replace(/<fox_tip>[\s\S]*?<\/fox_tip>/gi, '')
        .replace(/<CEstuff>[\s\S]*?<\/CEstuff>/gi, '')
        .replace(/<catsay>[\s\S]*?<\/catsay>/gi, '');
}

// 提取正文：从 正文###...结尾### 区间取内容
export function extractBodyText(message) {
    if (!message) return '';
    var startIdx = message.indexOf('正文###');
    var endIdx = message.indexOf('结尾###', startIdx + 1);
    if (startIdx >= 0 && endIdx > startIdx) return message.slice(startIdx + 5, endIdx);

    var endMarker = message.indexOf('\n结尾###');
    if (endMarker >= 0) return message.slice(0, endMarker);
    endMarker = message.indexOf('结尾###');
    if (endMarker >= 0) return message.slice(0, endMarker);

    var contentMatch = message.match(/<content>\s*([\s\S]*?)\s*<\/content>/i);
    if (contentMatch) return contentMatch[1].trim();

    var result = stripAiTags(message)
        .replace(/<backgrounds>[\s\S]*?<\/backgrounds>/gi, '')
        .replace(/<bginfor>[\s\S]*?<\/bginfor>/gi, '')
        .replace(/\n{3,}/g, '\n\n').trim();
    return result;
}

// 提取标记区间正文（用于缓存，不 trim）
export function extractBodyContent(text) {
    var startIdx = text.indexOf('正文###');
    var endIdx = text.indexOf('结尾###', startIdx + 1);
    if (startIdx >= 0 && endIdx > startIdx) return text.slice(startIdx + 5, endIdx);
    return text;
}

export function hasBodyMarker(text) {
    return text.indexOf('正文###') >= 0 && text.indexOf('结尾###') >= text.indexOf('正文###') + 5;
}

// 从增强文本中提取 [image:] 对应的【提示词】
export function extractImagePrompt(rawText, imageTag) {
    if (!rawText || !imageTag) return '';
    var idx = rawText.indexOf(imageTag);
    if (idx < 0) return '';
    var remaining = rawText.slice(idx + imageTag.length);
    var m = remaining.match(/^\s*\n?\s*【提示词[】:：]*\s*([\s\S]*?)【\/提示词】/);
    if (m) return m[1].replace(/<!--[\s\S]*?-->/g,'').replace(/<[^>]+>/g,'').trim();
    var match = remaining.match(/^\s*\n?\s*【提示词[】:：]*\s*([\s\S]*?)(?=\n\n|\n?【|<[a-zA-Z/!]|$)/);
    if (match) return match[1].replace(/<!--[\s\S]*?-->/g,'').replace(/<[^>]+>/g,'').trim();
    return '';
}

// Anime 模式下清除 prompt 中的中文字符
export function cleanAnimePrompt(prompt) {
    if (!prompt) return prompt;
    return prompt
        .replace(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]+[：:]\s*[^,\n]+/g, '')
        .replace(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]+/g, '')
        .replace(/\s*,\s*,+/g, ',')
        .replace(/,\s*$/, '')
        .trim();
}
