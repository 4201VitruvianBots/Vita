import crypto from "node:crypto";
import { getConfig } from "./config.js";

const MAX_AGE_MS = 8 * 60 * 60 * 1000;

function getCookieHeader(req) {
  if (typeof req.headers?.get === "function") {
    return req.headers.get("cookie") || "";
  }
  return req.headers?.cookie || "";
}

function cookieAttributes() {
  const { siteUrl, apiUrl } = getConfig();
  const crossOrigin = apiUrl.replace(/\/$/, "") !== siteUrl.replace(/\/$/, "");
  const secure = process.env.NODE_ENV === "production" || crossOrigin;
  const sameSite = crossOrigin ? "None" : "Lax";
  const secureFlag = secure ? "; Secure" : "";
  return { sameSite, secureFlag };
}

function sign(payload, secret) {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

function encodeSession(data) {
  return Buffer.from(JSON.stringify(data), "utf8").toString("base64url");
}

function decodeSession(value) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
}

export function createSessionCookie({ login, accessToken }) {
  const { sessionSecret, cookieName } = getConfig();
  const payload = encodeSession({
    login,
    accessToken,
    exp: Date.now() + MAX_AGE_MS,
  });
  const signature = sign(payload, sessionSecret);
  const value = `${payload}.${signature}`;

  const { sameSite, secureFlag } = cookieAttributes();
  return {
    name: cookieName,
    header: `${cookieName}=${value}; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=${MAX_AGE_MS / 1000}${secureFlag}`,
    value,
  };
}

export function clearSessionCookie() {
  const { cookieName } = getConfig();
  const { sameSite, secureFlag } = cookieAttributes();
  return `${cookieName}=; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=0${secureFlag}`;
}

export function readSession(req) {
  const { sessionSecret, cookieName } = getConfig();
  const raw = getCookieHeader(req);
  const match = raw.match(new RegExp(`(?:^|;\\s*)${cookieName}=([^;]+)`));
  if (!match) return null;

  const [payload, signature] = match[1].split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload, sessionSecret);
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const data = decodeSession(payload);
    if (!data.exp || Date.now() > data.exp) return null;
    if (!data.login || !data.accessToken) return null;
    return data;
  } catch {
    return null;
  }
}

export function createOAuthState() {
  const { sessionSecret } = getConfig();
  const payload = encodeSession({
    nonce: crypto.randomBytes(16).toString("hex"),
    exp: Date.now() + 10 * 60 * 1000,
  });
  return `${payload}.${sign(payload, sessionSecret)}`;
}

export function verifyOAuthState(state) {
  const { sessionSecret } = getConfig();
  if (!state) return false;

  const [payload, signature] = state.split(".");
  if (!payload || !signature) return false;

  const expected = sign(payload, sessionSecret);
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return false;
  }

  try {
    const data = decodeSession(payload);
    return Boolean(data.nonce && data.exp && Date.now() <= data.exp);
  } catch {
    return false;
  }
}
