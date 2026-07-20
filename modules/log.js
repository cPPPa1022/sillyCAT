// ── SillyImage Lab 内置日志系统 ──
var logLines = [];
export function slLog(msg) {
    var args = Array.prototype.slice.call(arguments);
    var time = new Date().toLocaleTimeString();
    var line = '[' + time + '] ' + args.join(' ');
    logLines.push(line);
    if (logLines.length > 500) logLines.shift();
    console.log(line);
}
export function slErr(msg) {
    var args = Array.prototype.slice.call(arguments);
    var time = new Date().toLocaleTimeString();
    var line = '[ERR ' + time + '] ' + args.join(' ');
    logLines.push(line);
    if (logLines.length > 500) logLines.shift();
    console.error(line);
}
export function slLogDump() { return logLines.join('\n'); }
export function getLogCount() { return logLines.length; }

export function slClearLogs() {
    logLines = [];
    slLog('日志已清空');
}
