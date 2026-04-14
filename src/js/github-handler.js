/**
 * GitHub 平台特定处理逻辑
 */

import { getLarkConfig } from "./store";

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
    removeGitLabTooltipAttributes
  } = context;

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
    `;
    document.head.appendChild(style);
  }

  /**
   * 初始化 GitHub 页面监听
   */
  async function initPageListener() {
    const config = await getLarkConfig();
    if (!config) return;

    const dom_github_container = document.querySelector("#js-repo-pjax-container, .application-main");
    if (dom_github_container) {
      const ro = new ResizeObserver(function () {
        replaceGitHubCommits();
        replaceGitHubPullRequests();
      });
      ro.observe(dom_github_container);
    }
  }

  /**
   * 设置 GitHub 导航监听
   */
  function setupNavigationListeners() {
    // 扫描并处理 GitHub 内容的统一函数
    const scanGitHubContent = () => {
      replaceGitHubCommits();
      replaceGitHubPullRequests();
    };

    // GitHub 使用 turbo 进行页面导航
    document.addEventListener('turbo:load', () => {
      setTimeout(scanGitHubContent, 500);
    });

    // Turbo Frame 内容加载完成（专门用于局部刷新）
    document.addEventListener('turbo:frame-load', () => {
      setTimeout(scanGitHubContent, 300);
    });

    // Turbo Frame 渲染完成
    document.addEventListener('turbo:render', () => {
      setTimeout(scanGitHubContent, 300);
    });

    // 也监听 pjax（旧版 GitHub）
    document.addEventListener('pjax:end', () => {
      setTimeout(scanGitHubContent, 500);
    });
  }

  /**
   * 替换 GitHub commits 列表中的项目 ID
   */
  function replaceGitHubCommits() {
    // GitHub commits 页面 - commit 标题链接（支持 /commit/ 和 /commits/）
    const commitTitleLinks = document.querySelectorAll('a[href*="/commit/"], a[href*="/commits/"]');
    
    commitTitleLinks.forEach(link => {
      if (nodeMap.has(link)) return;
      
      // 跳过导航用的覆盖层链接（position-absolute 且没有实际文本内容）
      if (link.classList.contains('position-absolute') && 
          (link.textContent.trim() === '' || link.getAttribute('aria-label')?.includes('Link to'))) {
        return;
      }
      
      const text = link.textContent;
      const LarkConfig = getLarkConfigSync();
      if (!LarkConfig) return;
      
      const prefixes = LarkConfig?.prefixes || "m,f";
      const prefixList = prefixes.split(",").map(p => p.trim().toLowerCase()).filter(p => p);
      const reg = new RegExp(`#(${prefixList.join("|")})-\\d{7,}`, "gi");
      
      const matches = text.matchAll(reg);
      let hasMatch = false;
      
      for (const match of matches) {
        hasMatch = true;
        const fullMatch = match[0]; // 如 #XX-6616715346
        const tid = fullMatch.substring(1); // 移除 #，得到 XX-6616715346
        const projectId = tid.split("-")[1];
        const prefix = tid.split("-")[0].toLowerCase();
        
        // 检查是否已经有这个 tid 的类型记录
        let type = tidTypeMap.get(tid);
        
        if (!type) {
          // 根据上下文判断初始类型
          type = "story";
          if (prefix === "m") {
            type = "story";
          } else if (prefix === "f") {
            type = "issue";
          } else {
            // 根据 commit 类型前缀判断
            const lowerText = text.toLowerCase();
            if (/^(fix|bugfix|hotfix|bug)[\s:]/i.test(lowerText)) {
              type = "issue";
            } else if (/^(feat|feature|chore|refactor|perf|style|test|docs|build|ci)[\s:]/i.test(lowerText)) {
              type = "story";
            }
          }
          
          // 记录初始类型
          tidTypeMap.set(tid, type);
        }
        
        const url = getLarkProjectLink(projectId, type);
        
        // 替换文本中的项目 ID 为带链接的版本
        const newHTML = link.innerHTML.replace(
          fullMatch,
          `<span class="github-lark-id" data-tid="${tid}" data-lark-type="${type}" data-lark-url="${url}">#${tid}</span>`
        );
        link.innerHTML = newHTML;
        
        // 获取项目信息
        fetchLarkProjectInfo({
          tid: tid,
          app: LarkConfig.app,
        });
      }
      
      if (hasMatch) {
        // 为每个项目 ID span 单独绑定事件
        const idSpans = link.querySelectorAll('.github-lark-id');
        
        idSpans.forEach(idSpan => {
          // 每个 span 独立的悬浮事件
          idSpan.addEventListener("mouseenter", enterHandler);
          idSpan.addEventListener("mouseleave", leaveHandler);
          
          // 每个 span 独立的点击事件
          idSpan.addEventListener("click", function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // 使用最新的类型和 URL
            const tid = idSpan.dataset.tid;
            const projectId = tid.split("-")[1];
            const actualType = tidTypeMap.get(tid) || idSpan.dataset.larkType || "story";
            const url = getLarkProjectLink(projectId, actualType);
            window.open(url, '_blank');
          });
        });
        
        nodeMap.set(link, true);
      }
    });

    // GitHub commits 页面 - commit 组
    const commitGroups = document.querySelectorAll('.commit-group, .commits-list-item, .TimelineItem');
    
    commitGroups.forEach(group => {
      if (nodeMap.has(group)) return;
      
      // 在整个 commit 容器中查找链接
      let hasReplaced = replaceLarkLinks(group);
      
      // 如果没有找到链接，尝试旧方法处理纯文本（向后兼容）
      if (!hasReplaced) {
        const commitMessage = group.querySelector('.commit-title, .commit-message, .timeline-comment-label');
        if (commitMessage) {
          const result = replaceProjectIdToLarkProjectLink(commitMessage);
          if (result[0]) {
            commitMessage.innerHTML = result[1];
            // 为所有创建的链接绑定事件（可能有多个项目 ID）
            const links = commitMessage.querySelectorAll(".lark-project-link");
            links.forEach(link => {
              bindPopoverEvent(link);
            });
            hasReplaced = true;
          }
        }
      }
      
      if (hasReplaced) {
        nodeMap.set(group, true);
      }
    });

    // GitHub commit 详情页 - commit message 容器（新版 UI，使用 CSS Modules）
    const commitMessageContainers = document.querySelectorAll('[class*="commitMessageContainer"], [class*="CommitHeader"], .commit-desc');
    
    commitMessageContainers.forEach(container => {
      if (nodeMap.has(container)) return;
      
      const LarkConfig = getLarkConfigSync();
      if (!LarkConfig) return;
      
      const prefixes = LarkConfig?.prefixes || "m,f";
      const prefixList = prefixes.split(",").map(p => p.trim().toLowerCase()).filter(p => p);
      
      // 查找所有可能包含 commit message 的元素
      const messageElements = container.querySelectorAll('div, span, p');
      
      messageElements.forEach(element => {
        if (nodeMap.has(element)) return;
        
        // 跳过已经处理过的元素和链接
        if (element.tagName === 'A' || 
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
          nodeMap.set(element, true);
        }
      });
      
      nodeMap.set(container, true);
    });
  }

  /**
   * 替换 GitHub Pull Request / Issue 标题、描述和评论中的项目 ID
   */
  function replaceGitHubPullRequests() {
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
    
    prTitleSelectors.forEach(selector => {
      const prTitles = document.querySelectorAll(selector);
      
      prTitles.forEach(prTitle => {
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
            handleNavigationLink(prTitle);
            return;
          }
        }
        
        // 非导航链接的正常处理（包括 div、bdi 等非链接元素）
        handleNormalElement(prTitle);
      });
    });

    // PR/Issue 评论和描述
    const comments = document.querySelectorAll('.comment-body, .timeline-comment, .markdown-body');
    comments.forEach(comment => {
      if (nodeMap.has(comment)) return;
      
      // 跳过编辑态的 markdown（在 textarea 或 contenteditable 容器中）
      const isEditing = 
        comment.closest('textarea') !== null ||
        comment.closest('[contenteditable="true"]') !== null ||
        comment.closest('.js-write-bucket') !== null ||
        comment.closest('.is-comment-editing') !== null;
      
      if (isEditing) {
        return;
      }
      
      // 首先尝试处理已有的链接
      let hasReplaced = replaceLarkLinks(comment);
      
      // 如果没有找到链接，处理纯文本中的项目 ID（针对 .markdown-body）
      if (!hasReplaced) {
        hasReplaced = handleMarkdownBody(comment);
      }
      
      if (hasReplaced) {
        nodeMap.set(comment, true);
      }
    });
  }

  function isCommitRowElement(element) {
    return Boolean(
      element.closest(
        '[data-testid="commit-row-item"], [data-commit-link], [class*="CommitRow-module__ListItem"], .commits-list-item, .commit-group'
      )
    );
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
    span.style.color = '#1890ff';
    span.style.cursor = 'pointer';
    span.style.fontWeight = '500';
    span.style.textDecoration = 'none';
    span.textContent = `#${tid}`;
    bindGitHubLarkSpan(span);
    return span;
  }

  function replaceTaskIdsInTextNodes(root, contextText) {
    const { LarkConfig, prefixList } = getGitHubPrefixConfig();
    if (!LarkConfig || prefixList.length === 0) {
      return false;
    }

    const reg = new RegExp(`#\\s*(${prefixList.join("|")})-\\d{7,}`, "gi");
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

          if (node.parentElement.closest('.github-lark-id, .lark-project-link, textarea, [contenteditable="true"], script, style')) {
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
  function handleNavigationLink(prTitle) {
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
        const larkSpan = `<span class="github-lark-id" data-tid="${tid}" data-lark-type="${larkType}" data-lark-url="${larkUrl}" style="color: #1890ff; cursor: pointer; font-weight: 500; text-decoration: none;">#${tid}</span>`;
        
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
      
      nodeMap.set(prTitle, true);
    } else {
      nodeMap.set(prTitle, true);
    }
  }

  /**
   * 处理普通元素（非导航链接）
   */
  function handleNormalElement(prTitle) {
    let hasReplaced = false;
    
    // 对于非 <a> 标签，使用内联 span 方式替换项目 ID
    if (prTitle.tagName !== 'A') {
      const originalText = prTitle.textContent || '';
      hasReplaced = replaceTaskIdsInTextNodes(prTitle, originalText);

      if (hasReplaced) {
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
      nodeMap.set(prTitle, true);
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
  function handleMarkdownBody(comment) {
    let hasReplaced = false;
    
    // 在 p, li, div 等元素中查找纯文本项目 ID
    const textElements = comment.querySelectorAll('p, li, div, span, td, th, blockquote, pre');
    textElements.forEach(elem => {
      // 跳过已处理的元素
      if (nodeMap.has(elem)) return;
      
      // 跳过已经包含飞书链接的元素
      if (elem.querySelector('.github-lark-id, .lark-project-link')) return;
      
      const LarkConfig = getLarkConfigSync();
      if (!LarkConfig) return;
      
      let prefixList = LarkConfig.prefixes;
      if (typeof prefixList === 'string') {
        prefixList = prefixList.split(',').map(p => p.trim()).filter(p => p);
      }
      
      if (prefixList && prefixList.length > 0) {
        const originalText = elem.textContent;
        const reg = new RegExp(`#\\s*(${prefixList.join("|")})-\\d{7,}`, "gi");
        const matches = originalText.match(reg);
        
        if (matches && matches.length > 0) {
          let newHTML = elem.innerHTML;
          
          matches.forEach(match => {
            const tid = match.replace(/^#\s*/, '');
            const projectId = tid.split("-")[1];
            const prefix = tid.split("-")[0].toLowerCase();
            
            // 检查缓存的类型
            let type = tidTypeMap.get(tid);
            if (!type) {
              type = "story";
              if (prefix === "f") {
                type = "issue";
              } else if (prefix === "m") {
                type = "story";
              }
              tidTypeMap.set(tid, type);
            }
            
            const url = getLarkProjectLink(projectId, type);
            
            // 创建内嵌飞书链接 span
            const larkSpan = `<span class="github-lark-id" data-tid="${tid}" data-lark-type="${type}" data-lark-url="${url}" style="color: #1890ff; cursor: pointer; font-weight: 500; text-decoration: none;">#${tid}</span>`;
            
            // 替换所有匹配的项目 ID
            newHTML = newHTML.replace(new RegExp(match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), larkSpan);
            
            // 获取项目信息
            fetchLarkProjectInfo({
              tid: tid,
              app: LarkConfig.app,
            });
          });
          
          // 更新 innerHTML
          elem.innerHTML = newHTML;
          
          // 为所有 span.github-lark-id 绑定点击和悬浮事件
          const larkSpans = elem.querySelectorAll('.github-lark-id');
          larkSpans.forEach(span => {
            span.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              const tid = span.dataset.tid;
              const projectId = tid.split("-")[1];
              const larkType = tidTypeMap.get(tid) || span.dataset.larkType;
              const url = getLarkProjectLink(projectId, larkType);
              window.open(url, '_blank');
            });
            
            span.addEventListener('mouseenter', enterHandler);
            span.addEventListener('mouseleave', leaveHandler);
          });
          
          hasReplaced = true;
          nodeMap.set(elem, true);
        }
      }
    });
    
    return hasReplaced;
  }

  return {
    init,
    replaceGitHubCommits,
    replaceGitHubPullRequests
  };
}
