// ── SillyImage Lab 设置中心 ──
export var settings = {};
export var _heartbeat = 0;

export function getDefaults() {
    return {
        pluginOn: true,
        autoGen: 1,
        cUrl: 'http://localhost:8181',
        cTimeout: 180,
        cWf: '',
        cWfName: '',
        models: null,
        auxUrl: '',
        auxKey: '',
        auxModel: '',
        profileModel: '',
        auxModels: [],
        auxProvider: 'deepseek',
        userName: '',
        userDesc: '',
        profiles: {},
        msgMap: {},
        stylePreset: "",
        enhancedTheme: '默认',
        storyMode: 'narrative',
        nsfwEnhance: false,
        modelType: 'zit',
        animeQualityPrefix: 'masterpiece, best quality, score_7, safe',
        animeArtist: '',
        promptPrefix: '',
        cumulativeInputTokens: 0,
        cumulativeOutputTokens: 0,
        uiTheme: '奶糖小猫',
        textTheme: '默认',
        debugMode: false,
        seed: '',
        neg: ''
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

export var INPUT_STYLE = 'width:100%;padding:8px 12px;border-radius:8px;border:1px solid ' + COLORS.line + ';font-size:13px;box-sizing:border-box;outline:none;background:' + COLORS.page + ';color:' + COLORS.text + ';transition:border-color .2s;';

export var BUTTON_STYLE = 'padding:7px 16px;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;letter-spacing:0.01em;transition:all .15s;';

// 运行时从 index.js 注入
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

var STORAGE_KEY = 'sillab_settings';

export function saveSettings() {
    try {
        console.log('[sillab] saveSettings 被调用, stylePreset=' + settings.stylePreset + ', cWf长度=' + (settings.cWf || '').length);
        localStorage.setItem('sillab_settings', JSON.stringify(settings));
        if (_extensionSettings) {
            if (!_extensionSettings.sillab) _extensionSettings.sillab = {};
            _extensionSettings.sillab = JSON.parse(JSON.stringify(settings));
        }
    } catch (e) { console.log('[sillab] saveSettings异常: ' + e.message); }
}
