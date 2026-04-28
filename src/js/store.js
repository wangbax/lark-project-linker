// 配置存储 key
const GITLAB_LINK_TO_LARK = "GITLAB_LINK_TO_LARK";

// 缓存配置
let _GITLAB_LINK_TO_LARK_OPTIONS = null;

export const isDev = process.env.isDev === "1";

// 获取配置
export const getLarkConfig = async () => {
  if (_GITLAB_LINK_TO_LARK_OPTIONS) return _GITLAB_LINK_TO_LARK_OPTIONS;

  if (isDev) {
    _GITLAB_LINK_TO_LARK_OPTIONS = {
      app: process.env.app,
      domain: process.env.domain,
    };
    return _GITLAB_LINK_TO_LARK_OPTIONS;
  }

  const resp = await chrome.storage.sync.get(GITLAB_LINK_TO_LARK);
  if (resp && resp[GITLAB_LINK_TO_LARK]) {
    _GITLAB_LINK_TO_LARK_OPTIONS = JSON.parse(resp[GITLAB_LINK_TO_LARK]);
  }
  return _GITLAB_LINK_TO_LARK_OPTIONS;
};

export const getLarkConfigSync = () => {
  return _GITLAB_LINK_TO_LARK_OPTIONS;
};

// 设置配置
export const setLarkConfig = async (value) => {
  const dataString = JSON.stringify(value);
  if (isDev) return;
  await chrome.storage.sync.set({ [GITLAB_LINK_TO_LARK]: dataString });
};

// ==================== 项目类型缓存管理 ====================

// 缓存配置
const CACHE_KEY = 'LARK_PROJECT_TYPE_CACHE';
const CACHE_EXPIRY_DAYS = 30; // 缓存有效期 30 天
const GITHUB_USER_ALIAS_CACHE_KEY = 'GITHUB_USER_ALIAS_CACHE';
const GITHUB_USER_ALIAS_CACHE_EXPIRY_DAYS = 30; // GitHub 用户映射缓存 30 天

/**
 * 从本地存储加载缓存
 * @returns {Promise<{tidTypeMap: Map, cacheMap: Map}>}
 */
export async function loadCacheFromStorage() {
  const tidTypeMap = new Map();
  const cacheMap = new Map();
  
  try {
    const result = await chrome.storage.local.get(CACHE_KEY);
    const cache = result[CACHE_KEY];
    
    if (cache) {
      const now = Date.now();
      let validCount = 0;
      let expiredCount = 0;
      
      for (const [tid, item] of Object.entries(cache)) {
        if (item.expiry && item.expiry > now) {
          tidTypeMap.set(tid, item.type);
          
          if (item.data) {
            cacheMap.set(tid, {
              locker: true,
              error: false,
              data: item.data,
            });
          }
          validCount++;
        } else {
          expiredCount++;
        }
      }
      
      if (expiredCount > 0) {
        await cleanExpiredCache();
      }
    }
  } catch (error) {
    console.error('[Lark Cache] 加载缓存失败:', error);
  }
  
  return { tidTypeMap, cacheMap };
}

/**
 * 保存类型到本地缓存
 * @param {string} tid - 项目 ID
 * @param {string} type - 项目类型 (story/issue)
 * @param {Object} data - 项目数据
 */
export async function saveCacheToStorage(tid, type, data = null) {
  try {
    const result = await chrome.storage.local.get(CACHE_KEY);
    const cache = result[CACHE_KEY] || {};
    
    const expiry = Date.now() + (CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    
    cache[tid] = {
      type,
      data,
      expiry,
      updatedAt: Date.now(),
    };
    
    await chrome.storage.local.set({ [CACHE_KEY]: cache });
  } catch (error) {
    console.error('[Lark Cache] 保存缓存失败:', error);
  }
}

/**
 * 清理过期缓存
 */
export async function cleanExpiredCache() {
  try {
    const result = await chrome.storage.local.get(CACHE_KEY);
    const cache = result[CACHE_KEY];
    
    if (!cache) return;
    
    const now = Date.now();
    const newCache = {};
    let cleanedCount = 0;
    
    for (const [tid, item] of Object.entries(cache)) {
      if (item.expiry && item.expiry > now) {
        newCache[tid] = item;
      } else {
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      await chrome.storage.local.set({ [CACHE_KEY]: newCache });
    }
  } catch (error) {
    console.error('[Lark Cache] 清理缓存失败:', error);
  }
}

// ==================== GitHub 用户映射缓存管理 ====================

/**
 * 加载 GitHub 用户映射缓存
 * @param {string} sourceUrl - GitHub 用户目录仓库 URL
 * @param {{allowExpired?: boolean}} options
 * @returns {Promise<Map<string, {name: string, emailPrefix: string}> | null>}
 */
export async function loadGitHubUserAliasCache(sourceUrl, options = {}) {
  if (!sourceUrl) return null;

  try {
    const result = await chrome.storage.local.get(GITHUB_USER_ALIAS_CACHE_KEY);
    const cache = result[GITHUB_USER_ALIAS_CACHE_KEY] || {};
    const item = cache[sourceUrl];

    if (!item || !Array.isArray(item.entries)) return null;
    if (!options.allowExpired && (!item.expiry || item.expiry <= Date.now())) {
      return null;
    }

    const entries = item.entries.filter(([login, userInfo]) => {
      return login && userInfo && (userInfo.name || userInfo.emailPrefix);
    });

    return entries.length > 0 ? new Map(entries) : null;
  } catch (error) {
    console.error('[GitHub User Alias Cache] 加载缓存失败:', error);
    return null;
  }
}

/**
 * 保存 GitHub 用户映射缓存
 * @param {string} sourceUrl - GitHub 用户目录仓库 URL
 * @param {Map<string, {name: string, emailPrefix: string}>} aliasMap
 */
export async function saveGitHubUserAliasCache(sourceUrl, aliasMap) {
  if (!sourceUrl || !aliasMap || aliasMap.size === 0) return;

  try {
    const result = await chrome.storage.local.get(GITHUB_USER_ALIAS_CACHE_KEY);
    const cache = result[GITHUB_USER_ALIAS_CACHE_KEY] || {};
    const expiry = Date.now() + (GITHUB_USER_ALIAS_CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    cache[sourceUrl] = {
      entries: Array.from(aliasMap.entries()),
      expiry,
      updatedAt: Date.now(),
    };

    await chrome.storage.local.set({ [GITHUB_USER_ALIAS_CACHE_KEY]: cache });
  } catch (error) {
    console.error('[GitHub User Alias Cache] 保存缓存失败:', error);
  }
}

/**
 * 清除所有缓存（用于调试）
 */
export async function clearAllCache() {
  try {
    await chrome.storage.local.remove([CACHE_KEY, GITHUB_USER_ALIAS_CACHE_KEY]);
  } catch (error) {
    console.error('[Lark Cache] 清除缓存失败:', error);
  }
}
