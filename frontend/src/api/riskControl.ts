import { get } from '@/utils/request'

export interface RiskControlAlert {
  cookie_id: string
  event_type: string
  event_description: string
  processing_status: 'processing' | 'failed' | 'success' | string
  processing_result?: string
  error_message?: string
  last_event_at?: string
  updated_at?: string
  /** 后端给出的快速修复建议文案 */
  suggestion: string
  /** 推荐的快速操作：qrcode | manual_verify | password */
  action: 'qrcode' | 'manual_verify' | 'password' | string
}

export interface ActiveRiskControlResp {
  success: boolean
  data: RiskControlAlert[]
  count: number
  message?: string
}

/** 获取当前用户名下账号最近 24 小时内未解除的风控告警 */
export const getActiveRiskControlAlerts = async (): Promise<RiskControlAlert[]> => {
  try {
    const res = await get<ActiveRiskControlResp>('/risk-control/active')
    return res?.data || []
  } catch {
    return []
  }
}
