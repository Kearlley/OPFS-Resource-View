// src/utils/base64.js

/**
 * 将 Uint8Array 转换为 Base64 字符串
 * @param {Uint8Array} bytes - 要转换的字节数组
 * @returns {string} Base64 编码的字符串
 */
export function toBase64(bytes) {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

/**
 * 将 Base64 字符串转换为 Uint8Array
 * @param {string} b64 - Base64 编码的字符串
 * @returns {Uint8Array} 解码后的字节数组
 */
export function fromBase64(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}
