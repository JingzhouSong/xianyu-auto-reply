import { AlertTriangle, ShieldAlert, Loader2 } from 'lucide-react'
import type { RiskControlAlert } from '@/api/riskControl'

interface RiskControlBadgeProps {
  alert?: RiskControlAlert | null
  /** 点击徽标时的处理（账号管理页传入打开弹窗的回调） */
  onClick?: (alert: RiskControlAlert) => void
}

/**
 * 在账号列表/仪表盘中显示风控告警徽标。
 * - processing：黄色"处理中"
 * - failed：红色"需人工"
 * - 其它/无：返回 null（不展示）
 */
export function RiskControlBadge({ alert, onClick }: RiskControlBadgeProps) {
  if (!alert) return null
  const isProcessing = alert.processing_status === 'processing'
  const cls = isProcessing
    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300/60'
    : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border-rose-300/60'
  const Icon = isProcessing ? Loader2 : ShieldAlert
  const label = isProcessing ? '风控处理中' : '需人工处理'

  return (
    <button
      type="button"
      onClick={() => onClick?.(alert)}
      title={alert.suggestion || alert.event_description || '账号风控'}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-medium ${cls} hover:opacity-80 transition`}
    >
      <Icon className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
      {label}
    </button>
  )
}

interface DashboardRiskControlPanelProps {
  alerts: RiskControlAlert[]
  /** 点击"立即处理"跳转账号管理页（默认 /accounts） */
  onResolve?: (alert: RiskControlAlert) => void
}

/** 仪表盘上方的风控告警卡片，多账号被风控时一并列出 */
export function DashboardRiskControlPanel({ alerts, onResolve }: DashboardRiskControlPanelProps) {
  if (!alerts || alerts.length === 0) return null
  return (
    <div className="rounded-lg border border-amber-300/70 dark:border-amber-700/70 bg-amber-50 dark:bg-amber-900/20 p-3 sm:p-4">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-300 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-amber-800 dark:text-amber-200 text-sm">
            检测到 {alerts.length} 个账号需要人工处理
          </div>
          <div className="mt-2 space-y-2">
            {alerts.map((a) => (
              <div
                key={a.cookie_id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-md bg-white/70 dark:bg-slate-900/40 px-3 py-2 border border-amber-200/50 dark:border-amber-800/50"
              >
                <div className="text-sm min-w-0">
                  <div className="font-mono text-blue-600 dark:text-blue-400 truncate">{a.cookie_id}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                    {a.event_description || '账号被风控'}
                  </div>
                  <div className="text-xs text-amber-700 dark:text-amber-300 mt-1">{a.suggestion}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`badge ${a.processing_status === 'processing' ? 'badge-warning' : 'badge-danger'}`}>
                    {a.processing_status === 'processing' ? '处理中' : '失败'}
                  </span>
                  <button
                    type="button"
                    onClick={() => onResolve?.(a)}
                    className="btn-ios-primary px-3 py-1 text-xs"
                  >
                    立即处理
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
