import { getLarkConfig, getLarkConfigSync } from "./store";

export const LARK_DOMAIN_HOST = "https://project.feishu.cn";

// 检查是否满足条件（GitLab）
export async function checkCondition() {
  const config = await getLarkConfig();
  if (!config) return false;

  if (window.location.host.includes("github.com")) {
    return true;
  }

  const domains = config.domain.split(",");
  if (domains.length === 0) return false;
  return domains.some((domain) => {
    return window.location.host.includes(domain);
  })
    ? true
    : false;
}

// 检查是否满足条件（Sentry）
export function checkSentryCondition() {
  const config = getLarkConfigSync();
  if (!config || !config.sentryDomain) return false;
  const domains = config.sentryDomain.split(",").map(d => d.trim()).filter(d => d);
  if (domains.length === 0) return false;
  return domains.some((domain) => {
    return window.location.host.includes(domain);
  });
}
