/**
 * User-Agent-тен құрылғы туралы шамамен ақпарат.
 * UA-ға толық сенуге болмайды (оны кез келген адам өзгерте алады) — тек көрсету үшін.
 * Нәтиже қысқартылып, басқару таңбаларынан тазаланады; React оны мәтін ретінде шығарады (HTML емес).
 */

export interface DeviceInfo {
  deviceName: string;
  browser: string;
  os: string;
}

/** Басқару таңбаларын, < > тырнақшаларын алып тастап, ұзындығын шектейді */
export function cleanText(value: string | null | undefined, max = 60): string {
  return (value ?? "")
    .replace(/[\u0000-\u001f\u007f<>"'`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function version(ua: string, re: RegExp) {
  const m = ua.match(re);
  return m ? m[1].split(".")[0] : "";
}

export function parseUserAgent(raw: string | null | undefined): DeviceInfo {
  const ua = (raw ?? "").slice(0, 512);

  let os = "Белгісіз ОЖ";
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && /Mobile\//.test(ua))) os = `iPadOS ${version(ua, /OS (\d+[_.]\d+)/).replace("_", ".")}`.trim();
  else if (/iPhone|iPod/.test(ua)) os = `iOS ${version(ua, /OS (\d+)[_.]/)}`.trim();
  else if (/Android/.test(ua)) os = `Android ${version(ua, /Android (\d+(?:\.\d+)?)/)}`.trim();
  else if (/Windows NT/.test(ua)) os = "Windows";
  else if (/CrOS/.test(ua)) os = "ChromeOS";
  else if (/Mac OS X|Macintosh/.test(ua)) os = "macOS";
  else if (/Linux/.test(ua)) os = "Linux";

  let browser = "Белгісіз браузер";
  if (/YaBrowser\//.test(ua)) browser = `Yandex ${version(ua, /YaBrowser\/(\d+)/)}`;
  else if (/SamsungBrowser\//.test(ua)) browser = `Samsung Internet ${version(ua, /SamsungBrowser\/(\d+)/)}`;
  else if (/Edg(A|iOS)?\//.test(ua)) browser = `Edge ${version(ua, /Edg(?:A|iOS)?\/(\d+)/)}`;
  else if (/OPR\/|Opera/.test(ua)) browser = `Opera ${version(ua, /OPR\/(\d+)/)}`;
  else if (/Firefox\/|FxiOS\//.test(ua)) browser = `Firefox ${version(ua, /(?:Firefox|FxiOS)\/(\d+)/)}`;
  else if (/CriOS\//.test(ua)) browser = `Chrome ${version(ua, /CriOS\/(\d+)/)}`;
  else if (/Chrome\//.test(ua)) browser = `Chrome ${version(ua, /Chrome\/(\d+)/)}`;
  else if (/Safari\//.test(ua) && /Version\//.test(ua)) browser = `Safari ${version(ua, /Version\/(\d+)/)}`;

  let deviceName: string;
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && /Mobile\//.test(ua))) deviceName = "iPad";
  else if (/iPhone/.test(ua)) deviceName = "iPhone";
  else if (/Android/.test(ua)) {
    // «Android 14; SM-S918B Build/...» → SM-S918B
    const model = ua.match(/Android [\d.]+; (?:[a-z]{2}-[a-z]{2}; )?([^;)]+?)(?: Build|\))/i)?.[1];
    const kind = /Mobile/.test(ua) ? "телефон" : "планшет";
    deviceName = model && !/^K$|wv/i.test(model) ? `${model} (${kind})` : `Android ${kind}`;
  } else if (os === "Windows") deviceName = "Windows компьютері";
  else if (os === "macOS") deviceName = "Mac компьютері";
  else if (os === "ChromeOS") deviceName = "Chromebook";
  else if (os === "Linux") deviceName = "Linux компьютері";
  else deviceName = "Белгісіз құрылғы";

  return { deviceName: cleanText(deviceName, 80), browser: cleanText(browser.trim(), 60), os: cleanText(os, 60) };
}
