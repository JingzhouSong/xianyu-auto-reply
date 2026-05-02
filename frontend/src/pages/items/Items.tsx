import { useEffect, useState, useRef } from 'react'
import { CheckSquare, Download, Edit2, ExternalLink, Loader2, Package, RefreshCw, Search, Square, Trash2, X, MessageSquare, ImagePlus, Truck } from 'lucide-react'
import { batchDeleteItems, deleteItem, fetchAllItemsFromAccount, getItems, updateItem, updateItemMultiQuantityDelivery, updateItemMultiSpec, getItemDefaultReply, saveItemDefaultReply, deleteItemDefaultReply, batchSaveItemDefaultReply, batchDeleteItemDefaultReply, uploadItemDefaultReplyImage } from '@/api/items'
import { getAccounts } from '@/api/accounts'
import { formatAccountId } from '@/utils/accountLabel'
import { getDeliveryRules, addDeliveryRule, deleteDeliveryRule } from '@/api/delivery'
import { getCards, createCard, type CardData } from '@/api/cards'
import { post } from '@/utils/request'
import type { DeliveryRule } from '@/types'
import { useUIStore } from '@/store/uiStore'
import { PageLoading } from '@/components/common/Loading'
import { useAuthStore } from '@/store/authStore'
import { Select } from '@/components/common/Select'
import type { Account, Item } from '@/types'

