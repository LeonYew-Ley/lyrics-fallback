LF.i18n = {
  en: {
    appName: "Lyrics Fallback",
    intro:
      "Official Spotify lyrics always come first. The sources below are tried from top to bottom only when official lyrics are missing. Drag the list to change the order; it is saved on this device.",
    orderHeading: "Provider order",
    testButton: "Test source latency",
    testing: "Testing…",
    resetTitle: "Restore default order",
    dragHandle: "Drag to reorder",
    noTrack: "No track is playing",
    currentTrack: "Current track: {name}",
    statusSynced: "Synced lyrics",
    statusUnsynced: "Plain text only",
    statusError: "Error",
    statusTesting: "Testing…",
    statusMiss: "Not found",
  },
  zh: {
    appName: "Lyrics Fallback",
    intro:
      "官方 Spotify 歌词始终优先。下面的源只在官方歌词缺失时，按从上到下的顺序尝试。拖动列表即可调整顺序，调整后会保存在本地。",
    orderHeading: "歌词源顺序",
    testButton: "测试各源延迟",
    testing: "测试中…",
    resetTitle: "恢复默认顺序",
    dragHandle: "拖动以调整顺序",
    noTrack: "当前没有在播的歌",
    currentTrack: "当前曲目：{name}",
    statusSynced: "同步歌词",
    statusUnsynced: "仅纯文本",
    statusError: "出错",
    statusTesting: "测试中…",
    statusMiss: "未找到",
  },
};

LF.localeCode = function localeCode() {
  const candidates = [];
  try {
    if (window.Spicetify && Spicetify.Locale) {
      if (typeof Spicetify.Locale.getLocale === "function") candidates.push(Spicetify.Locale.getLocale());
      if (Spicetify.Locale._locale) candidates.push(Spicetify.Locale._locale);
    }
  } catch (_) {}
  try {
    if (
      window.Spicetify &&
      Spicetify.Platform &&
      Spicetify.Platform.Session &&
      Spicetify.Platform.Session.locale
    ) {
      candidates.push(Spicetify.Platform.Session.locale);
    }
  } catch (_) {}
  try {
    candidates.push(navigator.language);
  } catch (_) {}
  for (let i = 0; i < candidates.length; i++) {
    const raw = String(candidates[i] || "").trim();
    if (raw) return raw;
  }
  return "en";
};

LF.isChineseLocale = function isChineseLocale(code) {
  const lower = String(code || "").toLowerCase().replace(/_/g, "-");
  return lower === "zh" || lower.indexOf("zh-") === 0;
};

// Chinese (zh, zh-CN, zh-TW, zh-HK, …) uses the Chinese UI; everything else is English.
LF.uiLang = function uiLang() {
  return LF.isChineseLocale(LF.localeCode()) ? "zh" : "en";
};

LF.t = function t(key, vars) {
  const lang = LF.uiLang();
  const table = LF.i18n[lang] || LF.i18n.en;
  let text = table[key] != null ? table[key] : LF.i18n.en[key];
  if (text == null) return key;
  if (vars) {
    Object.keys(vars).forEach(function (name) {
      text = text.replace(new RegExp("\\{" + name + "\\}", "g"), String(vars[name]));
    });
  }
  return text;
};
