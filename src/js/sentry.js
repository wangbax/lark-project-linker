import { getLarkConfig, getLarkConfigSync } from "./store";
import { checkSentryCondition } from "./utils";

main();

async function main() {
  // 先加载配置，再检查域名
  await getLarkConfig();
  
  // 检查是否匹配 Sentry 域名
  if (!checkSentryCondition()) {
    return;
  }
  
  // 初始化样式
  initStyles();
  
  // 使用 MutationObserver 监听 DOM 变化
  const observer = new MutationObserver((mutations) => {
    // 检查是否有新增的节点或属性变化
    let shouldCheck = false;
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        shouldCheck = true;
        break;
      }
      if (mutation.type === 'attributes') {
        shouldCheck = true;
        break;
      }
    }
    if (shouldCheck) {
      debouncedCheckAndAddButton();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style']
  });

  // 立即执行一次检查
  checkAndAddButton();

  // 监听 URL 变化（Sentry 使用 History API）
  let lastUrl = location.href;
  const urlObserver = new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      setTimeout(() => {
        checkAndAddButton();
      }, 1000);
    }
  });

  const titleElement = document.querySelector('title');
  if (titleElement) {
    urlObserver.observe(titleElement, {
      childList: true,
      subtree: true
    });
  }

  // 监听 popstate 事件（浏览器前进/后退）
  window.addEventListener('popstate', () => {
    setTimeout(() => {
      checkAndAddButton();
    }, 1000);
  });
}

// 防抖函数
let checkTimer = null;
function debouncedCheckAndAddButton() {
  if (checkTimer) {
    clearTimeout(checkTimer);
  }
  checkTimer = setTimeout(() => {
    checkAndAddButton();
  }, 300);
}

// 初始化样式
function initStyles() {
  const styleId = 'lark-sentry-feishu-button-style';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.innerHTML = `
    /* 飞书 Issue 项 - 精确匹配 Jira/GitLab Issues 样式 */
    .lark-sentry-feishu-issue-item {
      -webkit-text-size-adjust: 100%;
      -webkit-XX-highlight-color: rgba(0,0,0,0);
      -webkit-font-smoothing: antialiased;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin: 8px -8px 8px 0px;
      line-height: 0;
      font-family: Rubik, Avenir Next, Helvetica Neue, sans-serif;
      font-size: 14px;
      color: rgb(62, 52, 70);
    }
    
    .lark-sentry-feishu-link {
      display: block;
      text-decoration: none;
      color: rgb(62, 52, 70);
      transition: opacity 0.15s ease;
      cursor: pointer;
      font-family: inherit;
    }
    
    .lark-sentry-feishu-link:hover {
      opacity: 0.8;
    }
    
    /* 左侧容器（包含图标和文字） */
    .lark-sentry-icon-text-wrapper {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex: 0 0 auto;
    }
    
    /* 左侧图标 - 精确 20x20 */
    .lark-sentry-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      flex-shrink: 0;
    }
    
    .lark-sentry-icon svg {
      width: 20px;
      height: 20px;
      display: block;
    }
    
    /* 中间文字 */
    .lark-sentry-text {
      font-family: inherit;
      font-size: 14px;
      font-weight: 500;
      color: rgb(62, 52, 70);
      line-height: 1.5;
      white-space: nowrap;
    }
    
    /* 右侧按钮容器 - 匹配 Sentry 原生样式 */
    .lark-sentry-add-button {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin: 0;
      margin-left: auto;
      padding: 6px 8px;
      height: 26px;
      min-height: 26px;
      background-color: transparent;
      border: 1px solid transparent;
      border-radius: 6px;
      cursor: pointer;
      flex-shrink: 0;
      transition: background 0.1s, border 0.1s, box-shadow 0.1s;
      color: rgb(62, 52, 70);
      font-weight: 600;
      font-size: 0.75rem;
      line-height: 0.875rem;
      box-sizing: border-box;
      text-transform: none;
      -webkit-appearance: button;
      -webkit-font-smoothing: antialiased;
      -webkit-XX-highlight-color: rgba(0,0,0,0);
      box-shadow: none;
    }
    
    .lark-sentry-add-button:hover {
      background-color: rgba(0, 0, 0, 0.06);
    }
    
    .lark-sentry-add-button:active {
      background-color: rgba(0, 0, 0, 0.1);
    }
    
    /* 右侧加号 - 精确 16x16，自动继承 currentColor */
    .lark-sentry-plus {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
    }
    
    .lark-sentry-plus svg {
      width: 16px;
      height: 16px;
      display: block;
    }
    
    /* 深色模式适配 */
    @media (prefers-color-scheme: dark) {
      .lark-sentry-feishu-link,
      .lark-sentry-text {
        color: rgb(199, 193, 227);
      }
      
      .lark-sentry-add-button {
        color: rgb(199, 193, 227);
      }
      
      .lark-sentry-add-button:hover {
        background-color: rgba(255, 255, 255, 0.08);
      }
      
      .lark-sentry-add-button:active {
        background-color: rgba(255, 255, 255, 0.12);
      }
    }
    
    /* ========== 弹框样式 ========== */
    .lark-sentry-modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .lark-sentry-modal-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
    }
    
    .lark-sentry-modal-container {
      position: relative;
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
      width: 90%;
      max-width: 600px;
      max-height: 90vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      animation: lark-sentry-modal-slide-in 0.2s ease-out;
    }
    
    @keyframes lark-sentry-modal-slide-in {
      from {
        opacity: 0;
        transform: translateY(-20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    /* Toast 提示样式 */
    .lark-sentry-toast {
      position: fixed;
      top: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      font-size: 14px;
      font-weight: 500;
      z-index: 100001;
      animation: lark-sentry-toast-slide-in 0.3s ease-out;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .lark-sentry-toast.error {
      background: #ef4444;
    }
    
    .lark-sentry-toast-icon {
      font-size: 16px;
    }
    
    @keyframes lark-sentry-toast-slide-in {
      from {
        opacity: 0;
        transform: translateX(100%);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
    
    @keyframes lark-sentry-toast-slide-out {
      from {
        opacity: 1;
        transform: translateX(0);
      }
      to {
        opacity: 0;
        transform: translateX(100%);
      }
    }
    
    .lark-sentry-modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 24px;
      border-bottom: 1px solid #e5e7eb;
    }
    
    .lark-sentry-modal-title {
      font-size: 18px;
      font-weight: 600;
      color: #111827;
      margin: 0;
    }
    
    .lark-sentry-modal-close {
      background: none;
      border: none;
      font-size: 32px;
      line-height: 1;
      color: #6b7280;
      cursor: pointer;
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: background-color 0.15s, color 0.15s;
    }
    
    .lark-sentry-modal-close:hover {
      background-color: #f3f4f6;
      color: #111827;
    }
    
    .lark-sentry-modal-body {
      padding: 24px;
      overflow-y: auto;
      flex: 1;
    }
    
    /* 加载动画 */
    .lark-sentry-form-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 16px;
      color: #6b7280;
    }
    
    .lark-sentry-spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #e5e7eb;
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: lark-sentry-spin 0.8s linear infinite;
      margin-bottom: 16px;
    }
    
    @keyframes lark-sentry-spin {
      to { transform: rotate(360deg); }
    }
    
    /* 表单样式 */
    .lark-sentry-form {
      display: flex;
      flex-direction: column;
    }
    
    .lark-sentry-form-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 12px;
    }
    
    .lark-sentry-form-label {
      font-size: 14px;
      font-weight: 500;
      color: #374151;
    }
    
    .lark-sentry-form-required {
      color: #ef4444;
    }
    
    .lark-sentry-form-input,
    .lark-sentry-form-textarea,
    .lark-sentry-form-select {
      font-family: inherit;
      font-size: 14px;
      padding: 10px 12px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      background-color: white;
      color: #111827;
      transition: border-color 0.15s, box-shadow 0.15s;
      width: 100%;
      box-sizing: border-box;
    }
    
    .lark-sentry-form-input:focus,
    .lark-sentry-form-textarea:focus,
    .lark-sentry-form-select:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }
    
    .lark-sentry-form-textarea {
      resize: vertical;
      min-height: 120px;
    }
    
    .lark-sentry-form-error {
      padding: 12px;
      background-color: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 6px;
      color: #dc2626;
      font-size: 14px;
      margin-top: 12px;
    }
    
    #lark-sentry-dynamic-fields {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    #lark-sentry-dynamic-fields .lark-sentry-form-group {
      margin-bottom: 0;
    }
    
    .lark-sentry-form-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      margin-top: 12px;
    }
    
    .lark-sentry-btn {
      font-family: inherit;
      font-size: 14px;
      font-weight: 500;
      padding: 10px 20px;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      transition: background-color 0.15s, opacity 0.15s;
    }
    
    .lark-sentry-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .lark-sentry-btn-cancel {
      background-color: white;
      color: #374151;
      border: 1px solid #d1d5db;
    }
    
    .lark-sentry-btn-cancel:hover:not(:disabled) {
      background-color: #f9fafb;
    }
    
    .lark-sentry-btn-primary {
      background-color: #3b82f6;
      color: white;
    }
    
    .lark-sentry-btn-primary:hover:not(:disabled) {
      background-color: #2563eb;
    }
    
    /* 自动完成下拉框样式 */
    .lark-sentry-autocomplete-wrapper {
      position: relative;
    }
    
    .lark-sentry-autocomplete-dropdown {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      margin-top: 4px;
      background-color: white;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
      max-height: 300px;
      overflow-y: auto;
      z-index: 1000;
    }
    
    .lark-sentry-autocomplete-item {
      padding: 10px 12px;
      cursor: pointer;
      transition: background-color 0.15s;
      border-bottom: 1px solid #f3f4f6;
    }
    
    .lark-sentry-autocomplete-item:last-child {
      border-bottom: none;
    }
    
    .lark-sentry-autocomplete-item:hover {
      background-color: #f3f4f6;
    }
    
    .lark-sentry-autocomplete-item-name {
      font-size: 14px;
      font-weight: 500;
      color: #111827;
      margin-bottom: 2px;
    }
    
    .lark-sentry-autocomplete-item-email {
      font-size: 12px;
      color: #6b7280;
    }
    
    .lark-sentry-autocomplete-no-results {
      padding: 16px 12px;
      text-align: center;
      color: #6b7280;
      font-size: 14px;
    }
    
    /* 深色模式适配 - 弹框 */
    @media (prefers-color-scheme: dark) {
      .lark-sentry-modal-container {
        background-color: #1f2937;
      }
      
      .lark-sentry-modal-header {
        border-bottom-color: #374151;
      }
      
      .lark-sentry-modal-title {
        color: #f9fafb;
      }
      
      .lark-sentry-modal-close {
        color: #9ca3af;
      }
      
      .lark-sentry-modal-close:hover {
        background-color: #374151;
        color: #f9fafb;
      }
      
      .lark-sentry-form-loading {
        color: #9ca3af;
      }
      
      .lark-sentry-form-label {
        color: #d1d5db;
      }
      
      .lark-sentry-form-input,
      .lark-sentry-form-textarea,
      .lark-sentry-form-select {
        background-color: #374151;
        border-color: #4b5563;
        color: #f9fafb;
      }
      
      .lark-sentry-form-error {
        background-color: #7f1d1d;
        border-color: #991b1b;
        color: #fca5a5;
      }
      
      .lark-sentry-btn-cancel {
        background-color: #374151;
        color: #d1d5db;
        border-color: #4b5563;
      }
      
      .lark-sentry-btn-cancel:hover:not(:disabled) {
        background-color: #4b5563;
      }
      
      .lark-sentry-autocomplete-dropdown {
        background-color: #374151;
        border-color: #4b5563;
      }
      
      .lark-sentry-autocomplete-item {
        border-bottom-color: #4b5563;
      }
      
      .lark-sentry-autocomplete-item:hover {
        background-color: #4b5563;
      }
      
      .lark-sentry-autocomplete-item-name {
        color: #f9fafb;
      }
      
      .lark-sentry-autocomplete-item-email {
        color: #9ca3af;
      }
      
      .lark-sentry-autocomplete-no-results {
        color: #9ca3af;
      }
    }
  `;
  document.head.appendChild(style);
}

