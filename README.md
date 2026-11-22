# lyrics-fallback

A standalone Spicetify extension that uses Spotify's native lyrics UI. Official Spotify lyrics always win. When official lyrics are missing, configured fallback providers are tried in order until one returns usable lyrics.

This extension does not depend on Lyrics Plus and does not hide or interact with that app.

## Behavior

- Official lyrics present: the native panel shows official lyrics unchanged.
- Official lyrics missing, a fallback provider has lyrics: enable the bottom-right native button and fill the official panel.
- Neither source has lyrics: the button stays "No lyrics".

## Settings

Open **Lyrics Fallback** from the Spotify profile menu (top-right avatar). The modal stays open until you click its close control; clicking the dimmed overlay does not dismiss it.

- The **歌词源顺序** heading has the **测试各源延迟** button beside it. Under the heading, a sub label shows the current track, or "当前没有在播的歌" if nothing is playing.
- The test uses the current track, or a fixed sample (Blinding Lights / The Weeknd) if nothing is playing. Enabled sources are tested in parallel. Results appear on the corresponding drag-list row (time-to-result plus 同步歌词 / 仅纯文本 / 未找到 / 出错), with a compact spinner on each row while that source is in flight. There is no footer status line and no separate results table. The test does not write to the official lyrics cache and does not need a token.
- Drag a row (grip handle or the row itself) to reorder providers. While dragging, rows keep their DOM order and only translate to open a gap; the new order is committed on drop, saved in `localStorage` (`lyrics-fallback:providers`), and used for later lookups. Official Spotify lyrics are never part of this list and still always win.
- A 32px reserved slot sits next to the heading so the layout does not jump. The refresh icon (20px glyph) is visible only when the order differs from the built-in default (LRCLIB, then LRCMux, NetEase, KuGou). It clears the saved key and restores that default. There is no text label on the icon.

If you have never changed the order, the default above is used and nothing is stored.

## Fallback providers

Tried in this order by default (first usable hit wins). Official color-lyrics / `has_lyrics` still always take priority over every item here.

| Order | id | Why it is included |
| --- | --- | --- |
| 1 | `lrclib` | Documented public API (`lrclib.net`). Broad international catalog, no login, and uncensored synced lyrics. Tried first among fallbacks. |
| 2 | `lrcmux` | Documented public API (`api.lrcmux.dev`), no login. International uncensored synced lyrics from Deezer / YouTube Music (`sources=deezer,ytmusic`, so KuGou is not used here). Live-checked against Blinding Lights / The Weeknd (synced LRC). Replaces QQ Music. |
| 3 | `netease` | Official NetEase search + lyric APIs, no login. Strong synced LRC coverage for Chinese tracks. Verified against 亏欠 / 張震嶽. Later fallback because Chinese sources often censor swear words. |
| 4 | `kugou` | Official KuGou song search + `lyrics.kugou.com` LRC download, no user key. Another stable Chinese source, last among the current fallbacks. |

Genius is not included: its official API requires an access token and does not return full lyrics. Scraping genius.com would be fragile and is not used. Musixmatch is not included because it needs a secret key. Saved orders that still contain `qq` drop that id and append `lrcmux` if it is missing.

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
| `src/providers/netease.js` | NetEase official lyrics |
| `src/providers/lrcmux.js` | LRCMux (Deezer / YouTube Music) lyrics |
| `src/providers/kugou.js` | KuGou official lyrics |
| `src/providers/lrclib.js` | LRCLIB client |
| `src/providers/registry.js` | Provider registration and lookup order |
| `src/settings-store.js` | Persist and sanitize the user's provider order |
| `src/settings-ui.js` | Profile-menu settings modal, reorder, latency test |
| `src/fallback.js` | Cache and fallback orchestration |
| `src/network.js` | `fetch` / XHR hooks only (no webpack transport hook) |
| `src/query-cache.js` | Write native lyrics cache only when official lyrics are absent |
| `src/entry.js` | Boot, player watch, and settings menu |

## Build and install

```bash
node scripts/build.mjs
```

Copy `dist/lyrics-fallback.js` to:

- `%APPDATA%\spicetify\Extensions\lyrics-fallback.js`
- `%APPDATA%\Spotify\Apps\xpui\extensions\lyrics-fallback.js` (if you skip `spicetify apply`)

Then restart Spotify so the new file is loaded. Only run `spicetify apply` if Spicetify config itself changed. Keep `extensions=lyrics-fallback.js` and `custom_apps=marketplace`. Do not change theme settings as part of installing this extension.

## Adding a provider later

1. Add `src/providers/<id>.js` with `{ id, displayName, fetch(track) }` returning `{ syncedLyrics, plainLyrics }` or null.
2. Register it in `src/providers/registry.js`.
3. Append the id to `LF.config.defaultProviders` in `src/config.js` (order is the built-in default priority). Users who already saved a custom order keep that order, with new providers appended.
4. Rebuild.
