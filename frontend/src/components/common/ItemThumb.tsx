import { Package } from 'lucide-react'

interface ItemThumbProps {
  itemId?: string | null
  picUrl?: string | null
  itemTitle?: string | null
  size?: number
  /** 是否包裹 a 标签，点击在新标签打开闲鱼商品页 */
  link?: boolean
}

/**
 * 商品缩略图组件：有图显示图片（点击新标签打开），无图显示占位 icon。
 * 用于：商品列表、自动发货规则、订单管理等页面，复用一致的样式。
 */
export function ItemThumb({ itemId, picUrl, itemTitle, size = 48, link = true }: ItemThumbProps) {
  const dim = `${size}px`
  const inner = picUrl ? (
    <img
      src={picUrl}
      alt={itemTitle || itemId || '商品图'}
      loading="lazy"
      style={{ width: dim, height: dim }}
      className="rounded-lg object-cover border border-slate-200 dark:border-slate-700 hover:scale-110 transition-transform"
      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
    />
  ) : (
    <div
      style={{ width: dim, height: dim }}
      className="rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-300"
    >
      <Package className="w-1/2 h-1/2" />
    </div>
  )

  if (link && itemId) {
    return (
      <a
        href={`https://www.goofish.com/item?id=${itemId}`}
        target="_blank"
        rel="noopener noreferrer"
        title={itemTitle || itemId || '查看商品'}
        className="inline-block shrink-0"
      >
        {inner}
      </a>
    )
  }
  return <span className="inline-block shrink-0" title={itemTitle || itemId || ''}>{inner}</span>
}