// 检查并添加按钮
async function checkAndAddButton() {
  const config = getLarkConfigSync();
  if (!config || !config.sentryIssueCreateUrl) {
    return;
  }

  let trackingSection = null;
  
  // 方法1（最优先）: 使用 Sentry 的 data-test-id 属性
  trackingSection = document.querySelector('[data-test-id="linked-issues"]');
  
  // 方法2: 查找 "Issue Tracking" 标题
  if (!trackingSection) {
    const headings = document.querySelectorAll('h3, h4, h5, h6, [role="heading"]');
    
    for (const heading of headings) {
      const text = heading.textContent.toLowerCase();
      if (text.includes('issue tracking') || text.includes('external issues')) {
        trackingSection = heading.closest('div[class*="panel"], div[class*="section"], section');
        if (!trackingSection) {
          trackingSection = heading.parentElement;
        }
        break;
      }
    }
  }

  // 方法3: 查找包含 "Jira" 或其他集成的区域
  if (!trackingSection) {
    const links = document.querySelectorAll('a[href*="jira"], a[href*="github"], a[href*="gitlab"]');
    if (links.length > 0) {
      trackingSection = links[0].closest('div[class*="panel"], div[class*="section"], section, ul, div');
    }
  }

  // 方法4: 查找 sidebar 中的插件集成区域
  if (!trackingSection) {
    const sidebar = document.querySelector('[data-test-id="sidebar"], aside, [class*="sidebar"]');
    if (sidebar) {
      const panels = sidebar.querySelectorAll('div[class*="panel"], section');
      for (const panel of panels) {
        const text = panel.textContent.toLowerCase();
        if (text.includes('integrations') || text.includes('issue') || text.includes('tracking')) {
          trackingSection = panel;
          break;
        }
      }
    }
  }

  if (!trackingSection) {
    // 如果实在找不到，尝试在问题详情页面的顶部添加按钮
    const issueHeader = document.querySelector('[data-test-id="issue-header"], header, [class*="issue-header"]');
    if (issueHeader) {
      const actionsContainer = issueHeader.querySelector('[class*="actions"], [class*="buttons"], div:last-child');
      if (actionsContainer && !actionsContainer.querySelector('.lark-sentry-feishu-issue-item')) {
        await addFeishuButton(actionsContainer, config);
      }
    }
    return;
  }

  // 检查是否已经添加过按钮
  if (trackingSection.querySelector('.lark-sentry-feishu-issue-item')) {
    return;
  }

  // 直接插入到 Issue Tracking 容器中
  await addFeishuButton(trackingSection, config);
}

