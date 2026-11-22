LF.watchPlayer = function watchPlayer() {
  if (LF.debug.watching) return;
  const run = () => {
    const track = LF.currentTrack();
    if (!track) return;
    if (LF.debug.currentUri === track.uri && LF.cacheGet(track.base62)) {
      if (LF.cacheGet(track.base62).status === "hit") LF.syncCurrentIntoQueryCache();
      return;
    }
    LF.debug.currentUri = track.uri;
    LF.log("track change", { id: track.base62, title: track.title, artist: track.artist });
    LF.lookupTrack(track);
  };
  LF.debug.watching = true;
  run();
  try {
    Spicetify.Player.addEventListener("songchange", run);
  } catch (_) {
    setInterval(run, 2000);
  }
  setInterval(() => {
    try {
      LF.findQueryClient();
      LF.watchQueryCache();
      LF.syncCurrentIntoQueryCache();
    } catch (_) {}
  }, 1000);
};

LF.start = function start() {
  if (!LF.config.enabled) {
    LF.log("disabled by config");
    return false;
  }
  try {
    LF.loadProviderOrder();
  } catch (err) {
    LF.log("load provider order failed", String(err));
  }
  LF.hookFetch();
  LF.hookXHR();
  if (window.Spicetify && Spicetify.Player) LF.watchPlayer();
  LF.ensureSettingsMenu();
  LF.log("running fetch/XHR + QueryClient inject", { providers: (LF.config.providers || []).slice() });
  LF.debug.ready = true;
  LF.exposeDebug();
  return true;
};

// Install network hooks immediately so early metadata fetches are visible if they use fetch.
LF.hookFetch();
LF.hookXHR();

LF.boot = function boot(attempt) {
  const readySpice = !!(window.Spicetify && Spicetify.Player);
  if (readySpice || attempt > 20) {
    try {
      LF.start();
    } catch (err) {
      LF.log("start failed", String(err));
    }
    return;
  }
  if (attempt > 80) {
    LF.log("boot gave up waiting for Spicetify");
    try { LF.start(); } catch (_) {}
    return;
  }
  setTimeout(() => LF.boot(attempt + 1), 250);
};

LF.boot(0);
