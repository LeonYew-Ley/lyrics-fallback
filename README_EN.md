# lyrics-fallback

<p align="center">
  ⚡ <a href="https://afdian.com/a/leonyew">Afdian</a>
  &nbsp;·&nbsp;
  ☕ <a href="https://ko-fi.com/leonyew">Ko-fi</a>
  <br><br>
  <strong>Languages</strong>
  &nbsp;·&nbsp;
  <a href="README.md">中文</a>
  &nbsp;·&nbsp;
  <a href="README_EN.md">English</a>
</p>

This is a [Spicetify](https://spicetify.app) extension that uses Spotify's native lyrics panel. Official Spotify lyrics always win. Fallback sources are tried in order only when official lyrics are missing.

The settings UI follows the Spotify client language (Chinese and English for now).

## Effect

Fallback lyrics appear in Spotify's official lyrics panel.

## Install

Install [Spicetify](https://spicetify.app) first (official docs: [spicetify.app](https://spicetify.app) or [spicetify.co](https://spicetify.co)), then install this extension. Lyrics Fallback depends on Spicetify's APIs, so both Marketplace and manual install require Spicetify to already be installed and applied.

### Marketplace

Open Spicetify Marketplace in Spotify, search for **Lyrics Fallback**, and install it (once the extension is listed).

### Manual install

Manual install also requires Spicetify. Copying the file into the extensions folder is not enough if Spicetify has not already been installed and applied to Spotify.

1. Copy `dist/lyrics-fallback.js` from this repository to the Spicetify extensions folder:
   - Windows: `%APPDATA%\spicetify\Extensions\lyrics-fallback.js`
2. In a terminal, run:

```bash
spicetify config extensions lyrics-fallback.js
spicetify apply
```

Then restart Spotify.

## How to use

Click the **profile avatar in the top-right corner** of Spotify, then choose **Lyrics Fallback**.

In the settings page you can:

- Drag the list to change fallback provider priority; the order is saved when you drop
- Click **Test source latency** to probe all sources in parallel; each row shows its own result
- When the order differs from the default, a reset icon appears next to the heading and restores LRCLIB, LRCMux, NetEase, then KuGou

Official Spotify lyrics are not part of this list and still always win.

Developer notes are in [docs/development.md](docs/development.md).