// 添加飞书按钮
async function addFeishuButton(container, config) {
  // 检查是否已经添加过按钮（防止重复插入）
  if (container.querySelector('.lark-sentry-feishu-issue-item')) {
    return;
  }
  
  // 提取 Sentry Issue ID
  const sentryIssueId = extractSentryIssueId();
  if (!sentryIssueId) {
    console.warn('[Sentry] 无法从 URL 中提取 Sentry Issue ID');
    return;
  }
  
  // 先查询 Issue 是否已存在
  const existingIssue = await queryFeishuIssue(config, sentryIssueId);
  
  // 创建与 Jira/GitLab Issue 完全相同结构的元素
  const issueItem = document.createElement('div');
  issueItem.setAttribute('data-test-id', 'external-issue-item');
  issueItem.className = 'lark-sentry-feishu-issue-item';
  
  // 创建左侧容器（包含图标和文字链接）
  const iconTextWrapper = document.createElement('span');
  iconTextWrapper.className = 'lark-sentry-icon-text-wrapper';
  
  // 左侧图标（飞书 logo - 20x20）
  const iconSpan = document.createElement('span');
  iconSpan.className = 'lark-sentry-icon';
  iconSpan.innerHTML = `
    <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
      <path d="M0 0h1024v1024H0V0z m244.622222 193.422222c6.6048 19.820089 11.593956 22.840889 28.091734 34.844445C302.887822 251.044978 330.763378 275.717689 358.4 301.511111l13.641956 12.515556C435.325156 374.328889 496.116622 450.2528 534.755556 529.066667v22.755555c-12.686222 11.576889-12.686222 11.576889-29.513956 23.113956l-16.594489 11.576889L472.177778 597.333333l-14.153956 10.643911C443.733333 614.4 443.733333 614.4 427.554133 611.202844c-107.679289-49.043911-207.9232-121.400889-289.934222-206.648888C126.674489 391.224889 126.674489 391.224889 113.777778 392.533333a18880.682667 18880.682667 0 0 0-1.479111 140.942223c-0.142222 21.816889-0.341333 43.633778-0.6656 65.444977a5641.563022 5641.563022 0 0 0-0.551823 63.186489c-0.056889 8.027022-0.159289 16.054044-0.312888 24.081067a1867.036444 1867.036444 0 0 0-0.221867 33.780622l-0.187733 19.410489c5.125689 25.856 20.997689 38.269156 42.183111 52.736l9.568711 4.886756 10.934044 5.597866 11.491556 5.575111 12.026311 5.927823c114.346667 54.516622 245.731556 61.513956 365.550933 20.718933 151.614578-55.153778 240.497778-162.9184 312.888889-302.290489l8.391111-16.145067c5.461333-10.552889 10.882844-21.122844 16.270222-31.715555 12.982044-25.2416 25.673956-48.014222 44.691912-69.381689-4.881067-12.8-4.881067-12.8-19.626667-17.464889C859.704889 376.638578 799.857778 374.328889 733.866667 392.533333l-1.553067-19.933866c-3.345067-26.447644-12.481422-47.286044-24.758044-70.729956L701.44 289.905778c-18.875733-35.9424-41.216-67.726222-69.973333-96.483556-16.816356-1.672533-16.816356-1.672533-36.807111-1.291378h-11.434667c-12.498489 0-24.991289 0.091022-37.489778 0.182045l-25.969778 0.045511c-22.806756 0.045511-45.607822 0.159289-68.408889 0.284444-23.256178 0.113778-46.518044 0.170667-69.779911 0.227556-45.653333 0.113778-91.306667 0.312889-136.954311 0.551822z" fill="#FEFEFE"/>
      <path d="M113.777778 392.533333c16.611556 7.953067 27.653689 15.251911 40.180622 28.802845 126.765511 129.991111 331.172978 252.683378 514.844444 268.8 49.237333-0.762311 98.9184-17.590044 133.330489-52.980622l11.377778 5.688888c-86.971733 112.878933-195.4816 189.2352-337.755022 213.799823C354.833067 870.570667 224.398222 848.2816 125.155556 773.688889c-13.448533-20.1728-12.765867-28.529778-12.669156-52.4288v-22.084267l0.182044-23.864889 0.045512-24.416711c0.045511-21.407289 0.159289-42.814578 0.284444-64.221866 0.113778-21.845333 0.170667-43.702044 0.227556-65.547378A46936.746667 46936.746667 0 0 1 113.777778 392.533333z" fill="#3171FE"/>
      <path d="M244.622222 193.422222c49.749333-1.058133 99.498667-1.865956 149.253689-2.3552 23.108267-0.238933 46.205156-0.5632 69.307733-1.080889 22.317511-0.494933 44.629333-0.762311 66.946845-0.881777 8.4992-0.085333 16.992711-0.250311 25.486222-0.494934 66.417778-1.848889 66.417778-1.848889 89.759289 14.637511A216.558933 216.558933 0 0 1 671.288889 238.933333l11.798755 17.379556c52.718933 92.16 52.718933 92.16 50.779023 136.220444l11.377777 5.688889-10.643911 3.777422-14.597689 5.467023-14.205155 5.199644c-46.432711 22.124089-81.891556 53.327644-117.356089 90.089245l-12.452978 12.686222A5490.0224 5490.0224 0 0 0 546.133333 546.133333a1010.961067 1010.961067 0 0 1-23.131022-36.443022C493.983289 461.909333 463.701333 417.547378 426.666667 375.466667c-4.152889-4.778667-8.305778-9.545956-12.572445-14.466845-44.987733-50.898489-91.022222-97.934222-146.067911-137.864533C260.039111 217.258667 252.302222 211.057778 244.622222 204.8v-11.377778z" fill="#01D6BA"/>
      <path d="M938.666667 403.911111l5.688889 11.377778-7.4752 9.984c-27.022222 37.182578-47.775289 75.531378-67.549867 116.952178a7167.106844 7167.106844 0 0 1-17.3056 35.84l-7.537778 15.786666c-26.168889 47.314489-68.1984 78.984533-119.864889 94.151111C629.105778 712.533333 529.789156 662.272 443.733333 625.777778v-11.377778c8.664178-5.802667 17.618489-11.167289 26.669511-16.355556 47.866311-29.622044 87.552-68.437333 126.464-108.845511C688.651378 394.183111 811.121778 348.171378 938.666667 403.911111z" fill="#0C3A9B"/>
    </svg>
  `;
  
  // 文字链接（点击打开弹框或工单）
  const textLink = document.createElement('a');
  textLink.className = 'lark-sentry-feishu-link';
  textLink.href = '#';
  
  if (existingIssue && existingIssue.url) {
    // Issue 已存在，显示工单标题（优先使用 label）
    const issueTitle = existingIssue.label 
      || (existingIssue.mapping?.feishu_ticket_id ? `#${existingIssue.mapping.feishu_ticket_id}` : null)
      || 'Feishu Issue';
    textLink.innerHTML = `<span class="lark-sentry-text">${escapeHtml(issueTitle)}</span>`;
    textLink.onclick = (e) => {
      e.preventDefault();
      window.open(existingIssue.url, '_blank');
    };
  } else {
    // Issue 不存在，显示默认文本
    textLink.innerHTML = '<span class="lark-sentry-text">Feishu Issue</span>';
    textLink.onclick = async (e) => {
      e.preventDefault();
      // 异步获取 Issue 信息（包括从 JSON 获取堆栈）
      const issueInfo = await extractIssueInfo();
      showCreateIssueModal(issueInfo, config);
    };
  }
  
  iconTextWrapper.appendChild(iconSpan);
  iconTextWrapper.appendChild(textLink);
  
  issueItem.appendChild(iconTextWrapper);
  
  // 右侧加号按钮（仅在工单不存在时显示）
  if (!existingIssue || !existingIssue.url) {
    const addButton = document.createElement('button');
    addButton.className = 'lark-sentry-add-button';
    addButton.setAttribute('aria-label', 'Add');
    addButton.setAttribute('type', 'button');
    addButton.onclick = async (e) => {
      e.preventDefault();
      // 异步获取 Issue 信息（包括从 JSON 获取堆栈）
      const issueInfo = await extractIssueInfo();
      showCreateIssueModal(issueInfo, config);
    };
    addButton.innerHTML = `
      <span class="lark-sentry-plus">
        <svg viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M8.75,7.25V2a.75.75,0,0,0-1.5,0V7.25H2a.75.75,0,0,0,0,1.5H7.25V14a.75.75,0,0,0,1.5,0V8.75H14a.75.75,0,0,0,0-1.5Z"/>
        </svg>
      </span>
    `;
    issueItem.appendChild(addButton);
  }
  
  // 根据容器类型选择插入方式
  if (container.getAttribute('data-test-id') === 'linked-issues') {
    // 查找 H6 标题（Issue Tracking 标题）
    let insertPosition = null;
    let foundHeading = false;
    
    for (const child of container.children) {
      // 如果找到了标题元素
      if (child.tagName === 'H6' || child.tagName === 'H5' || child.tagName === 'H4') {
        foundHeading = true;
        continue; // 跳过标题，继续查找下一个元素
      }
      
      // 如果已经找到了标题，当前元素就是标题后的第一个元素
      if (foundHeading) {
        insertPosition = child;
        break;
      }
    }
    
    if (insertPosition) {
      // 在标题后的第一个元素之前插入
      container.insertBefore(issueItem, insertPosition);
    } else if (foundHeading) {
      // 找到了标题但没有后续元素，追加到末尾
      container.appendChild(issueItem);
    } else {
      // 没有找到标题，查找第一个 external-issue-item
      let firstIssue = null;
      for (const child of container.children) {
        if (child.getAttribute('data-test-id') === 'external-issue-item') {
          firstIssue = child;
          break;
        }
      }
      
      if (firstIssue) {
        container.insertBefore(issueItem, firstIssue);
      } else {
        container.appendChild(issueItem);
      }
    }
  }
}

