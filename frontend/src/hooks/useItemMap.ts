import { useEffect, useState } from 'react'
import { getItems } from '@/api/items'
import type { Item } from '@/types'

export interface ItemBrief {
  pic_url?: string | null
  item_title?: string | null
}

/**
 * 加载所有商品并构建 item_id -> { pic_url, item_title } 映射，
 * 供"自动发货规则"、"订单管理"等页面渲染商品图与标题使用。
 *
 * @param enabled 鉴权 ready 时再请求；通常传 (_hasHydrated && isAuthenticated && !!token)
 */
export function useItemMap(enabled: boolean) {
  const [itemMap, setItemMap] = useState<Record<string, ItemBrief>>({})

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    ;(async () => {
      try {
        const result = await getItems()
        if (cancelled || !result.success) return
        const map: Record<string, ItemBrief> = {}
        for (const it of (result.data || []) as Item[]) {
          if (!it.item_id) continue
          // 同一 item_id 可能在不同账号下重复，保留第一个非空图片的版本
          const prev = map[String(it.item_id)]
          if (!prev || (!prev.pic_url && it.pic_url)) {
            map[String(it.item_id)] = {
              pic_url: it.pic_url || prev?.pic_url || null,
              item_title: it.item_title || it.title || prev?.item_title || null,
            }
          }
        }
        setItemMap(map)
      } catch {
        // ignore
      }
    })()
    return () => { cancelled = true }
  }, [enabled])

  return itemMap
}
