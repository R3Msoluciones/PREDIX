const isDev = process.env.NODE_ENV !== "production";

export const logger = {
  info: (msg: string, ctx?: unknown) => {
    if (isDev) console.info(`[INFO]  ${msg}`, ctx !== undefined ? ctx : "");
  },
  warn: (msg: string, ctx?: unknown) => {
    console.warn(`[WARN]  ${msg}`, ctx !== undefined ? ctx : "");
  },
  error: (msg: string, ctx?: unknown) => {
    console.error(`[ERROR] ${msg}`, ctx !== undefined ? ctx : "");
  },
  debug: (msg: string, ctx?: unknown) => {
    if (isDev) console.debug(`[DEBUG] ${msg}`, ctx !== undefined ? ctx : "");
  },
};
