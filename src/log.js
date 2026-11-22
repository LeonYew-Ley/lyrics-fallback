LF.debug = { events: [], last: null, injected: {} };

LF.safe = function safe(value) {
  try {
    return typeof value === "string" ? value : JSON.stringify(value);
  } catch (_) {
    return String(value);
  }
};

LF.log = function log(message, extra) {
  const line = extra !== undefined ? message + " " + LF.safe(extra) : message;
  LF.debug.events.push(line);
  if (LF.debug.events.length > 80) LF.debug.events.shift();
  LF.debug.last = line;
  try {
    console.info(LF.config.logPrefix, message, extra !== undefined ? extra : "");
  } catch (_) {}
  try {
    window.__lyricsFallback = LF.debug;
  } catch (_) {}
};

LF.exposeDebug = function exposeDebug() {
  try {
    LF.debug.openSettings = function openSettings() {
      return LF.openSettings();
    };
    LF.debug.getProviderOrder = function getProviderOrder() {
      return (LF.config.providers || []).slice();
    };
    window.__lyricsFallback = LF.debug;
  } catch (_) {}
};
