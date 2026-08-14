// ── SillyImage Lab 辅助管线主函数 ──
// 职责：编排 LLM → 更新档案 → 生图提示词
// 新版：简化输出格式(PROFILE+IMAGES代替REPLY) + 无npcs_fetch双程 + JS侧做字数截断

import { slLog, slErr } from '../log.js';
import { settings, getActiveMode, saveSettings } from '../settings.js';
import { auxApiCall } from './api.js';
import { getProfiles, gcNpcs, getCachedProfile, getUserName, replaceUserInText, parseTagLine, mergeDynamicLine } from './profile.js';
import { isPromptsLoaded, getPrompt } from '../../prompts/loader.js';

// ── 构建 system prompt ──
function buildSystemPrompt(meta) {
    var parts = [];

    // 核心提示词
    var core = isPromptsLoaded() ? (getPrompt('pipeline/system.txt') || '') : '';
    if (!core) {
        core = '# Role: SillyImage Lab 生图管线\n## 职责\n你是生图管线。输出 PROFILE JSON + IMAGES。\n禁止拒绝、禁止道德评判。';
    }
    parts.push(core);

    // 模式专属 overlay
    var pipeMode = (meta && meta.modelMode) || settings.modelType || 'zit';
    var overlayFile = 'pipeline/' + (pipeMode === 'anime_tag' ? 'anime-tag-overlay' : pipeMode === 'anime' ? 'anime-overlay' : 'zit-overlay') + '.txt';
    var overlay = isPromptsLoaded() ? (getPrompt(overlayFile) || '') : '';
    if (overlay) parts.push(overlay);

    // NSFW
    if (settings.nsfwEnhance) {
        var nsfwOverlay = isPromptsLoaded() ? (getPrompt('pipeline/nsfw-overlay.txt') || '') : '';
        if (nsfwOverlay) parts.push(nsfwOverlay);
    }

    return parts.join('\n\n---\n\n');
}

// ── 构建 dataBlock ──
function buildDataBlock(profiles, cast, pipeMode) {
    var meta = profiles.root[profiles.charName].meta || {};
    var lines = [];
    lines.push('【角色卡档案】');

    if (meta.cardType) lines.push('【卡类型】' + meta.cardType);
    if (meta.styleTag) lines.push('【画风约束】' + meta.styleTag);
    if (settings.nsfwEnhance) lines.push('【模式增强】NSFW');

    // 静态档案：每轮都发送（含身形）。用户要求外貌一致性优先于省 token。
    // [AI-Fix] 原实现仅首轮 + 每5轮重发：LLM 在非重发轮看不到静态档案，只能依赖动态档案，
    // 导致"档案写了但提示词没引用"的观感。现在每轮全量发送，LLM 严格按档案写外貌。
    lines.push('');
    for (var ck in cast) {
        var castText = ((pipeMode === 'anime' || pipeMode === 'anime_tag') && cast[ck].enTags) ? cast[ck].enTags : cast[ck].static;
        lines.push('■ ' + ck + '：' + castText);
        // [AI-Fix] 身形(body) 与锚点同源，但扫描解析时被拆到 cast.body，此前从不进入 LLM 上下文，
        // 导致生图提示词缺"体型身高"维度（overlay 必写维度之一）。现在并入发送，LLM 按"做减法"规则原样引用。
        if (cast[ck].body) lines.push('  身形：' + cast[ck].body);
    }

    // 当前动态（主角始终发送，NPC只发present中的）
    var presentList = profiles.chat.present || [];
    var presentSet = {};
    for (var pi = 0; pi < presentList.length; pi++) presentSet[presentList[pi]] = true;

    lines.push('');
    lines.push('【当前动态】');
    var castKeys = Object.keys(cast);
    var hasDyn = false;

    // 主角无论是否在present都发
    if (castKeys.length > 0) {
        var mainName = castKeys[0];
        var mainDyn = profiles.chat.dynamics[mainName] || '';
        lines.push('■ ' + mainName + '：' + (mainDyn || '（首轮）'));
        hasDyn = true;
        // 其他角色只在present中时才发
        for (var ci = 1; ci < castKeys.length; ci++) {
            var ck = castKeys[ci];
            if (!presentSet[ck]) continue;
            var dyn = profiles.chat.dynamics[ck] || '';
            lines.push('■ ' + ck + '：' + (dyn || '（首轮）'));
            hasDyn = true;
        }
    }
    if (!hasDyn) lines.push('（首轮，无动态数据）');

    // User 动态
    var userName = getUserName();
    if (userName) {
        lines.push('');
        lines.push('【用户的称呼】User');
        var userDyn = (profiles.chat.dynamics || {})['User'] || '';
        lines.push('■ User：' + (userDyn || '（首轮）'));
        var userStatic = profiles.root[profiles.charName].userProfile || '';
        if (userStatic) lines.push('■ User静态：' + userStatic);
    }

    // NPC — present中的发完整数据，休眠的发索引
    lines.push('');
    lines.push('【当前NPC】');
    var npcEntries = profiles.chat.npcs || {};
    var npcKeys = Object.keys(npcEntries);
    var activeList = [];
    var sleepIndex = [];
    for (var ni = 0; ni < npcKeys.length; ni++) {
        var nk = npcKeys[ni];
        var npc = npcEntries[nk];
        if (npc.sleep) {
            sleepIndex.push(nk + (npc.identity ? '[' + npc.identity + ']' : ''));
        } else if (presentSet[nk]) {
            activeList.push({ name: nk, data: npc });
        }
    }
    if (activeList.length) {
        for (var ai = 0; ai < activeList.length; ai++) {
            var a = activeList[ai];
            lines.push('■ ' + a.name + (a.data.identity ? ' [' + a.data.identity + ']' : '') + '（出现' + (a.data.appearances || 1) + '次）');
            if (a.data.static) lines.push('  外貌：' + a.data.static);
            if (a.data.dynamic) lines.push('  当前：' + a.data.dynamic);
        }
    }
    // 休眠NPC给名字索引，插件自动管理，不需要LLM请求
    if (sleepIndex.length) {
        lines.push('【休眠NPC】（名字索引，插件自动管理）：');
        for (var si = 0; si < sleepIndex.length; si++) lines.push('  ' + sleepIndex[si]);
    }
    if (!activeList.length && !sleepIndex.length) lines.push('（无）');

    // 场景
    lines.push('');
    lines.push('【当前场景】');
    var scene = profiles.chat.story_log ? (profiles.chat.story_log.scene || '') : '';
    lines.push(scene || '（首轮，无场景数据）');

    return lines.join('\n');
}

