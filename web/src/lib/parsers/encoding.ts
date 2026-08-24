export function sniffEncoding(bytes: Uint8Array): "utf-8" | "gb18030" | "utf-16" {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return "utf-8";
  if (bytes.length >= 2 && ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff))) return "utf-16";
  try { new TextDecoder("utf-8", { fatal: true }).decode(bytes); return "utf-8"; }
  catch { return "gb18030"; }
}

export function decodeBytes(bytes: ArrayBuffer): { text: string; encoding: string } {
  const u8 = new Uint8Array(bytes);
  const encoding = sniffEncoding(u8);
  const text = new TextDecoder(
    encoding === "gb18030" ? "gb18030" : "utf-8"
  ).decode(u8);
  return { text: text.replace(/^﻿/, ""), encoding };
}
