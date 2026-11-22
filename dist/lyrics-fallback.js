/* lyrics-fallback.js
 * Generated from src/. Edit the modules and run: node scripts/build.mjs
 * Backup lyrics source for Spotify's native lyrics UI.
 * Official color-lyrics / has_lyrics win when present. Configured providers are used only as fallback.
 */
(function LyricsFallback() {
  const LF = {};

  /* ===== src/config.js ===== */
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

  /* ===== src/log.js ===== */
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

  /* ===== src/ids.js ===== */
  LF.B62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

  LF.base62ToHex = function base62ToHex(id) {
    if (!id || id.length !== 22) return null;
    let n = 0n;
    for (let i = 0; i < id.length; i++) {
      const idx = LF.B62.indexOf(id[i]);
      if (idx < 0) return null;
      n = n * 62n + BigInt(idx);
    }
    return n.toString(16).padStart(32, "0");
  };

  LF.hexToBase62 = function hexToBase62(hex) {
    if (!hex || hex.length !== 32) return null;
    let n = BigInt("0x" + hex);
    if (n === 0n) return "0".repeat(22);
    let out = "";
    while (n > 0n) {
      const rem = Number(n % 62n);
      out = LF.B62[rem] + out;
      n = n / 62n;
    }
    return out.padStart(22, "0");
  };

  LF.normalizeId = function normalizeId(id) {
    if (!id) return {};
    if (/^[0-9a-f]{32}$/i.test(id)) {
      const hex = id.toLowerCase();
      return { hex, base62: LF.hexToBase62(hex) };
    }
    if (/^[0-9A-Za-z]{22}$/.test(id)) {
      return { base62: id, hex: LF.base62ToHex(id) };
    }
    return { raw: id };
  };

  /* ===== src/track.js ===== */
  LF.currentTrack = function currentTrack() {
    const item = Spicetify?.Player?.data?.item || Spicetify?.Player?.data?.track;
    if (!item) return null;
    const meta = item.metadata || {};
    const uri = item.uri || meta.uri || "";
    const base62 = (uri.split(":")[2] || "").split("?")[0];
    const title = item.name || meta.title || "";
    const album =
      (item.album && (item.album.name || item.album.title)) || meta.album_title || "";
    let artist = meta.artist_name || "";
    if (!artist && Array.isArray(item.artists)) {
      artist = item.artists.map((a) => a.name).filter(Boolean).join(", ");
    }
    if (!artist && item.artist && item.artist.name) artist = item.artist.name;
    const durationMs = Number(
      item.duration?.milliseconds || item.duration || meta.duration || 0
    );
    if (!base62 || !title) return null;
    return { uri, base62, hex: LF.base62ToHex(base62), title, artist, album, durationMs };
  };

  /* ===== src/official.js ===== */
  LF.idFromUrl = function idFromUrl(url) {
    const text = String(url || "");
    const color = text.match(/\/color-lyrics\/v2\/track\/([^/?#/]+)/i);
    if (color) return { kind: "color-lyrics", id: decodeURIComponent(color[1]) };
    const meta = text.match(/\/metadata\/4\/track\/([^/?#/]+)/i);
    if (meta) return { kind: "metadata", id: decodeURIComponent(meta[1]) };
    return null;
  };

  LF.isOfficialColorBody = function isOfficialColorBody(body) {
    return !!(body && body.lyrics && Array.isArray(body.lyrics.lines) && body.lyrics.lines.length);
  };

  LF.isOfficialMetadata = function isOfficialMetadata(body) {
    return !!(body && body.has_lyrics);
  };

  LF.isOfficialCachedLyrics = function isOfficialCachedLyrics(data) {
    if (!data || !data.hasLyrics) return false;
    const provider = String(data.provider || "");
    const display = String(data.providerDisplayName || "");
    if (LF.providers && LF.providers.isFallbackName(provider)) return false;
    if (LF.providers && LF.providers.isFallbackName(display)) return false;
    return true;
  };

  /* ===== src/mapping.js ===== */
  LF.timestampToMs = function timestampToMs(timestamp) {
    const cleaned = String(timestamp).replace(/[\[\]<>]/g, "");
    const parts = cleaned.split(":");
    if (parts.length < 2) return 0;
    const minutes = Number(parts[0]);
    const seconds = Number(parts.slice(1).join("."));
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return 0;
    return minutes * 60 * 1000 + seconds * 1000;
  };

  LF.parseLocalLyrics = function parseLocalLyrics(lyrics) {
    if (!lyrics || typeof lyrics !== "string") return { synced: null, unsynced: null };
    const lines = lyrics
      .replace(/\[[a-zA-Z]+:[^\]]*\]/g, "")
      .trim()
      .split(/\r?\n/);
    if (!lines.length) return { synced: null, unsynced: null };
    const syncedTimestamp = /\[([0-9:.]+)\]/;
    const unsynced = [];
    const hasTimestamp = lines.some((line) => syncedTimestamp.test(line));
    const synced = hasTimestamp ? [] : null;
    for (const line of lines) {
      if (!line.trim()) continue;
      const time = line.match(syncedTimestamp)?.[1];
      const lyric = line
        .replace(/\[([0-9:.]+)\]/g, "")
        .replace(/<([0-9:.]+)>/g, "")
        .trim();
      if (!time && !lyric) continue;
      const text = lyric || "♪";
      if (hasTimestamp && time && synced) synced.push({ text, startTime: LF.timestampToMs(time) });
      unsynced.push({ text });
    }
    return {
      synced: synced && synced.length ? synced : null,
      unsynced: unsynced.length ? unsynced : null,
    };
  };

  // Convert provider lyrics (syncedLyrics / plainLyrics, same shape as LRCLIB) into
  // Spotify's native color-lyrics JSON body.
  LF.toColorLyrics = function toColorLyrics(data, provider) {
    const displayName = (provider && (provider.displayName || provider.id)) || "fallback";
    const parsed = data.syncedLyrics
      ? LF.parseLocalLyrics(data.syncedLyrics)
      : { synced: null, unsynced: LF.parseLocalLyrics(data.plainLyrics || "").unsynced };
    const synced = parsed.synced && parsed.synced.length ? parsed.synced : null;
    const unsynced =
      (parsed.unsynced && parsed.unsynced.length && parsed.unsynced) ||
      (synced && synced.map((line) => ({ text: line.text }))) ||
      null;
    if (!synced && !unsynced) return null;
    const rows = synced || unsynced;
    const lines = rows.map((line, i) => ({
      startTimeMs: String(synced ? line.startTime : 0),
      words: line.text,
      syllables: [],
      endTimeMs: String(synced && rows[i + 1] ? rows[i + 1].startTime : 0),
    }));
    return {
      lyrics: {
        syncType: synced ? "LINE_SYNCED" : "UNSYNCED",
        lines,
        provider: displayName,
        providerLyricsId: data.id != null ? String(data.id) : "",
        providerDisplayName: displayName,
        syncLyricsUri: "",
        isDenseTypeface: false,
        alternatives: [],
        language: data.language || "",
        isRtlLanguage: false,
        fullscreenAction: "FULLSCREEN_LYRICS",
        showUpsell: false,
        previewLines: lines.slice(0, 3),
        capStatus: undefined,
      },
      colors: {
        background: -9013642,
        text: -16777216,
        highlightText: -1,
      },
      hasVocalRemoval: false,
    };
  };

  // Shape expected by the native React Query lyrics hook (module 45461).
  LF.toQueryLyrics = function toQueryLyrics(payload) {
    const lines = (payload && payload.lyrics && payload.lyrics.lines) || [];
    const mapped = lines.map((line, i) => {
      const start = Number(line.startTimeMs) || 0;
      const next = lines[i + 1];
      return {
        start,
        end: next && next.startTimeMs ? Number(next.startTimeMs) : Infinity,
        text: line.words,
      };
    });
    const syncType = payload.lyrics.syncType;
    return {
      hasLyrics: true,
      isTimeSynced: syncType === "LINE_SYNCED" || syncType === "SYLLABLE_SYNCED",
      syncType,
      lyrics: mapped,
      colors: {
        text: "rgb(0, 0, 0)",
        activeText: "rgb(255, 255, 255)",
        background: "rgb(118, 86, 118)",
      },
      dynamicColors: null,
      provider: payload.lyrics.provider,
      providerDisplayName: payload.lyrics.providerDisplayName,
      providerLyricsId: payload.lyrics.providerLyricsId,
      hasVocalRemoval: false,
      showUpsell: false,
      alternatives: payload.lyrics.alternatives || [],
      previewLines: mapped.slice(0, 3),
      capStatus: payload.lyrics.capStatus,
    };
  };

  /* ===== src/http.js ===== */
  LF.httpGet = async function httpGet(url, headers) {
    const hdrs = Object.assign({ Accept: "application/json, text/plain, */*" }, headers || {});

    const parse = function parseBody(text) {
      if (text == null) return null;
      const trimmed = String(text).trim();
      if (!trimmed) return null;
      const start = trimmed.indexOf("{") >= 0 && (trimmed.indexOf("[") < 0 || trimmed.indexOf("{") < trimmed.indexOf("["))
        ? trimmed.indexOf("{")
        : trimmed.indexOf("[");
      const jsonText = start > 0 ? trimmed.slice(start) : trimmed;
      try {
        return JSON.parse(jsonText);
      } catch (_) {
        return null;
      }
    };

    try {
      const res = await fetch(url, { headers: hdrs });
      const text = await res.text();
      const json = parse(text);
      if (res.ok) return { ok: true, status: res.status, text: text, json: json };
      if (res.status > 0) return { ok: false, status: res.status, text: text, json: json };
    } catch (err) {
      LF.log("fetch failed", url, String(err));
    }

    if (window.Spicetify && Spicetify.CosmosAsync && typeof Spicetify.CosmosAsync.get === "function") {
      try {
        const body = await Spicetify.CosmosAsync.get(url, null, hdrs);
        if (body && typeof body === "object") return { ok: true, status: 200, text: "", json: body };
        const text = body == null ? "" : String(body);
        const json = parse(text);
        return { ok: !!json || !!text, status: 200, text: text, json: json };
      } catch (err) {
        LF.log("cosmos failed", url, String(err));
      }
    }

    return { ok: false, status: 0, text: "", json: null };
  };

  LF.decodeBase64Utf8 = function decodeBase64Utf8(value) {
    try {
      const binary = atob(String(value || "").replace(/\s+/g, ""));
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return new TextDecoder("utf-8").decode(bytes);
    } catch (_) {
      return "";
    }
  };

  /* ===== src/text.js ===== */
  LF._t2sFrom = "㑮㑯㑳㑶㒓㓄㓨㔋㖮㗲㗿㘉㘓㘔㘚㛝㜄㜏㜐㜗㜢㜷㞞㟺㠏㠣㢗㢝㥮㦎㦛㦞㨻㩋㩜㩳㩵㪎㯤㰙㵗㵾㶆㷍㷿㸇㹽㺏㺜㻶㿖㿗㿧䀉䀹䁪䁻䂎䃮䅐䅳䆉䉑䉙䉬䉲䉶䊭䊷䊺䋃䋔䋙䋚䋦䋹䋻䋼䋿䌈䌋䌖䌝䌟䌥䌰䍤䍦䍽䎙䎱䓣䕤䕳䖅䗅䗿䙔䙡䙱䚩䛄䛳䜀䜖䝭䝻䝼䞈䞋䞓䟃䟆䟐䠆䠱䡐䡩䡵䢨䤤䥄䥇䥑䥕䥗䥩䥯䥱䦘䦛䦟䦯䦳䧢䪊䪏䪗䪘䪴䪾䫀䫂䫟䫴䫶䫻䫾䬓䬘䬝䬞䬧䭀䭃䭑䭔䭿䮄䮝䮞䮠䮫䮰䮳䮾䯀䯤䰾䱀䱁䱙䱧䱬䱰䱷䱸䱽䲁䲅䲖䲘䲰䳜䳢䳤䳧䳫䴉䴋䴬䴱䴴䴽䵳䵴䶕䶲丟並么乾亂亙亞仝佇佈佔併來侖侶侷俁係俓俔俠俥俬俱倀倆倈倉個們倖倫倲偉偑側偵偽傌傑傖傘備傢傭傯傳傴債傷傾僂僅僉像僑僕僞僤僥僨僱價儀儁儂億儈儉儎儐儔儕儘償儣優儭儲儷儸儺儻儼兇兌兒兗內兩冊冑冪凈凍凙凜凱別刪剄則剋剎剗剛剝剮剴創剷剾劃劄劇劉劊劌劍劏劑劚勁勑動務勛勝勞勢勣勩勱勳勵勸勻匭匯匱區協卹卻卽厙厠厤厭厲厴參叄叚叢吒吳吶呂咼員哩哯唄唓唸問啓啞啟啢喆喎喚喪喫喬單喲嗆嗇嗊嗎嗚嗩嗰嗶嗹嘆嘍嘓嘔嘖嘗嘜嘩嘪嘮嘯嘰嘳嘵嘸嘺嘽噁噅噓噚噝噞噠噥噦噯噲噴噸噹嚀嚇嚌嚐嚕嚙嚛嚥嚦嚧嚨嚮嚲嚳嚴嚶嚽囀囁囂囃囅囈囉囌囑囒囪圇國圍園圓圖團圞坏垻埡埨埬埰執堃堅堊堖堚堝堯報場塊塋塏塒塗塚塢塤塵塸塹塿墊墜墠墮墰墲墳墶墻墾壇壈壋壎壓壗壘壙壚壜壞壟壠壢壣壩壪壯壺壼壽夠夢夥夾奐奧奩奪奬奮奼妝姍姦娙娛婁婡婦婭媈媧媯媰媼媽嫋嫗嫵嫺嫻嫿嬀嬃嬇嬈嬋嬌嬙嬡嬣嬤嬦嬪嬰嬸嬻孃孄孆孇孋孌孎孫學孻孾孿宮寀寠寢實寧審寫寬寵寶將專尋對導尷屆屍屓屜屢層屨屩屬岡峯峴島峽崍崑崗崙崢崬嵐嵗嵼嵽嵾嶁嶄嶇嶈嶔嶗嶘嶠嶢嶧嶨嶮嶸嶹嶺嶼嶽巊巋巒巔巖巗巘巰巹帥師帳帶幀幃幓幗幘幝幟幣幩幫幬幷幹幾庫廁廂廄廈廎廕廚廝廞廟廠廡廢廣廧廩廬廳弒弔弳張強彃彄彆彈彌彎彔彙彠彥彫彲彷彿後徑從徠復徵徹徿恆恥悅悞悵悶悽惡惱惲惻愛愜愨愴愷愻愾慄態慍慘慚慟慣慤慪慫慮慳慶慺慼慾憂憊憐憑憒憖憚憢憤憫憮憲憶憸憹懀懇應懌懍懎懞懟懣懤懨懲懶懷懸懺懼懾戀戇戔戧戩戰戱戲戶扞拋拚挩挱挾捨捫捱捲掃掄掆掗掙掚掛採揀揚換揮揯損搖搗搧搵搶摋摐摑摜摟摯摳摶摺摻撈撊撏撐撓撝撟撣撥撧撫撲撳撻撾撿擁擄擇擊擋擓擔據擟擠擡擣擫擬擯擰擱擲擴擷擺擻擼擽擾攄攆攋攏攔攖攙攛攜攝攢攣攤攪攬敎敓敗敘敵數斂斃斅斆斕斬斷斸於旂旣昇時晉晛晝暈暉暐暘暢暫曄曆曇曉曊曏曖曠曥曨曬書會朥朧朮東枴柵柺査桱桿梔梖梘梜條梟梲棄棊棖棗棟棡棧棲棶椀椏椲楇楊楓楨業極榘榦榪榮榲榿構槍槓槤槧槨槫槮槳槶槼樁樂樅樑樓標樞樠樢樣樤樧樫樳樸樹樺樿橈橋機橢橫橯檁檉檔檜檟檢檣檭檮檯檳檵檸檻櫃櫅櫍櫓櫚櫛櫝櫞櫟櫠櫥櫧櫨櫪櫫櫬櫱櫳櫸櫻欄欅欇權欍欏欐欑欒欓欖欘欞欽歎歐歟歡歲歷歸歿殘殞殢殤殨殫殭殮殯殰殲殺殻殼毀毆毊毿氂氈氌氣氫氬氭氳氾汎汙決沈沒沖況泝洩洶浹浿涇涗涼淒淚淥淨淩淪淵淶淺淼渙減渢渦測渾湊湋湞湧湯溈準溝溡溫溮溳溼滄滅滌滎滙滬滯滲滷滸滻滾滿漁漊漍漚漢漣漬漲漵漸漿潁潑潔潕潙潚潛潣潤潯潰潷潿澀澂澅澆澇澐澗澠澤澦澩澫澬澮澱澾濁濃濄濆濕濘濚濛濜濟濤濧濫濰濱濺濼濾濿瀂瀃瀅瀆瀇瀉瀋瀏瀕瀘瀝瀟瀠瀦瀧瀨瀰瀲瀾灃灄灍灑灒灕灘灙灝灡灣灤灧灩災為烏烴無煇煉煒煙煢煥煩煬煱熂熅熉熌熒熓熗熚熡熰熱熲熾燀燁燈燉燒燖燙燜營燦燬燭燴燶燻燼燾爃爄爇爍爐爖爛爥爧爭爲爺爾牀牆牘牴牽犇犖犛犞犢犧狀狹狽猌猙猶猻獁獃獄獅獊獎獨獩獪獫獮獰獱獲獵獷獸獺獻獼玀玁珼現琱琺琿瑋瑒瑣瑤瑩瑪瑲瑻瑽璉璊璕璗璝璡璣璦璫璯環璵璸璼璽璾璿瓄瓅瓊瓏瓔瓕瓚瓛甌甕產産甦甯畝畢畫異畵當畼疇疊痙痠痮痾瘂瘋瘍瘓瘞瘡瘧瘮瘱瘲瘺瘻療癆癇癉癐癒癘癟癡癢癤癥癧癩癬癭癮癰癱癲發皁皚皟皰皸皺盃盜盞盡監盤盧盨盪眝眞眥眾睍睏睜睞瞘瞜瞞瞤瞭瞶瞼矇矉矑矓矚矯硃硜硤硨硯碕碙碩碭碸確碼碽磑磚磠磣磧磯磽磾礄礆礎礐礒礙礦礪礫礬礮礱祇祕祿禍禎禕禡禦禪禮禰禱禿秈稅稈稏稜稟種稱穀穇穌積穎穠穡穢穩穫穭窩窪窮窯窵窶窺竄竅竇竈竊竚竪竱競筆筍筦筧筴箇箋箏箚節範築篋篔篘篠篢篤篩篳篸簀簂簍簑簞簡簢簣簫簹簽簾籃籅籋籌籔籙籛籜籟籠籤籩籪籬籮籲粵糉糝糞糧糰糲糴糶糹糺糾紀紂紃約紅紆紇紈紉紋納紐紓純紕紖紗紘紙級紛紜紝紞紟紡紬紮細紱紲紳紵紹紺紼紿絀絁終絃組絅絆絍絎結絕絙絛絜絝絞絡絢絥給絧絨絪絰統絲絳絶絹絺綀綁綃綄綆綇綈綉綋綌綎綏綐綑經綖綜綝綞綟綠綡綢綣綧綪綫綬維綯綰綱網綳綴綵綸綹綺綻綽綾綿緄緇緊緋緍緑緒緓緔緗緘緙線緝緞緟締緡緣緤緦編緩緬緮緯緰緱緲練緶緷緸緹緻緼縈縉縊縋縍縎縐縑縕縗縛縝縞縟縣縧縫縬縭縮縯縰縱縲縳縴縵縶縷縸縹縺總績繂繃繅繆繈繏繐繒繓織繕繚繞繟繡繢繨繩繪繫繬繭繮繯繰繳繶繷繸繹繻繼繽繾繿纁纆纇纈纊續纍纏纓纔纕纖纗纘纚纜缽罃罈罌罎罰罵罷羅羆羈羋羣羥羨義羵羶習翫翬翹翽耑耬耮聖聞聯聰聲聳聵聶職聹聻聽聾肅脅脈脛脣脥脩脫脹腎腖腡腦腪腫腳腸膃膕膚膞膠膢膩膹膽膾膿臉臍臏臗臘臚臟臠臢臥臨臺與興舉舊舖舘艙艣艤艦艫艱艷芻苧茲荊莊莖莢莧菉菕華菴菸萇萊萬萴萵葉葒葝葤葦葯葷蒍蒐蒓蒔蒕蒞蒭蒼蓀蓆蓋蓧蓮蓯蓴蓽蔄蔔蔘蔞蔣蔥蔦蔭蔯蔿蕁蕆蕎蕒蕓蕕蕘蕝蕢蕩蕪蕭蕳蕷蕽薀薆薈薊薌薑薔薘薟薦薩薳薴薵薹薺藉藍藎藝藥藪藭藴藶藷藹藺蘀蘄蘆蘇蘊蘋蘚蘞蘟蘢蘭蘺蘿虆虉處虛虜號虧虯蛺蛻蜆蝀蝕蝟蝦蝨蝸螄螞螢螮螻螿蟂蟄蟈蟎蟘蟜蟣蟬蟯蟲蟳蟶蟻蠀蠁蠅蠆蠍蠐蠑蠔蠙蠟蠣蠦蠨蠱蠶蠻蠾衆衊術衕衚衛衝衹袞袷裊裏補裝裡製複褌褘褲褳褸褻襀襇襉襏襓襖襗襘襝襠襤襪襬襯襰襲襴襵覆覈見覎規覓視覘覛覡覥覦親覬覯覲覷覹覺覼覽覿觀觴觶觸訁訂訃計訊訌討訏訐訑訒訓訕訖託記訛訜訝訞訟訢訣訥訨訩訪設許訴訶診註証詀詁詆詊詎詐詑詒詓詔評詖詗詘詛詝詞詠詡詢詣試詩詪詫詬詭詮詰話該詳詵詷詼詿誂誄誅誆誇誋誌認誑誒誕誘誚語誠誡誣誤誥誦誨說誫説誰課誳誴誶誷誹誺誼誾調諂諄談諉請諍諏諑諒諓論諗諛諜諝諞諟諡諢諣諤諥諦諧諫諭諮諯諰諱諲諳諴諶諷諸諺諼諾謀謁謂謄謅謆謉謊謎謏謐謔謖謗謙謚講謝謠謡謨謫謬謭謯謱謳謸謹謾譁譂譅譆證譊譎譏譑譓譖識譙譚譜譞譟譨譫譭譯議譴護譸譽譾讀讅變讋讌讎讒讓讕讖讚讜讞谿豈豎豐豔豬豵豶貍貓貗貙貝貞貟負財貢貧貨販貪貫責貯貰貲貳貴貶買貸貺費貼貽貿賀賁賂賃賄賅資賈賊賑賒賓賕賙賚賜賝賞賟賠賡賢賣賤賦賧質賫賬賭賰賴賵賺賻購賽賾贃贄贅贇贈贉贊贋贍贏贐贑贓贔贖贗贚贛贜赬趕趙趨趲跡踐踰踴蹌蹔蹕蹟蹠蹣蹤蹳蹺蹻躂躉躊躋躍躎躑躒躓躕躘躚躝躡躥躦躪軀軉車軋軌軍軏軑軒軔軕軗軛軜軝軟軤軨軫軬軲軷軸軹軺軻軼軾軿較輄輅輇輈載輊輋輒輓輔輕輖輗輛輜輝輞輟輢輥輦輨輩輪輬輮輯輳輶輷輸輻輼輾輿轀轂轄轅轆轇轉轊轍轎轐轔轗轟轠轡轢轣轤辦辭辮辯農迴迺逕這連週進遊運過達違遙遜遞遠遡適遱遲遶遷選遺遼邁還邇邊邏邐邨郟郵鄆鄉鄒鄔鄖鄟鄧鄩鄭鄰鄲鄳鄴鄶鄺酇酈醃醖醜醞醟醣醫醬醱醲醶釀釁釃釅釋釐釒釓釔釕釗釘釙釚針釟釣釤釦釧釨釩釲釳釴釵釷釹釺釾釿鈀鈁鈃鈄鈅鈆鈇鈈鈉鈋鈍鈎鈐鈑鈒鈔鈕鈖鈗鈛鈞鈠鈡鈣鈥鈦鈧鈮鈯鈰鈲鈳鈴鈷鈸鈹鈺鈽鈾鈿鉀鉁鉅鉆鉈鉉鉊鉋鉍鉑鉔鉕鉗鉚鉛鉝鉞鉠鉢鉤鉥鉦鉧鉬鉭鉮鉳鉶鉷鉸鉺鉻鉽鉾鉿銀銁銂銃銅銈銊銍銏銑銓銖銘銚銛銜銠銣銥銦銨銩銪銫銬銱銳銶銷銹銻銼鋁鋂鋃鋅鋇鋉鋌鋏鋐鋒鋗鋙鋝鋟鋠鋣鋤鋥鋦鋨鋩鋪鋭鋮鋯鋰鋱鋶鋸鋹鋼錀錁錂錄錆錇錈錏錐錒錕錘錙錚錛錜錝錞錟錠錡錢錤錥錦錨錩錫錮錯録錳錶錸錼錽鍀鍁鍃鍄鍅鍆鍇鍈鍉鍊鍋鍍鍒鍔鍘鍚鍛鍠鍤鍥鍩鍬鍭鍮鍰鍵鍶鍺鍼鍾鎂鎄鎇鎈鎊鎌鎍鎓鎔鎖鎘鎙鎚鎛鎝鎞鎡鎢鎣鎦鎧鎩鎪鎬鎭鎮鎯鎰鎲鎳鎵鎶鎷鎸鎿鏃鏆鏇鏈鏉鏌鏍鏏鏐鏑鏗鏘鏚鏜鏝鏞鏟鏡鏢鏤鏥鏦鏨鏰鏵鏷鏹鏺鏻鏽鏾鐃鐄鐇鐈鐋鐍鐎鐏鐐鐒鐓鐔鐘鐙鐝鐠鐥鐦鐧鐨鐩鐪鐫鐮鐯鐲鐳鐵鐶鐸鐺鐼鐽鐿鑀鑄鑉鑊鑌鑑鑒鑔鑕鑞鑠鑣鑥鑪鑭鑰鑱鑲鑴鑷鑹鑼鑽鑾鑿钁钂長門閂閃閆閈閉開閌閍閎閏閐閑閒間閔閗閘閝閞閡閣閤閥閨閩閫閬閭閱閲閵閶閹閻閼閽閾閿闃闆闇闈闉闊闋闌闍闐闑闒闓闔闕闖關闞闠闡闢闤闥阪陘陝陞陣陰陳陸陽隉隊階隑隕際隤隨險隮隯隱隴隸隻雋雖雙雛雜雞離難雲電霑霢霣霧霼霽靂靄靆靈靉靚靜靝靦靧靨鞏鞝鞦鞽鞾韁韃韆韉韋韌韍韓韙韚韛韜韝韞韠韻響頁頂頃項順頇須頊頌頍頎頏預頑頒頓頔頗領頜頠頡頤頦頫頭頮頰頲頴頵頷頸頹頻頽顂顃顅顆題額顎顏顒顓顔顗願顙顛類顢顣顥顧顫顬顯顰顱顳顴風颭颮颯颰颱颳颶颷颸颺颻颼颾飀飄飆飈飋飛飠飢飣飥飦飩飪飫飭飯飱飲飴飵飶飼飽飾飿餃餄餅餈餉養餌餎餏餑餒餓餔餕餖餗餘餚餛餜餞餡餦餧館餪餫餬餭餱餳餵餶餷餸餺餼餾餿饁饃饅饈饉饊饋饌饑饒饗饘饜饞饟饠饢馬馭馮馯馱馳馴馹馼駁駃駉駊駎駐駑駒駓駔駕駘駙駚駛駝駞駟駡駢駤駧駩駪駫駭駰駱駶駸駻駼駿騁騂騃騄騅騉騊騌騍騎騏騑騔騖騙騚騜騝騞騟騠騤騧騪騫騭騮騰騱騴騵騶騷騸騻騼騾驀驁驂驃驄驅驊驋驌驍驎驏驓驕驗驙驚驛驟驢驤驥驦驨驪驫骯髏髒體髕髖髮鬆鬍鬖鬚鬠鬢鬥鬧鬨鬩鬮鬱鬹魎魘魚魛魟魢魥魦魨魯魴魵魷魺魽鮀鮁鮃鮄鮅鮆鮈鮊鮋鮍鮎鮐鮑鮒鮓鮚鮜鮝鮞鮟鮠鮡鮣鮤鮦鮪鮫鮭鮮鮯鮰鮳鮵鮶鮸鮺鮿鯀鯁鯄鯆鯇鯉鯊鯒鯔鯕鯖鯗鯛鯝鯞鯡鯢鯤鯧鯨鯪鯫鯬鯰鯱鯴鯶鯷鯻鯽鯾鯿鰁鰂鰃鰆鰈鰉鰊鰋鰌鰍鰏鰐鰑鰒鰓鰕鰛鰜鰟鰠鰣鰤鰥鰦鰧鰨鰩鰫鰭鰮鰱鰲鰳鰵鰶鰷鰹鰺鰻鰼鰽鰾鱀鱂鱄鱅鱆鱇鱈鱉鱊鱒鱔鱖鱗鱘鱚鱝鱟鱠鱢鱣鱤鱧鱨鱭鱮鱯鱲鱷鱸鱺鳥鳧鳩鳬鳲鳳鳴鳶鳷鳼鳽鳾鴀鴃鴅鴆鴇鴉鴐鴒鴔鴕鴗鴛鴜鴝鴞鴟鴣鴥鴦鴨鴮鴯鴰鴲鴳鴴鴷鴻鴽鴿鵁鵂鵃鵊鵏鵐鵑鵒鵓鵚鵜鵝鵟鵠鵡鵧鵩鵪鵫鵬鵮鵯鵰鵲鵷鵾鶄鶇鶉鶊鶌鶒鶓鶖鶗鶘鶚鶠鶡鶥鶦鶩鶪鶬鶭鶯鶰鶱鶲鶴鶹鶺鶻鶼鶿鷀鷁鷂鷄鷅鷉鷊鷐鷓鷔鷖鷗鷙鷚鷟鷣鷤鷥鷦鷨鷩鷫鷭鷯鷲鷳鷴鷷鷸鷹鷺鷽鷿鸂鸇鸊鸋鸌鸏鸑鸕鸗鸘鸚鸛鸝鸞鹵鹹鹺鹼鹽麗麥麨麩麪麫麬麯麲麳麴麵麷麼麽黃黌點黨黲黴黶黷黽黿鼂鼉鼕鼴齊齋齎齏齒齔齕齗齘齙齜齟齠齡齣齦齧齩齪齬齭齮齯齰齲齴齶齷齼齾龍龎龐龑龓龔龕龜龢龭龯鿁鿓𠁞𠌥𠏢𠐊𠗣𠞆𠠎𠬙𠼤𠽃𠿕𡂡𡃄𡃕𡃤𡄔𡄣𡅏𡅯𡑍𡑭𡓁𡓾𡔖𡞵𡟫𡠹𡢃𡮉𡮣𡳳𡸗𡹬𡻕𡽗𡾱𡿖𢍰𢠼𢣐𢣚𢣭𢤩𢤱𢤿𢯷𢶒𢶫𢷮𢹿𢺳𣈶𣋋𣍐𣙎𣜬𣝕𣞻𣠩𣠲𣯩𣯴𣯶𣽏𣾷𣿉𤁣𤄷𤅶𤑳𤑹𤒎𤒻𤓌𤓎𤓩𤘀𤛮𤛱𤜆𤠮𤢟𤢻𤩂𤪺𤫩𤬅𤳷𤳸𤷃𤸫𤺔𥊝𥌃𥏝𥕥𥖅𥖲𥗇𥗽𥜐𥜰𥞵𥢢𥢶𥢷𥨐𥪂𥯤𥴨𥴼𥵃𥵊𥶽𥸠𥻦𥼽𥽖𥾯𥿊𦀖𦂅𦃄𦃩𦅇𦅈𦆲𦒀𦔖𦘧𦟼𦠅𦡝𦢈𦣎𦧺𦪙𦪽𦱌𦾟𧎈𧒯𧔥𧕟𧜗𧜵𧝞𧞫𧟀𧡴𧢄𧦝𧦧𧩕𧩙𧩼𧫝𧬤𧭈𧭹𧳟𧵳𧶔𧶧𧷎𧸘𧹈𧽯𨂐𨄣𨅍𨆪𨇁𨇞𨇤𨇰𨇽𨈊𨈌𨊰𨊸𨊻𨋢𨌈𨍰𨎌𨎮𨏠𨏥𨞺𨟊𨢿𨣈𨣞𨣧𨤻𨥛𨥟𨦫𨧀𨧜𨧰𨧱𨨏𨨛𨨢𨩰𨪕𨫒𨬖𨭆𨭎𨭖𨭸𨮂𨮳𨯅𨯟𨰃𨰋𨰥𨰲𨲳𨳑𨳕𨴗𨴹𨵩𨵸𨶀𨶏𨶮𨶲𨷲𨼳𨽏𩀨𩅙𩎖𩎢𩏂𩏠𩏪𩏷𩑔𩒎𩓣𩓥𩔑𩔳𩖰𩗀𩗓𩗴𩘀𩘝𩘹𩘺𩙈𩚛𩚥𩚩𩚵𩛆𩛌𩛡𩛩𩜇𩜦𩜵𩝔𩝽𩞄𩞦𩞯𩟐𩟗𩠴𩡣𩡺𩢡𩢴𩢸𩢾𩣏𩣑𩣫𩣵𩣺𩤊𩤙𩤲𩤸𩥄𩥇𩥉𩥑𩦠𩧆𩭙𩯁𩯳𩰀𩰹𩳤𩴵𩵦𩵩𩵹𩶁𩶘𩶰𩶱𩷰𩸃𩸄𩸡𩸦𩻗𩻬𩻮𩼶𩽇𩿅𩿤𩿪𪀖𪀦𪀾𪁈𪁖𪂆𪃍𪃏𪃒𪃧𪄆𪄕𪅂𪆷𪇳𪈼𪉸𪋿𪌭𪍠𪓰𪔵𪘀𪘯𪙏𪟖𪷓𫒡𫜦𰻞";
  LF._t2sTo = "㑮㑔㑇㐹㒓㓄刾㔋㖮𠵾㗿㘉㘓㘔㘎㛝㚯㛣㜐㜗𡞱㜷㞞㟺㟆𫵷㢗㢝㤘㦎㦛㦞㨻㩋㨫㧐擜㪎㯤㰙㵗㵾㶆㷍㷿㸇㹽𤠋㺜㻶㿖㿗㿧䀉䀹𥇢䀥䂎鿎䅐䅳䆉䉑䉙䉬䉲䉶䊭䌶䊺䋃䋔䌺䌻䋦䌿䌾䋼䋿䌈䌋䌖䌝䌟䌥䌰䍤䍠䍽䎙䎬𬜯䕤䕳䖅䗅䗿䙔䙌䙱䚩䛄䛳䜧䜖䝭䝻䞍䞈䞋䞓䟃䟆䟐䠆䠱䡐䡩𫟦䢨䤤䥄䦂鿏𬭯䥗䥩䥯䥾䦘䦶䦷䦯䦳𨸟䪊䪏䪗䪘䪴䪾䫀䫂䫟䫴䫶䫻䫾䬓䬘䬝䬞䬧䭀䭃䭑䭔䭿𫠊䮝䮞䮠䮫䮰䮳䮾䯅䯤鲃䱀䱁䱙䱧䱬䱰䲣䱸䲝鳚䲅䲖鳤䲰䳜䳢䳤䳧䳫鹮䴋䴬䴱䴴䴽䵳䵴䶕䶲丢并么干乱亘亚仝伫布占并来仑侣局俣系俓伣侠伡私俱伥俩俫仓个们幸伦㑈伟㐽侧侦伪㐷杰伧伞备家佣偬传伛债伤倾偻仅佥像侨仆伪𫢸侥偾雇价仪俊侬亿侩俭傤傧俦侪尽偿儣优儭储俪㑩傩傥俨凶兑儿兖内两册胄幂净冻凙凛凯别删刭则克刹刬刚剥剐剀创铲剾划札剧刘刽刿剑㓥剂㔉劲勑动务勋胜劳势𪟝勚劢勋励劝匀匦汇匮区协恤却即厍厕历厌厉厣参叁叚丛咤吴呐吕呙员哩哯呗唓念问启哑启唡喆㖞唤丧吃乔单哟呛啬唝吗呜唢𠮶哔嗹叹喽啯呕啧尝唛哗嘪唠啸叽嘳哓呒嘺啴恶噅嘘㖊咝噞哒哝哕嗳哙喷吨当咛吓哜尝噜啮嚛咽呖𠰷咙向亸喾严嘤嚽啭嗫嚣囃冁呓啰苏嘱囒囱囵国围园圆图团圞坏坝垭𫭢埬采执堃坚垩垴堚埚尧报场块茔垲埘涂冢坞埙尘𫭟堑𪣻垫坠𫮃堕坛墲坟垯墙垦坛壈垱埙压𡋤垒圹垆坛坏垄垅坜壣坝塆壮壶壸寿够梦伙夹奂奥奁夺奖奋姹妆姗奸𫰛娱娄婡妇娅媈娲妫㛀媪妈袅妪妩娴娴婳妫媭嬇娆婵娇嫱嫒嬣嬷嬦嫔婴婶嬻娘孄孆孇㛤娈孎孙学𡥧孾孪宫采寠寝实宁审写宽宠宝将专寻对导尴届尸屃屉屡层屦屩属冈峰岘岛峡崃昆岗仑峥岽岚岁嵼𫶇㟥嵝崭岖嶈嵚崂嶘峤峣峄峃崄嵘嶹岭屿岳巊岿峦巅岩巗𪩘巯卺帅师帐带帧帏㡎帼帻幝帜币幩帮帱并干几库厕厢厩厦庼荫厨厮𫷷庙厂庑废广廧廪庐厅弑吊弪张强彃𫸩别弹弥弯录汇彟彦雕彨彷佛后径从徕复征彻徿恒耻悦悮怅闷凄恶恼恽恻爱惬悫怆恺愻忾栗态愠惨惭恸惯悫怄怂虑悭庆㥪戚欲忧惫怜凭愦慭惮憢愤悯怃宪忆憸憹懀恳应怿懔懎蒙怼懑㤽恹惩懒怀悬忏惧慑恋戆戋戗戬战戯戏户捍抛拼捝挲挟舍扪挨卷扫抡㧏挜挣掚挂采拣扬换挥搄损摇捣扇揾抢摋摐掴掼搂挚抠抟折掺捞撊挦撑挠㧑挢掸拨撧抚扑揿挞挝捡拥掳择击挡㧟担据擟挤抬捣擫拟摈拧搁掷扩撷摆擞撸㧰扰摅撵攋拢拦撄搀撺携摄攒挛摊搅揽教敚败叙敌数敛毙斅敩斓斩断斸于旗既升时晋𬀪昼晕晖𬀩旸畅暂晔历昙晓曊向暧旷𣆐昽晒书会𦛨胧术东拐栅拐查𣐕杆栀梖枧𬂩条枭棁弃棋枨枣栋㭎栈栖梾椀桠㭏楇杨枫桢业极矩干杩荣榅桤构枪杠梿椠椁槫椮桨椢椝桩乐枞梁楼标枢樠㭤样樤榝㭴桪朴树桦椫桡桥机椭横𣓿檩柽档桧槚检樯檭梼台槟檵柠槛柜櫅𬃊橹榈栉椟橼栎櫠橱槠栌枥橥榇蘖栊榉樱栏榉欇权欍椤欐欑栾𣗋榄欘棂钦叹欧欤欢岁历归殁残殒殢殇㱮殚僵殓殡㱩歼杀壳壳毁殴毊毵牦毡氇气氢氩氭氲泛泛污决沈没冲况溯泄汹浃𬇙泾涚凉凄泪渌净凌沦渊涞浅淼涣减沨涡测浑凑𣲗浈涌汤沩准沟溡温浉涢湿沧灭涤荥汇沪滞渗卤浒浐滚满渔溇𬇹沤汉涟渍涨溆渐浆颍泼洁𣲘沩㴋潜潣润浔溃滗涠涩澂澅浇涝沄涧渑泽滪泶𬇕澬浍淀㳠浊浓㳡𣸣湿泞溁蒙浕济涛㳔滥潍滨溅泺滤濿澛瀃滢渎㲿泻沈浏濒泸沥潇潆潴泷濑弥潋澜沣滠灍洒𪷽漓滩𣺼灏㳕湾滦滟滟灾为乌烃无煇炼炜烟茕焕烦炀㶽熂煴熉熌荧熓炝熚熡𬉼热颎炽𬊤烨灯炖烧𬊈烫焖营灿毁烛烩㶶熏烬焘爃爄爇烁炉爖烂爥爧争为爷尔床墙牍抵牵犇荦牦犞犊牺状狭狈猌狰犹狲犸呆狱狮獊奖独獩狯猃狝狞㺍获猎犷兽獭献猕猡玁珼现雕珐珲玮玚琐瑶莹玛玱瑻瑽琏𫞩𬍤𬍡璝琎玑瑷珰㻅环玙瑸璼玺璾璇瓄𬍛琼珑璎瓕瓒𤩽瓯瓮产产甦甯亩毕画异画当畼畴叠痉酸痮疴痖疯疡痪瘗疮疟瘆瘱疭瘘瘘疗痨痫瘅癐愈疠瘪痴痒疖症疬癞癣瘿瘾痈瘫癫发皂皑皟疱皲皱杯盗盏尽监盘卢盨荡眝真眦众𪾢困睁睐眍䁖瞒瞤瞭瞆睑蒙矉矑眬瞩矫朱硁硖砗砚埼碙硕砀砜确码䂵硙砖硵碜碛矶硗䃅硚礆础𬒈礒碍矿砺砾矾礮砻祇秘禄祸祯祎祃御禅礼祢祷秃籼税秆䅉棱禀种称谷䅟稣积颖秾穑秽稳获穞窝洼穷窑窎窭窥窜窍窦灶窃竚竖竱竞笔笋筦笕䇲个笺筝札节范筑箧筼篘筿𬕂笃筛筚𥮾箦簂篓蓑箪简簢篑箫筜签帘篮𥫣籋筹䉤箓篯箨籁笼签笾簖篱箩吁粤粽糁粪粮团粝籴粜纟糺纠纪纣𬘓约红纡纥纨纫纹纳纽纾纯纰纼纱纮纸级纷纭纴𬘘紟纺䌷扎细绂绁绅纻绍绀绋绐绌絁终弦组䌹绊絍绗结绝絙绦絜绔绞络绚絥给絧绒𬘡绖统丝绛绝绢𫄨綀绑绡𬘫绠綇绨绣綋绤𬘩绥䌼捆经𫄧综𬘭缍綟绿𫟅绸绻𬘯𬘬线绶维绹绾纲网绷缀彩纶绺绮绽绰绫绵绲缁紧绯緍绿绪绬绱缃缄缂线缉缎緟缔缗缘緤缌编缓缅緮纬緰缑缈练缏緷緸缇致缊萦缙缢缒縍縎绉缣缊缞缚缜缟缛县绦缝縬缡缩𬙂縰纵缧䌸纤缦絷缕縸缥縺总绩繂绷缫缪繈繏繐缯繓织缮缭绕繟绣缋繨绳绘系繬茧缰缳缲缴𫄷繷䍁绎𦈡继缤缱䍀𫄸𬙊颣缬纩续累缠缨才𬙋纤纗缵纚缆钵䓨坛罂坛罚骂罢罗罴羁芈群羟羡义羵膻习玩翚翘翙耑耧耢圣闻联聪声耸聩聂职聍聻听聋肃胁脉胫唇脥修脱胀肾胨脶脑腪肿脚肠腽腘肤䏝胶𦝼腻膹胆脍脓脸脐膑臗腊胪脏脔臜卧临台与兴举旧铺馆舱艣舣舰舻艰艳刍苎兹荆庄茎荚苋菉菕华庵烟苌莱万荝莴叶荭葝荮苇药荤𫇭搜莼莳蒀莅蒭苍荪席盖蓧莲苁莼荜𬜬卜参蒌蒋葱茑荫𫈟𫇭荨蒇荞荬芸莸荛蕝蒉荡芜萧蕳蓣蕽蕰薆荟蓟芗姜蔷荙莶荐萨薳苧䓓苔荠藉蓝荩艺药薮䓖蕴苈藷蔼蔺萚蕲芦苏蕴苹藓蔹𦻕茏兰蓠萝蔂𬟁处虚虏号亏虬蛱蜕蚬𬟽蚀猬虾虱蜗蛳蚂萤䗖蝼螀蟂蛰蝈螨蟘蟜虮蝉蛲虫𫊻蛏蚁蠀蚃蝇虿蝎蛴蝾蚝蠙蜡蛎蠦蟏蛊蚕蛮蠾众蔑术同胡卫冲衹衮夹袅里补装里制复裈袆裤裢褛亵𫌀裥裥袯襓袄襗襘裣裆褴袜摆衬襰袭襕襵覆核见觃规觅视觇覛觋觍觎亲觊觏觐觑覹觉覼览觌观觞觯触讠订讣计讯讧讨𬣙讦訑讱训讪讫托记讹訜讶訞讼䜣诀讷訨讻访设许诉诃诊注证𧮪诂诋詊讵诈詑诒詓诏评诐诇诎诅𬣞词咏诩询诣试诗𬣳诧诟诡诠诘话该详诜𫍣诙诖誂诔诛诓夸誋志认诳诶诞诱诮语诚诫诬误诰诵诲说誫说谁课誳誴谇誷诽誺谊訚调谄谆谈诿请诤诹诼谅𬣡论谂谀谍谞谝𬤊谥诨諣谔諥谛谐谏谕咨諯諰讳𬤇谙𫍯谌讽诸谚谖诺谋谒谓誊诌謆謉谎谜𫍲谧谑谡谤谦谥讲谢谣谣谟谪谬谫謯謱讴謸谨谩哗譂譅譆证譊谲讥譑𬤝谮识谯谭谱𫍽噪譨谵毁译议谴护诪誉谫读谉变詟䜩雠谗让谰谶赞谠谳溪岂竖丰艳猪豵豮狸猫貗䝙贝贞贠负财贡贫货贩贪贯责贮贳赀贰贵贬买贷贶费贴贻贸贺贲赂赁贿赅资贾贼赈赊宾赇赒赉赐賝赏賟赔赓贤卖贱赋赕质赍账赌䞐赖赗赚赙购赛赜贃贽赘赟赠贉赞赝赡赢赆贑赃赑赎赝贚赣赃赪赶赵趋趱迹践逾踊跄蹔跸迹跖蹒踪蹳跷蹻跶趸踌跻跃䟢踯跞踬蹰躘跹躝蹑蹿躜躏躯軉车轧轨军𫐄轪轩轫軕軗轭軜𬨂软轷軨轸軬轱軷轴轵轺轲轶轼軿较𨐈辂辁辀载轾𪨶辄挽辅轻輖𫐐辆辎辉辋辍輢辊辇輨辈轮辌𫐓辑辏𬨎輷输辐辒辗舆辒毂辖辕辘轇转轊辙轿轐辚轗轰轠辔轹轣轳办辞辫辩农回迺径这连周进游运过达违遥逊递远溯适遱迟绕迁选遗辽迈还迩边逻逦邨郏邮郓乡邹邬郧鄟邓𬩽郑邻郸𫑡邺郐邝酂郦腌酝丑酝蒏糖医酱酦𬪩醶酿衅酾酽释厘钅钆钇钌钊钉钋釚针釟钓钐扣钏釨钒釲釳𬬩钗钍钕钎䥺𬬱钯钫钘钭钥鈆𫓧钚钠鈋钝钩钤钣钑钞钮鈖鈗鈛钧鈠钟钙钬钛钪铌鈯铈鈲钶铃钴钹铍钰钸铀钿钾鉁巨钻铊铉𬬿铇铋铂鉔钷钳铆铅𫟷钺鉠钵钩𬬸钲𬭁钼钽𬬹锫铏𫟹铰铒铬鉽鉾铪银銁銂铳铜𫓯銊铚銏铣铨铢铭铫铦衔铑铷铱铟铵铥铕铯铐铞锐𨱇销锈锑锉铝鋂锒锌钡鋉铤铗𬭎锋𫓶铻锊锓鋠铘锄锃锔锇铓铺锐铖锆锂铽锍锯𬬮钢𬬭锞錂录锖锫锩铔锥锕锟锤锱铮锛錜錝𬭚锬锭锜钱𫓹錥锦锚锠锡锢错录锰表铼镎錽锝锨锪鍄钫钔锴锳鍉炼锅镀鍒锷铡钖锻锽锸锲锘锹𬭤鍮锾键锶锗针钟镁锿镅鎈镑镰鎍𬭩镕锁镉鎙锤镈𨱏鎞镃钨蓥镏铠铩锼镐镇镇鎯镒镋镍镓鿔鎷镌镎镞鏆旋链鏉镆镙𬭬镠镝铿锵鏚镗镘镛铲镜镖镂鏥鏦錾镚铧镤镪䥽𬭸锈鏾铙𨱑𫔍鐈铴𫔎鐎𨱔镣铹镦镡钟镫镢镨䦅锎锏镄𬭼鐪镌镰䦃镯镭铁镮铎铛鐼𫟼镱鑀铸鑉镬镔鉴鉴镲锧镴铄镳镥𬬻镧钥镵镶鑴镊镩锣钻銮凿镢镋长门闩闪闫闬闭开闶閍闳闰閐闲闲间闵閗闸閝閞阂阁合阀闺闽阃阆闾阅阅閵阊阉阎阏阍阈阌阒板暗闱𬮱阔阕阑阇阗𫔶阘闿阖阙闯关阚阓阐辟阛闼阪陉陕升阵阴陈陆阳陧队阶𬮿陨际𬯎随险𬯀陦隐陇隶只隽虽双雏杂鸡离难云电沾霡霣雾霼霁雳霭叇灵叆靓静靔腼靧靥巩绱秋鞒鞾缰鞑千鞯韦韧韨韩韪韚韛韬鞲韫韠韵响页顶顷项顺顸须顼颂𫠆颀颃预顽颁顿𬱖颇领颌𬱟颉颐颏𫖯头颒颊颋颕𫖳颔颈颓频颓顂顃顅颗题额颚颜颙颛颜𫖮愿颡颠类颟顣颢顾颤颥显颦颅颞颧风飐飑飒颰台刮飓颷飔飏飖飕颾飗飘飙飚飋飞饣饥饤饦飦饨饪饫饬饭飧饮饴飵飶饲饱饰饳饺饸饼糍饷养饵饹饻饽馁饿餔馂饾𫗧余肴馄馃饯馅餦餧馆餪餫糊餭糇饧喂馉馇𩠌馎饩馏馊馌馍馒馐馑馓馈馔饥饶飨𫗴餍馋饟饠馕马驭冯馯驮驰驯驲𫘜驳𫘝𬳶駊駎驻驽驹𬳵驵驾骀驸駚驶驼駞驷骂骈駤駧駩𬳽駫骇骃骆駶骎駻𬳿骏骋骍騃𫘧骓騉𫘦骔骒骑骐𬴂騔骛骗騚騜騝𬴃騟𫘨骙䯄騪骞骘骝腾𫘬騴𫘪驺骚骟騻騼骡蓦骜骖骠骢驱骅驋骕骁𬴊骣驓骄验驙惊驿骤驴骧骥骦驨骊骉肮髅脏体髌髋发松胡鬖须鬠鬓斗闹哄阋阄郁鬶魉魇鱼鱽𫚉鱾魥魦鲀鲁鲂魵鱿鲄魽𬶍鲅鲆鮄鮅𫚖𬶋鲌鲉鲏鲇鲐鲍鲋鲊鲒鲘鲞鲕𩽾𬶏𬶐䲟鮤鲖鲔鲛鲑鲜鮯鮰鲓鮵鲪𩾃鲝鮿鲧鲠鯄鯆鲩鲤鲨鲬鲻鲯鲭鲞鲷鲴鯞鲱鲵鲲鲳鲸鲮鲰鯬鲶鯱鲺鯶鳀𬶟鲫鯾鳊鳈鲗鳂䲠鲽鳇𬶠鰋䲡鳅鲾鳄鰑鳆鳃鰕鳁鳒鳑鳋鲥𫚕鳏鰦䲢鳎鳐鰫鳍鳁鲢鳌鳓鳘𬶭鲦鲣鲹鳗鳛鰽鳔𬶨鳉鱄鳙鱆𩾌鳕鳖鱊鳟鳝鳜鳞鲟𬶮鲼鲎鲙鱢鳣鳡鳢鲿鲚鱮鳠𫚭鳄鲈鲡鸟凫鸠凫鸤凤鸣鸢鳷鳼鳽䴓鴀鴃鴅鸩鸨鸦鴐鸰鴔鸵鴗鸳鴜鸲鸮鸱鸪鴥鸯鸭鴮鸸鸹鴲鴳鸻䴕鸿鴽鸽䴔鸺鸼鵊𬷕鹀鹃鹆鹁鵚鹈鹅𫛭鹄鹉鵧鵩鹌鵫鹏鹐鹎雕鹊鹓鹍䴖鸫鹑鹒鶌鶒鹋鹙鶗鹕鹗𬸘鹖鹛鶦鹜䴗鸧鶭莺鶰𬸣鹟鹤鹠鹡鹘鹣鹚鹚鹢鹞鸡鷅䴘鹝鷐鹧鷔鹥鸥鸷鹨𬸦鷣鷤鸶鹪鷨鷩鹔𬸪鹩鹫鹇鹇鷷鹬鹰鹭鸴鷿㶉鹯䴙鸋鹱鹲𬸚鸬鸗鹴鹦鹳鹂鸾卤咸鹾碱盐丽麦麨麸面面𤿲曲麲𪎌曲面麷么么黄黉点党黪霉黡黩黾鼋鼌鼍冬鼹齐斋赍齑齿龀龁龂𬹼龅龇龃龆龄出龈啮齩龊龉齭𬺈𫠜齰龋齴腭龌𬺓齾龙厐庞䶮龓龚龛龟龢龭龯䜤鿒𠀾𠌥𠏢𠐊㓆𠞆𠠎𠬙𠼤𠽃𠿕𡂡𡃄𠴛𡃤𡄔𡄣𠲥𡅯𫭼𡋗𡓁𡋀𡍣㛟𡟫㛿㛠𡭜𡭬𡳃𡸗𡹬岁𡽗㟜𡿖𢍰𢠼𢣐𢘝𢣭𢤩𢤱𢤿𢯷𢶒𢫞𢷮𢬦𢺳暅𣋋𣍐㭣𣜬𣝕𣘓𣞎𣑶𣯩𣯴毶𣽏㳢𣿉𣺽𤄷𣷷𤑳𤑹𤒎𤒻𤓌𤓎𤊰𤘀𤛮𤛱𤜆𤠮𤢟𤢻𤩂㻘㻏𤬅𤳷𤳄𤷃𤸫𤺔𥅿𥅘𥏝𥐰𥐯𥖲𥗇𬒗𥜐𥜰𥞵䅪𥢶𥢷𥨐𥪂𥯤𥴨𥴼𥵃𥵊𥶽𥮋𥻦𥹥𥽖𥾯𥿊𦀖𦂅𦃄𦃩𦅇𦅈𦆲𦒀𦔖𡳒𦟼𦠅𦡝𦢈𦟗𦧺䑽𦪽𦱌𦾟𧎈𧒯𧔥𧕟䘞䙊䘛𧞫𧝧𧡴𧢄𧦝𧦧𧩕䜥𧩼𧫝𧬤𧭈𧭹𧳟䞌𧶔䞎𧷎𧸘𧹈𧽯𨂐𨄣𨅍𨆪𨇁𨇞𨇤𨇰𨇽𨈊𨈌䢀䢁𨊻䢂𨌈𨍰𨎌𨎮𨏠𨏥𨞺𨟊𨢿𨣈𨣞𨣧𨤰𨥛𨥟䦀𬭊䦁𨧰𨧱𬭛𨨛𨨢𨩰𨪕𨫒𨬖𬭶𬭳𨭖𨭸𨮂𨮳䥿𨯟𨰃𨰋𨰥𨰲𨲳𨳑𨳕𨴗𨴹𨵩𨵸𨶀𨶏𨶮𨶲𨷲𨼳𨽏𩀨𩅙𩎖𩎢𩏂𩏠𩏪𩏷𩑔𩒎𩓣𩓥𩔑𩔳𩖰𩗀𩗓𩗴𩘀𩘝𩘹𩘺𩙈𩚛𩚥𩚩𩚵𩛆𩛌𩛡𩛩𩜇𩜦𩜵𩝔𩝽𩞄𩞦䭪𩟐𩟗𩠠𩡣𩡺𩢡𩢴𩢸𩢾𩣏䯃𩣫𩣵𩣺𩤊𩤙𩤲𩤸𩥄𩥇𩥉𩥑𩦠𩧆𩭙𩯁𩯳𩰀𩰹𩳤𩴵𩵦𩵩𩵹𩶁䲞𩶰𩶱𩷰𩸃𩸄𩸡𩸦𩻗𩻬𩻮𩼶𩽇𩿅𩿤𩿪𪀖𪀦𪀾𪁈𪁖𪂆𪃍𪃏𪃒𪃧𪄆𪄕𪅂𪆷𪇳𪈼𪉸𪋿𪌭𪍠𪓰𪔵𪘀𪘯𪙏𪟖𪷓𫒡𫜦𰻝";
  LF._t2sMap = null;

  LF.toSimplified = function toSimplified(value) {
    const text = String(value || "");
    if (!text) return "";
    if (!LF._t2sMap) {
      LF._t2sMap = new Map();
      const from = Array.from(LF._t2sFrom);
      const to = Array.from(LF._t2sTo);
      for (let i = 0; i < from.length; i++) LF._t2sMap.set(from[i], to[i]);
      // Common Taiwan form not always listed as a single-character TS pair.
      if (!LF._t2sMap.has("著")) LF._t2sMap.set("著", "着");
    }
    let out = "";
    for (const ch of text) out += LF._t2sMap.get(ch) || ch;
    return out;
  };

  LF.normalizeText = function normalizeText(value) {
    return String(value || "")
      .normalize("NFKC")
      .replace(/\s+/g, " ")
      .trim();
  };

  LF.coreTitle = function coreTitle(value) {
    let text = LF.normalizeText(value);
    text = text.replace(/\s*[\(\[（【].*?[\)\]）】]/g, "");
    text = text.replace(/\s+(?:feat(?:uring)?|ft|with)\.?\s+.+$/i, "");
    return LF.toSimplified(text).toLowerCase();
  };

  LF.isLiveOrRemix = function isLiveOrRemix(value) {
    return /\b(live|remix|instrumental)\b|现场|現場|演唱会|演唱會|\bdj\b|夜店/i.test(String(value || ""));
  };

  // Pick the closest title/artist/duration candidate. Returns null if nothing is confident.
  LF.pickBest = function pickBest(track, candidates, maxDurationDeltaMs) {
    const maxDt = maxDurationDeltaMs == null ? 4000 : maxDurationDeltaMs;
    const wantTitle = LF.coreTitle(track && track.title);
    const wantArtist = LF.coreTitle(track && track.artist);
    const wantAlbum = LF.coreTitle((track && track.album) || "");
    const durationMs = Number(track && track.durationMs) || 0;
    const queryIsLive = LF.isLiveOrRemix((track && track.title) || "");
    let best = null;
    let bestScore = -1;

    for (const cand of candidates || []) {
      if (!cand) continue;
      const title = LF.coreTitle(cand.title);
      const artist = LF.coreTitle(cand.artist);
      const album = LF.coreTitle(cand.album || "");
      const candMs = Number(cand.durationMs) || 0;
      const dt = durationMs && candMs ? Math.abs(candMs - durationMs) : 0;
      if (durationMs && candMs && dt > maxDt) continue;
      if (wantTitle && title !== wantTitle && !title.includes(wantTitle) && !wantTitle.includes(title)) continue;
      if (wantArtist && artist && !artist.includes(wantArtist) && !wantArtist.includes(artist)) continue;

      const raw = (cand.title || "") + " " + (cand.album || "");
      const noisy = !queryIsLive && LF.isLiveOrRemix(raw);
      if (noisy && !(durationMs && candMs && dt <= 1500)) continue;

      let score = 0;
      if (wantTitle && title === wantTitle) score += 50;
      else if (wantTitle) score += 10;
      if (wantArtist && artist && (artist.includes(wantArtist) || wantArtist.includes(artist))) score += 30;
      if (wantAlbum && album && (album === wantAlbum || album.includes(wantAlbum) || wantAlbum.includes(album))) score += 15;
      if (durationMs && candMs) score += Math.max(0, 20 - dt / 200);
      if (noisy) score -= 25;
      if (score > bestScore) {
        bestScore = score;
        best = cand;
      }
    }

    return bestScore >= 40 ? best : null;
  };

  LF.lyricsFromLrc = function lyricsFromLrc(lrc, id, language) {
    const text = String(lrc || "").trim();
    if (!text || /纯音乐,\s*请欣赏/.test(text)) return null;
    const parsed = LF.parseLocalLyrics(text);
    const hasSynced = !!(parsed.synced && parsed.synced.length);
    const hasPlain = !!(parsed.unsynced && parsed.unsynced.length);
    if (!hasSynced && !hasPlain) return null;
    return {
      id: id,
      syncedLyrics: hasSynced ? text : null,
      plainLyrics: hasSynced ? null : text,
      language: language || "",
    };
  };

  /* ===== src/providers/netease.js ===== */
  LF.providers = LF.providers || {};

  LF.providers.netease = {
    id: "netease",
    displayName: "NetEase",

    fetch: async function neteaseFetch(track) {
      if (!track || !track.title) return null;
      const query = [track.title, track.artist].filter(Boolean).join(" ");
      const search = await LF.httpGet(
        "https://music.163.com/api/search/get?s=" + encodeURIComponent(query) + "&type=1&limit=10&offset=0",
        { Referer: "https://music.163.com/", Origin: "https://music.163.com/" }
      );
      const songs = search.json && search.json.result && search.json.result.songs;
      if (!Array.isArray(songs) || !songs.length) return null;

      const best = LF.pickBest(
        track,
        songs.map(function (song) {
          return {
            id: song.id,
            title: song.name,
            artist: (song.artists || []).map(function (artist) { return artist.name; }).join(" "),
            album: song.album && song.album.name,
            durationMs: song.duration,
          };
        })
      );
      if (!best) return null;

      const lyric = await LF.httpGet(
        "https://music.163.com/api/song/lyric?id=" + encodeURIComponent(best.id) + "&lv=-1&kv=-1&tv=-1",
        { Referer: "https://music.163.com/", Origin: "https://music.163.com/" }
      );
      const body = lyric.json || {};
      return LF.lyricsFromLrc(body.lrc && body.lrc.lyric, best.id, "zh");
    },
  };

  /* ===== src/providers/kugou.js ===== */
  LF.providers = LF.providers || {};

  LF.providers.kugou = {
    id: "kugou",
    displayName: "KuGou",

    fetch: async function kugouFetch(track) {
      if (!track || !track.title) return null;
      const query = [track.title, track.artist].filter(Boolean).join(" ");
      const search = await LF.httpGet(
        "https://mobileservice.kugou.com/api/v3/search/song?keyword=" +
          encodeURIComponent(query) +
          "&page=1&pagesize=10"
      );
      const songs = search.json && search.json.data && search.json.data.info;
      if (!Array.isArray(songs) || !songs.length) return null;

      const best = LF.pickBest(
        track,
        songs.map(function (song) {
          const seconds = Number(song.duration) || 0;
          return {
            id: song.hash,
            title: song.songname || song.songname_original,
            artist: song.singername,
            album: song.album_name,
            durationMs: seconds > 10000 ? seconds : seconds * 1000,
            hash: song.hash,
          };
        })
      );
      if (!best || !best.hash) return null;

      const durationSec = Math.round((Number(best.durationMs) || Number(track.durationMs) || 0) / 1000);
      const kgHeaders = {
        "KG-RC": "1",
        "User-Agent": "KuGou2012-9020-ExpandSearchManager",
      };
      const listed = await LF.httpGet(
        "https://lyrics.kugou.com/search?ver=1&man=yes&client=pc&lrctxt=1&keyword=" +
          encodeURIComponent(best.title || track.title) +
          "&hash=" + encodeURIComponent(best.hash) +
          "&timelength=" + encodeURIComponent(String(durationSec)),
        kgHeaders
      );
      const candidates = (listed.json && listed.json.candidates) || [];
      if (!Array.isArray(candidates) || !candidates.length) return null;

      const trackMs = Number(track.durationMs) || best.durationMs || 0;
      const chosen =
        candidates.find(function (item) {
          const dt = Math.abs((Number(item.duration) || 0) - trackMs);
          return !trackMs || dt <= 4000;
        }) || candidates[0];
      if (!chosen || !chosen.id || !chosen.accesskey) return null;

      const download = await LF.httpGet(
        "https://lyrics.kugou.com/download?ver=1&client=pc&fmt=lrc&charset=utf8&id=" +
          encodeURIComponent(chosen.id) +
          "&accesskey=" + encodeURIComponent(chosen.accesskey),
        kgHeaders
      );
      const content = download.json && download.json.content;
      if (!content) return null;
      return LF.lyricsFromLrc(LF.decodeBase64Utf8(content), chosen.id, "zh");
    },
  };

  /* ===== src/providers/lrclib.js ===== */
  LF.providers = LF.providers || {};

  LF.providers.lrclib = {
    id: "lrclib",
    displayName: "LRCLIB",
    getUrl: "https://lrclib.net/api/get",
    searchUrl: "https://lrclib.net/api/search",

    isUsable: function isUsableLrclib(data) {
      if (!data || data.instrumental) return false;
      if (data.syncedLyrics && String(data.syncedLyrics).trim()) return true;
      if (data.plainLyrics && String(data.plainLyrics).trim()) return true;
      return false;
    },

    queriesFor: function lrclibQueries(track) {
      const seen = new Set();
      const list = [];
      const add = function add(title, artist, album) {
        const key = [title, artist, album].join("\0");
        if (!title || seen.has(key)) return;
        seen.add(key);
        list.push({ title: title, artist: artist || "", album: album || "" });
      };
      add(track.title, track.artist, track.album);
      add(LF.toSimplified(track.title), LF.toSimplified(track.artist || ""), LF.toSimplified(track.album || ""));
      add(LF.coreTitle(track.title), LF.coreTitle(track.artist || ""), LF.coreTitle(track.album || ""));
      return list;
    },

    get: async function lrclibGet(query, durationMs) {
      const params = new URLSearchParams({
        track_name: query.title,
        artist_name: query.artist || "",
        album_name: query.album || "",
        duration: String((durationMs || 0) / 1000),
      });
      const res = await fetch(this.getUrl + "?" + params.toString(), {
        headers: { "x-user-agent": LF.config.userAgent },
      });
      if (res.status !== 200) return null;
      return res.json();
    },

    search: async function lrclibSearch(query, durationMs) {
      const params = new URLSearchParams({
        track_name: query.title,
        artist_name: query.artist || "",
      });
      const res = await fetch(this.searchUrl + "?" + params.toString(), {
        headers: { "x-user-agent": LF.config.userAgent },
      });
      if (res.status !== 200) return null;
      const list = await res.json();
      if (!Array.isArray(list) || !list.length) return null;
      const durationSec = (durationMs || 0) / 1000;
      const scored = list
        .map((item) => {
          const dt = Math.abs((item.duration || 0) - durationSec);
          return { item, dt };
        })
        .sort((a, b) => a.dt - b.dt);
      const best = scored[0];
      if (durationSec && best.dt > 4) {
        const named = list.find(
          (item) =>
            String(item.trackName || item.name || "").toLowerCase() === String(query.title || "").toLowerCase()
        );
        if (named) return named;
      }
      return best.item;
    },

    fetch: async function lrclibFetch(track) {
      if (!track || !track.title) return null;
      const queries = this.queriesFor(track);
      for (const query of queries) {
        let data = null;
        try {
          data = await this.get(query, track.durationMs);
        } catch (err) {
          LF.log("lrclib get failed", String(err));
          data = null;
        }
        if (!this.isUsable(data)) {
          try {
            data = await this.search(query, track.durationMs);
          } catch (err) {
            LF.log("lrclib search failed", String(err));
            data = null;
          }
        }
        if (this.isUsable(data)) return data;
      }
      return null;
    },
  };

  /* ===== src/providers/lrcmux.js ===== */
  LF.providers = LF.providers || {};

  LF.providers.lrcmux = {
    id: "lrcmux",
    displayName: "LRCMux",
    url: "https://api.lrcmux.dev/get",

    queriesFor: function lrcmuxQueries(track) {
      const seen = new Set();
      const list = [];
      const add = function add(title, artist, album) {
        const key = [title, artist, album].join("\0");
        if (!title || seen.has(key)) return;
        seen.add(key);
        list.push({ title: title, artist: artist || "", album: album || "" });
      };
      add(track.title, track.artist, track.album);
      if (LF.toSimplified) {
        add(LF.toSimplified(track.title), LF.toSimplified(track.artist || ""), LF.toSimplified(track.album || ""));
      }
      if (LF.coreTitle) {
        add(LF.coreTitle(track.title), LF.coreTitle(track.artist || ""), LF.coreTitle(track.album || ""));
      }
      return list;
    },

    fetch: async function lrcmuxFetch(track) {
      if (!track || !track.title) return null;
      const queries = this.queriesFor(track);
      const durationSec = Math.round((Number(track.durationMs) || 0) / 1000);
      for (const query of queries) {
        const params = new URLSearchParams({
          artist: query.artist || "",
          title: query.title,
          format: "lrc",
          level: "line",
          sources: "deezer,ytmusic",
        });
        if (query.album) params.set("album", query.album);
        if (durationSec) params.set("duration", String(durationSec));
        let res = null;
        try {
          res = await LF.httpGet(this.url + "?" + params.toString(), {
            "User-Agent": LF.config.userAgent,
          });
        } catch (err) {
          LF.log("lrcmux fetch failed", String(err));
          res = null;
        }
        if (!res || !res.ok || !res.text) continue;
        const parsed = LF.lyricsFromLrc(res.text, query.title, "");
        if (parsed) return parsed;
      }
      return null;
    },
  };

  /* ===== src/providers/registry.js ===== */
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

  /* ===== src/settings-store.js ===== */
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

  /* ===== src/fallback.js ===== */
  LF.cache = new Map();
  LF.inflight = new Map();

  LF.cacheGet = function cacheGet(id) {
    const ids = LF.normalizeId(id);
    return (
      (ids.base62 && LF.cache.get(ids.base62)) ||
      (ids.hex && LF.cache.get(ids.hex)) ||
      (ids.raw && LF.cache.get(ids.raw)) ||
      null
    );
  };

  LF.cacheSet = function cacheSet(id, value) {
    const ids = LF.normalizeId(id);
    if (ids.base62) LF.cache.set(ids.base62, value);
    if (ids.hex) LF.cache.set(ids.hex, value);
    if (ids.raw) LF.cache.set(ids.raw, value);
  };

  LF.lookupTrack = async function lookupTrack(track) {
    if (!track?.base62) return { status: "none" };
    const existing = LF.cacheGet(track.base62);
    if (existing && existing.status !== "pending") return existing;
    if (LF.inflight.has(track.base62)) return LF.inflight.get(track.base62);

    const job = (async () => {
      try {
        let payload = null;
        let provider = null;
        let raw = null;
        for (const candidate of LF.providers.enabled()) {
          try {
            raw = await candidate.fetch(track);
          } catch (err) {
            LF.log(candidate.id + " fetch failed", String(err));
            raw = null;
          }
          if (!raw) continue;
          payload = LF.toColorLyrics(raw, candidate);
          if (payload) {
            provider = candidate;
            break;
          }
        }
        if (!payload) {
          const miss = { status: "none", payload: null, track };
          LF.cacheSet(track.base62, miss);
          LF.log("fallback none", { id: track.base62, title: track.title });
          return miss;
        }
        const hit = {
          status: "hit",
          payload,
          track,
          provider: provider.displayName || provider.id,
        };
        LF.cacheSet(track.base62, hit);
        LF.log("fallback hit", {
          id: track.base62,
          title: track.title,
          provider: hit.provider,
          syncType: payload.lyrics.syncType,
          lines: payload.lyrics.lines.length,
        });
        try {
          LF.injectQueryCache(track.uri, payload);
        } catch (err) {
          LF.log("inject after hit failed", String(err));
        }
        return hit;
      } catch (err) {
        const miss = { status: "none", payload: null, track };
        LF.cacheSet(track.base62, miss);
        LF.log("fallback error", String(err));
        return miss;
      } finally {
        LF.inflight.delete(track.base62);
      }
    })();

    LF.inflight.set(track.base62, job);
    return job;
  };

  LF.trackForRequestId = function trackForRequestId(id) {
    const cached = LF.cacheGet(id);
    if (cached?.track) return cached.track;
    const current = LF.currentTrack();
    if (!current) return null;
    const ids = LF.normalizeId(id);
    if (
      (ids.base62 && ids.base62 === current.base62) ||
      (ids.hex && ids.hex === current.hex)
    ) {
      return current;
    }
    return current;
  };

  LF.fallbackFor = async function fallbackFor(id) {
    const known = LF.cacheGet(id);
    if (known) return known;
    const track = LF.trackForRequestId(id);
    if (!track) return { status: "none", payload: null };
    return LF.lookupTrack(track);
  };

  /* ===== src/network.js ===== */
  // Hook window.fetch and XMLHttpRequest only. Do not hook webpack SpotifyTransportRequest:
  // walking or pushing dummy rspack chunks has crashed xpui.

  LF.jsonResponse = function jsonResponse(body) {
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  LF.hookXHR = function hookXHR() {
    if (!window.XMLHttpRequest || XMLHttpRequest.prototype.__lyricsFallbackHooked) return;
    const open = XMLHttpRequest.prototype.open;
    const send = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url) {
      try { this.__lfUrl = url; } catch (_) {}
      return open.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function () {
      const xhr = this;
      const url = xhr.__lfUrl;
      const target = LF.idFromUrl(url);
      if (!target) return send.apply(xhr, arguments);
      xhr.addEventListener("readystatechange", function () {
        if (xhr.readyState !== 4) return;
        try {
          LF.log("xhr " + target.kind + " status=" + xhr.status, target.id);
        } catch (_) {}
      });
      return send.apply(xhr, arguments);
    };
    XMLHttpRequest.prototype.__lyricsFallbackHooked = true;
    LF.log("hooked XMLHttpRequest");
  };

  LF.hookFetch = function hookFetch() {
    if (!window.fetch || window.fetch.__lyricsFallbackHooked) return;
    const original = window.fetch.bind(window);
    window.fetch = async function (input, init) {
      const url = typeof input === "string" ? input : input && input.url;
      const target = LF.idFromUrl(url);
      if (!target) return original(input, init);
      if (target.kind === "color-lyrics") {
        const res = await original(input, init);
        if (res.ok) {
          const clone = res.clone();
          let body;
          try { body = await clone.json(); } catch (_) { return res; }
          if (LF.isOfficialColorBody(body)) return res;
          const fb = await LF.fallbackFor(target.id);
          if (fb.status === "hit") {
            LF.log("fetch color-lyrics replaced with " + (fb.provider || "fallback"), target.id);
            return LF.jsonResponse(fb.payload);
          }
          return res;
        }
        if (res.status === 404 || res.status === 204) {
          const fb = await LF.fallbackFor(target.id);
          if (fb.status === "hit") {
            LF.log("fetch color-lyrics 404, using " + (fb.provider || "fallback"), target.id);
            return LF.jsonResponse(fb.payload);
          }
        }
        return res;
      }
      if (target.kind === "metadata") {
        const res = await original(input, init);
        if (!res.ok) return res;
        const clone = res.clone();
        let body;
        try { body = await clone.json(); } catch (_) { return res; }
        if (LF.isOfficialMetadata(body)) return res;
        const fb = await LF.fallbackFor(target.id);
        if (fb.status === "hit") {
          LF.log("fetch metadata flipped has_lyrics=true", target.id);
          return LF.jsonResponse(Object.assign({}, body, { has_lyrics: true }));
        }
        return res;
      }
      return original(input, init);
    };
    window.fetch.__lyricsFallbackHooked = true;
    LF.log("hooked window.fetch");
  };

  /* ===== src/query-cache.js ===== */
  LF.looksLikeQueryClient = function looksLikeQueryClient(obj) {
    if (!obj || typeof obj !== "object") return null;
    try {
      if (
        typeof obj.setQueryData === "function" &&
        typeof obj.getQueryCache === "function" &&
        typeof obj.getQueryData === "function"
      ) {
        return obj;
      }
      if (obj.client && LF.looksLikeQueryClient(obj.client)) return obj.client;
    } catch (_) {}
    return null;
  };

  LF.findQueryClient = function findQueryClient() {
    if (LF.debug.queryClient && typeof LF.debug.queryClient.setQueryData === "function") {
      return LF.debug.queryClient;
    }
    const nodes = [];
    try {
      const selectors = ["#main", "#root", ".Root", "body > div", "[data-testid='root']"];
      for (const sel of selectors) {
        document.querySelectorAll(sel).forEach((el) => nodes.push(el));
      }
      if (document.body) nodes.push(document.body);
    } catch (_) {}
    const fibers = [];
    for (const el of nodes) {
      try {
        for (const key of Object.keys(el)) {
          if (
            key.startsWith("__reactContainer$") ||
            key.startsWith("__reactFiber$") ||
            key.startsWith("__reactInternalInstance$")
          ) {
            fibers.push(el[key]);
          }
        }
      } catch (_) {}
    }
    const seen = new Set();
    const stack = fibers.slice();
    let hops = 0;
    while (stack.length && hops < 8000) {
      const fiber = stack.pop();
      hops++;
      if (!fiber || typeof fiber !== "object" || seen.has(fiber)) continue;
      seen.add(fiber);
      const buckets = [
        fiber.stateNode,
        fiber.memoizedState,
        fiber.memoizedProps,
        fiber.pendingProps,
        fiber.context,
      ];
      for (const bucket of buckets) {
        const qc = LF.looksLikeQueryClient(bucket);
        if (qc) {
          LF.debug.queryClient = qc;
          LF.log("found QueryClient");
          return qc;
        }
      }
      let state = fiber.memoizedState;
      let sh = 0;
      while (state && sh++ < 40) {
        const qc =
          LF.looksLikeQueryClient(state) ||
          LF.looksLikeQueryClient(state.memoizedState) ||
          LF.looksLikeQueryClient(state.queue && state.queue.shared);
        if (qc) {
          LF.debug.queryClient = qc;
          LF.log("found QueryClient via hook state");
          return qc;
        }
        try {
          state = state.next;
        } catch (_) {
          break;
        }
      }
      try {
        if (fiber.child) stack.push(fiber.child);
        if (fiber.sibling) stack.push(fiber.sibling);
      } catch (_) {}
    }
    return LF.debug.queryClient || null;
  };

  LF.uriOfAvailabilityKey = function uriOfAvailabilityKey(key) {
    if (!Array.isArray(key) || key[0] !== "useLyricsAvailability") return null;
    return key[1] || null;
  };

  LF.uriOfLyricsKey = function uriOfLyricsKey(key) {
    if (!Array.isArray(key) || key[0] !== "lyrics") return null;
    const spec = key[1];
    if (spec && typeof spec === "object") return spec.uri || null;
    return null;
  };

  // Only write when official lyrics are absent. Official has_lyrics / color-lyrics win.
  LF.injectQueryCache = function injectQueryCache(uri, payload) {
    if (!uri || !payload) return false;
    const qc = LF.findQueryClient();
    if (!qc) {
      LF.log("QueryClient not ready");
      return false;
    }
    const transformed = LF.toQueryLyrics(payload);
    let flipped = false;
    let wroteLyrics = 0;
    try {
      const queries = qc.getQueryCache().getAll();
      for (const query of queries) {
        const key = query.queryKey;
        const availUri = LF.uriOfAvailabilityKey(key);
        if (availUri === uri) {
          const current = query.state && query.state.data;
          if (current === true) {
            LF.debug.injected[uri] = LF.debug.injected[uri] || {};
            LF.debug.injected[uri].officialAvailability = true;
            continue;
          }
          qc.setQueryData(key, true);
          flipped = true;
        }
        const lyricsUri = LF.uriOfLyricsKey(key);
        if (lyricsUri === uri) {
          const current = query.state && query.state.data;
          if (LF.isOfficialCachedLyrics(current)) {
            LF.debug.injected[uri] = LF.debug.injected[uri] || {};
            LF.debug.injected[uri].officialLyrics = true;
            continue;
          }
          // Same fallback provider: skip to avoid 1s poll flicker.
          // Different fallback provider (e.g. after a reorder + cache clear): overwrite.
          if (
            current &&
            current.hasLyrics &&
            LF.providers.isFallbackName(current.provider) &&
            String(current.provider || "") === String(transformed.provider || "")
          ) {
            continue;
          }
          qc.setQueryData(key, Object.assign({}, transformed));
          wroteLyrics++;
        }
      }
    } catch (err) {
      LF.log("query cache walk failed", String(err));
    }

    const official = !!(LF.debug.injected[uri] && LF.debug.injected[uri].officialAvailability);
    if (!official) {
      try {
        const existing = qc.getQueryData(["useLyricsAvailability", uri]);
        if (existing !== true) {
          qc.setQueryData(["useLyricsAvailability", uri], true);
          flipped = true;
        }
      } catch (err) {
        LF.log("set availability failed", String(err));
      }
    }

    LF.debug.injected[uri] = Object.assign({}, LF.debug.injected[uri], {
      flipped,
      wroteLyrics,
      at: Date.now(),
    });
    if (flipped || wroteLyrics) {
      LF.log("injected query cache", { uri, flipped, wroteLyrics });
    }
    return flipped || wroteLyrics > 0;
  };

  LF.syncCurrentIntoQueryCache = function syncCurrentIntoQueryCache() {
    const track = LF.currentTrack();
    if (!track) return;
    const hit = LF.cacheGet(track.base62);
    if (!hit || hit.status !== "hit") return;
    LF.injectQueryCache(track.uri, hit.payload);
  };

  LF.watchQueryCache = function watchQueryCache() {
    if (LF.debug.queryCacheWatching) return;
    const qc = LF.findQueryClient();
    if (!qc) return;
    try {
      qc.getQueryCache().subscribe(function () {
        try {
          LF.syncCurrentIntoQueryCache();
        } catch (_) {}
      });
      LF.debug.queryCacheWatching = true;
      LF.log("subscribed to QueryCache");
    } catch (err) {
      LF.log("QueryCache subscribe failed", String(err));
    }
  };

  /* ===== src/settings-ui.js ===== */
  LF.settings = LF.settings || {};

  LF.sampleTrack = function sampleTrack() {
    const sample = LF.config.sampleTrack || {
      title: "Blinding Lights",
      artist: "The Weeknd",
      album: "After Hours",
      durationMs: 200000,
    };
    return {
      title: sample.title,
      artist: sample.artist || "",
      album: sample.album || "",
      durationMs: Number(sample.durationMs) || 0,
      uri: "",
      base62: "",
      hex: "",
    };
  };

  LF.trackForLatencyTest = function trackForLatencyTest() {
    return LF.currentTrack() || LF.sampleTrack();
  };

  LF.withTimeout = function withTimeout(promise, ms) {
    const timeoutMs = Number(ms) || 15000;
    return new Promise(function (resolve, reject) {
      const timer = setTimeout(function () {
        reject(new Error("timeout after " + timeoutMs + "ms"));
      }, timeoutMs);
      promise.then(
        function (value) {
          clearTimeout(timer);
          resolve(value);
        },
        function (err) {
          clearTimeout(timer);
          reject(err);
        }
      );
    });
  };

  LF.lyricsStatus = function lyricsStatus(raw) {
    if (!raw) return "miss";
    const payload = LF.toColorLyrics(raw, { displayName: "test" });
    if (!payload) return "miss";
    if (payload.lyrics && payload.lyrics.syncType === "LINE_SYNCED") return "synced";
    return "unsynced";
  };

  LF.testProviderLatency = async function testProviderLatency(provider, track) {
    const started = performance.now();
    let raw = null;
    let error = null;
    try {
      raw = await LF.withTimeout(provider.fetch(track), LF.config.latencyTimeoutMs || 15000);
    } catch (err) {
      error = String(err && err.message ? err.message : err);
      raw = null;
    }
    const ms = Math.round(performance.now() - started);
    const status = error ? "error" : LF.lyricsStatus(raw);
    return {
      id: provider.id,
      displayName: provider.displayName || provider.id,
      ms: ms,
      status: status,
      error: error,
    };
  };

  LF.testAllProvidersLatency = async function testAllProvidersLatency(onProgress) {
    const current = LF.currentTrack();
    const track = current || LF.sampleTrack();
    const providers = LF.providers.enabled();
    const results = [];
    await Promise.all(
      providers.map(function (provider) {
        return LF.testProviderLatency(provider, track).then(function (result) {
          results.push(result);
          if (onProgress) onProgress(result, results.slice(), track, !current);
          return result;
        });
      })
    );
    return { track: track, usedSample: !current, results: results };
  };

  LF.settings.el = function settingsEl(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        const value = attrs[key];
        if (value == null || value === false) return;
        if (key === "className") node.className = value;
        else if (key === "text") node.textContent = value;
        else if (key === "html") node.innerHTML = value;
        else if (key.indexOf("on") === 0 && typeof value === "function") {
          node.addEventListener(key.slice(2).toLowerCase(), value);
        } else if (key === "disabled") node.disabled = !!value;
        else node.setAttribute(key, value === true ? "" : String(value));
      });
    }
    (children || []).forEach(function (child) {
      if (child == null) return;
      node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    });
    return node;
  };

  LF.settings.statusLabel = function statusLabel(status) {
    if (status === "synced") return "同步歌词";
    if (status === "unsynced") return "仅纯文本";
    if (status === "error") return "出错";
    if (status === "testing") return "测试中…";
    return "未找到";
  };

  LF.settings.trackLabel = function trackLabel(track) {
    if (!track) return "当前没有在播的歌";
    const name = [track.title, track.artist].filter(Boolean).join(" — ");
    return "当前曲目：" + name;
  };

  LF.settings.isDefaultOrder = function isDefaultOrder(ids) {
    const current = ids || LF.config.providers || [];
    const def = LF.defaultProviders();
    if (current.length !== def.length) return false;
    for (let i = 0; i < def.length; i++) {
      if (current[i] !== def[i]) return false;
    }
    return true;
  };

  LF.settings.updateResetButton = function updateResetButton() {
    const button = LF.settings.resetButton;
    if (!button) return;
    const custom = !LF.settings.isDefaultOrder();
    button.hidden = false;
    button.style.display = "inline-flex";
    button.style.visibility = custom ? "visible" : "hidden";
    button.style.pointerEvents = custom ? "auto" : "none";
    button.setAttribute("aria-hidden", custom ? "false" : "true");
    if (custom) button.removeAttribute("tabindex");
    else button.setAttribute("tabindex", "-1");
  };

  LF.settings.updateTrackLine = function updateTrackLine() {
    const line = LF.settings.trackLine;
    if (!line) return;
    line.textContent = LF.settings.trackLabel(LF.currentTrack());
  };

  LF.settings.watchTrackLabel = function watchTrackLabel() {
    if (LF.settings._trackTimer) {
      clearInterval(LF.settings._trackTimer);
      LF.settings._trackTimer = null;
    }
    const tick = function tick() {
      const line = LF.settings.trackLine;
      if (!line || !line.isConnected) {
        if (LF.settings._trackTimer) {
          clearInterval(LF.settings._trackTimer);
          LF.settings._trackTimer = null;
        }
        return;
      }
      LF.settings.updateTrackLine();
    };
    tick();
    LF.settings._trackTimer = setInterval(tick, 1000);
  };

  LF.settings.renumber = function renumber(host) {
    const rows = host.querySelectorAll(".lf-settings-row");
    for (let i = 0; i < rows.length; i++) {
      const index = rows[i].querySelector(".lf-settings-index");
      if (index) index.textContent = String(i + 1);
    }
  };

  LF.settings.dragHandle = function dragHandle() {
    return LF.settings.el("span", {
      className: "lf-settings-handle",
      title: "拖动以调整顺序",
      "aria-label": "拖动以调整顺序",
      html:
        '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="5" cy="3" r="1.15" fill="currentColor"/><circle cx="11" cy="3" r="1.15" fill="currentColor"/><circle cx="5" cy="8" r="1.15" fill="currentColor"/><circle cx="11" cy="8" r="1.15" fill="currentColor"/><circle cx="5" cy="13" r="1.15" fill="currentColor"/><circle cx="11" cy="13" r="1.15" fill="currentColor"/></svg>',
    });
  };

  LF.settings.bindDrag = function bindDrag(row, host) {
    const onDown = function onDown(e) {
      if (e.button != null && e.button !== 0) return;
      if (LF.settings.dragging) return;
      e.preventDefault();
      e.stopPropagation();
      LF.settings.startDrag(row, host, e);
    };
    row.addEventListener("pointerdown", onDown);
  };

  LF.settings.disposeWarmDrag = function disposeWarmDrag() {
    const leftover = document.querySelectorAll(".lf-settings-row-ghost");
    for (let i = 0; i < leftover.length; i++) {
      if (leftover[i].parentNode) leftover[i].parentNode.removeChild(leftover[i]);
    }
    LF.settings._warmGhost = null;
  };

  LF.settings.warmDrag = function warmDrag(host) {
    host = host || LF.settings.listHost;
    if (!host || !host.isConnected) return;
    const rows = Array.from(host.querySelectorAll(".lf-settings-row"));
    if (!rows.length) return;

    for (let i = 0; i < rows.length; i++) {
      rows[i].style.willChange = "transform";
      rows[i].style.transition = "none";
      rows[i].style.transform = "translate3d(0,0,0)";
    }
    for (let i = 0; i < rows.length; i++) rows[i].getBoundingClientRect();
    void host.offsetHeight;
    for (let i = 0; i < rows.length; i++) {
      rows[i].style.transition = "transform 100ms ease";
      rows[i].style.transform = "";
    }
    void host.offsetHeight;

    // Warm the ghost compositor path, then remove it. Never leave a parked
    // ghost in the document (especially not at 0,0 or with a transform transition).
    LF.settings.disposeWarmDrag();
    const sample = rows[0];
    const rect = sample.getBoundingClientRect();
    const probe = sample.cloneNode(true);
    probe.classList.add("lf-settings-row-ghost");
    probe.style.transition = "none";
    probe.style.opacity = "0";
    probe.style.visibility = "hidden";
    probe.style.pointerEvents = "none";
    probe.style.width = rect.width + "px";
    probe.style.height = rect.height + "px";
    probe.style.transform = "translate3d(" + rect.left + "px," + rect.top + "px,0)";
    document.body.appendChild(probe);
    void probe.offsetHeight;
    if (probe.parentNode) probe.parentNode.removeChild(probe);
    LF.settings._warmGhost = null;

    requestAnimationFrame(function () {
      if (!LF.settings.dragging) LF.settings.clearRowTransforms(host);
    });
  };

  // Snap a drag ghost to a viewport position with transitions forced off so
  // the first visible frame is already under the pointer, never flying from 0,0.
  LF.settings.mountDragGhost = function mountDragGhost(row, left, top, width, height) {
    const ghost = row.cloneNode(true);
    ghost.classList.add("lf-settings-row-ghost");
    ghost.style.transition = "none";
    ghost.style.opacity = "0";
    ghost.style.visibility = "hidden";
    ghost.style.width = width + "px";
    ghost.style.height = height + "px";
    ghost.style.transform = "translate3d(" + left + "px," + top + "px,0)";
    document.body.appendChild(ghost);
    void ghost.getBoundingClientRect();
    ghost.style.visibility = "visible";
    ghost.style.opacity = "";
    return ghost;
  };

  LF.settings.clearRowTransforms = function clearRowTransforms(host) {
    const rows = host.querySelectorAll(".lf-settings-row");
    for (let i = 0; i < rows.length; i++) {
      rows[i].style.transition = "";
      rows[i].style.transform = "";
    }
  };

  // Preview a new hover index by translating siblings only. DOM order stays put
  // until drop. Geometry comes from slots cached at pointerdown.
  LF.settings.applyDragShifts = function applyDragShifts(rows, slots, from, to, dragged) {
    const n = rows.length;
    const visual = rows.slice();
    const moved = visual.splice(from, 1)[0];
    visual.splice(to, 0, moved);
    const destOf = new Map();
    for (let i = 0; i < visual.length; i++) destOf.set(visual[i], i);

    for (let i = 0; i < n; i++) {
      const item = rows[i];
      const dest = destOf.get(item);
      const idxEl = item.querySelector(".lf-settings-index");
      if (idxEl) idxEl.textContent = String(dest + 1);
      if (item === dragged) {
        item.style.transition = "none";
        item.style.transform = "";
        continue;
      }
      const dy = slots[dest].top - slots[i].top;
      item.style.transition = "transform 100ms ease";
      item.style.transform = dy ? "translate3d(0," + dy + "px,0)" : "translate3d(0,0,0)";
    }
    return visual;
  };

  LF.settings.commitDragOrder = function commitDragOrder(host, visual) {
    for (let i = 0; i < visual.length; i++) {
      visual[i].style.transition = "none";
    }
    for (let i = 0; i < visual.length; i++) {
      host.appendChild(visual[i]);
    }
    LF.settings.clearRowTransforms(host);
    LF.settings.renumber(host);
  };

  LF.settings.startDrag = function startDrag(row, host, event) {
    LF.settings.dragging = true;
    const rows = Array.from(host.querySelectorAll(".lf-settings-row"));
    const rect = row.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    const originIndex = rows.indexOf(row);

    const firstBox = rows[0].getBoundingClientRect();
    const gap = rows.length > 1 ? rows[1].getBoundingClientRect().top - (firstBox.top + firstBox.height) : 6;
    const slots = [];
    let slotTop = firstBox.top;
    for (let i = 0; i < rows.length; i++) {
      const box = i === 0 ? firstBox : rows[i].getBoundingClientRect();
      const height = box.height;
      slots.push({ top: slotTop, height: height, mid: slotTop + height / 2 });
      slotTop += height + gap;
    }
    let overIndex = originIndex;
    let visual = rows.slice();

    if (LF.settings._warmGhost) LF.settings.disposeWarmDrag();
    const ghost = LF.settings.mountDragGhost(row, rect.left, rect.top, rect.width, rect.height);
    LF.settings.dragGhost = ghost;

    const moveGhost = function moveGhost(clientX, clientY) {
      ghost.style.transition = "none";
      ghost.style.transform = "translate3d(" + (clientX - offsetX) + "px," + (clientY - offsetY) + "px,0)";
    };
    row.classList.add("lf-settings-row-dragging");
    host.classList.add("lf-settings-list-dragging");

    const indexFromY = function indexFromY(y) {
      let next = slots.length - 1;
      for (let i = 0; i < slots.length; i++) {
        if (y < slots[i].mid) {
          next = i;
          break;
        }
      }
      return next;
    };

    const setPreview = function setPreview(nextIndex) {
      overIndex = nextIndex;
      visual = LF.settings.applyDragShifts(rows, slots, originIndex, overIndex, row);
      const ghostIdx = ghost.querySelector(".lf-settings-index");
      if (ghostIdx) ghostIdx.textContent = String(overIndex + 1);
    };

    let pendingX = event.clientX;
    let pendingY = event.clientY;
    let raf = 0;

    const tick = function tick() {
      raf = 0;
      moveGhost(pendingX, pendingY);
      const next = indexFromY(pendingY);
      if (next !== overIndex) setPreview(next);
    };

    const onMove = function onMove(ev) {
      ev.preventDefault();
      pendingX = ev.clientX;
      pendingY = ev.clientY;
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const finish = function finish() {
      if (!LF.settings.dragging) return;
      LF.settings.dragging = false;
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      moveGhost(pendingX, pendingY);
      const next = indexFromY(pendingY);
      if (next !== overIndex) setPreview(next);

      row.classList.remove("lf-settings-row-dragging");
      host.classList.remove("lf-settings-list-dragging");
      if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
      LF.settings.dragGhost = null;

      LF.settings.commitDragOrder(host, visual);

      const saved = LF.settings.latencyById || {};
      for (let i = 0; i < visual.length; i++) {
        const id = visual[i].getAttribute("data-provider-id");
        if (id && saved[id]) LF.settings.setRowResult(id, saved[id]);
      }

      document.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("pointerup", finish, true);
      document.removeEventListener("pointercancel", finish, true);
      const ids = visual.map(function (item) {
        return item.getAttribute("data-provider-id");
      });
      const prev = (LF.config.providers || []).slice();
      let changed = ids.length !== prev.length;
      if (!changed) {
        for (let i = 0; i < ids.length; i++) {
          if (ids[i] !== prev[i]) {
            changed = true;
            break;
          }
        }
      }
      if (!changed) return;
      setTimeout(function () {
        LF.saveProviderOrder(ids);
        LF.settings.updateResetButton();
      }, 0);
    };

    document.addEventListener("pointermove", onMove, true);
    document.addEventListener("pointerup", finish, true);
    document.addEventListener("pointercancel", finish, true);
  };

  LF.settings.rowForProvider = function rowForProvider(id) {
    const host = LF.settings.listHost;
    if (!host || !id) return null;
    return host.querySelector('.lf-settings-row[data-provider-id="' + id + '"]');
  };

  LF.settings.setRowResult = function setRowResult(id, result) {
    LF.settings.latencyById = LF.settings.latencyById || {};
    if (result) LF.settings.latencyById[id] = result;
    else delete LF.settings.latencyById[id];
    const row = LF.settings.rowForProvider(id);
    if (!row) return;
    const slot = row.querySelector(".lf-settings-result");
    if (!slot) return;
    slot.textContent = "";
    if (!result) return;
    if (result.status === "testing") {
      slot.appendChild(
        LF.settings.el("span", { className: "lf-settings-spinner", "aria-label": "测试中" })
      );
      return;
    }
    const klass = result.status === "synced" ? "lf-settings-ok" : "lf-settings-miss";
    const status = LF.settings.el("span", {
      className: "lf-settings-result-status " + klass,
      text: LF.settings.statusLabel(result.status),
    });
    if (result.status === "error" && result.error) status.title = result.error;
    slot.appendChild(
      LF.settings.el("span", {
        className: "lf-settings-result-ms",
        text: result.ms == null ? "—" : result.ms + " ms",
      })
    );
    slot.appendChild(status);
  };

  LF.settings.clearRowResults = function clearRowResults() {
    LF.settings.latencyById = {};
    const host = LF.settings.listHost;
    if (!host) return;
    const rows = host.querySelectorAll(".lf-settings-row");
    for (let i = 0; i < rows.length; i++) {
      LF.settings.setRowResult(rows[i].getAttribute("data-provider-id"), null);
    }
  };

  LF.settings.renderList = function renderList(host) {
    host.textContent = "";
    const ids = (LF.config.providers || []).slice();
    const saved = LF.settings.latencyById || {};
    ids.forEach(function (id, index) {
      const provider = LF.providers._byId[id];
      const name = (provider && provider.displayName) || id;
      const row = LF.settings.el("div", { className: "lf-settings-row", "data-provider-id": id }, [
        LF.settings.dragHandle(),
        LF.settings.el("span", { className: "lf-settings-index", text: String(index + 1) }),
        LF.settings.el("span", { className: "lf-settings-name", text: name }),
        LF.settings.el("span", { className: "lf-settings-result", "aria-live": "polite" }),
      ]);
      LF.settings.bindDrag(row, host);
      host.appendChild(row);
      if (saved[id]) LF.settings.setRowResult(id, saved[id]);
    });
  };

  LF.settings.reset = function resetSettingsOrder() {
    LF.resetProviderOrder();
    setTimeout(function () {
      if (LF.settings.listHost) LF.settings.renderList(LF.settings.listHost);
      LF.settings.updateResetButton();
    }, 0);
  };

  LF.settings.runLatencyTest = async function runLatencyTest() {
    if (LF.settings.testing) return;
    LF.settings.testing = true;
    if (LF.settings.testButton) {
      LF.settings.testButton.disabled = true;
      LF.settings.testButton.textContent = "测试中…";
    }
    const current = LF.currentTrack();
    const track = current || LF.sampleTrack();
    LF.settings.updateTrackLine();
    LF.settings.clearRowResults();
    const providers = LF.providers.enabled();
    for (let i = 0; i < providers.length; i++) {
      LF.settings.setRowResult(providers[i].id, { status: "testing" });
    }
    try {
      const results = await Promise.all(
        providers.map(function (provider) {
          return LF.testProviderLatency(provider, track).then(function (result) {
            LF.settings.setRowResult(provider.id, result);
            return result;
          });
        })
      );
      return results;
    } catch (err) {
      LF.log("latency test failed", String(err));
    } finally {
      LF.settings.testing = false;
      if (LF.settings.testButton) {
        LF.settings.testButton.disabled = false;
        LF.settings.testButton.textContent = "测试各源延迟";
      }
    }
  };

  LF.settings.disableOverlayDismiss = function disableOverlayDismiss() {
    const modal = document.querySelector("body > generic-modal");
    if (!modal) return false;
    const overlay = modal.querySelector(".GenericModal__overlay");
    if (!overlay || overlay.getAttribute("data-lf-stay-open") === "1") return !!overlay;
    const next = overlay.cloneNode(false);
    next.setAttribute("data-lf-stay-open", "1");
    while (overlay.firstChild) next.appendChild(overlay.firstChild);
    if (overlay.parentNode) overlay.parentNode.replaceChild(next, overlay);
    const closeBtn = modal.querySelector(".spicetify-popup-closeBtn, .main-trackCreditsModal-closeBtn");
    if (closeBtn && typeof modal.hide === "function") {
      closeBtn.onclick = function (event) {
        event.preventDefault();
        event.stopPropagation();
        LF.settings.disposeWarmDrag();
        modal.hide();
      };
    }
    return true;
  };

  LF.settings.build = function buildSettings() {
    const root = LF.settings.el("div", { className: "lf-settings" });
    const style = document.createElement("style");
    style.textContent = [
      ".lf-settings { color: var(--text-base, #fff); font-size: 14px; line-height: 1.5; }",
      ".lf-settings p, .lf-settings .lf-settings-note, .lf-settings .lf-settings-sub { margin: 0 0 12px; color: var(--text-subdued, #b3b3b3); }",
      ".lf-settings .lf-settings-sub { margin: 0 0 10px; font-size: 13px; }",
      ".lf-settings-heading { display: flex; align-items: center; gap: 8px; margin: 4px 0 4px; }",
      ".lf-settings-heading h3 { margin: 0; font-size: 16px; font-weight: 700; color: var(--text-base, #fff); }",
      ".lf-settings-heading .lf-settings-primary { margin-left: auto; }",
      ".lf-settings-row { display: flex; align-items: center; gap: 8px; padding: 8px 10px; margin: 0 0 6px; border-radius: 8px; background: rgba(255,255,255,0.08); cursor: grab; user-select: none; touch-action: none; will-change: transform; }",
      ".lf-settings-row-dragging { visibility: hidden; cursor: grabbing; }",
      ".lf-settings-row-ghost { position: fixed; left: 0; top: 0; z-index: 10000; margin: 0; box-sizing: border-box; pointer-events: none; opacity: 0.96; cursor: grabbing; box-shadow: 0 12px 28px rgba(0,0,0,0.45); will-change: transform; transition: none !important; }",
      ".lf-settings-handle { display: inline-flex; align-items: center; justify-content: center; width: 20px; color: var(--text-subdued, #b3b3b3); pointer-events: none; }",
      ".lf-settings-index { width: 1.5em; color: var(--text-subdued, #b3b3b3); }",
      ".lf-settings-name { flex: 1 1 auto; min-width: 0; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
      ".lf-settings button { border: 0; border-radius: 16px; padding: 6px 12px; cursor: pointer; background: rgba(255,255,255,0.12); color: var(--text-base, #fff); font-size: 13px; }",
      ".lf-settings button:hover:not(:disabled) { background: rgba(255,255,255,0.2); }",
      ".lf-settings button:disabled { opacity: 0.4; cursor: not-allowed; }",
      ".lf-settings-reset-slot { flex: 0 0 32px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; }",
      ".lf-settings button.lf-settings-reset { display: inline-flex; width: 32px; height: 32px; padding: 0; border-radius: 50%; align-items: center; justify-content: center; flex: 0 0 auto; overflow: hidden; box-sizing: border-box; background: rgba(255,255,255,0.08); color: var(--text-subdued, #b3b3b3); }",
      ".lf-settings button.lf-settings-reset svg { width: 20px; height: 20px; display: block; overflow: hidden; flex: 0 0 auto; }",
      ".lf-settings button.lf-settings-reset:hover:not(:disabled) { background: rgba(255,255,255,0.2); color: var(--text-base, #fff); }",
      ".lf-settings-primary { background: #1ed760 !important; color: #000 !important; font-weight: 700; }",
      ".lf-settings-result { flex: 0 0 11.5rem; width: 11.5rem; min-height: 16px; display: inline-flex; align-items: center; justify-content: flex-end; gap: 8px; font-size: 12px; line-height: 1.2; white-space: nowrap; pointer-events: none; }",
      ".lf-settings-result-ms { color: var(--text-subdued, #b3b3b3); font-variant-numeric: tabular-nums; }",
      ".lf-settings-ok { color: #1ed760; }",
      ".lf-settings-miss { color: var(--text-subdued, #b3b3b3); }",
      ".lf-settings-spinner { box-sizing: border-box; width: 14px; height: 14px; flex: 0 0 14px; border: 2px solid rgba(255,255,255,0.22); border-top-color: #1ed760; border-radius: 50%; animation: lf-settings-spin 0.7s linear infinite; }",
      "@keyframes lf-settings-spin { to { transform: rotate(360deg); } }",
    ].join("\n");
    root.appendChild(style);
    root.appendChild(
      LF.settings.el("p", {
        text: "官方 Spotify 歌词始终优先。下面的源只在官方歌词缺失时，按从上到下的顺序尝试。拖动列表即可调整顺序，调整后会保存在本地。",
      })
    );

    const reset = LF.settings.el("button", {
      type: "button",
      className: "lf-settings-reset",
      title: "恢复默认顺序",
      "aria-label": "恢复默认顺序",
      html:
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3.15-6.75"></path><polyline points="21 3 21 9 15 9"></polyline></svg>',
      onClick: function () {
        LF.settings.reset();
      },
    });
    LF.settings.resetButton = reset;
    const resetSlot = LF.settings.el("div", { className: "lf-settings-reset-slot" }, [reset]);
    LF.settings.resetSlot = resetSlot;

    const testButton = LF.settings.el("button", {
      type: "button",
      className: "lf-settings-primary",
      text: "测试各源延迟",
      onClick: function () {
        LF.settings.runLatencyTest();
      },
    });
    LF.settings.testButton = testButton;

    const heading = LF.settings.el("div", { className: "lf-settings-heading" }, [
      LF.settings.el("h3", { text: "歌词源顺序" }),
      resetSlot,
      testButton,
    ]);
    root.appendChild(heading);

    const trackLine = LF.settings.el("p", {
      className: "lf-settings-sub",
      text: LF.settings.trackLabel(LF.currentTrack()),
    });
    LF.settings.trackLine = trackLine;
    root.appendChild(trackLine);
    LF.settings.updateResetButton();

    const listHost = LF.settings.el("div", { className: "lf-settings-list" });
    LF.settings.listHost = listHost;
    LF.settings.renderList(listHost);
    root.appendChild(listHost);
    LF.settings.statusLine = null;
    return root;
  };

  LF.openSettings = function openSettings() {
    if (!window.Spicetify || !Spicetify.PopupModal) {
      LF.log("PopupModal unavailable");
      return false;
    }
    if (LF.settings._opening) return true;
    LF.settings._opening = true;
    setTimeout(function () {
      LF.settings._opening = false;
      try {
        LF.loadProviderOrder();
      } catch (_) {}
      LF.settings.disposeWarmDrag();
      const root = LF.settings.build();
      Spicetify.PopupModal.display({
        title: "Lyrics Fallback",
        content: root,
        isLarge: true,
      });
      LF.settings.disableOverlayDismiss();
      LF.settings.watchTrackLabel();
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          LF.settings.warmDrag(LF.settings.listHost);
        });
      });
    }, 60);
    return true;
  };

  LF.installSettingsMenu = function installSettingsMenu() {
    if (LF.debug.settingsMenu) return true;
    if (!window.Spicetify || !Spicetify.Menu || !Spicetify.Menu.Item || !Spicetify.PopupModal) {
      return false;
    }
    try {
      const item = new Spicetify.Menu.Item("Lyrics Fallback", false, function () {
        LF.openSettings();
      });
      item.register();
      LF.debug.settingsMenu = item;
      LF.log("settings menu registered");
      return true;
    } catch (err) {
      LF.log("settings menu failed", String(err));
      return false;
    }
  };

  LF.ensureSettingsMenu = function ensureSettingsMenu(attempt) {
    if (LF.installSettingsMenu()) return;
    const n = Number(attempt) || 0;
    if (n > 40) {
      LF.log("settings menu gave up waiting for Spicetify.Menu");
      return;
    }
    setTimeout(function () {
      LF.ensureSettingsMenu(n + 1);
    }, 250);
  };

  /* ===== src/entry.js ===== */
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
})();