// 提取当前页面的 Issue 信息
async function extractIssueInfo() {
  // 清理 URL，只保留 referrer=jira_integration
  let cleanUrl = window.location.origin + window.location.pathname;
  cleanUrl += '?referrer=jira_integration';
  
  const info = {
    title: '',
    description: '',
    url: cleanUrl
  };

  // 1. 先从页面提取异常类型和消息（作为备用）
  const errorTitle = document.querySelector('[data-test-id="event-type"]');
  const errorMessage = document.querySelector('[data-test-id="issue-message"]');
  
  // 2. 提取短标题（例如：XXX-ANDROID-6896）
  let shortTitle = '';
  const shortTitleElement = document.querySelector(
    '.auto-select-text span, ' +
    '.help-link span, ' +
    'header [class*="group-detail"] span'
  );
  if (shortTitleElement && shortTitleElement.textContent) {
    const text = shortTitleElement.textContent.trim();
    // 匹配类似 XXX-ANDROID-6896 的格式
    if (/^[A-Z]+-[A-Z]+-[A-F0-9]+$/i.test(text)) {
      shortTitle = text;
    }
  }
  
  // 3. 提取异常信息
  let exceptionInfo = '';
  if (errorTitle && errorMessage) {
    const exceptionType = errorTitle.textContent.trim();
    const exceptionMsg = errorMessage.textContent.trim();
    exceptionInfo = `${exceptionType}: ${exceptionMsg}`;
  } else if (errorMessage) {
    exceptionInfo = errorMessage.textContent.trim();
  }
  
  // 4. 查找 JSON 链接并提取堆栈信息
  const jsonLink = document.querySelector('a[href*="/json/"]');
  let inAppFrames = [];
  let hiddenFrames = 0;
  
  if (jsonLink) {
    try {
      const response = await fetch(jsonLink.href, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
        const jsonData = await response.json();

        // 从 JSON 提取堆栈信息
        if (jsonData.exception && jsonData.exception.values) {
          const exceptions = jsonData.exception.values;
          const lastException = exceptions[exceptions.length - 1];
          
          if (lastException) {
            // 使用 JSON 中的异常信息作为标题
            if (lastException.type && lastException.value) {
              exceptionInfo = `${lastException.type}: ${lastException.value}`;
              info.title = exceptionInfo; // 设置标题为异常信息
            }
            
            // 提取堆栈帧（显示所有帧，包括 in_app 和非 in_app）
            if (lastException.stacktrace && lastException.stacktrace.frames) {
              const frames = lastException.stacktrace.frames;
              let inAppFramesTemp = [];
              let nonInAppFramesCount = 0;
              
              frames.forEach((frame) => {
                let frameLine = '    at ';
                
                // 格式：module.function(file:line)
                if (frame.module && frame.function) {
                  frameLine += `${frame.module}.${frame.function}`;
                } else if (frame.function) {
                  frameLine += frame.function;
                } else {
                  frameLine += '<unknown>';
                }
                
                const filename = frame.filename || frame.abs_path || 'unknown';
                const lineno = frame.lineno || '?';
                frameLine += `(${filename}:${lineno})`;
                
                if (frame.in_app) {
                  // 应用内代码
                  inAppFramesTemp.push(frameLine);
                } else {
                  // 非应用内代码也添加
                  inAppFramesTemp.push(frameLine);
                  nonInAppFramesCount++;
                }
              });
              
              // 只显示前几帧，剩余的统计
              const maxFrames = 20;
              if (inAppFramesTemp.length > maxFrames) {
                inAppFrames = inAppFramesTemp.slice(0, maxFrames);
                hiddenFrames = inAppFramesTemp.length - maxFrames;
              } else {
                inAppFrames = inAppFramesTemp;
                hiddenFrames = 0;
              }
            }
          }
        }
      } else {
        console.warn('[Sentry] JSON 数据获取失败或需要认证');
      }
    } catch (error) {
      console.error('[Sentry] 获取 JSON 数据时出错:', error);
    }
  }
  
  // 如果没有从 JSON 获取到标题，使用页面异常信息或页面标题
  if (!info.title) {
    if (exceptionInfo) {
      info.title = exceptionInfo;
    } else {
      const titleElement = document.querySelector(
        '[data-test-id="issue-title"], ' +
        'h1, ' +
        '[class*="title"]'
      );
      if (titleElement) {
        info.title = titleElement.textContent.trim();
      }
    }
  }
  
  // 3. 构建描述（Jira 风格）
  // 优先使用短标题（XXX-ANDROID-6896），否则使用完整标题
  const linkTitle = shortTitle || info.title || 'Link';
  let description = `Sentry Issue: [${linkTitle}|${info.url}]\n\n`;
  
  // 4. 构建代码块
  if (inAppFrames.length > 0 || exceptionInfo) {
    description += '{code}\n';
    
    if (exceptionInfo) {
      description += `${exceptionInfo}\n`;
    }
    
    if (inAppFrames.length > 0) {
      description += inAppFrames.join('\n') + '\n';
    }
    
    if (hiddenFrames > 0) {
      description += `...\n(${hiddenFrames} additional frame(s) were not displayed)\n`;
    }
    
    description += '{code}\n\n';
  }
  
  // 5. 提取环境信息（如果有）
  const tags = document.querySelectorAll('[data-test-id="event-tag"]');
  const metadata = [];
  
  tags.forEach((tag) => {
    const key = tag.querySelector('[class*="key"]');
    const value = tag.querySelector('[class*="value"]');
    if (key && value) {
      const keyText = key.textContent.trim();
      const valueText = value.textContent.trim();
      
      // 只保留关键信息
      if (['environment', 'release', 'platform', 'device', 'os'].includes(keyText.toLowerCase())) {
        metadata.push(`*${keyText}:* ${valueText}`);
      }
    }
  });
  
  if (metadata.length > 0) {
    description += metadata.join(' | ') + '\n';
  }
  
  info.description = description;
  
  return info;
}

