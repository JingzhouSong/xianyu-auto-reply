import { useState, useEffect } from 'react'
import { Users as UsersIcon, RefreshCw, Plus, Trash2, CalendarClock, Infinity as InfinityIcon } from 'lucide-react'
import { getUsers, deleteUser, extendUserExpiry, setUserExpiry } from '@/api/admin'
import { useUIStore } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'
import { PageLoading } from '@/components/common/Loading'
import type { User } from '@/types'

function formatExpiry(ts?: number | null): { text: string; expired: boolean; permanent: boolean } {
  if (ts === null || ts === undefined) return { text: '永久', expired: false, permanent: true }
  const d = new Date(ts * 1000)
  const expired = ts * 1000 <= Date.now()
  return { text: d.toLocaleString(), expired, permanent: false }
}

export function Users() {
  const { addToast } = useUIStore()
  const { isAuthenticated, token, _hasHydrated } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<User[]>([])
  const [expiryUser, setExpiryUser] = useState<User | null>(null)
  const [expiryDate, setExpiryDate] = useState('')
  const [expirySaving, setExpirySaving] = useState(false)

  const loadUsers = async () => {
    if (!_hasHydrated || !isAuthenticated || !token) return
    try {
      setLoading(true)
      const result = await getUsers()
      if (result.success) {
        setUsers(result.data || [])
      }
    } catch {
      addToast({ type: 'error', message: '加载用户列表失败' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!_hasHydrated || !isAuthenticated || !token) return
    loadUsers()
  }, [_hasHydrated, isAuthenticated, token])

  // TODO: 后端暂未实现 PUT /admin/users/{user_id} 接口
  const handleNotImplemented = (action: string) => {
    addToast({ type: 'warning', message: `${action}功能后端暂未实现` })
  }

  const handleDelete = async (userId: number) => {
    if (!confirm('确定要删除这个用户吗？此操作不可恢复！')) return
    try {
      await deleteUser(userId)
      addToast({ type: 'success', message: '删除成功' })
      loadUsers()
    } catch {
      addToast({ type: 'error', message: '删除失败' })
    }
  }

  const handleExtend = async (user: User, days: number) => {
    try {
      await extendUserExpiry(user.user_id, days)
      addToast({ type: 'success', message: `已为 ${user.username} 续期 ${days} 天` })
      loadUsers()
    } catch {
      addToast({ type: 'error', message: '续期失败' })
    }
  }

  const handleSetPermanent = async (user: User) => {
    if (!confirm(`将 ${user.username} 设为永久不过期？`)) return
    try {
      await setUserExpiry(user.user_id, null)
      addToast({ type: 'success', message: '已设为永久' })
      loadUsers()
    } catch {
      addToast({ type: 'error', message: '操作失败' })
    }
  }

  const openSetExpiry = (user: User) => {
    setExpiryUser(user)
    if (user.expires_at) {
      const d = new Date(user.expires_at * 1000)
      // datetime-local 需要 yyyy-MM-ddThh:mm 格式
      const pad = (n: number) => String(n).padStart(2, '0')
      setExpiryDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`)
    } else {
      setExpiryDate('')
    }
  }

  const handleSaveExpiry = async () => {
    if (!expiryUser) return
    if (!expiryDate) {
      addToast({ type: 'warning', message: '请选择到期时间' })
      return
    }
    const ts = new Date(expiryDate).getTime() / 1000
    if (!Number.isFinite(ts)) {
      addToast({ type: 'error', message: '到期时间无效' })
      return
    }
    setExpirySaving(true)
    try {
      await setUserExpiry(expiryUser.user_id, ts)
      addToast({ type: 'success', message: '到期时间已更新' })
      setExpiryUser(null)
      loadUsers()
    } catch {
      addToast({ type: 'error', message: '保存失败' })
    } finally {
      setExpirySaving(false)
    }
  }

  if (loading) {
    return <PageLoading />
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">用户管理</h1>
          <p className="page-description">管理系统用户账号</p>
        </div>
        <div className="flex gap-3">
          {/* TODO: 后端暂未实现 POST /admin/users 接口 */}
          <button onClick={() => handleNotImplemented('添加用户')} className="btn-ios-primary">
            <Plus className="w-4 h-4" />
            添加用户
          </button>
          <button onClick={loadUsers} className="btn-ios-secondary">
            <RefreshCw className="w-4 h-4" />
            刷新
          </button>
        </div>
      </div>

      {/* Users List */}
      <div className="vben-card">
        <div className="vben-card-header flex items-center justify-between">
          <h2 className="vben-card-title">
            <UsersIcon className="w-4 h-4" />
            用户列表
          </h2>
          <span className="badge-primary">{users.length} 个用户</span>
        </div>
        <div className="overflow-x-auto">
          <table className="table-ios">
            <thead>
              <tr>
                <th>ID</th>
                <th>用户名</th>
                <th>邮箱</th>
                <th>注册IP</th>
                <th>到期时间</th>
                <th>角色</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <UsersIcon className="w-12 h-12 text-slate-300 dark:text-slate-600" />
                      <p>暂无用户数据</p>
                    </div>
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const exp = formatExpiry(user.expires_at)
                  return (
                    <tr key={user.user_id}>
                      <td className="font-medium">{user.user_id}</td>
                      <td className="font-medium text-blue-600 dark:text-blue-400">{user.username}</td>
                      <td className="text-slate-500 dark:text-slate-400">{user.email || '-'}</td>
                      <td className="text-xs text-slate-500 dark:text-slate-400 font-mono">{user.register_ip || '-'}</td>
                      <td>
                        {exp.permanent ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs">
                            <InfinityIcon className="w-3.5 h-3.5" />永久
                          </span>
                        ) : (
                          <span className={`inline-flex items-center gap-1 text-xs ${exp.expired ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'}`}>
                            <CalendarClock className="w-3.5 h-3.5" />
                            {exp.text}{exp.expired ? '（已到期）' : ''}
                          </span>
                        )}
                      </td>
                      <td>
                        {user.is_admin ? (
                          <span className="badge-warning">管理员</span>
                        ) : (
                          <span className="badge-gray">普通用户</span>
                        )}
                      </td>
                      <td>
                        <div className="flex gap-1 flex-wrap">
                          {!user.is_admin && (
                            <>
                              <button onClick={() => handleExtend(user, 7)} className="px-2 py-1 text-xs rounded bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300" title="续 7 天">+7天</button>
                              <button onClick={() => handleExtend(user, 30)} className="px-2 py-1 text-xs rounded bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300" title="续 30 天">+30天</button>
                              <button onClick={() => handleExtend(user, 365)} className="px-2 py-1 text-xs rounded bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300" title="续 365 天">+365天</button>
                              <button onClick={() => openSetExpiry(user)} className="px-2 py-1 text-xs rounded bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200" title="设置具体到期时间">设到期</button>
                              <button onClick={() => handleSetPermanent(user)} className="px-2 py-1 text-xs rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300" title="设为永久">永久</button>
                            </>
                          )}
                          <button
                            onClick={() => handleDelete(user.user_id)}
                            className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            title="删除"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 提示信息 */}
      <div className="vben-card">
        <div className="vben-card-body">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            提示：注册时同 IP 首次注册自动赠送 1 天体验，到期后无法登录，可由管理员续期或设置永久。
          </p>
        </div>
      </div>

      {/* 设置到期时间弹窗 */}
      {expiryUser && (
        <div className="modal-overlay">
          <div className="modal-content max-w-sm">
            <div className="modal-header flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-blue-500" />
                设置到期时间
              </h2>
              <button onClick={() => setExpiryUser(null)} className="p-1 hover:bg-gray-100 rounded-lg">
                ×
              </button>
            </div>
            <div className="modal-body space-y-3">
              <div className="text-sm text-slate-600 dark:text-slate-300">
                用户：<span className="font-medium">{expiryUser.username}</span>
              </div>
              <div>
                <label className="input-label">到期时间</label>
                <input
                  type="datetime-local"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="input-ios"
                />
                <p className="text-xs text-gray-500 mt-1">到期后用户将无法登录，管理员可重新设置或选择永久</p>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" onClick={() => setExpiryUser(null)} className="btn-ios-secondary" disabled={expirySaving}>
                取消
              </button>
              <button onClick={handleSaveExpiry} className="btn-ios-primary" disabled={expirySaving}>
                {expirySaving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
