LF.storageGet = function storageGet(key) {
  try {
    if (window.Spicetify && Spicetify.LocalStorage && typeof Spicetify.LocalStorage.get === "function") {
      const value = Spicetify.LocalStorage.get(key);
      if (value != null) return value;
    }
  } catch (_) {}
  try {
    return window.localStorage.getItem(key);
  } catch (_) {
    return null;
  }
};

LF.storageSet = function storageSet(key, value) {
  try {
    if (window.Spicetify && Spicetify.LocalStorage && typeof Spicetify.LocalStorage.set === "function") {
      Spicetify.LocalStorage.set(key, value);
    }
  } catch (_) {}
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (err) {
    LF.log("localStorage set failed", String(err));
    return false;
  }
};

LF.storageRemove = function storageRemove(key) {
  try {
    if (window.Spicetify && Spicetify.LocalStorage && typeof Spicetify.LocalStorage.remove === "function") {
      Spicetify.LocalStorage.remove(key);
    }
  } catch (_) {}
  try {
    window.localStorage.removeItem(key);
  } catch (_) {}
};

LF.retiredProviderIds = function retiredProviderIds() {
  return ["qq"];
};

LF.defaultProviders = function defaultProviders() {
  const listed = LF.config.defaultProviders || ["lrclib", "lrcmux", "netease", "kugou"];
  return listed.slice();
};

LF.sanitizeProviderIds = function sanitizeProviderIds(ids) {
  if (!Array.isArray(ids)) return null;
  const known = LF.providers && LF.providers._byId ? LF.providers._byId : {};
  const retired = {};
  LF.retiredProviderIds().forEach(function (id) { retired[id] = true; });
  const seen = new Set();
  const out = [];
  for (const id of ids) {
    if (typeof id !== "string" || retired[id] || !known[id] || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  const append = function append(id) {
    if (!known[id] || seen.has(id)) return;
    seen.add(id);
    out.push(id);
  };
  for (const id of LF.defaultProviders()) append(id);
  for (const id of Object.keys(known)) append(id);
  return out.length ? out : null;
};

LF.clearFallbackCache = function clearFallbackCache() {
  try {
    if (LF.cache && typeof LF.cache.clear === "function") LF.cache.clear();
  } catch (_) {}
  try {
    if (LF.inflight && typeof LF.inflight.clear === "function") LF.inflight.clear();
  } catch (_) {}
};

LF.loadProviderOrder = function loadProviderOrder() {
  const fallback = LF.defaultProviders();
  let parsed = null;
  try {
    const raw = LF.storageGet(LF.config.storageKey);
    if (raw) parsed = JSON.parse(raw);
  } catch (err) {
    LF.log("provider order parse failed", String(err));
    parsed = null;
  }
  const sanitized = LF.sanitizeProviderIds(parsed);
  if (!parsed || !sanitized) {
    LF.config.providers = fallback;
    return { source: "default", providers: fallback.slice() };
  }
  LF.config.providers = sanitized;
  return { source: "storage", providers: sanitized.slice() };
};

LF.saveProviderOrder = function saveProviderOrder(ids) {
  const sanitized = LF.sanitizeProviderIds(ids);
  if (!sanitized) return false;
  LF.config.providers = sanitized;
  const ok = LF.storageSet(LF.config.storageKey, JSON.stringify(sanitized));
  LF.clearFallbackCache();
  LF.log("provider order saved", sanitized);
  return ok;
};

LF.resetProviderOrder = function resetProviderOrder() {
  LF.config.providers = LF.defaultProviders();
  LF.storageRemove(LF.config.storageKey);
  LF.clearFallbackCache();
  LF.log("provider order reset to default", LF.config.providers);
  return LF.config.providers.slice();
};

try {
  LF.loadProviderOrder();
} catch (_) {}