/**
 * 显示创建 Issue 的弹框
 */
function showCreateIssueModal(issueInfo, config) {
  // 如果弹框已存在，先移除
  const existingModal = document.getElementById('lark-sentry-modal');
  if (existingModal) {
    existingModal.remove();
  }

  // 创建弹框容器
  const modal = document.createElement('div');
  modal.id = 'lark-sentry-modal';
  modal.className = 'lark-sentry-modal';
  modal.innerHTML = `
    <div class="lark-sentry-modal-overlay"></div>
    <div class="lark-sentry-modal-container">
      <div class="lark-sentry-modal-header">
        <h3 class="lark-sentry-modal-title">创建飞书 Issue</h3>
        <button class="lark-sentry-modal-close" aria-label="Close">&times;</button>
      </div>
      <div class="lark-sentry-modal-body">
        <div class="lark-sentry-form-loading" id="lark-sentry-form-loading">
          <div class="lark-sentry-spinner"></div>
          <p>正在加载字段选项...</p>
        </div>
        <form id="lark-sentry-issue-form" class="lark-sentry-form" style="display: none;">
          <div class="lark-sentry-form-group">
            <label class="lark-sentry-form-label">
              标题 <span class="lark-sentry-form-required">*</span>
            </label>
            <input 
              type="text" 
              name="title" 
              class="lark-sentry-form-input" 
              value="${escapeHtml(issueInfo.title)}"
              required
            />
          </div>
          
          <div class="lark-sentry-form-group">
            <label class="lark-sentry-form-label">
              描述 <span class="lark-sentry-form-required">*</span>
            </label>
            <textarea 
              name="description" 
              class="lark-sentry-form-textarea" 
              rows="6"
              required
            >${escapeHtml(issueInfo.description)}</textarea>
          </div>
          
          <div class="lark-sentry-form-group">
            <label class="lark-sentry-form-label">
              报告人 <span class="lark-sentry-form-required">*</span>
            </label>
            <div class="lark-sentry-autocomplete-wrapper">
              <input 
                type="text" 
                name="reporter" 
                id="reporter-input"
                class="lark-sentry-form-input" 
                placeholder="输入姓名或邮箱搜索..."
                autocomplete="off"
                required
              />
              <input type="hidden" name="reporterId" id="reporter-id" required />
              <div class="lark-sentry-autocomplete-dropdown" id="reporter-dropdown" style="display: none;"></div>
            </div>
          </div>
          
          <div class="lark-sentry-form-group">
            <label class="lark-sentry-form-label">
              经办人 <span class="lark-sentry-form-required">*</span>
            </label>
            <div class="lark-sentry-autocomplete-wrapper">
              <input 
                type="text" 
                name="assignee" 
                id="assignee-input"
                class="lark-sentry-form-input" 
                placeholder="输入姓名或邮箱搜索..."
                autocomplete="off"
                required
              />
              <input type="hidden" name="assigneeId" id="assignee-id" required />
              <div class="lark-sentry-autocomplete-dropdown" id="assignee-dropdown" style="display: none;"></div>
            </div>
          </div>
          
          <!-- 动态字段容器 -->
          <div id="lark-sentry-dynamic-fields"></div>
          
          <div class="lark-sentry-form-error" id="lark-sentry-form-error" style="display: none;"></div>
          
          <div class="lark-sentry-form-actions">
            <button type="button" class="lark-sentry-btn lark-sentry-btn-cancel">取消</button>
            <button type="submit" class="lark-sentry-btn lark-sentry-btn-primary">创建 Issue</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // 绑定事件
  const closeBtn = modal.querySelector('.lark-sentry-modal-close');
  const cancelBtn = modal.querySelector('.lark-sentry-btn-cancel');
  const overlay = modal.querySelector('.lark-sentry-modal-overlay');
  const form = modal.querySelector('#lark-sentry-issue-form');

  const closeModal = () => modal.remove();
  
  closeBtn.onclick = closeModal;
  cancelBtn.onclick = closeModal;
  overlay.onclick = closeModal;

  // 防止点击弹框内容区域时关闭
  modal.querySelector('.lark-sentry-modal-container').onclick = (e) => {
    e.stopPropagation();
  };

  // 初始化表单
  populateFormOptions(config).then(() => {
    document.getElementById('lark-sentry-form-loading').style.display = 'none';
    form.style.display = 'block';
  }).catch(error => {
    console.error('[Sentry] 初始化表单失败:', error);
    showFormError('初始化表单失败: ' + error.message);
  });

  // 表单提交
  form.onsubmit = async (e) => {
    e.preventDefault();
    await handleFormSubmit(form, config, issueInfo);
  };
}

/**
 * 加载字段选项
 */
async function loadFieldOptions(config) {
  if (!config.sentryIssueCreateUrl) {
    throw new Error('请先在插件选项中配置 Sentry Issue 创建地址');
  }

  // 从 Sentry URL 中提取项目信息，或使用默认值
  const projectKey = extractProjectKey() || '148';
  
  // 构建 API URL
  const apiBase = config.sentryIssueCreateUrl;
  const url = `${apiBase}/field-options?projectKey=${projectKey}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * 从当前 Sentry URL 中提取项目 Key
 */
function extractProjectKey() {
  // 尝试从 URL 路径中提取项目 ID
  // 例如: https://sentry.io/organizations/myorg/issues/123/?project=148
  const urlParams = new URLSearchParams(window.location.search);
  const projectParam = urlParams.get('project');
  if (projectParam) {
    return projectParam;
  }
  
  // 尝试从路径中提取
  const pathMatch = window.location.pathname.match(/\/projects?\/([^\/]+)/);
  if (pathMatch) {
    return pathMatch[1];
  }
  
  return null;
}

/**
 * 提取 Sentry Issue ID（从 URL 中）
 */
function extractSentryIssueId() {
  // URL 格式: https://sentry.com/organizations/project/issues/7188091/...
  const match = window.location.pathname.match(/\/issues\/(\d+)/);
  return match ? match[1] : null;
}

/**
 * 查询 Feishu Issue 是否已存在
 */
async function queryFeishuIssue(config, sentryIssueId) {
  try {
    const url = `${config.sentryIssueCreateUrl}/ticket?sentryIssueId=${sentryIssueId}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const result = await response.json();

      // 返回格式: { code: 0, success: true, data: { mapping: {...}, url: "..." } }
      if (result.success && result.data) {
        return result.data;
      }
      return null;
    } else if (response.status === 404) {
      // Issue 不存在
      return null;
    } else {
      console.warn('[Sentry] 查询 Feishu Issue 失败:', response.status);
      return null;
    }
  } catch (error) {
    console.error('[Sentry] 查询 Feishu Issue 时出错:', error);
    return null;
  }
}

/**
 * 从当前 Sentry URL 中提取组织名称
 */
function extractOrganization() {
  // 例如: https://sentry.com/organizations/project/issues/...
  const pathMatch = window.location.pathname.match(/\/organizations\/([^\/]+)/);
  if (pathMatch) {
    return pathMatch[1];
  }
  return null;
}

/**
 * 获取当前登录用户信息
 */
function getCurrentUser() {
  try {
    // Content script 无法直接访问页面的 window.__initialData
    // 需要从 DOM 中的 <script> 标签提取数据
    const scripts = document.querySelectorAll('script');
    let initialData = null;
    
    // 遍历所有 script 标签，找到包含 window.__initialData 的脚本
    for (const script of scripts) {
      const content = script.textContent || script.innerText;
      if (content && content.includes('window.__initialData')) {
        try {
          // 提取 JSON 数据
          const match = content.match(/window\.__initialData\s*=\s*(\{[\s\S]*?\});/);
          if (match && match[1]) {
            initialData = JSON.parse(match[1]);
            break;
          }
        } catch (parseError) {
          console.warn('[Sentry] 解析 __initialData 失败:', parseError);
        }
      }
    }
    
    if (!initialData) {
      console.warn('[Sentry] 未找到 __initialData 数据');
      return null;
    }
    
    // 从 __initialData.user 中获取当前用户信息
    if (initialData.user) {
      const user = initialData.user;

      // 如果没有 name，使用邮箱 @ 前面的部分
      const displayName = user.name || (user.email ? user.email.split('@')[0] : user.email);
      
      const currentUser = {
        id: user.id,
        name: displayName,
        email: user.email,
        username: user.username,
        avatarUrl: user.avatarUrl
      };
      return currentUser;
    } else if (initialData.userIdentity) {
      // 降级到 userIdentity
      const user = initialData.userIdentity;

      // 如果没有 name，使用邮箱 @ 前面的部分
      const displayName = user.name || (user.email ? user.email.split('@')[0] : user.email);
      
      const currentUser = {
        id: user.id.toString(),
        name: displayName,
        email: user.email,
        username: user.email,
        avatarUrl: null
      };
      return currentUser;
    } else {
      console.warn('[Sentry] __initialData 中没有 user 或 userIdentity 信息');
    }
  } catch (error) {
    console.error('[Sentry] 获取当前用户信息时出错:', error);
  }
  
  console.warn('[Sentry] 返回 null，无法获取当前用户');
  return null;
}

/**
 * 从 Sentry API 搜索组织成员
 */
async function searchSentryMembers(query = '') {
  const org = extractOrganization();
  if (!org) {
    console.warn('[Sentry] 无法从 URL 中提取组织名称');
    return [];
  }
  
  try {
    // 构建 Sentry API URL
    const baseUrl = `${window.location.protocol}//${window.location.host}`;
    const url = `${baseUrl}/api/0/organizations/${org}/members/${query ? `?query=${encodeURIComponent(query)}` : ''}`;

    const response = await fetch(url, {
      credentials: 'include', // 携带认证信息
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.warn('[Sentry] 搜索成员失败:', response.status);
      return [];
    }

    const members = await response.json();

    // 转换为统一格式，如果没有 name，使用邮箱 @ 前面的部分
    return members.map(member => {
      const displayName = member.user.name || (member.user.email ? member.user.email.split('@')[0] : member.user.email);
      return {
        id: member.user.id,
        name: displayName,
        email: member.user.email,
        username: member.user.username,
        avatarUrl: member.user.avatarUrl
      };
    });
  } catch (error) {
    console.error('[Sentry] 搜索成员时出错:', error);
    return [];
  }
}

/**
 * 填充表单选项
 */
async function populateFormOptions(config) {
  const reporterInput = document.getElementById('reporter-input');
  const reporterIdInput = document.getElementById('reporter-id');
  const reporterDropdown = document.getElementById('reporter-dropdown');
  const assigneeInput = document.getElementById('assignee-input');
  const assigneeIdInput = document.getElementById('assignee-id');
  const assigneeDropdown = document.getElementById('assignee-dropdown');

  // 初始化报告人自动完成（使用搜索接口）
  initAutocompleteWithSearch(reporterInput, reporterIdInput, reporterDropdown);
  
  // 初始化经办人自动完成（使用搜索接口）
  initAutocompleteWithSearch(assigneeInput, assigneeIdInput, assigneeDropdown);
  
  // 设置默认值为当前登录用户
  const currentUser = getCurrentUser();
  if (currentUser) {
    reporterInput.value = `${currentUser.name} (${currentUser.email})`;
    reporterIdInput.value = currentUser.id;
    assigneeInput.value = `${currentUser.name} (${currentUser.email})`;
    assigneeIdInput.value = currentUser.id;
  }
  
  // 加载后端字段选项（优先级、严重程度等动态字段）
  try {
    const result = await loadFieldOptions(config);
    if (result && result.data && result.data.options) {
      renderDynamicFields(result.data.options);
    }
  } catch (error) {
    console.warn('[Sentry] 动态字段加载失败:', error);
  }
}

/**
 * 渲染动态字段
 */
function renderDynamicFields(fieldOptions) {
  const container = document.getElementById('lark-sentry-dynamic-fields');
  if (!container) return;
  
  fieldOptions.forEach(field => {
    const fieldGroup = document.createElement('div');
    fieldGroup.className = 'lark-sentry-form-group';
    
    // 创建标签
    const label = document.createElement('label');
    label.className = 'lark-sentry-form-label';
    label.innerHTML = `${escapeHtml(field.label)} ${field.required ? '<span class="lark-sentry-form-required">*</span>' : ''}`;
    
    // 创建下拉框
    const select = document.createElement('select');
    select.name = field.key;
    select.className = 'lark-sentry-form-select';
    if (field.required) {
      select.required = true;
    }
    
    // 添加选项
    field.options.forEach(option => {
      const opt = document.createElement('option');
      opt.value = option.value;
      opt.textContent = option.label;
      select.appendChild(opt);
    });
    
    // 设置默认值
    if (field.default) {
      select.value = field.default;
    }
    
    fieldGroup.appendChild(label);
    fieldGroup.appendChild(select);
    container.appendChild(fieldGroup);
  });
}

/**
 * 初始化自动完成功能（使用搜索接口）
 */
function initAutocompleteWithSearch(input, hiddenInput, dropdown) {
  let selectedIndex = -1;
  let searchTimer = null;
  
  // 输入事件 - 实时搜索
  input.addEventListener('input', async (e) => {
    const searchText = e.target.value.trim();
    
    // 清除之前的定时器
    if (searchTimer) {
      clearTimeout(searchTimer);
    }
    
    // 如果输入为空，清空隐藏字段并关闭下拉框
    if (!searchText) {
      dropdown.style.display = 'none';
      hiddenInput.value = '';
      return;
    }
    
    // 显示加载状态
    dropdown.innerHTML = '<div class="lark-sentry-autocomplete-no-results">搜索中...</div>';
    dropdown.style.display = 'block';
    
    // 防抖：500ms 后执行搜索
    searchTimer = setTimeout(async () => {
      try {
        const members = await searchSentryMembers(searchText);
        
        if (members.length > 0) {
          renderDropdown(dropdown, members, (item) => {
            input.value = item.email ? `${item.name} (${item.email})` : item.name;
            hiddenInput.value = item.id;
            dropdown.style.display = 'none';
          });
          dropdown.style.display = 'block';
        } else {
          dropdown.innerHTML = '<div class="lark-sentry-autocomplete-no-results">未找到匹配的用户</div>';
          dropdown.style.display = 'block';
        }
        
        selectedIndex = -1;
      } catch (error) {
        console.error('[Sentry] 搜索用户失败:', error);
        dropdown.innerHTML = '<div class="lark-sentry-autocomplete-no-results">搜索失败，请重试</div>';
        dropdown.style.display = 'block';
      }
    }, 500);
  });
  
  // 键盘导航
  input.addEventListener('keydown', (e) => {
    const items = dropdown.querySelectorAll('.lark-sentry-autocomplete-item');
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
      updateSelection(items, selectedIndex);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, -1);
      updateSelection(items, selectedIndex);
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      items[selectedIndex].click();
    } else if (e.key === 'Escape') {
      dropdown.style.display = 'none';
      selectedIndex = -1;
    }
  });
  
  // 点击外部关闭下拉框
  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.style.display = 'none';
      selectedIndex = -1;
    }
  });
  
  // 聚焦时如果输入框有值，触发搜索
  input.addEventListener('focus', async () => {
    const searchText = input.value.trim();
    
    // 如果已经有选中的用户（有隐藏ID），不触发搜索
    if (hiddenInput.value) {
      return;
    }
    
    // 如果有输入内容，触发搜索
    if (searchText) {
      dropdown.innerHTML = '<div class="lark-sentry-autocomplete-no-results">搜索中...</div>';
      dropdown.style.display = 'block';
      
      try {
        const members = await searchSentryMembers(searchText);
        
        if (members.length > 0) {
          renderDropdown(dropdown, members, (item) => {
            input.value = item.email ? `${item.name} (${item.email})` : item.name;
            hiddenInput.value = item.id;
            dropdown.style.display = 'none';
          });
          dropdown.style.display = 'block';
        } else {
          dropdown.innerHTML = '<div class="lark-sentry-autocomplete-no-results">未找到匹配的用户</div>';
        }
      } catch (error) {
        console.error('[Sentry] 搜索用户失败:', error);
      }
    }
  });
}

