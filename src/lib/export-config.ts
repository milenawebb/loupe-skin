/** Change only this origin when the demo moves to a custom domain. */
export const DEMO_BASE_URL = "https://loupevideo.com";
export const SITE_DESCRIPTION = "Every frame at once. Loupe turns a video into a contact sheet you can read at a glance, click into and drag across. A Video.js v10 skin by Milena Webb.";

export function sourcePageUrl(path: string) {
  return new URL(path, DEMO_BASE_URL).href;
}

export function framePageUrl(pageUrl: string, seconds: number) {
  const url = new URL(pageUrl);
  url.searchParams.set("t", String(seconds));
  return url.href;
}

export function parseStartTime(value: string | null) {
  if (value === null || value.trim() === "") return undefined;
  const time = Number(value);
  return Number.isFinite(time) && time >= 0 ? time : undefined;
}