export function Items() {
  const { addToast } = useUIStore()
  const { isAuthenticated, token, _hasHydrated } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<Item[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  // 商品ID -> 发货规则列表
  const [deliveryRulesByItem, setDeliveryRulesByItem] = useState<Record<string, DeliveryRule[]>>({})
  const [allCards, setAllCards] = useState<CardData[]>([])
  // 快速创建发货规则弹窗
  const [ruleModalItem, setRuleModalItem] = useState<Item | null>(null)
  const [ruleKeyword, setRuleKeyword] = useState('')
  const [ruleCardId, setRuleCardId] = useState('')
  const [ruleSaving, setRuleSaving] = useState(false)
  const [ruleDeliveryCount, setRuleDeliveryCount] = useState(1)
  const [ruleBonusTiers, setRuleBonusTiers] = useState('')
  // 规则卡券模式：'existing' 选已有卡券；'new' 内联新建卡券
  const [ruleCardMode, setRuleCardMode] = useState<'existing' | 'new'>('existing')
  const [ruleNewCardType, setRuleNewCardType] = useState<'text' | 'image' | 'data'>('text')
  const [ruleNewCardName, setRuleNewCardName] = useState('')
  const [ruleNewCardText, setRuleNewCardText] = useState('')
  const [ruleNewCardData, setRuleNewCardData] = useState('')
  const [ruleNewCardImageUrl, setRuleNewCardImageUrl] = useState('')
  const [ruleNewCardImageUploading, setRuleNewCardImageUploading] = useState(false)
  const ruleNewCardImageInputRef = useRef<HTMLInputElement>(null)
  const [selectedAccount, setSelectedAccount] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set())
  const [fetching, setFetching] = useState(false)

  // 编辑弹窗状态
  const [editingItem, setEditingItem] = useState<Item | null>(null)
  const [editDetail, setEditDetail] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  // 商品默认回复弹窗状态
  const [defaultReplyItem, setDefaultReplyItem] = useState<Item | null>(null)
  const [defaultReplyContent, setDefaultReplyContent] = useState('')
  const [defaultReplyImage, setDefaultReplyImage] = useState('')
  const [defaultReplyEnabled, setDefaultReplyEnabled] = useState(true)
  const [defaultReplyOnce, setDefaultReplyOnce] = useState(false)
  const [loadingDefaultReply, setLoadingDefaultReply] = useState(false)
  const [savingDefaultReply, setSavingDefaultReply] = useState(false)
  const [defaultReplyImageUploading, setDefaultReplyImageUploading] = useState(false)
  const defaultReplyImageInputRef = useRef<HTMLInputElement>(null)

  // 批量默认回复弹窗状态
  const [showBatchDefaultReplyModal, setShowBatchDefaultReplyModal] = useState(false)
  const [batchReplyContent, setBatchReplyContent] = useState('')
  const [batchReplyImage, setBatchReplyImage] = useState('')
  const [batchReplyEnabled, setBatchReplyEnabled] = useState(true)
  const [batchReplyOnce, setBatchReplyOnce] = useState(false)
  const [savingBatchReply, setSavingBatchReply] = useState(false)
  const [batchReplyImageUploading, setBatchReplyImageUploading] = useState(false)
  const batchReplyImageInputRef = useRef<HTMLInputElement>(null)

  // 删除确认状态
  const [deleteDefaultReplyConfirm, setDeleteDefaultReplyConfirm] = useState(false)
  const [batchDeleteDefaultReplyConfirm, setBatchDeleteDefaultReplyConfirm] = useState(false)

  const loadItems = async () => {
    if (!_hasHydrated || !isAuthenticated || !token) {
      return
    }
    try {
      setLoading(true)
      const result = await getItems(selectedAccount || undefined)
      if (result.success) {
        setItems(result.data || [])
      }
    } catch {
      addToast({ type: 'error', message: '加载商品列表失败' })
    } finally {
      setLoading(false)
    }
  }


  const handleFetchItems = async () => {
    if (!selectedAccount) {
      addToast({ type: 'warning', message: '请先选择账号后再获取商品' })
      return
    }

    setFetching(true)

    try {
      const result = await fetchAllItemsFromAccount(selectedAccount)

      if (result.success) {
        const totalCount = (result as { total_count?: number }).total_count || 0
        const savedCount = (result as { saved_count?: number }).saved_count || 0
        addToast({ type: 'success', message: `成功获取商品，共 ${totalCount} 件，保存 ${savedCount} 件` })
        await loadItems()
      } else {
        addToast({ type: 'error', message: (result as { message?: string }).message || '获取商品失败' })
      }
    } catch {
      addToast({ type: 'error', message: '获取商品失败' })
    } finally {
      setFetching(false)
    }
  }

  const loadAccounts = async () => {
    if (!_hasHydrated || !isAuthenticated || !token) {
      return
    }
    try {
      const data = await getAccounts()
      setAccounts(data)
    } catch {
      // ignore
    }
  }

  const loadDeliveryRules = async () => {
    if (!_hasHydrated || !isAuthenticated || !token) return
    try {
      const result = await getDeliveryRules()
      const rules = result.data || []
      const map: Record<string, DeliveryRule[]> = {}
      for (const r of rules) {
        if (r.item_id) {
          ;(map[r.item_id] ||= []).push(r)
        }
      }
      setDeliveryRulesByItem(map)
    } catch {
      // ignore
    }
  }

  const loadAllCards = async () => {
    if (!_hasHydrated || !isAuthenticated || !token) return
    try {
      const r = await getCards()
      if (r.success) setAllCards(r.data || [])
    } catch {
      // ignore
    }
  }

  const openCreateRuleForItem = (item: Item) => {
    setRuleModalItem(item)
    // 商品ID 已自动绑定，关键词留空表示该商品任何消息都触发
    setRuleKeyword('')
    setRuleCardId('')
    setRuleDeliveryCount(1)
    setRuleBonusTiers('')
    setRuleCardMode('existing')
    setRuleNewCardType('text')
    setRuleNewCardName('')
    setRuleNewCardText('')
    setRuleNewCardData('')
    setRuleNewCardImageUrl('')
  }

  const closeCreateRuleForItem = () => {
    setRuleModalItem(null)
    setRuleKeyword('')
    setRuleCardId('')
    setRuleDeliveryCount(1)
    setRuleBonusTiers('')
    setRuleNewCardName('')
    setRuleNewCardText('')
    setRuleNewCardData('')
    setRuleNewCardImageUrl('')
  }

  const handleRuleNewCardImageSelect = async (file: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      addToast({ type: 'warning', message: '请选择图片文件' })
      return
    }
    setRuleNewCardImageUploading(true)
    try {
      const fd = new FormData()
      fd.append('image', file)
      const result = await post<{ image_url: string }>('/upload-image', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setRuleNewCardImageUrl(result.image_url || '')
      addToast({ type: 'success', message: '图片上传成功' })
    } catch {
      addToast({ type: 'error', message: '图片上传失败' })
    } finally {
      setRuleNewCardImageUploading(false)
    }
  }

  const handleSaveRuleForItem = async () => {
    if (!ruleModalItem) return

    let cardIdToUse: number | null = null

    if (ruleCardMode === 'existing') {
      if (!ruleCardId) {
        addToast({ type: 'warning', message: '请选择卡券' })
        return
      }
      cardIdToUse = Number(ruleCardId)
    } else {
      // 新建卡券
      if (ruleNewCardType === 'text' && !ruleNewCardText.trim()) {
        addToast({ type: 'warning', message: '请输入文本内容' })
        return
      }
      if (ruleNewCardType === 'data' && !ruleNewCardData.trim()) {
        addToast({ type: 'warning', message: '请输入批量数据（每行一条）' })
        return
      }
      if (ruleNewCardType === 'image' && !ruleNewCardImageUrl) {
        addToast({ type: 'warning', message: '请上传图片' })
        return
      }
    }

    setRuleSaving(true)
    try {
      // 若选择新建卡券，先创建
      if (ruleCardMode === 'new') {
        const cardName = (ruleNewCardName.trim()
          || `${ruleModalItem.item_title || ruleModalItem.title || ruleModalItem.item_id}-${Date.now().toString().slice(-6)}`).slice(0, 80)
        const payload: Parameters<typeof createCard>[0] = {
          name: cardName,
          type: ruleNewCardType,
          enabled: true,
          delay_seconds: 0,
          description: `商品 ${ruleModalItem.item_id} 自动发货`.slice(0, 200),
        }
        if (ruleNewCardType === 'text') payload.text_content = ruleNewCardText.trim()
        if (ruleNewCardType === 'data') payload.data_content = ruleNewCardData.trim()
        if (ruleNewCardType === 'image') payload.image_url = ruleNewCardImageUrl
        const res = await createCard(payload)
        cardIdToUse = Number(res.id)
        if (!cardIdToUse) throw new Error('卡券创建失败')
      }

      await addDeliveryRule({
        keyword: ruleKeyword.trim(),
        card_id: cardIdToUse!,
        delivery_count: Math.max(1, Math.floor(ruleDeliveryCount) || 1),
        enabled: true,
        item_id: ruleModalItem.item_id,
        bonus_tiers: ruleBonusTiers.trim() || null,
        description: `商品页创建：${ruleModalItem.item_title || ruleModalItem.title || ''}`.slice(0, 200),
      } as Partial<DeliveryRule>)
      addToast({ type: 'success', message: '发货规则已创建，可继续添加其它卡券' })
      // 保留弹窗打开，仅重置表单，便于连续添加多种卡券
      setRuleKeyword('')
      setRuleCardId('')
      setRuleDeliveryCount(1)
      setRuleBonusTiers('')
      setRuleCardMode('existing')
      setRuleNewCardName('')
      setRuleNewCardText('')
      setRuleNewCardData('')
      setRuleNewCardImageUrl('')
      loadDeliveryRules()
      // 新建了卡券需要刷新卡券列表
      if (ruleCardMode === 'new') loadAllCards()
    } catch (err) {
      const msg = err instanceof Error && err.message ? err.message : '创建失败'
      addToast({ type: 'error', message: msg })
    } finally {
      setRuleSaving(false)
    }
  }

  useEffect(() => {
    if (!_hasHydrated || !isAuthenticated || !token) return
    loadAccounts()
    loadItems()
    loadDeliveryRules()
    loadAllCards()
  }, [_hasHydrated, isAuthenticated, token])

  useEffect(() => {
    if (!_hasHydrated || !isAuthenticated || !token) return
    loadItems()
  }, [_hasHydrated, isAuthenticated, token, selectedAccount])

  const handleDelete = async (item: Item) => {
    if (!confirm('确定要删除这个商品吗？')) return
    try {
      await deleteItem(item.cookie_id, item.item_id)
      addToast({ type: 'success', message: '删除成功' })
      loadItems()
    } catch {
      addToast({ type: 'error', message: '删除失败' })
    }
  }

  // 批量选择相关
  const toggleSelect = (id: string | number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredItems.map((item) => item.id)))
    }
  }

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) {
      addToast({ type: 'warning', message: '请先选择要删除的商品' })
      return
    }
    if (!confirm(`确定要删除选中的 ${selectedIds.size} 个商品吗？`)) return
    try {
      const itemsToDelete = items
        .filter((item) => selectedIds.has(item.id))
        .map((item) => ({ cookie_id: item.cookie_id, item_id: item.item_id }))
      await batchDeleteItems(itemsToDelete)
      addToast({ type: 'success', message: `成功删除 ${selectedIds.size} 个商品` })
      setSelectedIds(new Set())
      loadItems()
    } catch {
      addToast({ type: 'error', message: '批量删除失败' })
    }
  }

  // 切换多数量发货状态
  const handleToggleMultiQuantity = async (item: Item) => {
    try {
      const newStatus = !item.multi_quantity_delivery
      await updateItemMultiQuantityDelivery(item.cookie_id, item.item_id, newStatus)
      addToast({ type: 'success', message: `多数量发货已${newStatus ? '开启' : '关闭'}` })
      loadItems()
    } catch {
      addToast({ type: 'error', message: '操作失败' })
    }
  }

  // 切换多规格状态
  const handleToggleMultiSpec = async (item: Item) => {
    try {
      const newStatus = !(item.is_multi_spec || item.has_sku)
      await updateItemMultiSpec(item.cookie_id, item.item_id, newStatus)
      addToast({ type: 'success', message: `多规格已${newStatus ? '开启' : '关闭'}` })
      loadItems()
    } catch {
      addToast({ type: 'error', message: '操作失败' })
    }
  }

  // 打开编辑弹窗
  const handleEdit = (item: Item) => {
    setEditingItem(item)
    setEditDetail(item.item_detail || item.desc || '')
  }

  // 保存编辑
  const handleSaveEdit = async () => {
    if (!editingItem) return
    setEditSaving(true)
    try {
      await updateItem(editingItem.cookie_id, editingItem.item_id, {
        item_detail: editDetail,
      })
      addToast({ type: 'success', message: '商品详情已更新' })
      setEditingItem(null)
      loadItems()
    } catch {
      addToast({ type: 'error', message: '更新失败' })
    } finally {
      setEditSaving(false)
    }
  }


  // 打开默认回复配置弹窗
  const handleOpenDefaultReply = async (item: Item) => {
    setDefaultReplyItem(item)
    setDefaultReplyImage('')
    setLoadingDefaultReply(true)
    
    try {
      const result = await getItemDefaultReply(item.cookie_id, item.item_id)
      if (result.success && result.data) {
        setDefaultReplyContent(result.data.reply_content || '')
        setDefaultReplyImage(result.data.reply_image || '')
        setDefaultReplyEnabled(result.data.enabled ?? true)
        setDefaultReplyOnce(result.data.reply_once ?? false)
      } else {
        setDefaultReplyContent('')
        setDefaultReplyImage('')
        setDefaultReplyEnabled(true)
        setDefaultReplyOnce(false)
      }
    } catch {
      setDefaultReplyContent('')
      setDefaultReplyImage('')
      setDefaultReplyEnabled(true)
      setDefaultReplyOnce(false)
    } finally {
      setLoadingDefaultReply(false)
    }
  }

  // 关闭默认回复配置弹窗
  const closeDefaultReply = () => {
    setDefaultReplyItem(null)
    setDefaultReplyContent('')
    setDefaultReplyImage('')
    setDefaultReplyEnabled(true)
    setDefaultReplyOnce(false)
    setDeleteDefaultReplyConfirm(false)
  }

  // 保存默认回复配置
  const handleSaveDefaultReply = async () => {
    if (!defaultReplyItem) return
    setSavingDefaultReply(true)
    
    try {
      await saveItemDefaultReply(defaultReplyItem.cookie_id, defaultReplyItem.item_id, {
        reply_content: defaultReplyContent,
        reply_image_url: defaultReplyImage,
        enabled: defaultReplyEnabled,
        reply_once: defaultReplyOnce
      })
      addToast({ type: 'success', message: '商品默认回复保存成功' })
      closeDefaultReply()
    } catch {
      addToast({ type: 'error', message: '保存失败' })
    } finally {
      setSavingDefaultReply(false)
    }
  }

  // 删除默认回复配置
  const handleDeleteDefaultReply = async () => {
    if (!defaultReplyItem) return
    
    try {
      await deleteItemDefaultReply(defaultReplyItem.cookie_id, defaultReplyItem.item_id)
      addToast({ type: 'success', message: '商品默认回复已删除' })
      closeDefaultReply()
    } catch {
      addToast({ type: 'error', message: '删除失败' })
    }
  }

  // 上传默认回复图片
  const handleDefaultReplyImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !defaultReplyItem) return
    
    setDefaultReplyImageUploading(true)
    try {
      const result = await uploadItemDefaultReplyImage(defaultReplyItem.cookie_id, defaultReplyItem.item_id, file)
      if (result.success && result.image_url) {
        setDefaultReplyImage(result.image_url)
        addToast({ type: 'success', message: '图片上传成功' })
      } else {
        addToast({ type: 'error', message: result.message || '图片上传失败' })
      }
    } catch {
      addToast({ type: 'error', message: '图片上传失败' })
    } finally {
      setDefaultReplyImageUploading(false)
      if (defaultReplyImageInputRef.current) {
        defaultReplyImageInputRef.current.value = ''
      }
    }
  }

  // 打开批量默认回复弹窗
  const handleOpenBatchDefaultReply = () => {
    if (selectedIds.size === 0) {
      addToast({ type: 'warning', message: '请先选择商品' })
      return
    }
    setBatchReplyContent('')
    setBatchReplyImage('')
    setBatchReplyEnabled(true)
    setBatchReplyOnce(false)
    setShowBatchDefaultReplyModal(true)
  }

  // 保存批量默认回复
  const handleSaveBatchDefaultReply = async () => {
    if (selectedIds.size === 0) return
    
    const selectedItems = items.filter((item) => selectedIds.has(item.id))
    const cookieId = selectedItems[0]?.cookie_id
    if (!cookieId) return
    
    // 检查是否所有选中的商品都属于同一个账号
    const allSameCookie = selectedItems.every((item) => item.cookie_id === cookieId)
    if (!allSameCookie) {
      addToast({ type: 'error', message: '批量操作只能针对同一账号的商品' })
      return
    }
    
    setSavingBatchReply(true)
    try {
      const itemIds = selectedItems.map((item) => item.item_id)
      await batchSaveItemDefaultReply(cookieId, {
        item_ids: itemIds,
        reply_content: batchReplyContent,
        reply_image_url: batchReplyImage,
        enabled: batchReplyEnabled,
        reply_once: batchReplyOnce
      })
      addToast({ type: 'success', message: `批量保存成功，共 ${itemIds.length} 个商品` })
      setShowBatchDefaultReplyModal(false)
      setSelectedIds(new Set())
    } catch {
      addToast({ type: 'error', message: '批量保存失败' })
    } finally {
      setSavingBatchReply(false)
    }
  }

  // 上传批量默认回复图片
  const handleBatchReplyImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setBatchReplyImageUploading(true)
    try {
      // 使用通用图片上传接口
      const formData = new FormData()
      formData.append('image', file)
      const response = await fetch('/upload-image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })
      const result = await response.json()
      if (result.image_url) {
        setBatchReplyImage(result.image_url)
        addToast({ type: 'success', message: '图片上传成功' })
      } else {
        addToast({ type: 'error', message: result.detail || result.message || '图片上传失败' })
      }
    } catch {
      addToast({ type: 'error', message: '图片上传失败' })
    } finally {
      setBatchReplyImageUploading(false)
      if (batchReplyImageInputRef.current) {
        batchReplyImageInputRef.current.value = ''
      }
    }
  }

  // 批量删除默认回复
  const handleBatchDeleteDefaultReply = async () => {
    if (selectedIds.size === 0) return
    
    const selectedItems = items.filter((item) => selectedIds.has(item.id))
    const cookieId = selectedItems[0]?.cookie_id
    if (!cookieId) return
    
    const allSameCookie = selectedItems.every((item) => item.cookie_id === cookieId)
    if (!allSameCookie) {
      addToast({ type: 'error', message: '批量操作只能针对同一账号的商品' })
      return
    }
    
    try {
      const itemIds = selectedItems.map((item) => item.item_id)
      await batchDeleteItemDefaultReply(cookieId, itemIds)
      addToast({ type: 'success', message: `批量删除成功，共 ${itemIds.length} 个商品` })
      setBatchDeleteDefaultReplyConfirm(false)
      setSelectedIds(new Set())
    } catch {
      addToast({ type: 'error', message: '批量删除失败' })
    }
  }

  const filteredItems = items.filter((item) => {
    if (!searchKeyword) return true
    const keyword = searchKeyword.toLowerCase()
    const title = item.item_title || item.title || ''
    const desc = item.item_detail || item.desc || ''
    return (
      title.toLowerCase().includes(keyword) ||
      desc.toLowerCase().includes(keyword) ||
      item.item_id?.includes(keyword)
    )
  })

  if (loading) {
    return <PageLoading />
  }


  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="page-header flex-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">商品管理</h1>
          <p className="page-description">管理各账号的商品信息</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedIds.size > 0 && (
            <>
              <button onClick={handleOpenBatchDefaultReply} className="btn-ios-secondary">
                <MessageSquare className="w-4 h-4" />
                批量默认回复
              </button>
              <button onClick={() => setBatchDeleteDefaultReplyConfirm(true)} className="btn-ios-secondary">
                <Trash2 className="w-4 h-4" />
                批量删除回复
              </button>
              <button onClick={handleBatchDelete} className="btn-ios-danger">
                <Trash2 className="w-4 h-4" />
                删除选中 ({selectedIds.size})
              </button>
            </>
          )}
          <button
            onClick={handleFetchItems}
            disabled={fetching}
            className="btn-ios-primary"
          >
            {fetching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                获取中...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                获取商品
              </>
            )}
          </button>
          <button onClick={loadItems} className="btn-ios-secondary">
            <RefreshCw className="w-4 h-4" />
            刷新
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="vben-card">
        <div className="vben-card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="input-group">
              <label className="input-label">筛选账号</label>
              <Select
                value={selectedAccount}
                onChange={setSelectedAccount}
                options={[
                  { value: '', label: '所有账号' },
                  ...accounts.map((account) => ({
                    value: account.id,
                    label: account.note ? `${account.id} (${account.note})` : account.id,
                  })),
                ]}
                placeholder="所有账号"
              />
            </div>
            <div className="input-group">
              <label className="input-label">搜索商品</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  placeholder="搜索商品标题或详情..."
                  className="input-ios pl-9"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Items List */}
      <div className="vben-card">
        <div className="vben-card-header">
          <h2 className="vben-card-title ">
            <Package className="w-4 h-4" />
            商品列表
          </h2>
          <span className="badge-primary">{filteredItems.length} 个商品</span>
        </div>
        <div className="overflow-x-auto">
          <table className="table-ios min-w-[1000px]">
            <thead>
              <tr>
                <th className="w-10 whitespace-nowrap">
                  <button
                    onClick={toggleSelectAll}
                    className="p-1 hover:bg-gray-100 rounded"
                    title={selectedIds.size === filteredItems.length ? '取消全选' : '全选'}
                  >
                    {selectedIds.size === filteredItems.length && filteredItems.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <Square className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                </th>
                <th className="whitespace-nowrap">图片</th>
                <th className="whitespace-nowrap">账号ID</th>
                <th className="whitespace-nowrap">商品ID</th>
                <th className="whitespace-nowrap">商品标题</th>
                <th className="whitespace-nowrap">价格</th>
                <th className="whitespace-nowrap">多规格</th>
                <th className="whitespace-nowrap">多数量发货</th>
                <th className="whitespace-nowrap">自动发货</th>
                <th className="whitespace-nowrap">更新时间</th>
                <th className="whitespace-nowrap sticky right-0 bg-slate-50 dark:bg-slate-800">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={11}>
                    <div className="empty-state py-8">
                      <Package className="empty-state-icon" />
                      <p className="text-gray-500">暂无商品数据</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className={selectedIds.has(item.id) ? 'bg-blue-50 dark:bg-blue-900/30' : ''}>
                    <td>
                      <button
                        onClick={() => toggleSelect(item.id)}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                      >
                        {selectedIds.has(item.id) ? (
                          <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        ) : (
                          <Square className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </td>
                    <td>
                      {item.pic_url ? (
                        <a
                          href={`https://www.goofish.com/item?id=${item.item_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="点击查看商品"
                          className="block"
                        >
                          <img
                            src={item.pic_url}
                            alt={item.item_title || item.title || '商品图'}
                            loading="lazy"
                            className="w-12 h-12 rounded-lg object-cover border border-slate-200 dark:border-slate-700 hover:scale-110 transition-transform"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                          />
                        </a>
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-300">
                          <Package className="w-5 h-5" />
                        </div>
                      )}
                    </td>
                    <td className="font-medium text-blue-600 dark:text-blue-400 whitespace-nowrap">{formatAccountId(item.cookie_id, accounts)}</td>
                    <td className="text-xs text-gray-500">
                      <a
                        href={`https://www.goofish.com/item?id=${item.item_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-blue-500 flex items-center gap-1"
                      >
                        {item.item_id}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                    <td className="max-w-[280px]">
                      <div
                        className="font-medium line-clamp-2 cursor-help"
                        title={item.item_title || item.title || '-'}
                      >
                        {item.item_title || item.title || '-'}
                      </div>
                      {(item.item_detail || item.desc) && (
                        <div
                          className="text-xs text-gray-400 line-clamp-1 mt-0.5 cursor-help"
                          title={item.item_detail || item.desc}
                        >
                          {item.item_detail || item.desc}
                        </div>
                      )}
                    </td>
                    <td className="text-amber-600 font-medium">
                      {item.item_price || (item.price ? `¥${item.price}` : '-')}
                    </td>
                    <td>
                      <button
                        onClick={() => handleToggleMultiSpec(item)}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                          (item.is_multi_spec || item.has_sku)
                            ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
                        }`}
                        title={(item.is_multi_spec || item.has_sku) ? '点击关闭多规格' : '点击开启多规格'}
                      >
                        {(item.is_multi_spec || item.has_sku) ? '已开启' : '已关闭'}
                      </button>
                    </td>
                    <td>
                      <button
                        onClick={() => handleToggleMultiQuantity(item)}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                          item.multi_quantity_delivery
                            ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
                        }`}
                        title={item.multi_quantity_delivery ? '点击关闭多数量发货' : '点击开启多数量发货'}
                      >
                        {item.multi_quantity_delivery ? '已开启' : '已关闭'}
                      </button>
                    </td>
                    <td>
                      {(() => {
                        const rules = deliveryRulesByItem[String(item.item_id)] || []
                        if (rules.length === 0) {
                          return (
                            <button
                              onClick={() => openCreateRuleForItem(item)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-600 dark:bg-slate-800 dark:text-slate-400"
                              title="为该商品创建自动发货规则"
                            >
                              <Truck className="w-3.5 h-3.5" />
                              未配置
                            </button>
                          )
                        }
                        return (
                          <button
                            onClick={() => openCreateRuleForItem(item)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300"
                            title={rules.map(r => `${r.keyword} → ${r.card_name || r.card_id}`).join('\n')}
                          >
                            <Truck className="w-3.5 h-3.5" />
                            已配置 {rules.length} 条
                          </button>
                        )
                      })()}
                    </td>
                    <td className="text-gray-500 text-xs">
                      {item.updated_at ? new Date(item.updated_at).toLocaleString() : '-'}
                    </td>
                    <td className="sticky right-0 bg-white dark:bg-slate-900">
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleOpenDefaultReply(item)}
                          className="table-action-btn hover:!bg-green-50"
                          title="默认回复"
                        >
                          <MessageSquare className="w-4 h-4 text-green-500" />
                        </button>
                        <button
                          onClick={() => handleEdit(item)}
                          className="table-action-btn hover:!bg-blue-50"
                          title="编辑"
                        >
                          <Edit2 className="w-4 h-4 text-blue-500" />
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          className="table-action-btn hover:!bg-red-50"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
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


      {/* 编辑弹窗 */}
      {editingItem && (
        <div className="modal-overlay">
          <div className="modal-content max-w-lg">
            <div className="modal-header">
              <h2 className="modal-title">编辑商品</h2>
              <button onClick={() => setEditingItem(null)} className="modal-close">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="modal-body space-y-4">
              <div className="input-group">
                <label className="input-label">商品ID</label>
                <input
                  type="text"
                  value={editingItem.item_id}
                  disabled
                  className="input-ios bg-slate-100 dark:bg-slate-700"
                />
              </div>
              <div className="input-group">
                <label className="input-label">商品标题</label>
                <input
                  type="text"
                  value={editingItem.item_title || editingItem.title || ''}
                  disabled
                  className="input-ios bg-slate-100 dark:bg-slate-700"
                />
              </div>
              <div className="input-group">
                <label className="input-label">商品详情</label>
                <textarea
                  value={editDetail}
                  onChange={(e) => setEditDetail(e.target.value)}
                  className="input-ios h-32 resize-none"
                  placeholder="输入商品详情..."
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="btn-ios-secondary"
                disabled={editSaving}
              >
                取消
              </button>
              <button
                onClick={handleSaveEdit}
                className="btn-ios-primary"
                disabled={editSaving}
              >
                {editSaving ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    保存中...
                  </span>
                ) : (
                  '保存'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 商品默认回复配置弹窗 */}
      {defaultReplyItem && (
        <div className="modal-overlay">
          <div className="modal-content max-w-lg">
            <div className="modal-header">
              <h2 className="modal-title">商品默认回复配置</h2>
              <button onClick={closeDefaultReply} className="modal-close">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="modal-body space-y-4">
              {loadingDefaultReply ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                </div>
              ) : (
                <>
                  <div className="input-group">
                    <label className="input-label">商品信息</label>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      <div>ID: {defaultReplyItem.item_id}</div>
                      <div className="line-clamp-1">{defaultReplyItem.item_title || defaultReplyItem.title || '-'}</div>
                    </div>
                  </div>
                  
                  <div className="input-group">
                    <label className="input-label flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={defaultReplyEnabled}
                        onChange={(e) => setDefaultReplyEnabled(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300"
                      />
                      启用商品默认回复
                    </label>
                  </div>
                  
                  <div className="input-group">
                    <label className="input-label">回复内容</label>
                    <textarea
                      value={defaultReplyContent}
                      onChange={(e) => setDefaultReplyContent(e.target.value)}
                      className="input-ios h-24 resize-none"
                      placeholder="输入默认回复内容，支持变量：{send_user_name}、{send_user_id}、{send_message}、{item_id}"
                    />
                  </div>
                  
                  <div className="input-group">
                    <label className="input-label">回复图片</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={defaultReplyImage}
                        onChange={(e) => setDefaultReplyImage(e.target.value)}
                        className="input-ios flex-1"
                        placeholder="图片URL（可选）"
                      />
                      <input
                        type="file"
                        ref={defaultReplyImageInputRef}
                        onChange={handleDefaultReplyImageUpload}
                        accept="image/*"
                        className="hidden"
                      />
                      <button
                        onClick={() => defaultReplyImageInputRef.current?.click()}
                        disabled={defaultReplyImageUploading}
                        className="btn-ios-secondary"
                      >
                        {defaultReplyImageUploading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <ImagePlus className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {defaultReplyImage && (
                      <div className="mt-2">
                        <img src={defaultReplyImage} alt="预览" className="max-h-24 rounded" />
                      </div>
                    )}
                  </div>
                  
                  <div className="input-group">
                    <label className="input-label flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={defaultReplyOnce}
                        onChange={(e) => setDefaultReplyOnce(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300"
                      />
                      只回复一次（同一用户只回复一次）
                    </label>
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              {!deleteDefaultReplyConfirm ? (
                <>
                  <button
                    type="button"
                    onClick={() => setDeleteDefaultReplyConfirm(true)}
                    className="btn-ios-danger mr-auto"
                    disabled={loadingDefaultReply || savingDefaultReply}
                  >
                    删除
                  </button>
                  <button
                    type="button"
                    onClick={closeDefaultReply}
                    className="btn-ios-secondary"
                    disabled={savingDefaultReply}
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSaveDefaultReply}
                    className="btn-ios-primary"
                    disabled={loadingDefaultReply || savingDefaultReply}
                  >
                    {savingDefaultReply ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        保存中...
                      </span>
                    ) : (
                      '保存'
                    )}
                  </button>
                </>
              ) : (
                <>
                  <span className="text-red-500 text-sm">确定要删除此商品的默认回复配置吗？</span>
                  <button
                    type="button"
                    onClick={() => setDeleteDefaultReplyConfirm(false)}
                    className="btn-ios-secondary"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleDeleteDefaultReply}
                    className="btn-ios-danger"
                  >
                    确认删除
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}


      {/* 批量默认回复弹窗 */}
      {showBatchDefaultReplyModal && (
        <div className="modal-overlay">
          <div className="modal-content max-w-lg">
            <div className="modal-header">
              <h2 className="modal-title">批量设置默认回复</h2>
              <button onClick={() => setShowBatchDefaultReplyModal(false)} className="modal-close">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="modal-body space-y-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                已选择 {selectedIds.size} 个商品
              </div>
              
              <div className="input-group">
                <label className="input-label flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={batchReplyEnabled}
                    onChange={(e) => setBatchReplyEnabled(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  启用默认回复
                </label>
              </div>
              
              <div className="input-group">
                <label className="input-label">回复内容</label>
                <textarea
                  value={batchReplyContent}
                  onChange={(e) => setBatchReplyContent(e.target.value)}
                  className="input-ios h-24 resize-none"
                  placeholder="输入默认回复内容，支持变量：{send_user_name}、{send_user_id}、{send_message}、{item_id}"
                />
              </div>
              
              <div className="input-group">
                <label className="input-label">回复图片（可选）</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={batchReplyImage}
                    onChange={(e) => setBatchReplyImage(e.target.value)}
                    className="input-ios flex-1"
                    placeholder="图片URL，或点击上传按钮"
                  />
                  <input
                    type="file"
                    ref={batchReplyImageInputRef}
                    onChange={handleBatchReplyImageUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    onClick={() => batchReplyImageInputRef.current?.click()}
                    disabled={batchReplyImageUploading}
                    className="btn-ios-secondary"
                    title="上传图片"
                  >
                    {batchReplyImageUploading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ImagePlus className="w-4 h-4" />
                    )}
                  </button>
                  {batchReplyImage && (
                    <button
                      onClick={() => setBatchReplyImage('')}
                      className="btn-ios-secondary text-red-500"
                      title="清除图片"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {batchReplyImage && (
                  <div className="mt-2">
                    <img src={batchReplyImage} alt="预览" className="max-h-24 rounded border" />
                  </div>
                )}
              </div>
              
              <div className="input-group">
                <label className="input-label flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={batchReplyOnce}
                    onChange={(e) => setBatchReplyOnce(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  只回复一次
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                onClick={() => setShowBatchDefaultReplyModal(false)}
                className="btn-ios-secondary"
                disabled={savingBatchReply}
              >
                取消
              </button>
              <button
                onClick={handleSaveBatchDefaultReply}
                className="btn-ios-primary"
                disabled={savingBatchReply}
              >
                {savingBatchReply ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    保存中...
                  </span>
                ) : (
                  '批量保存'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 批量删除默认回复确认弹窗 */}
      {batchDeleteDefaultReplyConfirm && (
        <div className="modal-overlay">
          <div className="modal-content max-w-sm">
            <div className="modal-header">
              <h2 className="modal-title">确认删除</h2>
              <button onClick={() => setBatchDeleteDefaultReplyConfirm(false)} className="modal-close">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="modal-body">
              <p className="text-gray-600 dark:text-gray-400">
                确定要删除选中的 {selectedIds.size} 个商品的默认回复配置吗？
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                onClick={() => setBatchDeleteDefaultReplyConfirm(false)}
                className="btn-ios-secondary"
              >
                取消
              </button>
              <button
                onClick={handleBatchDeleteDefaultReply}
                className="btn-ios-danger"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 为商品创建/查看自动发货规则弹窗 */}
      {ruleModalItem && (
        <div className="modal-overlay">
          <div className="modal-content max-w-2xl">
            <div className="modal-header flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Truck className="w-5 h-5 text-emerald-500" />
                配置自动发货
              </h2>
              <button onClick={closeCreateRuleForItem} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="modal-body space-y-4">
              {/* 商品信息卡片 */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-gradient-to-br from-emerald-50 to-blue-50 dark:from-emerald-900/20 dark:to-blue-900/20 border border-emerald-100 dark:border-emerald-800">
                <Package className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    商品ID <span className="font-mono text-slate-700 dark:text-slate-200">{ruleModalItem.item_id}</span>
                  </div>
                  <div className="text-sm font-medium text-slate-800 dark:text-slate-100 line-clamp-2 mt-0.5">
                    {ruleModalItem.item_title || ruleModalItem.title || '-'}
                  </div>
                </div>
              </div>

              {/* 已配置规则列表 */}
              {(deliveryRulesByItem[String(ruleModalItem.item_id)] || []).length > 0 && (
                <div className="rounded-lg border border-slate-200 dark:border-slate-700">
                  <div className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 rounded-t-lg border-b border-slate-200 dark:border-slate-700">
                    已配置规则 ({(deliveryRulesByItem[String(ruleModalItem.item_id)] || []).length})
                  </div>
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                    {(deliveryRulesByItem[String(ruleModalItem.item_id)] || []).map(r => (
                      <li key={r.id} className="px-3 py-2 flex items-center gap-2">
                        <span className="badge-info text-xs">×{r.delivery_count || 1}</span>
                        <span className="font-mono text-xs text-slate-600 dark:text-slate-300">
                          {r.keyword || <span className="text-slate-400 italic">任意消息</span>}
                        </span>
                        <span className="text-slate-400 mx-1">→</span>
                        <span className="text-slate-700 dark:text-slate-200 truncate flex-1">{r.card_name || `卡券 ${r.card_id}`}</span>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!confirm(`删除该发货规则？\n${r.card_name || r.card_id}`)) return
                            try {
                              await deleteDeliveryRule(String(r.id))
                              addToast({ type: 'success', message: '规则已删除' })
                              loadDeliveryRules()
                            } catch (e) {
                              addToast({ type: 'error', message: '删除失败' })
                            }
                          }}
                          className="text-red-500 hover:text-red-600 text-xs"
                          title="删除"
                        >
                          删除
                        </button>
                      </li>
                    ))}
                  </ul>
                  <p className="px-3 py-2 text-xs text-slate-500 border-t border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40">
                    提示：该商品已配置 <b>{(deliveryRulesByItem[String(ruleModalItem.item_id)] || []).length}</b> 条规则，发货时会依次触发所有规则的内容一起发出。
                  </p>
                </div>
              )}

              {/* 新增规则区 */}
              <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-900/10">
                <div className="px-3 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 border-b border-blue-200 dark:border-blue-800">
                  新增规则
                </div>
                <div className="p-3 space-y-4">
                  {/* 卡券来源切换 */}
                  <div>
                    <label className="input-label">发货内容来源</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setRuleCardMode('existing')}
                        className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                          ruleCardMode === 'existing'
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        选择已有卡券
                      </button>
                      <button
                        type="button"
                        onClick={() => setRuleCardMode('new')}
                        className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                          ruleCardMode === 'new'
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        + 新建卡券
                      </button>
                    </div>
                  </div>

                  {/* 已有卡券下拉 */}
                  {ruleCardMode === 'existing' && (
                    <div>
                      <label className="input-label">关联卡券 *</label>
                      <Select
                        value={ruleCardId}
                        onChange={setRuleCardId}
                        options={[
                          { value: '', label: '请选择卡券' },
                          ...allCards.map((card) => ({
                            value: String(card.id),
                            label: card.is_multi_spec
                              ? `[${card.type}] ${card.name} (${card.spec_name}: ${card.spec_value})`
                              : `[${card.type}] ${card.name || (card as { text_content?: string }).text_content?.substring(0, 20) || `卡券 ${card.id}`}`,
                          })),
                        ]}
                        placeholder="请选择卡券"
                      />
                      {allCards.length === 0 && (
                        <p className="text-xs text-amber-600 mt-1">暂无卡券，请切换到"新建卡券"</p>
                      )}
                    </div>
                  )}

                  {/* 新建卡券表单 */}
                  {ruleCardMode === 'new' && (
                    <div className="space-y-3 rounded-lg border border-slate-200 dark:border-slate-700 p-3 bg-white/60 dark:bg-slate-900/40">
                      <div>
                        <label className="input-label">内容类型</label>
                        <div className="flex gap-2">
                          {([
                            { v: 'text', label: '文本', icon: MessageSquare },
                            { v: 'image', label: '图片', icon: ImagePlus },
                            { v: 'data', label: '批量数据', icon: Package },
                          ] as const).map(({ v, label, icon: Icon }) => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => setRuleNewCardType(v)}
                              className={`flex-1 px-2 py-1.5 text-xs rounded-md border flex items-center justify-center gap-1 transition-colors ${
                                ruleNewCardType === v
                                  ? 'bg-emerald-100 text-emerald-700 border-emerald-400 dark:bg-emerald-900/30 dark:text-emerald-300'
                                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              <Icon className="w-3.5 h-3.5" />
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="input-label">卡券名称（可选，留空自动生成）</label>
                        <input
                          type="text"
                          value={ruleNewCardName}
                          onChange={(e) => setRuleNewCardName(e.target.value)}
                          className="input-ios"
                          placeholder={`${ruleModalItem.item_title || ruleModalItem.item_id}-自动`}
                        />
                      </div>

                      {ruleNewCardType === 'text' && (
                        <div>
                          <label className="input-label">文本内容 *</label>
                          <textarea
                            value={ruleNewCardText}
                            onChange={(e) => setRuleNewCardText(e.target.value)}
                            className="input-ios min-h-[100px] resize-y"
                            placeholder="发送给买家的固定文本，例如：感谢购买，请扫描下方二维码加群"
                          />
                        </div>
                      )}

                      {ruleNewCardType === 'data' && (
                        <div>
                          <label className="input-label">批量数据 *（每行一条）</label>
                          <textarea
                            value={ruleNewCardData}
                            onChange={(e) => setRuleNewCardData(e.target.value)}
                            className="input-ios min-h-[120px] resize-y font-mono text-xs"
                            placeholder={"账号1:密码1\n账号2:密码2\n激活码-XXXX-XXXX"}
                          />
                          <p className="text-xs text-gray-500 mt-1">每次触发会消耗 N 条（N = 下方"发送倍数"）</p>
                        </div>
                      )}

                      {ruleNewCardType === 'image' && (
                        <div>
                          <label className="input-label">图片 *</label>
                          <div className="flex items-start gap-3">
                            {ruleNewCardImageUrl ? (
                              <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                                <img src={ruleNewCardImageUrl} alt="预览" className="w-full h-full object-cover" />
                                <button
                                  type="button"
                                  onClick={() => setRuleNewCardImageUrl('')}
                                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80"
                                  title="移除"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => ruleNewCardImageInputRef.current?.click()}
                                disabled={ruleNewCardImageUploading}
                                className="w-24 h-24 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 flex flex-col items-center justify-center text-slate-400 hover:border-emerald-400 hover:text-emerald-500 transition-colors"
                              >
                                {ruleNewCardImageUploading ? (
                                  <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                  <>
                                    <ImagePlus className="w-5 h-5" />
                                    <span className="text-xs mt-1">上传</span>
                                  </>
                                )}
                              </button>
                            )}
                            <div className="flex-1 text-xs text-slate-500 dark:text-slate-400">
                              <p>点击左侧上传图片，会自动保存到服务器。</p>
                              <p className="mt-1">推荐 PNG/JPG，&lt; 5MB。</p>
                            </div>
                            <input
                              ref={ruleNewCardImageInputRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0]
                                if (f) handleRuleNewCardImageSelect(f)
                                e.target.value = ''
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 触发关键词 + 发送倍数 同行 */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="input-label">触发关键词（可选）</label>
                      <input
                        type="text"
                        value={ruleKeyword}
                        onChange={(e) => setRuleKeyword(e.target.value)}
                        className="input-ios"
                        placeholder="留空：该商品任何消息都触发"
                      />
                    </div>
                    <div>
                      <label className="input-label">发送倍数</label>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={ruleDeliveryCount}
                        onChange={(e) => setRuleDeliveryCount(Math.max(1, Number(e.target.value) || 1))}
                        className="input-ios"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="input-label">满赠梯度（可选，买X赠Y）</label>
                    <input
                      type="text"
                      value={ruleBonusTiers}
                      onChange={(e) => setRuleBonusTiers(e.target.value)}
                      className="input-ios"
                      placeholder="如 10:1, 20:2, 50:5"
                    />
                  </div>
                  <p className="text-xs text-gray-500 -mt-2">
                    倍数：批量数据卡券每次发 N 条；文本/图片重复发 N 次。<br/>
                    满赠：购买数量满足梯度时自动多发几份（需商品开启“多数量发货”）。例如 <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">10:1,20:2</code>。
                  </p>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" onClick={closeCreateRuleForItem} className="btn-ios-secondary" disabled={ruleSaving}>
                取消
              </button>
              <button onClick={handleSaveRuleForItem} className="btn-ios-primary" disabled={ruleSaving || ruleNewCardImageUploading}>
                {ruleSaving ? (<><Loader2 className="w-4 h-4 animate-spin" />保存中...</>) : '创建规则'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