/**
 * 渲染下拉框选项
 */
function renderDropdown(dropdown, items, onSelect) {
  dropdown.innerHTML = items.map((item, index) => `
    <div class="lark-sentry-autocomplete-item" data-index="${index}">
      <div class="lark-sentry-autocomplete-item-name">${escapeHtml(item.name)}</div>
      ${item.email ? `<div class="lark-sentry-autocomplete-item-email">${escapeHtml(item.email)}</div>` : ''}
    </div>
  `).join('');
  
  // 绑定点击事件
  dropdown.querySelectorAll('.lark-sentry-autocomplete-item').forEach((el, index) => {
    el.addEventListener('click', () => onSelect(items[index]));
  });
}

/**
 * 更新选中状态
 */
function updateSelection(items, index) {
  items.forEach((item, i) => {
    if (i === index) {
      item.style.backgroundColor = '#f3f4f6';
      item.scrollIntoView({ block: 'nearest' });
    } else {
      item.style.backgroundColor = '';
    }
  });
}

/**
 * 处理表单提交
 */
async function handleFormSubmit(form, config, issueInfo) {
  const formData = new FormData(form);
  
  // 提取 Sentry Issue ID
  const sentryIssueId = extractSentryIssueId();
  if (!sentryIssueId) {
    showFormError('无法从 URL 中提取 Sentry Issue ID');
    return;
  }
  
  // 获取报告人邮箱（优先使用表单中的报告人邮箱）
  const reporterInput = document.getElementById('reporter-input');
  let email = null;
  
  if (reporterInput && reporterInput.value) {
    // 从 "Name (email)" 格式中提取邮箱
    const match = reporterInput.value.match(/\(([^)]+)\)/);
    email = match ? match[1] : reporterInput.value;
  }
  
  // 如果没有报告人邮箱，使用当前用户邮箱
  if (!email) {
    const currentUser = getCurrentUser();
    email = currentUser ? currentUser.email : null;
  }
  
  if (!email) {
    showFormError('无法获取用户邮箱');
    return;
  }
  
  // 准备描述数据
  const description = formData.get('description');
  const descriptionData = convertToFeishuFormat(description, issueInfo.url);
  
  // 构建请求数据
  const data = {
    sentryIssueId: sentryIssueId,
    email: email,
    title: `[Sentry] ${formData.get('title')}`,
    description: descriptionData
  };
  
  // 收集所有选项值（动态字段 + 报告人 + 经办人）
  const options = {};
  
  // 1. 收集动态字段的值（例如：priority, severity）
  const dynamicFieldsContainer = document.getElementById('lark-sentry-dynamic-fields');
  if (dynamicFieldsContainer) {
    const selects = dynamicFieldsContainer.querySelectorAll('select');
    selects.forEach(select => {
      if (select.name && select.value) {
        options[select.name] = select.value;
      }
    });
  }
  
  // 将 options 添加到数据中
  if (Object.keys(options).length > 0) {
    data.options = options;
  }

  // 显示提交按钮加载状态
  const submitBtn = form.querySelector('[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.textContent = '创建中...';
  submitBtn.disabled = true;

  try {
    const url = `${config.sentryIssueCreateUrl}/ticket`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();

    // 检查业务状态
    if (!result.success) {
      const errorMsg = result.msg || result.message || '创建工单失败';
      throw new Error(errorMsg);
    }
    
    // 成功，关闭弹框并显示提示
    document.getElementById('lark-sentry-modal').remove();
    showToast('Issue 创建成功！');
    
    // 更新页面上的 Feishu Issue 显示
    updateFeishuIssueDisplay(result.data || result);
    
    // 如果返回了 Issue URL，可以打开
    // 返回格式: { code: 0, success: true, data: { mapping: {...}, url: "..." } }
    const issueUrl = result.data?.url || result.issueUrl;
    if (issueUrl) {
      window.open(issueUrl, '_blank');
    }
  } catch (error) {
    console.error('[Sentry] 创建 Issue 失败:', error);
    showFormError('创建 Issue 失败: ' + error.message);
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
}

/**
 * 更新页面上的 Feishu Issue 显示
 */
function updateFeishuIssueDisplay(issueData) {
  try {
    // 查找页面上的 Feishu Issue 元素
    const feishuItem = document.querySelector('.lark-sentry-feishu-issue-item');
    if (!feishuItem) {
      console.warn('[Sentry] 未找到 Feishu Issue 元素');
      return;
    }
    
    // 更新文字链接
    const textLink = feishuItem.querySelector('.lark-sentry-feishu-link');
    if (textLink) {
      const issueTitle = issueData.label 
        || (issueData.feishu_ticket_id ? `#${issueData.feishu_ticket_id}` : null)
        || (issueData.mapping?.feishu_ticket_id ? `#${issueData.mapping.feishu_ticket_id}` : null)
        || 'Feishu Issue';
      
      textLink.innerHTML = `<span class="lark-sentry-text">${escapeHtml(issueTitle)}</span>`;
      
      // 更新点击行为
      const issueUrl = issueData.url || issueData.issueUrl;
      if (issueUrl) {
        textLink.onclick = (e) => {
          e.preventDefault();
          window.open(issueUrl, '_blank');
        };
      }
    }
    
    // 移除加号按钮
    const addButton = feishuItem.querySelector('.lark-sentry-add-button');
    if (addButton) {
      addButton.remove();
    }
  } catch (error) {
    console.error('[Sentry] 更新 Feishu Issue 显示时出错:', error);
  }
}

/**
 * 显示表单错误
 */
function showFormError(message) {
  const errorDiv = document.getElementById('lark-sentry-form-error');
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
  }
}

