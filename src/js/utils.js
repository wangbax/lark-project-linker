import { getLarkConfig, getLarkConfigSync } from "./store";

export const LARK_DOMAIN_OPTIONS = {
  feishu: "https://project.feishu.cn",
  larksuite: "https://project.larksuite.com",
};

export const DEFAULT_LARK_DOMAIN = LARK_DOMAIN_OPTIONS.larksuite;

export function getLarkDomainHost(config) {
  return config?.larkDomain || DEFAULT_LARK_DOMAIN;
}

// 检查是否满足条件（GitLab）
export async function checkCondition() {
  const config = await getLarkConfig();
  if (!config) return;
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
