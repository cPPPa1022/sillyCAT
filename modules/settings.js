// ── SillyImage Lab 设置中心 ──
export var settings = {};

export function getDefaults() {
    return {
        pluginOn: true,
        autoGen: 1,
        cUrl: 'http://localhost:8181',
        cTimeout: 180,
        cWf: '',
        cWfName: '',
        auxUrl: '',
        auxKey: '',
        auxModel: '',
        profileModel: '',
        userName: '',
        userDesc: '',
        profiles: {},
        msgMap: {},
        stylePreset: '',
        enhancedTheme: '默认',
        nsfwEnhance: false,
        modelType: 'zit',
        promptPrefix: '',
        uiTheme: '奶糖小猫',
        textTheme: '默认',
        debugMode: false,
    };
}

export var COLORS = {
    page: '#ffffff',
    card: '#f5f5f7',
    input: '#ebebed',
    text: '#1d1d1f',
    sub: '#6e6e73',
    mute: '#aeaeb2',
    line: '#d1d1d6',
    blue: '#0A84FF',
    orange: '#FF9F0A',
    green: '#30d158',
    red: '#ff3b30'
};

// ── 运行时依赖（从 index.js 注入） ──
var _getContext = null;
var _extensionSettings = null;

export function initSettings(getContextFn, extSettings) {
    _getContext = getContextFn;
    _extensionSettings = extSettings;
}

export function getSTContext() {
    if (!_getContext) throw new Error('settings not initialized');
    return _getContext();
}

export function getSTHeaders() {
    return getSTContext().getRequestHeaders();
}

export function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ── 设置持久化（localStorage + extension_settings 双存） ──
export function saveSettings() {
    try {
        localStorage.setItem('sillab_settings', JSON.stringify(settings));
        if (_extensionSettings) {
            if (!_extensionSettings.sillab) _extensionSettings.sillab = {};
            _extensionSettings.sillab = JSON.parse(JSON.stringify(settings));
        }
    } catch (e) { console.log('[sillab] saveSettings异常: ' + e.message); }
}

// ── 统一模式查询 ──
// 返回角色卡锁定的模式（meta.modelMode），无锁定则返回 settings.modelType（可修改值）
// 所有需要查模式的地方统一走此函数，确保逻辑一致
export function getActiveMode() {
    try {
        var ctx = getSTContext();
        var charName = ctx.characters?.[ctx.characterId]?.data?.name || '';
        if (charName && settings.profiles && settings.profiles[charName] && settings.profiles[charName].meta) {
            var locked = settings.profiles[charName].meta.modelMode;
            if (locked) return locked;
        }
    } catch (e) {}
    return settings.modelType || 'zit';
}
