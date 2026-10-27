import { describe, expect, it } from "vitest";
import { cleanText, parseUserAgent } from "./ua";
import { clientIpFromHeaders, isValidIp, locationFromHeaders, maskIp } from "./network";
import { envDeviceLimit, isUuid, loginErrorForStatus, sessionIdFromAccessToken } from "./config";

const UA = {
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  android: "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  windowsEdge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.2478.80",
  macSafari: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  yandex: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 YaBrowser/24.4.0.0 Safari/537.36",
  firefoxLinux: "Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0",
};

describe("parseUserAgent", () => {
  it("кең таралған құрылғыларды таниды", () => {
    expect(parseUserAgent(UA.iphone)).toEqual({ deviceName: "iPhone", browser: "Safari 17", os: "iOS 17" });
    expect(parseUserAgent(UA.android)).toEqual({ deviceName: "SM-S918B (телефон)", browser: "Chrome 124", os: "Android 14" });
    expect(parseUserAgent(UA.windowsEdge)).toEqual({ deviceName: "Windows компьютері", browser: "Edge 124", os: "Windows" });
    expect(parseUserAgent(UA.macSafari)).toEqual({ deviceName: "Mac компьютері", browser: "Safari 17", os: "macOS" });
    expect(parseUserAgent(UA.yandex).browser).toBe("Yandex 24");
    expect(parseUserAgent(UA.firefoxLinux)).toEqual({ deviceName: "Linux компьютері", browser: "Firefox 125", os: "Linux" });
  });
  it("бос немесе жалған UA-ға төзімді", () => {
    expect(parseUserAgent(null)).toEqual({ deviceName: "Белгісіз құрылғы", browser: "Белгісіз браузер", os: "Белгісіз ОЖ" });
    const evil = parseUserAgent('Mozilla/5.0 (Linux; Android 14; <script>alert(1)</script>) Chrome/1 Mobile');
    expect(evil.deviceName).not.toMatch(/[<>"']/);
  });
  it("cleanText HTML таңбаларын және ұзындықты шектейді", () => {
    expect(cleanText('<img src=x onerror="x">'.repeat(10), 20)).not.toMatch(/[<>"]/);
    expect(cleanText("a".repeat(500), 60)).toHaveLength(60);
  });
});

describe("IP және орналасу", () => {
  it("IP-ді жасырады", () => {
    expect(maskIp("192.168.0.107")).toBe("192.168.0.***");
    expect(maskIp("2001:db8:85a3:0:0:8a2e:370:7334")).toBe("2001:db8:85a3:****");
    expect(maskIp(null)).toBe("—");
  });
  it("header-лерден клиент IP-ін алады, жалған мәнді қабылдамайды", () => {
    expect(clientIpFromHeaders(new Headers({ "x-forwarded-for": "5.34.1.20, 10.0.0.1" }))).toBe("5.34.1.20");
    expect(clientIpFromHeaders(new Headers({ "x-forwarded-for": "not-an-ip", "x-real-ip": "::ffff:10.1.2.3" }))).toBe("10.1.2.3");
    expect(clientIpFromHeaders(new Headers({ "x-forwarded-for": "1.2.3.4'; drop table" }))).toBeNull();
    expect(isValidIp("999.1.1.1")).toBe(false);
  });
  it("Vercel header-лерінен шамамен орналасу", () => {
    expect(locationFromHeaders(new Headers({ "x-vercel-ip-city": "Almaty", "x-vercel-ip-country": "KZ" }))).toBe("Almaty, KZ");
    expect(locationFromHeaders(new Headers({ "x-vercel-ip-city": "%3Cscript%3E", "x-vercel-ip-country": "KZ" }))).toBe("script, KZ");
    expect(locationFromHeaders(new Headers())).toBeNull();
  });
});

describe("config", () => {
  it("env лимитін тексереді", () => {
    expect(envDeviceLimit("4")).toBe(4);
    expect(envDeviceLimit("")).toBeNull();
    expect(envDeviceLimit("0")).toBeNull();
    expect(envDeviceLimit("abc")).toBeNull();
    expect(envDeviceLimit("21")).toBeNull();
  });
  it("JWT-дан session_id алады", () => {
    const sid = "5b0a9c9e-0f7c-4c1a-9a1e-0a0a0a0a0a01";
    const token = `x.${Buffer.from(JSON.stringify({ sub: "u", session_id: sid })).toString("base64url")}.sig`;
    expect(sessionIdFromAccessToken(token)).toBe(sid);
    expect(sessionIdFromAccessToken("x.e30.sig")).toBeNull();
    expect(sessionIdFromAccessToken("garbage")).toBeNull();
    expect(isUuid(sid)).toBe(true);
  });
  it("күйлерді login хабарламасына айналдырады", () => {
    expect(loginErrorForStatus("limit_reached")).toBe("limit_reached");
    expect(loginErrorForStatus("mismatch")).toBe("device_revoked");
    expect(loginErrorForStatus("blocked")).toBe("blocked");
    expect(loginErrorForStatus("weird")).toBe("session");
  });
});
