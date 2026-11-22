LF.config = {
  enabled: true,
  // Built-in default when the user has not saved a custom order.
  // First listed fallback provider that returns usable lyrics wins.
  // Official Spotify color-lyrics / has_lyrics still always take priority.
  defaultProviders: ["lrclib", "lrcmux", "netease", "kugou"],
  providers: ["lrclib", "lrcmux", "netease", "kugou"],
  storageKey: "lyrics-fallback:providers",
  logPrefix: "[lyrics-fallback]",
  userAgent: "spicetify-lyrics-fallback/1.1 (https://github.com/spicetify/cli)",
  sampleTrack: {
    title: "Blinding Lights",
    artist: "The Weeknd",
    album: "After Hours",
    durationMs: 200000,
  },
  latencyTimeoutMs: 15000,
};
