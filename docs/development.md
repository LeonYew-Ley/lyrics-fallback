# Development

Build the extension:

```bash
node scripts/build.mjs
```

This writes `dist/lyrics-fallback.js`. For a local install you can also copy that file to:

- `%APPDATA%\spicetify\Extensions\lyrics-fallback.js`
- `%APPDATA%\Spotify\Apps\xpui\extensions\lyrics-fallback.js` if you are updating a running install without `spicetify apply`

Keep `extensions=lyrics-fallback.js` and `custom_apps=marketplace`. Do not change theme settings as part of installing this extension.

## Fallback providers

Tried in this order by default (first usable hit wins). Official color-lyrics / `has_lyrics` still always take priority.

| Order | id | Notes |
| --- | --- | --- |
| 1 | `lrclib` | Public API (`lrclib.net`). Broad international catalog, no login. |
| 2 | `lrcmux` | Public API (`api.lrcmux.dev`), no login. International synced lyrics from Deezer / YouTube Music (`sources=deezer,ytmusic`). |
| 3 | `netease` | NetEase search + lyric APIs, no login. Strong synced LRC coverage for Chinese tracks. |
| 4 | `kugou` | KuGou song search + `lyrics.kugou.com` LRC download, no user key. |

Genius and Musixmatch are not included because they require an access token or secret key. Saved orders that still contain `qq` drop that id and append `lrcmux` if it is missing.

The settings UI follows the Spotify client language via `Spicetify.Locale.getLocale()` (with `Spicetify.Platform.Session.locale` and `navigator.language` as fallbacks). Chinese locales (`zh`, `zh-CN`, `zh-TW`, `zh-HK`, …) use the Chinese UI; all other locales use English.

## Source layout

| Module | Role |
| --- | --- |
| `src/config.js` | Feature flags, default provider priority, sample track |
| `src/log.js` | Debug log (`window.__lyricsFallback`) |
| `src/ids.js` | Spotify track id (base62 / hex) helpers |
| `src/track.js` | Current playing track |
| `src/official.js` | Official metadata / color-lyrics detection |
| `src/mapping.js` | Map provider lyrics to native color-lyrics and React Query shapes |
| `src/http.js` | `fetch` with `Spicetify.CosmosAsync` fallback |
| `src/text.js` | Title matching, duration scoring, traditional-to-simplified for CJK search |
| `src/providers/*.js` | Provider clients and registry |
| `src/settings-store.js` | Persist and sanitize the user’s provider order |
| `src/i18n.js` | Chinese / English strings and locale detection |
| `src/settings-ui.js` | Profile-menu settings modal, reorder, latency test |
| `src/fallback.js` | Cache and fallback orchestration |
| `src/network.js` | `fetch` / XHR hooks only (no webpack transport hook) |
| `src/query-cache.js` | Write native lyrics cache only when official lyrics are absent |
| `src/entry.js` | Boot, player watch, and settings menu |

## Adding a provider later

1. Add `src/providers/<id>.js` with `{ id, displayName, fetch(track) }` returning `{ syncedLyrics, plainLyrics }` or null.
2. Register it in `src/providers/registry.js`.
3. Append the id to `LF.config.defaultProviders` in `src/config.js` (order is the built-in default priority). Users who already saved a custom order keep that order, with new providers appended.
4. Rebuild.
