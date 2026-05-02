import type { Account } from '@/types'

/** 把 cookie_id 渲染成 "ID (备注)"；找不到备注就只返回 ID */
export function formatAccountId(cookieId?: string | null, accounts: Account[] = []): string {
  if (!cookieId) return '-'
  const acc = accounts.find(a => a.id === cookieId)
  if (acc?.note) return `${cookieId} (${acc.note})`
  return cookieId
}

/** 构建 id -> note 映射，便于在大列表里 O(1) 查找 */
export function buildAccountNoteMap(accounts: Account[]): Record<string, string> {
  const m: Record<string, string> = {}
  for (const a of accounts) {
    if (a?.id) m[a.id] = a.note || ''
  }
  return m
}
