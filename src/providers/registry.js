LF.providers = LF.providers || {};
LF.providers._byId = LF.providers._byId || {};

LF.providers.register = function registerProvider(provider) {
  if (!provider || !provider.id) return;
  LF.providers._byId[provider.id] = provider;
};

LF.providers.register(LF.providers.lrclib);
LF.providers.register(LF.providers.lrcmux);
LF.providers.register(LF.providers.netease);
LF.providers.register(LF.providers.kugou);

LF.providers.enabled = function enabledProviders() {
  const ids = LF.config.providers || [];
  const list = [];
  for (const id of ids) {
    const provider = LF.providers._byId[id];
    if (provider) list.push(provider);
  }
  return list;
};

LF.providers.isFallbackName = function isFallbackName(name) {
  const value = String(name || "");
  if (!value) return false;
  const lower = value.toLowerCase();
  if (lower === "qq" || lower === "qq music") return true;
  for (const id of Object.keys(LF.providers._byId)) {
    const provider = LF.providers._byId[id];
    if (id.toLowerCase() === lower) return true;
    if (String(provider.displayName || "").toLowerCase() === lower) return true;
  }
  return false;
};
