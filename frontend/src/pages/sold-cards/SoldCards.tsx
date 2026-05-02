import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { CreditCard, RefreshCw, RotateCcw, Search, Trash2, X } from 'lucide-react'
import {
  listCardConsumptions,
  restoreCardConsumption,
  deleteCardConsumption,
  type CardConsumption,
} from '@/api/cards'
import { getAccounts } from '@/api/accounts'
import type { Account } from '@/types'
import { formatAccountId } from '@/utils/accountLabel'
import { useUIStore } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'
import { PageLoading } from '@/components/common/Loading'

const PAGE_SIZE = 50

export function SoldCards() {
  const { addToast } = useUIStore()
  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') =>
    addToast({ message, type })
  const { _hasHydrated, isAuthenticated, token } = useAuthStore()

  const [items, setItems] = useState<CardConsumption[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [restoredFilter, setRestoredFilter] = useState<'all' | 'unrestored' | 'restored'>('all')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total])

  const load = async (toPage = page) => {
    setLoading(true)
    try {
      const restored =
        restoredFilter === 'restored' ? true : restoredFilter === 'unrestored' ? false : undefined
      const res = await listCardConsumptions({
        page: toPage,
        page_size: PAGE_SIZE,
        search: search || undefined,
        restored,
      })
      setItems(res.items || [])
      setTotal(res.total || 0)
      setPage(res.page || toPage)
    } catch (e: any) {
      showToast(e?.message || '加载失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!_hasHydrated || !isAuthenticated || !token) return
    load(1)
    // 加载账号备注映射，便于显示
    getAccounts()
      .then((data) => setAccounts(data || []))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_hasHydrated, isAuthenticated, token, restoredFilter, search])

  const handleRestore = async (row: CardConsumption) => {
    if (row.restored) {
      showToast('该记录已恢复', 'info')
      return
    }
    if (!confirm(`确认把这条卡券内容恢复到卡券「${row.card_name || row.card_id}」？`)) return
    setBusyId(row.id)
    try {
      const res = await restoreCardConsumption(row.id)
      if (res?.success) {
        showToast(res.message || '已恢复为未售卖', 'success')
        load(page)
      } else {
        showToast(res?.message || '恢复失败', 'error')
      }
    } catch (e: any) {
      showToast(e?.message || '恢复失败', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (row: CardConsumption) => {
    if (!confirm('确认删除这条消费记录？此操作不会修改卡券内容。')) return
    setBusyId(row.id)
    try {
      await deleteCardConsumption(row.id)
      showToast('已删除', 'success')
      load(page)
    } catch (e: any) {
      showToast(e?.message || '删除失败', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput.trim())
  }

  if (loading && items.length === 0) {
    return <PageLoading />
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-500" />
            已售卡券（消费记录）
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            自动发货时被消费的「批量数据」类型卡券会记录在这里。可以查看上下文，也可以一键恢复为未售卖状态。
          </p>
        </div>
        <button
          onClick={() => load(page)}
          className="btn-secondary flex items-center gap-1.5"
        >
          <RefreshCw className="w-4 h-4" />
          刷新
        </button>
      </div>

      {/* 过滤工具栏 */}
      <div className="card p-3 flex flex-wrap items-center gap-3">
        <form onSubmit={onSearchSubmit} className="flex items-center gap-2 flex-1 min-w-[260px]">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="搜索内容/订单号/买家ID/卡券名"
              className="input-ios pl-8 pr-8 w-full"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('')
                  setSearch('')
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button type="submit" className="btn-primary">搜索</button>
        </form>
        <div className="flex items-center gap-1 text-xs">
          {[
            { v: 'all', l: '全部' },
            { v: 'unrestored', l: '未恢复' },
            { v: 'restored', l: '已恢复' },
          ].map((opt) => (
            <button
              key={opt.v}
              onClick={() => setRestoredFilter(opt.v as any)}
              className={`px-3 py-1.5 rounded-md transition ${
                restoredFilter === opt.v
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {opt.l}
            </button>
          ))}
        </div>
        <span className="badge-primary">{total} 条</span>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="table-ios min-w-[1300px]">
            <thead>
              <tr>
                <th className="whitespace-nowrap">消费时间</th>
                <th className="whitespace-nowrap">卡券</th>
                <th>已发出内容</th>
                <th className="whitespace-nowrap">售价</th>
                <th className="whitespace-nowrap">成本</th>
                <th className="whitespace-nowrap">利润</th>
                <th className="whitespace-nowrap">订单号</th>
                <th className="whitespace-nowrap">买家ID</th>
                <th className="whitespace-nowrap">商品ID</th>
                <th className="whitespace-nowrap">账号</th>
                <th className="whitespace-nowrap">状态</th>
                <th className="whitespace-nowrap sticky right-0 bg-slate-50 dark:bg-slate-800">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={12}>
                    <div className="empty-state py-8">
                      <CreditCard className="empty-state-icon" />
                      <p className="text-gray-500">暂无已售卡券记录</p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr key={row.id}>
                    <td className="text-xs text-slate-500 whitespace-nowrap">
                      {row.consumed_at ? new Date(row.consumed_at).toLocaleString() : '-'}
                    </td>
                    <td className="whitespace-nowrap">
                      <span className="font-medium">{row.card_name || `#${row.card_id}`}</span>
                      <span className="text-xs text-slate-400 ml-1">#{row.card_id}</span>
                    </td>
                    <td className="max-w-[320px]">
                      <div
                        className="text-sm font-mono break-all whitespace-pre-wrap line-clamp-3"
                        title={row.content}
                      >
                        {row.content}
                      </div>
                    </td>
                    <td className="text-xs whitespace-nowrap">
                      {row.sold_price ? <span className="text-emerald-600 dark:text-emerald-400">¥{Number(row.sold_price).toFixed(2)}</span> : <span className="text-slate-400">-</span>}
                    </td>
                    <td className="text-xs whitespace-nowrap">
                      {row.cost_price != null ? <span className="text-amber-600 dark:text-amber-400">¥{Number(row.cost_price).toFixed(2)}</span> : <span className="text-slate-400">-</span>}
                    </td>
                    <td className="text-xs whitespace-nowrap">
                      {(row.sold_price && row.cost_price != null) ? (
                        (() => {
                          const profit = Number(row.sold_price) - Number(row.cost_price)
                          const cls = profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                          return <span className={cls}>{profit >= 0 ? '+' : ''}¥{profit.toFixed(2)}</span>
                        })()
                      ) : <span className="text-slate-400">-</span>}
                    </td>
                    <td className="text-xs text-slate-500 whitespace-nowrap">{row.order_id || '-'}</td>
                    <td className="text-xs text-slate-500 whitespace-nowrap">{row.buyer_id || '-'}</td>
                    <td className="text-xs text-slate-500 whitespace-nowrap">{row.item_id || '-'}</td>
                    <td className="text-xs text-blue-600 dark:text-blue-400 whitespace-nowrap">
                      {row.cookie_id ? formatAccountId(row.cookie_id, accounts) : '-'}
                    </td>
                    <td className="whitespace-nowrap">
                      {row.restored ? (
                        <span className="badge-success">已恢复</span>
                      ) : (
                        <span className="badge-warning">已售卖</span>
                      )}
                    </td>
                    <td className="sticky right-0 bg-white dark:bg-slate-900">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRestore(row)}
                          disabled={row.restored || busyId === row.id}
                          className="text-blue-600 hover:text-blue-700 disabled:text-slate-300 disabled:cursor-not-allowed flex items-center gap-1 text-sm"
                          title="把这条卡券内容退回卡券，标记为未售卖"
                        >
                          <RotateCcw className="w-4 h-4" />
                          恢复
                        </button>
                        <button
                          onClick={() => handleDelete(row)}
                          disabled={busyId === row.id}
                          className="text-red-500 hover:text-red-600 disabled:text-slate-300 disabled:cursor-not-allowed flex items-center gap-1 text-sm"
                          title="删除这条记录（不影响卡券内容）"
                        >
                          <Trash2 className="w-4 h-4" />
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-3 border-t border-slate-200 dark:border-slate-700">
            <span className="text-xs text-slate-500">
              第 {page} / {totalPages} 页
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => load(page - 1)}
                disabled={page <= 1 || loading}
                className="btn-secondary disabled:opacity-50"
              >
                上一页
              </button>
              <button
                onClick={() => load(page + 1)}
                disabled={page >= totalPages || loading}
                className="btn-secondary disabled:opacity-50"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}
