import { useEffect, useState } from 'react'
import { CreditCard, RefreshCw, Plus, Trash2, X, Loader2, Power, PowerOff } from 'lucide-react'
import { getEntitlementPrices, upsertEntitlementPrice, deleteEntitlementPrice, type EntitlementPrice } from '@/api/admin'
import { useUIStore } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'
import { PageLoading } from '@/components/common/Loading'

export function Subscription() {
  const { addToast } = useUIStore()
  const { isAuthenticated, token, _hasHydrated } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<EntitlementPrice[]>([])
  const [editing, setEditing] = useState<EntitlementPrice | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    if (!_hasHydrated || !isAuthenticated || !token) return
    try {
      setLoading(true)
      const data = await getEntitlementPrices()
      setItems(data)
    } catch {
      addToast({ type: 'error', message: '加载会员档位失败' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!_hasHydrated || !isAuthenticated || !token) return
    load()
  }, [_hasHydrated, isAuthenticated, token])

  const openAdd = () => {
    setIsNew(true)
    setEditing({ key: '', name: '', days: 30, price: 0, enabled: true, sort_order: 0 })
  }

  const openEdit = (it: EntitlementPrice) => {
    setIsNew(false)
    setEditing({ ...it })
  }

  const close = () => {
    setEditing(null)
    setIsNew(false)
  }

  const save = async () => {
    if (!editing) return
    if (!editing.key.trim() || !editing.name.trim()) {
      addToast({ type: 'warning', message: 'key 与 名称 不能为空' })
      return
    }
    if (!Number.isFinite(editing.days) || editing.days <= 0) {
      addToast({ type: 'warning', message: '天数必须为正整数' })
      return
    }
    if (!Number.isFinite(editing.price) || editing.price < 0) {
      addToast({ type: 'warning', message: '价格必须 ≥ 0' })
      return
    }
    setSaving(true)
    try {
      await upsertEntitlementPrice(editing)
      addToast({ type: 'success', message: '已保存' })
      close()
      load()
    } catch {
      addToast({ type: 'error', message: '保存失败' })
    } finally {
      setSaving(false)
    }
  }

  const toggleEnabled = async (it: EntitlementPrice) => {
    try {
      await upsertEntitlementPrice({ ...it, enabled: !it.enabled })
      addToast({ type: 'success', message: it.enabled ? '已停用' : '已启用' })
      load()
    } catch {
      addToast({ type: 'error', message: '操作失败' })
    }
  }

  const remove = async (key: string) => {
    if (!confirm(`删除档位 ${key}？`)) return
    try {
      await deleteEntitlementPrice(key)
      addToast({ type: 'success', message: '已删除' })
      load()
    } catch {
      addToast({ type: 'error', message: '删除失败' })
    }
  }

  if (loading) return <PageLoading />

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">会员订阅配置</h1>
          <p className="page-description">配置周/月/年卡及自定义档位，定价与天数可由管理员维护</p>
        </div>
        <div className="flex gap-3">
          <button onClick={openAdd} className="btn-ios-primary">
            <Plus className="w-4 h-4" />新增档位
          </button>
          <button onClick={load} className="btn-ios-secondary">
            <RefreshCw className="w-4 h-4" />刷新
          </button>
        </div>
      </div>

      <div className="vben-card">
        <div className="vben-card-header flex items-center justify-between">
          <h2 className="vben-card-title">
            <CreditCard className="w-4 h-4" />
            档位列表
          </h2>
          <span className="badge-primary">{items.length} 个档位</span>
        </div>
        <div className="overflow-x-auto">
          <table className="table-ios">
            <thead>
              <tr>
                <th>Key</th>
                <th>名称</th>
                <th>天数</th>
                <th>价格 (¥)</th>
                <th>启用</th>
                <th>排序</th>
                <th>更新时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-500">暂无档位</td>
                </tr>
              ) : (
                items.map((it) => (
                  <tr key={it.key}>
                    <td className="font-mono text-blue-600 dark:text-blue-400">{it.key}</td>
                    <td>{it.name}</td>
                    <td>{it.days}</td>
                    <td className="text-amber-600 font-medium">¥{it.price}</td>
                    <td>
                      {it.enabled ? <span className="badge-success">启用</span> : <span className="badge-gray">停用</span>}
                    </td>
                    <td>{it.sort_order}</td>
                    <td className="text-xs text-slate-500">{it.updated_at || '-'}</td>
                    <td>
                      <div className="flex gap-1 flex-wrap">
                        <button onClick={() => toggleEnabled(it)} className="px-2 py-1 text-xs rounded hover:bg-slate-100 dark:hover:bg-slate-700" title={it.enabled ? '停用' : '启用'}>
                          {it.enabled ? <PowerOff className="w-3.5 h-3.5 text-amber-500" /> : <Power className="w-3.5 h-3.5 text-emerald-500" />}
                        </button>
                        <button onClick={() => openEdit(it)} className="px-2 py-1 text-xs rounded text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20">
                          编辑
                        </button>
                        <button onClick={() => remove(it.key)} className="px-2 py-1 text-xs rounded hover:bg-red-50 dark:hover:bg-red-900/20" title="删除">
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div className="modal-overlay">
          <div className="modal-content max-w-md">
            <div className="modal-header flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-500" />
                {isNew ? '新增档位' : '编辑档位'}
              </h2>
              <button onClick={close} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="modal-body space-y-3">
              <div>
                <label className="input-label">Key *（唯一标识，如 weekly/monthly/yearly）</label>
                <input
                  type="text"
                  value={editing.key}
                  onChange={(e) => setEditing({ ...editing, key: e.target.value })}
                  className="input-ios"
                  disabled={!isNew}
                  placeholder="weekly"
                />
              </div>
              <div>
                <label className="input-label">名称 *</label>
                <input
                  type="text"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="input-ios"
                  placeholder="周卡"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">天数 *</label>
                  <input
                    type="number"
                    value={editing.days}
                    onChange={(e) => setEditing({ ...editing, days: Number(e.target.value) })}
                    className="input-ios"
                    min={1}
                  />
                </div>
                <div>
                  <label className="input-label">价格 (¥) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editing.price}
                    onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })}
                    className="input-ios"
                    min={0}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">排序</label>
                  <input
                    type="number"
                    value={editing.sort_order}
                    onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })}
                    className="input-ios"
                  />
                </div>
                <div className="flex items-end">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editing.enabled}
                      onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })}
                    />
                    启用
                  </label>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" onClick={close} className="btn-ios-secondary" disabled={saving}>取消</button>
              <button onClick={save} className="btn-ios-primary" disabled={saving}>
                {saving ? (<><Loader2 className="w-4 h-4 animate-spin" />保存中...</>) : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
