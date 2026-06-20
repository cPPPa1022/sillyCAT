// ── SillyImage Lab 文本处理 ──

// 提取正文：从 正文###...结尾### 区间取内容
export function extractBodyText(message) {
    if (!message) return "";
    var startIdx = message.indexOf('正文###');
    var endIdx = message.indexOf('结尾###', startIdx + 1);
    if (startIdx >= 0 && endIdx > startIdx) return message.slice(startIdx + 5, endIdx);

    // 单结尾###兼容
    var endMarker = message.indexOf('\n结尾###');
    if (endMarker >= 0) return message.slice(0, endMarker);
    endMarker = message.indexOf('结尾###');
    if (endMarker >= 0) return message.slice(0, endMarker);

    // <content> 标签
    var contentMatch = message.match(/<content>\s*([\s\S]*?)\s*<\/content>/i);
    if (contentMatch) return contentMatch[1].trim();

    // fallback：删 AI 思考标签
    var result = message
        .replace(/<think[\s\S]*?<\/think>/gi, '')
        .replace(/<fox_selc>[\s\S]*?<\/fox_selc>/gi, '')
        .replace(/<fox_tip>[\s\S]*?<\/fox_tip>/gi, '')
        .replace(/<backgrounds>[\s\S]*?<\/backgrounds>/gi, '')
        .replace(/<bginfor>[\s\S]*?<\/bginfor>/gi, '')
        .replace(/<CEstuff>[\s\S]*?<\/CEstuff>/gi, '')
        .replace(/<catsay>[\s\S]*?<\/catsay>/gi, '')
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

// 判断是否包含标记区间
export function hasBodyMarker(text) {
    return text.indexOf('正文###') >= 0 && text.indexOf('结尾###') >= text.indexOf('正文###') + 5;
}

// 从增强文本中提取 [image:] 对应的【提示词】
export function extractImagePrompt(rawText, imageTag) {
    if (!rawText || !imageTag) return "";
    var idx = rawText.indexOf(imageTag);
    if (idx < 0) return '';
    var remaining = rawText.slice(idx + imageTag.length);
    var match = remaining.match(/^\s*\n?\s*【提示词】\s*([^\n]*)/);
    if (match) return match[1].trim();
    return '';
}
