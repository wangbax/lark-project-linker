/**
 * GitHub 平台特定处理逻辑
 */

import {
  getLarkConfig,
  loadGitHubUserAliasCache,
  saveGitHubUserAliasCache
} from "./store";

export function createGitHubHandler(context) {
  const {
    nodeMap,
    tidTypeMap,
    getLarkProjectLink,
    fetchLarkProjectInfo,
    bindPopoverEvent,
    replaceLarkLinks,
    replaceProjectIdToLarkProjectLink,
    getLarkConfigSync,
    enterHandler,
    leaveHandler,
    removeGitLabTooltipAttributes,
    isGitHubPullRequestPage
  } = context;
  const githubUserAliasState = {
    sourceUrl: "",
    promise: null,
    refreshSourceUrl: "",
    refreshPromise: null,
    map: new Map(),
  };
  let githubUserHovercardObserver = null;
  let githubContentScanTimer = null;
  const githubDebugCounters = new Map();
  const githubDebugEntries = [];
  let githubDebugFlushTimer = null;
  const MAX_GITHUB_TEXT_SCAN_LENGTH = 20000;
  const ignoredGitHubDynamicSelector = [
    '#partial-pull-merging',
    '.branch-action',
    '.merge-pr',
    '.merge-status-list',
    '.js-merge-box',
    '.js-checks-dropdown',
    '.js-checks-status-button',
    '[data-channel*="check"]',
    '[data-channel*="merge"]',
    'turbo-frame[src*="check"]',
    'turbo-frame[id*="check"]',
    '[id*="checks"]',
    '[class*="Checks"]',
    '[class*="checks"]'
  ].join(', ');

  /**
   * 初始化 GitHub 处理器
   */
  function init() {
    // 隐藏 GitHub 的默认 tooltip
    hideGitHubTooltips();

    // 初始化页面监听
    initPageListener();

    // 监听 GitHub 特定的导航事件
    setupNavigationListeners();

    // GitHub 用户别名只在 hovercard 出现时懒加载，避免拖慢 PR 首屏和 Checks 渲染。
    ensureGitHubHovercardObserver();
  }

  function isGitHubDebugEnabled() {
    try {
      return window.localStorage?.getItem("LARK_LINKER_DEBUG") === "1" ||
        new URLSearchParams(window.location.search).has("lark_linker_debug");
    } catch (error) {
      return false;
    }
  }

  function scheduleGitHubDebugFlush() {
    if (githubDebugFlushTimer || typeof chrome === "undefined" || !chrome.storage?.local) return;

    githubDebugFlushTimer = setTimeout(() => {
      githubDebugFlushTimer = null;
      try {
        const result = chrome.storage.local.set({
          LARK_LINKER_DEBUG_LOGS: githubDebugEntries,
        });
        if (result?.catch) {
          result.catch(() => {});
        }
      } catch (error) {
        // Debug logging must never affect the page.
      }
    }, 500);
  }

  function debugGitHubLog(label, data = {}) {
    if (!isGitHubDebugEnabled()) return;

    const count = (githubDebugCounters.get(label) || 0) + 1;
    githubDebugCounters.set(label, count);
    console.debug("[Lark Linker][GitHub]", label, {
      count,
      url: window.location.href,
      ...data,
    });

    githubDebugEntries.push({
      at: new Date().toISOString(),
      label,
      count,
      url: window.location.href,
      ...data,
    });
    if (githubDebugEntries.length > 100) {
      githubDebugEntries.shift();
    }
    scheduleGitHubDebugFlush();
  }

  function measureGitHubDebug(label, callback) {
    if (!isGitHubDebugEnabled()) {
      return callback();
    }

    const startedAt = performance.now();
    const result = callback();
    debugGitHubLog(label, {
      durationMs: Math.round((performance.now() - startedAt) * 10) / 10,
    });
    return result;
  }

  function scanGitHubContent() {
    measureGitHubDebug("scanGitHubContent", () => {
      replaceGitHubCommits();
      replaceGitHubPullRequests({
        observeTitle: !isGitHubPullRequestPage,
      });
    });
  }

  function scheduleGitHubContentScan(delay = 100) {
    debugGitHubLog("scheduleGitHubContentScan", { delay });

    if (githubContentScanTimer) {
      clearTimeout(githubContentScanTimer);
    }

    githubContentScanTimer = setTimeout(() => {
      githubContentScanTimer = null;
      scanGitHubContent();
    }, delay);
  }

  /**
   * 隐藏 GitHub 的默认 tooltip
   */
  function hideGitHubTooltips() {
    const style = document.createElement("style");
    style.id = "hide-github-tooltips";
    style.innerHTML = `
      /* 隐藏 GitHub 的 tooltip */
      .lark-project-link[aria-label],
      .lark-project-link tool-tip {
        pointer-events: none;
      }
      .github-user-real-name {
        color: var(--fgColor-muted, #656d76);
        font-weight: 400;
        margin-left: 4px;
      }
      .js-issue-title .github-lark-id,
      .js-issue-title .lark-project-link,
      .markdown-title .github-lark-id,
      .markdown-title .lark-project-link,
      a.Link--primary .github-lark-id,
      a.Link--primary .lark-project-link,
      bdi[data-testid="issue-title"] .github-lark-id,
      bdi[data-testid="issue-title"] .lark-project-link,
      div[class*="Title-module__container"] .github-lark-id,
      div[class*="Title-module__container"] .lark-project-link {
        color: inherit;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * 初始化 GitHub 页面监听
   */
  async function initPageListener() {
    const config = await getLarkConfig();
    if (!config) return;
  }

  /**
   * 设置 GitHub 导航监听
   */
  function setupNavigationListeners() {
    // GitHub 使用 turbo 进行页面导航
    document.addEventListener('turbo:load', () => {
      scheduleGitHubContentScan(500);
    });

    // 也监听 pjax（旧版 GitHub）
    document.addEventListener('pjax:end', () => {
      scheduleGitHubContentScan(500);
    });
  }

  /**
   * 替换 GitHub commits 列表中的项目 ID
   */
  function replaceGitHubCommits() {
    return measureGitHubDebug("replaceGitHubCommits", () => {
    // GitHub commits 页面 - commit 标题链接（支持 PR commits tab 的新版 commit row）
    const commitTitleLinks = document.querySelectorAll([
      'a[href*="/commit/"]',
      'a[href*="/commits/"]',
      'a[href*="/pull/"][href*="/changes/"]',
      'a.commit-row-message',
      '[data-testid="commit-row-item"] a.Link--primary',
      '[data-testid="commit-row-item"] a[class*="Commit"]',
      '[class*="CommitRow-module__ListItem"] a.Link--primary',
      '[class*="CommitRow-module__ListItem"] a[class*="Commit"]'
    ].join(', '));

    commitTitleLinks.forEach(link => {
      if (nodeMap.has(link)) return;
      if (isIgnoredGitHubDynamicNode(link)) return;

      // 跳过导航用的覆盖层链接（position-absolute 且没有实际文本内容）
      if (link.classList.contains('position-absolute') &&
          (link.textContent.trim() === '' || link.getAttribute('aria-label')?.includes('Link to'))) {
        return;
      }

      const text = link.textContent || "";
      const hasMatch = replaceTaskIdsInTextNodes(link, text, { allowAnchors: true });
      if (hasMatch) {
        nodeMap.add(link);
      }
    });

    // GitHub commits 页面 - commit 组
    const commitGroups = document.querySelectorAll([
      '.commit-group',
      '.commits-list-item',
      '.commit',
      '.commit-content',
      '[data-commit-link]',
      '[data-testid="commit-row-item"]',
      '[class*="CommitRow-module__ListItem"]'
    ].join(', '));

    commitGroups.forEach(group => {
      if (nodeMap.has(group)) return;
      if (isIgnoredGitHubDynamicNode(group)) return;

      // 在整个 commit 容器中查找链接
      let hasReplaced = replaceLarkLinks(group);

      // 如果没有找到链接，尝试旧方法处理纯文本（向后兼容）
      if (!hasReplaced) {
        const commitMessage = group.querySelector([
          '.commit-row-message',
          '.commit-row-description',
          '.commit-title',
          '.commit-message',
          '[class*="CommitMessage"]',
          '[class*="CommitRow-module__Message"]',
          '[class*="CommitRow-module__Title"]'
        ].join(', '));
        if (commitMessage) {
          hasReplaced = replaceTaskIdsInTextNodes(
            commitMessage,
            commitMessage.textContent || group.textContent || "",
            { allowAnchors: commitMessage.tagName === 'A' }
          );
        }
      }

      if (hasReplaced) {
        nodeMap.add(group);
      }
    });

    // GitHub commit 详情页 - commit message 容器（新版 UI，使用 CSS Modules）
    const commitMessageContainers = document.querySelectorAll('[class*="commitMessageContainer"], [class*="CommitHeader"], .commit-desc');

    commitMessageContainers.forEach(container => {
      if (nodeMap.has(container)) return;
      if (isIgnoredGitHubDynamicNode(container)) return;

      const LarkConfig = getLarkConfigSync();
      if (!LarkConfig) return;

      const prefixes = LarkConfig?.prefixes || "m,f";
      const prefixList = prefixes.split(",").map(p => p.trim().toLowerCase()).filter(p => p);

      // 查找所有可能包含 commit message 的元素
      const messageElements = container.querySelectorAll('div, span, p');

      messageElements.forEach(element => {
        if (nodeMap.has(element)) return;
        if (isIgnoredGitHubDynamicNode(element)) return;

        // 跳过已经处理过的元素和链接
        if (element.tagName === 'A' ||
            element.closest('.github-lark-id, .lark-project-link') ||
            element.closest('a.lark-project-link') ||
            element.querySelector('.lark-project-link')) {
          return;
        }

        const text = element.textContent;
        if (!text) return;

        // 检查是否包含项目 ID
        const reg = new RegExp(`#(${prefixList.join("|")})-\\d{7,}`, "i");
        if (!reg.test(text)) return;

        // 只处理直接包含文本的叶子节点（没有其他元素子节点）
        const hasElementChildren = Array.from(element.children).some(
          child => child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'BR'
        );

        if (hasElementChildren) return;

        const result = replaceProjectIdToLarkProjectLink(element);
        if (result[0]) {
          element.innerHTML = result[1];
          // 为所有创建的链接绑定事件
          const links = element.querySelectorAll(".lark-project-link");
          links.forEach(link => {
            bindPopoverEvent(link);
          });
          nodeMap.add(element);
        }
      });

      nodeMap.add(container);
    });
    });
  }

  /**
   * 替换 GitHub Pull Request / Issue 标题、描述和评论中的项目 ID
   */
  function replaceGitHubPullRequests(options = {}) {
    const {
      includeTitles = true,
      includeComments = true,
      observeTitle = true,
    } = options;

    return measureGitHubDebug("replaceGitHubPullRequests", () => {
    // PR/Issue 标题（支持多种选择器）
    const prTitleSelectors = [
      '.js-issue-title',                          // Conversation 标签页
      '.markdown-title',                          // Commits/Files changed 标签页 & Issue 详情页
      'bdi.js-issue-title',                       // 某些版本的 GitHub
      'div[class*="Title-module__container"]',    // Issue 列表标题
      'bdi[data-testid="issue-title"]',          // Issue 详情页标题
      'a.Link--primary[href*="/pull/"]',         // PR 列表页标题链接
      'a.Link--primary[href*="/issues/"]'        // Issue 列表页标题链接
    ];
    if (includeTitles) {
      prTitleSelectors.forEach(selector => {
        const prTitles = document.querySelectorAll(selector);

        prTitles.forEach(prTitle => {
          if (isIgnoredGitHubDynamicNode(prTitle)) {
            return;
          }

          // GitHub 新版 commit history 也复用了 Title-module 容器，避免误按 PR/Issue 标题处理
          if (isCommitRowElement(prTitle)) {
            return;
          }

          // 检查是否是 PR/Issue 列表中的导航链接
          if (prTitle.tagName === 'A') {
            const isNavigationLink =
              prTitle.classList.contains('js-navigation-open') ||
              prTitle.classList.contains('Link--primary') ||
              prTitle.id?.startsWith('issue_') ||
              prTitle.closest('.js-issue-row') !== null ||
              prTitle.closest('[data-hovercard-type="pull_request"]') !== null ||
              prTitle.closest('[data-hovercard-type="issue"]') !== null ||
              (prTitle.href && (prTitle.href.includes('/pull/') || prTitle.href.includes('/issues/')));

            // 如果是导航链接，检查是否需要重新处理
            if (isNavigationLink) {
              const needsReprocessing =
                prTitle.href.includes('project.feishu.cn') || // href 被错误修改为飞书链接
                prTitle.classList.contains('lark-project-link'); // 被错误地添加了类

              if (needsReprocessing && nodeMap.has(prTitle)) {
                nodeMap.delete(prTitle);
                // 清理错误的类和属性
                if (prTitle.classList.contains('lark-project-link')) {
                  prTitle.classList.remove('lark-project-link');
                }
                // 清理可能存在的 data 属性
                prTitle.removeAttribute('data-tid');
                prTitle.removeAttribute('data-lark-type');
                prTitle.removeAttribute('data-lark-url');
              }
            }
          }

          if (nodeMap.has(prTitle)) {
            return;
          }

          // 检查是否是 PR/Issue 列表中的导航链接
          if (prTitle.tagName === 'A') {
            const isNavigationLink =
              prTitle.classList.contains('js-navigation-open') ||
              prTitle.classList.contains('Link--primary') ||
              prTitle.id?.startsWith('issue_') ||
              prTitle.closest('.js-issue-row') !== null ||
              prTitle.closest('[data-hovercard-type="pull_request"]') !== null ||
              prTitle.closest('[data-hovercard-type="issue"]') !== null ||
              (prTitle.href && (prTitle.href.includes('/pull/') || prTitle.href.includes('/issues/')));

            if (isNavigationLink) {
              // 特殊处理：保留原始 PR 链接，在后面追加独立的飞书链接
              handleNavigationLink(prTitle, { observeHref: observeTitle });
              return;
            }
          }

          // 非导航链接的正常处理（包括 div、bdi 等非链接元素）
          handleNormalElement(prTitle, { observeReact: observeTitle });
        });
      });
    }

    // PR/Issue 评论和描述
    if (!includeComments) {
      return;
    }

    const comments = document.querySelectorAll('.comment-body, .markdown-body');
    comments.forEach(comment => {
      if (nodeMap.has(comment)) return;
      if (isIgnoredGitHubDynamicNode(comment)) return;

      const processedAncestor = comment.parentElement?.closest('.comment-body, .markdown-body');
      if (processedAncestor && nodeMap.has(processedAncestor)) return;

      // 跳过编辑态的 markdown（在 textarea 或 contenteditable 容器中）
      const isEditing =
        comment.closest('textarea') !== null ||
        comment.closest('[contenteditable="true"]') !== null ||
        comment.closest('.js-write-bucket') !== null ||
        comment.closest('.is-comment-editing') !== null;

      if (isEditing) {
        return;
      }

      const commentText = comment.textContent || "";

      // 首先尝试处理已有的链接
      const hasReplacedLinks = replaceLarkLinks(comment);

      // 再处理纯文本中的项目 ID（针对 .markdown-body）
      const hasReplacedText = shouldScanGitHubTextContainer(comment, commentText)
        ? handleMarkdownBody(comment, commentText)
        : false;

      if (hasReplacedLinks || hasReplacedText) {
        nodeMap.add(comment);
      }
    });
    });
  }

  function isCommitRowElement(element) {
    return Boolean(
      element.closest(
        '[data-testid="commit-row-item"], [data-commit-link], [class*="CommitRow-module__ListItem"], .commits-list-item, .commit-group'
      )
    );
  }

  function isIgnoredGitHubDynamicNode(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) {
      return false;
    }

    return node.matches(ignoredGitHubDynamicSelector) || Boolean(node.closest(ignoredGitHubDynamicSelector));
  }

  function getGitHubPrefixConfig() {
    const LarkConfig = getLarkConfigSync();
    if (!LarkConfig) {
      return { LarkConfig: null, prefixList: [] };
    }

    let prefixList = LarkConfig.prefixes;
    if (typeof prefixList === 'string') {
      prefixList = prefixList.split(',').map(p => p.trim()).filter(p => p);
    }

    return {
      LarkConfig,
      prefixList: (prefixList || []).map(prefix => prefix.toLowerCase())
    };
  }

  function inferTidType(tid, contextText = '') {
    let type = tidTypeMap.get(tid);
    if (type) {
      return type;
    }

    const prefix = tid.split('-')[0].toLowerCase();
    const lowerContext = contextText.toLowerCase();

    type = 'story';
    if (prefix === 'f') {
      type = 'issue';
    } else if (prefix !== 'm') {
      if (/^(fix|bugfix|hotfix|bug)[\s:]/i.test(lowerContext)) {
        type = 'issue';
      } else if (/^(feat|feature|chore|refactor|perf|style|test|docs|build|ci)[\s:]/i.test(lowerContext)) {
        type = 'story';
      }
    }

    tidTypeMap.set(tid, type);
    return type;
  }

  function bindGitHubLarkSpan(span) {
    span.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const tid = span.dataset.tid;
      const projectId = tid.split('-')[1];
      const larkType = tidTypeMap.get(tid) || span.dataset.larkType;
      const url = getLarkProjectLink(projectId, larkType);
      window.open(url, '_blank');
    });

    span.addEventListener('mouseenter', enterHandler);
    span.addEventListener('mouseleave', leaveHandler);
  }

  function createGitHubLarkSpan(tid, type, url) {
    const span = document.createElement('span');
    span.className = 'github-lark-id';
    span.dataset.tid = tid;
    span.dataset.larkType = type;
    span.dataset.larkUrl = url;
    span.style.cursor = 'pointer';
    span.style.fontWeight = '500';
    span.style.textDecoration = 'none';
    span.textContent = `#${tid}`;
    bindGitHubLarkSpan(span);
    return span;
  }

  function replaceTaskIdsInTextNodes(root, contextText, options = {}) {
    const { allowAnchors = false } = options;
    const { LarkConfig, prefixList } = getGitHubPrefixConfig();
    if (!LarkConfig || prefixList.length === 0) {
      return false;
    }

    const reg = new RegExp(`#\\s*(${prefixList.join("|")})-\\d{7,}`, "gi");
    if (!reg.test(contextText || "")) {
      reg.lastIndex = 0;
      return false;
    }
    reg.lastIndex = 0;

    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (!node.parentElement) {
            return NodeFilter.FILTER_REJECT;
          }

          if (!node.textContent || !reg.test(node.textContent)) {
            reg.lastIndex = 0;
            return NodeFilter.FILTER_REJECT;
          }

          reg.lastIndex = 0;

          const skippedSelector = allowAnchors
            ? 'button, input, select, textarea, [role="button"], .github-lark-id, .lark-project-link, [contenteditable="true"], script, style'
            : 'a, button, input, select, textarea, [role="button"], .github-lark-id, .lark-project-link, [contenteditable="true"], script, style';

          if (node.parentElement.closest(skippedSelector)) {
            return NodeFilter.FILTER_REJECT;
          }

          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const textNodes = [];
    while (walker.nextNode()) {
      textNodes.push(walker.currentNode);
    }

    let hasReplaced = false;

    textNodes.forEach(textNode => {
      const text = textNode.textContent || '';
      const matches = Array.from(text.matchAll(reg));
      reg.lastIndex = 0;

      if (matches.length === 0 || !textNode.parentNode) {
        return;
      }

      const fragment = document.createDocumentFragment();
      let lastIndex = 0;

      matches.forEach(match => {
        const startIndex = match.index ?? 0;
        if (startIndex > lastIndex) {
          fragment.appendChild(document.createTextNode(text.slice(lastIndex, startIndex)));
        }

        const tid = match[0].replace(/^#\s*/, '');
        const projectId = tid.split('-')[1];
        const type = inferTidType(tid, contextText);
        const url = getLarkProjectLink(projectId, type);

        fragment.appendChild(createGitHubLarkSpan(tid, type, url));

        fetchLarkProjectInfo({
          tid,
          app: LarkConfig.app,
        });

        lastIndex = startIndex + match[0].length;
        hasReplaced = true;
      });

      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
      }

      textNode.parentNode.replaceChild(fragment, textNode);
    });

    return hasReplaced;
  }

  /**
   * 处理导航链接
   */
  function handleNavigationLink(prTitle, options = {}) {
    const { observeHref = true } = options;
    const originalText = prTitle.textContent;
    const LarkConfig = getLarkConfigSync();
    if (!LarkConfig) return;

    // 确保 prefixList 是数组
    let prefixList = LarkConfig.prefixes;
    if (typeof prefixList === 'string') {
      prefixList = prefixList.split(',').map(p => p.trim()).filter(p => p);
    }

    if (!prefixList || prefixList.length === 0) return;

    const reg = new RegExp(`#\\s*(${prefixList.join("|")})-\\d{7,}`, "gi");
    const matches = originalText.match(reg);

    if (matches && matches.length > 0) {
      // 保存原始的 href（从 DOM 恢复或使用当前值）
      let originalGithubHref = prTitle.href;

      // 如果 href 已被修改为飞书链接，从覆盖层链接恢复
      if (originalGithubHref.includes('project.feishu.cn')) {
        const issueRow = prTitle.closest('.js-issue-row');
        if (issueRow) {
          const overlayLink = issueRow.querySelector('a.position-absolute[href*="/pull/"], a.position-absolute[href*="/issues/"]');
          if (overlayLink) {
            originalGithubHref = overlayLink.href;
          }
        }
      }

      // 清理导航链接上可能存在的错误属性
      prTitle.removeAttribute('data-tid');
      prTitle.removeAttribute('data-lark-type');
      prTitle.removeAttribute('data-lark-url');
      prTitle.removeAttribute('target');  // 移除 target="_blank"

      // 使用 innerHTML 在文本中插入飞书链接，保持原始链接的所有属性和行为
      let newHTML = originalText;

      // 为每个匹配的项目 ID 创建替换
      matches.forEach(match => {
        const tid = match.replace(/^#\s*/, '');
        const projectId = tid.split("-")[1];
        const cachedType = tidTypeMap.get(tid);
        let larkType = cachedType || 'story';
        let larkUrl = `https://project.feishu.cn/${LarkConfig.app}/${larkType}/detail/${projectId}`;

        // 创建内嵌飞书链接（使用 span 模拟链接，避免 a 嵌套问题）
        const larkSpan = `<span class="github-lark-id" data-tid="${tid}" data-lark-type="${larkType}" data-lark-url="${larkUrl}" style="cursor: pointer; font-weight: 500; text-decoration: none;">#${tid}</span>`;

        // 替换文本中的项目 ID
        newHTML = newHTML.replace(match, larkSpan);

        // 触发后台验证
        fetchLarkProjectInfo({
          app: LarkConfig.app,
          tid: tid
        });
      });

      // 更新 innerHTML
      prTitle.innerHTML = newHTML;

      // 强制恢复原始的 href（防止被其他代码修改）
      prTitle.href = originalGithubHref;
      prTitle.removeAttribute('target');  // 确保不是新窗口打开

      // 为所有 span.github-lark-id 绑定点击事件
      const larkSpans = prTitle.querySelectorAll('.github-lark-id');
      larkSpans.forEach(span => {
        // 点击事件：阻止冒泡，打开飞书链接
        span.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const tid = span.dataset.tid;
          const larkType = tidTypeMap.get(tid) || span.dataset.larkType;
          const larkUrl = span.dataset.larkUrl;
          window.open(larkUrl, '_blank');
        });

        // hover 事件：显示 tooltip（使用已有的 enterHandler 和 leaveHandler）
        span.addEventListener('mouseenter', enterHandler);
        span.addEventListener('mouseleave', leaveHandler);
      });

      if (observeHref) {
        // 使用 MutationObserver 监控 href 变化，防止被其他代码修改
        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'href') {
              const currentHref = prTitle.href;
              if (currentHref.includes('project.feishu.cn')) {
                prTitle.href = originalGithubHref;
                prTitle.removeAttribute('target');
              }
            }
          });
        });

        observer.observe(prTitle, {
          attributes: true,
          attributeFilter: ['href', 'target']
        });
      }

      nodeMap.add(prTitle);
    } else {
      nodeMap.add(prTitle);
    }
  }

  /**
   * 处理普通元素（非导航链接）
   */
  function handleNormalElement(prTitle, options = {}) {
    const { observeReact = true } = options;
    let hasReplaced = false;

    // 对于非 <a> 标签，使用内联 span 方式替换项目 ID
    if (prTitle.tagName !== 'A') {
      const originalText = prTitle.textContent || '';
      hasReplaced = replaceTaskIdsInTextNodes(prTitle, originalText);

      if (hasReplaced && observeReact) {
        // 使用 MutationObserver 监控 React 元素的重新渲染
        setupReactObserver(prTitle, () => replaceTaskIdsInTextNodes(prTitle, prTitle.textContent || originalText));
      }
    } else {
      // 对于 <a> 标签，使用原有逻辑
      hasReplaced = replaceLarkLinks(prTitle);

      if (!hasReplaced) {
        const result = replaceProjectIdToLarkProjectLink(prTitle);
        if (result[0]) {
          prTitle.innerHTML = result[1];
          // 为所有创建的链接绑定事件（可能有多个项目 ID）
          const links = prTitle.querySelectorAll(".lark-project-link");
          links.forEach(link => {
            bindPopoverEvent(link);
          });
          hasReplaced = true;
        }
      }
    }

    if (hasReplaced) {
      nodeMap.add(prTitle);
    }
  }

  /**
   * 设置 React 元素观察器
   */
  function setupReactObserver(prTitle, reapplyHandler) {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList' || mutation.type === 'characterData') {
          // 检查是否还有我们的 span 元素
          const currentSpans = prTitle.querySelectorAll('.github-lark-id');
          if (currentSpans.length === 0 && prTitle.textContent.includes('#')) {
            // 元素被 React 重置了，重新应用修改

            // 临时断开观察，避免无限循环
            observer.disconnect();

            reapplyHandler();

            // 重新连接观察
            observer.observe(prTitle, {
              childList: true,
              characterData: true,
              subtree: true
            });
          }
        }
      }
    });

    // 开始观察
    observer.observe(prTitle, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  /**
   * 处理 markdown body 中的项目 ID
   */
  function handleMarkdownBody(comment, commentText) {
    return replaceTaskIdsInTextNodes(comment, commentText || "");
  }

  function shouldScanGitHubTextContainer(element, text) {
    if (!element) return false;

    if (element.closest('.blob-wrapper, .blob-code, .file, .js-file, .js-diff-progressive-container')) {
      return false;
    }

    return (text || "").length <= MAX_GITHUB_TEXT_SCAN_LENGTH;
  }

  function normalizeGitHubDirectoryUrl(rawUrl) {
    if (!rawUrl) return "";

    try {
      const url = new URL(rawUrl.trim());
      if (url.hostname !== "github.com") return "";

      const pathSegments = url.pathname.split("/").filter(Boolean);
      if (pathSegments.length < 2) return "";

      return `${url.origin}/${pathSegments[0]}/${pathSegments[1]}`;
    } catch (error) {
      return "";
    }
  }

  function normalizeTableHeader(text) {
    return text.replace(/\s+/g, "").trim().toLowerCase();
  }

  function extractGitHubLoginFromLink(link) {
    if (!link) return "";

    const href = link.getAttribute("href") || "";
    const rawText = (link.textContent || "").trim();
    const textLogin = rawText.replace(/^@/, "").trim();

    try {
      const url = new URL(href, window.location.origin);
      if (url.hostname !== "github.com") {
        return textLogin;
      }

      const pathSegments = url.pathname.split("/").filter(Boolean);
      if (pathSegments.length === 1) {
        return pathSegments[0];
      }
    } catch (error) {
      return textLogin;
    }

    return textLogin;
  }

  function extractEmailPrefix(text) {
    const emailMatch = text.match(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
    if (!emailMatch) return "";

    return emailMatch[1].split("@")[0];
  }

  function buildGitHubUserDisplayName(userInfo) {
    if (!userInfo) return "";

    return (userInfo.name || userInfo.emailPrefix || "").trim();
  }

  function parseGitHubUserAliasMap(htmlText) {
    const aliasMap = new Map();
    const doc = new DOMParser().parseFromString(htmlText, "text/html");
    const tables = Array.from(doc.querySelectorAll(".markdown-body table"));

    tables.forEach(table => {
      const headerCells = Array.from(table.querySelectorAll("tr:first-child th"));
      if (headerCells.length === 0) return;

      const headers = headerCells.map(cell => normalizeTableHeader(cell.textContent || ""));
      const githubIndex = headers.indexOf("github");
      const nameIndex = headers.indexOf("name");
      const emailIndex = headers.indexOf("email");

      if (githubIndex === -1 || emailIndex === -1) return;

      const rows = Array.from(table.querySelectorAll("tr")).slice(1);
      rows.forEach(row => {
        const cells = Array.from(row.querySelectorAll("td"));
        if (cells.length <= Math.max(githubIndex, emailIndex, nameIndex)) return;

        const githubLink = cells[githubIndex].querySelector("a[href]");
        const login = extractGitHubLoginFromLink(githubLink || cells[githubIndex]);
        const name = nameIndex >= 0 ? (cells[nameIndex].textContent || "").trim() : "";
        const emailPrefix = extractEmailPrefix(cells[emailIndex].textContent || "");

        if (login && (name || emailPrefix)) {
          aliasMap.set(login, {
            name,
            emailPrefix,
          });
        }
      });
    });

    return aliasMap;
  }

  async function ensureGitHubUserAliasMap() {
    const LarkConfig = getLarkConfigSync();
    const sourceUrl = normalizeGitHubDirectoryUrl(LarkConfig?.githubUserDirectoryUrl);

    if (!sourceUrl) {
      githubUserAliasState.sourceUrl = "";
      githubUserAliasState.promise = null;
      githubUserAliasState.refreshSourceUrl = "";
      githubUserAliasState.refreshPromise = null;
      githubUserAliasState.map = new Map();
      return githubUserAliasState.map;
    }

    if (githubUserAliasState.promise && githubUserAliasState.sourceUrl === sourceUrl) {
      return githubUserAliasState.promise;
    }

    githubUserAliasState.sourceUrl = sourceUrl;
    githubUserAliasState.promise = loadGitHubUserAliasCache(sourceUrl, { allowExpired: true })
      .then(cachedMap => {
        if (cachedMap) {
          githubUserAliasState.map = cachedMap;
          return cachedMap;
        }

        return fetchAndCacheGitHubUserAliasMap(sourceUrl);
      })
      .catch(async error => {
        console.error("[GitHub Handler] 加载 GitHub 用户映射失败:", error);
        githubUserAliasState.map = new Map();
        return githubUserAliasState.map;
      });

    return githubUserAliasState.promise;
  }

  async function fetchAndCacheGitHubUserAliasMap(sourceUrl) {
    const response = await fetch(sourceUrl, {
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`GitHub user directory request failed: ${response.status}`);
    }

    const htmlText = await response.text();
    const aliasMap = parseGitHubUserAliasMap(htmlText);
    githubUserAliasState.map = aliasMap;
    await saveGitHubUserAliasCache(sourceUrl, aliasMap);
    return aliasMap;
  }

  function refreshGitHubUserAliasMap(sourceUrl) {
    if (githubUserAliasState.refreshPromise && githubUserAliasState.refreshSourceUrl === sourceUrl) {
      return githubUserAliasState.refreshPromise;
    }

    githubUserAliasState.refreshSourceUrl = sourceUrl;
    githubUserAliasState.refreshPromise = fetchAndCacheGitHubUserAliasMap(sourceUrl)
      .then(aliasMap => {
        collectGitHubHovercardContainers(document.body).forEach(enhanceGitHubHovercard);
        return aliasMap;
      })
      .catch(error => {
        console.error("[GitHub Handler] 刷新 GitHub 用户映射缓存失败:", error);
        return githubUserAliasState.map;
      });

    return githubUserAliasState.refreshPromise;
  }

  function extractLoginFromHovercard(container) {
    if (!container) return "";

    const hydroNode = container.querySelector("[data-hydro-view]");
    const hydroPayload = hydroNode?.getAttribute("data-hydro-view");
    if (hydroPayload) {
      try {
        const parsed = JSON.parse(hydroPayload);
        const loginFromPayload = parsed?.payload?.card_user_login;
        if (loginFromPayload) {
          return loginFromPayload;
        }
      } catch (error) {
        // ignore malformed payloads and fall through to DOM-based extraction
      }
    }

    const loginLink = container.querySelector('section[aria-label="User login and name"] a[href]');
    if (loginLink) {
      return extractGitHubLoginFromLink(loginLink);
    }

    return "";
  }

  function appendDisplayNameToHovercard(container, displayName) {
    if (!container || !displayName) return false;

    const nameSection = container.querySelector('section[aria-label="User login and name"]');
    if (!nameSection) return false;

    const loginLink = nameSection.querySelector('a[href]');
    if (!loginLink) return false;

    const displayNameTarget = nameSection.querySelector(".Truncate") || loginLink;
    const displayNameText = `(${displayName})`;
    const existing = nameSection.querySelector(".github-user-real-name");
    if (existing) {
      const isAlreadyPlaced = existing.previousElementSibling === displayNameTarget;
      if (existing.textContent !== displayNameText) {
        existing.textContent = displayNameText;
      }
      if (!isAlreadyPlaced) {
        displayNameTarget.insertAdjacentElement("afterend", existing);
      }
      return true;
    }

    const nameSpan = document.createElement("span");
    nameSpan.className = "github-user-real-name";
    nameSpan.textContent = displayNameText;
    displayNameTarget.insertAdjacentElement("afterend", nameSpan);

    return true;
  }

  function collectGitHubHovercardContainers(root = document.body) {
    if (!root || root.nodeType !== Node.ELEMENT_NODE) return [];

    const containerSet = new Set();
    if (root.matches?.(".Popover-message")) {
      containerSet.add(root);
    }

    const ancestorPopover = root.closest?.(".Popover-message");
    if (ancestorPopover) {
      containerSet.add(ancestorPopover);
    }

    root.querySelectorAll(".Popover-message").forEach(container => {
      containerSet.add(container);
    });

    return Array.from(containerSet);
  }

  function getGitHubHovercardContainerFromAddedNode(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return null;
    if (node.classList?.contains("github-user-real-name")) return null;

    if (node.matches?.(".Popover-message")) {
      return node;
    }

    return node.closest?.(".Popover-message") || null;
  }

  function enhanceGitHubHovercard(container) {
    if (!container) return;

    const login = extractLoginFromHovercard(container);
    if (!login) return;

    const userInfo = githubUserAliasState.map.get(login);
    const displayName = buildGitHubUserDisplayName(userInfo);
    if (!displayName) return;

    appendDisplayNameToHovercard(container, displayName);
  }

  function ensureGitHubHovercardObserver() {
    if (githubUserHovercardObserver) {
      return;
    }

    githubUserHovercardObserver = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          const hovercard = getGitHubHovercardContainerFromAddedNode(node);
          if (hovercard) {
            ensureGitHubUserAliasMap().then(() => {
              enhanceGitHubHovercard(hovercard);
            });
          }
        });
      });
    });

    githubUserHovercardObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  async function replaceGitHubUserAliases() {
    debugGitHubLog("replaceGitHubUserAliases:start");
    const aliasMap = await ensureGitHubUserAliasMap();
    if (!aliasMap || aliasMap.size === 0) {
      debugGitHubLog("replaceGitHubUserAliases:empty");
      return;
    }

    ensureGitHubHovercardObserver();
    const containers = collectGitHubHovercardContainers(document.body);
    containers.forEach(enhanceGitHubHovercard);
    debugGitHubLog("replaceGitHubUserAliases:done", {
      aliasCount: aliasMap.size,
      hovercardCount: containers.length,
    });
  }

  return {
    init,
    replaceGitHubCommits,
    replaceGitHubPullRequests,
    replaceGitHubUserAliases
  };
}