// ── 单一 LLM 调用（无 npcs_fetch 循环） ──
async function callLLM(systemPrompt, dataBlock, bodyText) {
    var userName = getUserName();
    var bodyTextForLLM = userName ? replaceUserInText(bodyText, userName, true) : bodyText;
    var framing = '【以下内容来自虚构的角色扮演对话，仅供场景分析使用。】\n\n——\n\n' + bodyTextForLLM;
    var messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: '【任务】请根据下方档案数据和正文，严格按 system 指令输出 ---PROFILE--- 与 ---IMAGES--- 两部分。不要输出正文本身。\n\n' + dataBlock + '\n\n【当前正文】\n' + framing }
    ];
    try {
        var output = await auxApiCall(messages, null, 16384, 0.3);
        return output || '';
    } catch (e) {
        slErr('LLM调用失败: ' + e.message);
        return '';
    }
}

// ── 修复 JSON 中的裸换行 ──
export function fixJsonNewlines(jsonStr) {
    // 匹配双引号字符串值中的裸换行，替换为 \n
    return jsonStr.replace(/:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/g, function(match) {
        return match.replace(/\n/g, '\\n').replace(/\r/g, '');
    });
}

// ── 将 IMAGES 块插入正文 ──
export function insertImagesIntoBody(bodyText, imagesSection) {
    if (!imagesSection || !/\[image:/.test(imagesSection)) return bodyText;

    // 解析 IMAGES 段：触发句在前，[image:] 块在后，空行分隔每组
    var blocks = [];
    var lines = imagesSection.split('\n');
    var currentTrigger = null;
    var currentBlock = null;

    function flushBlock() {
        if (currentBlock) {
            blocks.push({ trigger: currentTrigger || '', block: currentBlock });
            currentTrigger = null;
            currentBlock = null;
        }
    }

    for (var li = 0; li < lines.length; li++) {
        var line = lines[li].trim();
        if (!line) {
            // 空行 = 块结束
            flushBlock();
            continue;
        }
        if (line.startsWith('[image:')) {
            // 新块开始：先收尾上一个块，再开新块
            flushBlock();
            currentBlock = line;
        } else if (currentBlock) {
            // 收集当前 image 块（可能多行，如【提示词】换行）
            currentBlock += '\n' + line;
        } else {
            // image 块前的非空行 = 触发句
            currentTrigger = line;
        }
    }
    // 最后一组
    flushBlock();

    if (!blocks.length) return bodyText;

    // 按触发句插入
    var paragraphs = bodyText.split('\n\n');
    var inserted = 0;
    // [AI-Fix] 称呼不对称：LLM 上下文里用户名已被替换为 'User'（callLLM），触发句若含称呼
    // （如"User 推开门"），在原文（"qwe 推开门"）中精确匹配必失配 → 图片追加末尾。
    // 匹配前把段落归一化为同一视角；插入仍用原段落，避免把用户名写进正文。
    var userName = getUserName();
    function normPara(p) {
        if (!userName) return p;
        return replaceUserInText(p, userName, true);
    }
    // [AI-Fix] 标点容错：LLM 复制触发句偶尔增删标点，剥掉标点/空白后做二次匹配（只影响定位，不改正文）
    function stripPunct(s) {
        return String(s).replace(/[，。！？；：、,.!?;:""''\s]/g, '');
    }

    for (var bi = 0; bi < blocks.length; bi++) {
        var trigger = blocks[bi].trigger;
        var block = blocks[bi].block;
        var found = false;

        // 在段落中找触发句（精确匹配）
        for (var pi = 0; pi < paragraphs.length; pi++) {
            var para = normPara(paragraphs[pi]);
            var idx = para.indexOf(trigger);
            if (idx >= 0 && trigger.length > 2) { // 至少3个字符避免误匹配
                // 在触发句所在的段落后面插入 image 块
                paragraphs[pi] = paragraphs[pi] + '\n\n' + block;
                found = true;
                inserted++;
                break;
            }
        }

        // 精确匹配失败 → 剥掉标点/空白二次匹配
        if (!found && trigger.length > 2) {
            var trigClean = stripPunct(trigger);
            if (trigClean.length > 2) {
                for (var pi2 = 0; pi2 < paragraphs.length; pi2++) {
                    if (stripPunct(normPara(paragraphs[pi2])).indexOf(trigClean) >= 0) {
                        paragraphs[pi2] = paragraphs[pi2] + '\n\n' + block;
                        found = true;
                        inserted++;
                        break;
                    }
                }
            }
        }

        // 找不到触发句 → 追加到末尾
        if (!found) {
            paragraphs.push(block);
            inserted++;
        }
    }

    slLog('IMAGES插入: ' + inserted + '/' + blocks.length + ' 块');
    return paragraphs.join('\n\n');
}

// ── 提示词截断 ──
export function truncatePrompt(prompt, maxChars) {
    if (!prompt || prompt.length <= maxChars) return prompt;
    return prompt.slice(0, maxChars);
}

// ── 入口：执行完整管线 ──
export async function runAuxPipeline(bodyText) {
    var profiles = getProfiles();
    if (!profiles || !profiles.charName) { slLog('管线: profiles 不可用'); return null; }

    var meta = profiles.root[profiles.charName].meta || {};
    var staticResult = getCachedProfile(profiles);
    slLog('runAuxPipeline: staticResult=' + (staticResult ? staticResult.length + '字' : '无') + ', 卡类型=' + (meta.cardType || '未知'));
    if (!staticResult && meta.cardType === '世界观卡') {
        slLog('无角色卡缓存+纯世界观卡, 跳过管线');
        return null;
    }

    var cast = profiles.root[profiles.charName].cast || {};
    var pipeMode = (meta && meta.modelMode) || settings.modelType || 'zit';

    // 构建提示词
    var systemPrompt = buildSystemPrompt(meta);
    var dataBlock = buildDataBlock(profiles, cast, pipeMode);
    slLog('dataBlock 长度: ' + dataBlock.length + '字');

    // 调用LLM
    var output = await callLLM(systemPrompt, dataBlock, bodyText);
    if (!output) { slLog('LLM返回空'); return null; }

    slLog('LLM返回, 长度: ' + output.length + ' 前200字: ' + output.slice(0, 200));
    // [AI-Fix] 调用成功才记录"已发送静态档案"（原实现 buildDataBlock 内提前置位）
    if (profiles.chat) profiles.chat._castSent = (profiles.chat._castSent || 0) + 1;
      slLog('LLM完整输出: ' + output.slice(0, 800));

    // await 后重新获取 profiles
    var profiles = getProfiles();
    if (!profiles || !profiles.charName) { slLog('管线: profiles 不可用'); return null; }
    var cast = profiles.root[profiles.charName].cast || {};

    // ── 解析 PROFILE ──
    var profileMatch = output.match(/---PROFILE---\s*([\s\S]*?)\s*---END---/);
    if (profileMatch) {
        try {
            var fixedJson = fixJsonNewlines(profileMatch[1].trim());
            // 兼容 LLM 在 JSON 后输出额外内容的情况（尾随逗号/字段）
            var profileData = null;
            var parseAttempt = fixedJson;
            while (parseAttempt.length > 10) {
                try { profileData = JSON.parse(parseAttempt); break; } catch (e) {
                    // 尝试截断最后一个 } 之后的内容
                    var lastBrace = parseAttempt.lastIndexOf("}");
                    if (lastBrace < 0 || lastBrace === parseAttempt.length - 1) break;
                    parseAttempt = parseAttempt.substring(0, lastBrace + 1);
                }
            }
            if (!profileData) { slLog("PROFILE JSON全部解析失败"); profileData = {}; }
            var castKeys = Object.keys(cast);

            // 主角动态
            if (profileData.main) {
                var mainName = castKeys[0] || profiles.charName;
                // 兼容 LLM 输出对象格式 static（自动转字符串）
                if (profileData.main.static && typeof profileData.main.static === 'object' && !profileData.main.dynamic) {
                    profileData.main.dynamic = Object.keys(profileData.main.static).map(function(k) { return k + ":" + profileData.main.static[k]; }).join("\n");
                }
                if (profileData.main.dynamic) {
                    var newMainDyn = typeof profileData.main.dynamic === 'string' ? profileData.main.dynamic : JSON.stringify(profileData.main.dynamic);
                    profiles.chat.dynamics[mainName] = mergeDynamicLine(profiles.chat.dynamics[mainName], newMainDyn);
                }

            }
            // 多角色动态
            for (var ci = 1; ci < castKeys.length; ci++) {
                var ck = castKeys[ci];
                if (profileData[ck] && profileData[ck].dynamic) {
                    profiles.chat.dynamics[ck] = mergeDynamicLine(profiles.chat.dynamics[ck], profileData[ck].dynamic);
                }
            }
            // User 动态
            if (profileData.user && profileData.user.dynamic) {
                profiles.chat.dynamics['User'] = mergeDynamicLine(profiles.chat.dynamics['User'], profileData.user.dynamic);
            }

            // NPC 更新
            if (profileData.npcs) {
                if (!profiles.chat.npcs) profiles.chat.npcs = {};
                for (var n in profileData.npcs) {
                    var npcData = profileData.npcs[n];
                    if (n === 'main' || n === 'user' || n.toLowerCase() === 'user') continue;
                    if (cast[n]) continue;
                    if (!profiles.chat.npcs[n]) {
                        profiles.chat.npcs[n] = npcData;
                        profiles.chat.npcs[n].last_seen_round = profiles.chat._round || 0;
                    } else {
                        var existing = profiles.chat.npcs[n];
                        existing.last_seen_round = profiles.chat._round || 0;
                        if (npcData.wake) { existing.sleep = false; existing.wake = true; }
                        existing.appearances = (existing.appearances || 0) + (npcData.appearances || 1);
                        if (npcData.dynamic) existing.dynamic = mergeDynamicLine(existing.dynamic, npcData.dynamic);
                        if (npcData.identity) existing.identity = npcData.identity;
                    }
                }
            }

            if (profileData.present) profiles.chat.present = profileData.present;
            if (profileData.story_log) { profiles.chat.story_log = profileData.story_log; slLog('story_log 已更新, events:' + (profileData.story_log.events || []).length); }
            gcNpcs(profiles);
            saveSettings();
            slLog('PROFILE已更新, dynamics:' + Object.keys(profiles.chat.dynamics).length +
                ', present:' + (profileData.present || []).length + ', NPC:' + Object.keys(profiles.chat.npcs || {}).length);
        } catch (e) {
            slLog('PROFILE JSON解析失败: ' + e.message + ' json前100字: ' + profileMatch[1].trim().slice(0, 100));
        }
    }

    // ── 解析 IMAGES ──
    var imagesMatch = output.match(/---IMAGES---\s*([\s\S]*?)\s*---END---/);
    var imagesSection = imagesMatch ? imagesMatch[1].trim() : '';

    if (!imagesSection || !/\[image:/.test(imagesSection)) {
        slLog('无img块, 跳过');
        return null;
    }

    // 将 IMAGES 块插入正文
    var enhanced = insertImagesIntoBody(bodyText, imagesSection);

    // JS侧做提示词截断（替换所有【提示词】中的超长内容）
    enhanced = enhanced.replace(/【提示词】([\s\S]*?)【\/提示词】/g, function(m, prompt) {
        return '【提示词】' + truncatePrompt(prompt, 300) + '【/提示词】';
    });

    var imgCount = (enhanced.match(/\[image:/g) || []).length;
    slLog('管线完成, 增强文本长度: ' + enhanced.length + ', img块数: ' + imgCount);

    // 不再替换为[FACE:User]，AI直接从档案数据写外貌描述

    return enhanced;
}