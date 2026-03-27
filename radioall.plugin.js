module.exports = (() => {
  const DEFAULT_SOURCE_URL =
    "https://raw.githubusercontent.com/m3u8playlist/m3u8/master/radioall.json";

  const PAGE_SIZE = 200;
  const CACHE_TTL_MS = 10 * 60 * 1000; // 10 min

  let cache = {
    sourceUrl: "",
    fetchedAt: 0,
    title: "电台-全",
    list: [],
  };

  function now() {
    return Date.now();
  }

  function normalizeText(v) {
    return String(v || "").trim();
  }

  function makeId(name, url, idx) {
    return `${name}|${url}|${idx}`;
  }

  function toMusicItem(ch, idx) {
    const name = normalizeText(ch && ch.name) || `未命名电台-${idx + 1}`;
    const url = normalizeText(ch && ch.url);

    return {
      id: makeId(name, url, idx),
      title: name,
      artist: "在线电台",
      album: "广播直播流",
      artwork: "",
      duration: 0,
      url: url,
      _streamUrl: url,
    };
  }

  async function httpGetJson(url) {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json,text/plain,*/*",
      },
    });

    if (!res.ok) {
      throw new Error(`请求失败: ${res.status}`);
    }
    return await res.json();
  }

  async function loadChannels(forceRefresh) {
    const userVars = (env && env.getUserVariables && env.getUserVariables()) || {};
    const sourceUrl = normalizeText(userVars.sourceUrl) || DEFAULT_SOURCE_URL;

    const cacheValid =
      !forceRefresh &&
      cache.sourceUrl === sourceUrl &&
      cache.list.length > 0 &&
      now() - cache.fetchedAt < CACHE_TTL_MS;

    if (cacheValid) return cache;

    const data = await httpGetJson(sourceUrl);
    const title = normalizeText(data && data.title) || "电台-全";
    const channels = Array.isArray(data && data.channels) ? data.channels : [];

    const list = [];
    for (let i = 0; i < channels.length; i += 1) {
      const item = toMusicItem(channels[i], i);
      if (!item._streamUrl) continue;
      list.push(item);
    }

    cache = {
      sourceUrl,
      fetchedAt: now(),
      title,
      list,
    };

    return cache;
  }

  function paginate(arr, page) {
    const p = Number(page) > 0 ? Number(page) : 1;
    const start = (p - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return {
      data: arr.slice(start, end),
      isEnd: end >= arr.length,
    };
  }

  async function searchMusic(query, page) {
    const loaded = await loadChannels(false);
    const q = normalizeText(query).toLowerCase();

    const matched = !q
      ? loaded.list
      : loaded.list.filter((x) => normalizeText(x.title).toLowerCase().includes(q));

    return paginate(matched, page);
  }

  return {
    platform: "广播直播流",
    author: "ChatGPT",
    version: "0.1.0",
    description: "基于 radioall.json 的在线电台插件（单榜单 + 搜索）",
    cacheControl: "no-cache",
    supportedSearchType: ["music"],

    userVariables: [
      {
        key: "sourceUrl",
        name: "电台JSON地址(可选)",
      },
    ],

    async search(query, page, type) {
      if (type !== "music") {
        return { isEnd: true, data: [] };
      }
      return await searchMusic(query, page);
    },

    async getTopLists() {
      const loaded = await loadChannels(false);
      return [
        {
          title: loaded.title || "电台-全",
          data: [
            {
              id: "all",
              title: loaded.title || "电台-全",
              description: `共 ${loaded.list.length} 个电台流`,
            },
          ],
        },
      ];
    },

    async getTopListDetail() {
      const loaded = await loadChannels(false);
      return {
        title: loaded.title || "电台-全",
        musicList: loaded.list,
      };
    },

    async getMediaSource(musicItem) {
      const url = normalizeText(
        (musicItem && (musicItem._streamUrl || musicItem.url)) || ""
      );
      if (!url) return null;
      return { url };
    },
  };
})();