/**
 * 显示 Toast 提示
 */
function showToast(message, type = 'success', duration = 3000) {
  // 创建 toast 元素
  const toast = document.createElement('div');
  toast.className = `lark-sentry-toast${type === 'error' ? ' error' : ''}`;
  
  // 添加图标
  const icon = type === 'success' ? '✓' : '✕';
  toast.innerHTML = `
    <span class="lark-sentry-toast-icon">${icon}</span>
    <span>${escapeHtml(message)}</span>
  `;
  
  document.body.appendChild(toast);
  
  // 自动移除
  setTimeout(() => {
    toast.style.animation = 'lark-sentry-toast-slide-out 0.3s ease-out';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, duration);
}

/**
 * 转换为飞书文档格式
 */
function convertToFeishuFormat(description, sentryUrl) {
  try {
    // 解析描述内容
    // 格式: Sentry Issue: [title|url]\n\n{code}\nexception\nstack trace\n{code}
    
    // 提取 Sentry Issue 标题和链接
    // 格式: Sentry Issue: [XXX|https://sentry.com/...]
    const issueLinkMatch = description.match(/Sentry Issue: \[([^\]]+)\|([^\]]+)\]/);
    const issueTitle = issueLinkMatch ? issueLinkMatch[1] : 'Sentry Issue';
    const issueUrl = issueLinkMatch ? issueLinkMatch[2] : sentryUrl;
    
    // 提取代码块内容（不包含 {code} 标记）
    const codeMatch = description.match(/\{code\}([\s\S]*?)\{code\}/);
    const codeContent = codeMatch ? codeMatch[1].trim() : '';
    
    // 生成随机 zone ID
    const codeZoneId = 'z' + Math.random().toString(36).substring(2, 12);
    const linkId = 'l' + Math.random().toString(36).substring(2, 12);
    
    // 1. doc_text: 纯文本（格式：Sentry Issue: TITLE\n\n代码内容）
    let doc_text = `Sentry Issue: ${issueTitle}`;
    if (codeContent) {
      doc_text += `\n\n${codeContent}`;
    }
    
    // 2. doc: 飞书结构化文档格式
    const doc = {
      "0": {
        "ops": [
          {"insert": "Sentry Issue: "},
          {
            "attributes": {
              "hyperlink": JSON.stringify({
                "href": issueUrl,
                "linkId": linkId
              })
            },
            "insert": issueTitle
          },
          {"insert": "\n"},
          {"insert": "*", "attributes": {"lmkr": "1"}},
          {"insert": "\n"},
          {
            "insert": " ",
            "attributes": {
              "type": "codeblock",
              "language": "Kotlin",
              "zoneId": codeZoneId,
              "parentZoneId": "0"
            }
          },
          {"insert": "\n"},
          {"insert": "\n"}
        ],
        "zoneId": "0",
        "zoneType": "Z"
      }
    };
    
    // 添加代码块内容
    if (codeContent) {
      const codeLines = codeContent.split('\n');
      const codeOps = [];
      
      codeLines.forEach((line, index) => {
        codeOps.push({"insert": line + "\n"});
      });
      
      doc[codeZoneId] = {
        "ops": codeOps,
        "zoneId": codeZoneId,
        "zoneType": "Z"
      };
    }
    
    // 3. doc_html: HTML 格式
    let doc_html = `<div class="ace-line" data-node="true" dir="auto"><span data-string="true" data-leaf="true">Sentry Issue: </span>`;
    doc_html += `<span class="outer-u-container demo-outer-link-container" data-inline-wrapper="true">`;
    doc_html += `<span data-leaf="true"><a style="cursor:pointer;" class="url" target="_blank" data-hyperlink-open="true" `;
    doc_html += `href="${escapeHtml(issueUrl)}" data-href="${escapeHtml(issueUrl)}" rel="noopener noreferrer" data-id="${linkId}">`;
    doc_html += `<span data-string="true">${escapeHtml(issueTitle)}</span></a></span></span>`;
    doc_html += `<span data-string="true" data-enter="true" data-leaf="true"></span></div>`;
    doc_html += `<div class="ace-line" data-node="true" dir="auto"><span data-string="true" data-enter="true" data-leaf="true"></span></div>`;
    
    // 添加代码块 HTML
    if (codeContent) {
      doc_html += `<div class="ace-line" data-node="true" dir="auto"><span data-leaf="true">`;
      doc_html += `<div class="zone-wrapper" contenteditable="false">`;
      doc_html += `<div class="editor-kit-code-block code-block" spellcheck="false">`;
      doc_html += `<div class="code-block-content"><div class="zone-container code-block-zone-container" data-zone-id="${codeZoneId}" contenteditable="true">`;
      
      const codeLines = codeContent.split('\n');
      codeLines.forEach((line, index) => {
        doc_html += `<div class="ace-line" data-node="true" dir="auto">`;
        doc_html += `<div class="code-line-wrapper" data-line-num="${index + 1}">`;
        doc_html += `<span data-string="true" data-leaf="true">${escapeHtml(line)}</span>`;
        doc_html += `<span data-string="true" data-enter="true" data-leaf="true"></span>`;
        doc_html += `</div></div>`;
      });
      
      doc_html += `</div></div></div></div></span>`;
      doc_html += `<span data-string="true" data-enter="true" class=" not-display-enter" data-leaf="true"></span></div>`;
    }
    
    doc_html += `<div class="ace-line" data-node="true" dir="auto"><span data-string="true" data-enter="true" data-leaf="true"></span></div>`;
    
    return {
      doc_text: doc_text,
      doc: JSON.stringify(doc),
      doc_html: doc_html
    };
  } catch (error) {
    console.error('[Sentry] 转换飞书格式时出错:', error);
    // 降级处理：返回简单格式
    return {
      doc_text: description,
      doc: description,
      doc_html: description
    };
  }
}

/**
 * HTML 转义
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
