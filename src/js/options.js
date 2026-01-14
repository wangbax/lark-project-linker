import { getLarkConfig, setLarkConfig, isDev } from "./store";

function main() {
  if (isDev) {
    document.getElementById("dev-inject").style.display = "block";
    // Dev inject 按钮事件
    const devInjectBtn = document.getElementById("dev-inject-btn");
    if (devInjectBtn) {
      devInjectBtn.addEventListener("click", function() {
        const s = document.createElement('script');
        s.src = 'http://localhost:3000/index.js';
        document.body.appendChild(s);
      });
    }
  }

  const errMsgDom = document.getElementById("error");
  const successMsgDom = document.getElementById("success");
  const loadingDom = document.getElementById("loading");
  const form = document.getElementById("form");
  let formData = new FormData();
  document
    .getElementById("button")
    .addEventListener("click", async function () {
      formData = new FormData(form);
      loadingDom.style.display = "block";
      errMsgDom.style.display = "none";
      // 获取用户输入的内容
      const app = formData.get("app");
      const domain = formData.get("domain");
      const prefixes = formData.get("prefixes");
      const sentryDomain = formData.get("sentryDomain");
      const sentryIssueCreateUrl = formData.get("sentryIssueCreateUrl");
      const data = { app, domain, prefixes, sentryDomain, sentryIssueCreateUrl };
      if (!data.app) {
        return toggleError("请输入飞书命名空间");
      }
      if (!data.domain) {
        return toggleError("请输入 GitLab/GitHub 域名地址");
      }
      if (app && !/^[a-zA-Z0-9]+(,[a-zA-Z0-9]+)*$/.test(app.trim())) {
        return toggleError("飞书命名空间格式不正确，请使用字母、数字，多个命名空间用逗号分隔");
      }
      if (prefixes && !/^[a-zA-Z0-9]+(,[a-zA-Z0-9]+)*$/.test(prefixes.trim())) {
        return toggleError("项目 ID 前缀格式不正确，请使用字母、数字，多个前缀用逗号分隔");
      }
      toggleError();
      await setLarkConfig(data);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      successMsgDom.style.display = "block";
      loadingDom.style.display = "none";
    });
  function toggleError(msg) {
    if (msg) {
      errMsgDom.innerText = msg;
      errMsgDom.style.display = "block";
      loadingDom.style.display = "none";
      successMsgDom.style.display = "none";
    } else {
      errMsgDom.style.display = "none";
    }
  }
  getLarkConfig().then((config) => {
    updateFormData(config);
  });

  function updateFormData(data) {
    if (!data) return;
    Object.keys(data).forEach((key) => {
      const target = form.querySelector(`[name="${key}"]`);
      if (target) {
        target.value = data[key];
      }
    });
  }

  // 折叠/展开功能
  function initCollapsible() {
    const header = document.getElementById('sentry-config-header');
    const content = document.getElementById('sentry-config-content');
    const arrow = document.getElementById('sentry-config-arrow');
    
    if (header && content && arrow) {
      header.addEventListener('click', function() {
        if (content.classList.contains('expanded')) {
          content.classList.remove('expanded');
          arrow.classList.add('collapsed');
        } else {
          content.classList.add('expanded');
          arrow.classList.remove('collapsed');
        }
      });
    }
  }

  initCollapsible();
}

document.addEventListener("DOMContentLoaded", main);
