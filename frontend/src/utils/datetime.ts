/**
 * 数据库中的时间字符串（如 `2026-05-03 03:04:31`）来自 SQLite 的 `CURRENT_TIMESTAMP`，
 * 其**实际含义是 UTC**，但字符串里没有 `Z` 后缀。`new Date(str)` 会按浏览器本地时区解析，
 * 导致东八区用户看到的时间比实际早 8 小时。
 *
 * 统一通过此工具格式化，保证：
 *   - 无后缀的 `YYYY-MM-DD HH:mm:ss` 当作 UTC 来解析
 *   - 带 `Z` 或 `+HH:mm` 时区信息的按原样解析
 *   - 最终以用户本地时区（东八区浏览器=北京时间）展示
 */

/** 把"无时区后缀的 SQLite 时间字符串"安全解析为 Date（视为 UTC） */
export function parseDbDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const s = String(value).trim()
  if (!s) return null
  // 已带时区信息：Z / +08:00 / -05:00 等，直接交给 Date 解析
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) {
    const d = new Date(s)
    return isNaN(d.getTime()) ? null : d
  }
  // SQLite 默认格式 "YYYY-MM-DD HH:mm:ss[.fff]"：视为 UTC，补上 Z
  // 同时兼容 "YYYY-MM-DDTHH:mm:ss" 的 ISO 风格
  const iso = s.includes('T') ? s + 'Z' : s.replace(' ', 'T') + 'Z'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? null : d
}

/** 数据库时间 → 本地（东八区浏览器=北京时间）可读字符串 */
export function formatDbDateTime(
  value: string | null | undefined,
  fallback: string = '-',
): string {
  const d = parseDbDate(value)
  return d ? d.toLocaleString('zh-CN') : fallback
}
