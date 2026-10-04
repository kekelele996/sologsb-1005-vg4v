import { Injectable, OnDestroy } from '@angular/core'
import { BehaviorSubject, map, type Observable } from 'rxjs'
import type { Annotation, Claim, ClaimVersion, ComparisonConclusion, ComparisonResult, Feature, Paragraph, Position, RawReportItem, RawSearchReport, ReferenceDocument, ReferenceParagraph, ReportClaimItem, Role, SearchReport, ValidationIssue, WorkbenchState } from './models'

const STORAGE_KEY = 'patent-claim-mapping-workbench-v1'
const POSITION_KEY = 'patent-claim-mapping-position-v1'

const initialClaims: Claim[] = [
  { id: 'claim-1', number: 1, title: '一种自适应展柜环境控制装置', independent: true, text: '一种自适应展柜环境控制装置，包括：柜体；环境传感模块，设置于所述柜体内并用于采集温湿度数据；以及控制模块，与所述环境传感模块通信，并根据所述温湿度数据调节所述柜体的微环境。' },
  { id: 'claim-2', number: 2, title: '传感模块的布置方式', independent: false, text: '根据权利要求1所述的装置，其特征在于，所述环境传感模块包括沿所述柜体对角线布置的多个温湿度传感器。' },
  { id: 'claim-3', number: 3, title: '控制模块的调节策略', independent: false, text: '根据权利要求1所述的装置，其特征在于，所述控制模块基于历史数据与当前数据之间的偏差分级调节除湿单元。' }
]
const initialParagraphs: Paragraph[] = [
  { id: 'para-0012', section: '说明书 [0012]', text: '柜体1形成用于陈列文物的封闭空间。环境传感模块2安装于柜体内部，可采集温度、相对湿度等环境数据，并将数据发送至控制模块3。' },
  { id: 'para-0018', section: '说明书 [0018]', text: '在一种实施方式中，多个温湿度传感器沿柜体对角线布置，由此可降低局部气流造成的测量偏差。传感器数量可根据柜体容积设定。' },
  { id: 'para-0024', section: '说明书 [0024]', text: '控制模块可比较当前湿度与预设区间，并结合历史变化趋势生成调节等级。当偏差持续超过阈值时，控制模块启动除湿单元并提高调节频率。' },
  { id: 'para-0031', section: '说明书 [0031]', text: '控制模块与传感模块之间可以采用有线或无线通信。通信链路可周期传输数据，传输周期例如为十秒至五分钟。' },
  { id: 'para-0040', section: '说明书 [0040]', text: '微环境调节包括湿度调节、温度调节及气体交换。控制策略可记录执行结果，用于后续趋势判断。' }
]
/** 对比文件库：检索机构报告中引用的现有技术文献，段落按“段号 → 段落号”对照 */
const initialReferenceDocuments: ReferenceDocument[] = [
  {
    id: 'ref-d1', code: 'D1', title: '一种文物展柜恒湿控制系统',
    paragraphs: [
      { id: 'ref-d1-p1', ordinal: 1, paragraphNo: '[0012]', text: '柜体为封闭结构，内部形成用于陈列文物的容置空间。' },
      { id: 'ref-d1-p2', ordinal: 2, paragraphNo: '[0015]', text: '柜体内设置温湿度传感器，用于采集容置空间内的温湿度数据。' },
      { id: 'ref-d1-p3', ordinal: 3, paragraphNo: '[0018]', text: '多个温湿度传感器沿柜体对角线布置。' }
    ]
  },
  {
    id: 'ref-d2', code: 'D2', title: '展柜环境监测与调节装置',
    paragraphs: [
      { id: 'ref-d2-p1', ordinal: 1, paragraphNo: '[0008]', text: '展柜内布置环境传感器，传感器沿柜体对角线排列。' },
      { id: 'ref-d2-p2', ordinal: 2, paragraphNo: '[0021]', text: '控制模块接收传感器数据并与通信模块交互。' }
    ]
  }
]
/** 模拟检索机构早先发回的报告：部分比对只带段号（无段落号），用于演示收到时按段号补出段落号 */
function sampleRawReport(): RawSearchReport {
  return {
    agency: '国知检索中心',
    items: [
      {
        claimNumber: 1,
        comparisons: [
          { featureLabel: 'A · 柜体', referenceDocumentCode: 'D1', paragraphOrdinal: 1, conclusion: 'identical' },
          { featureLabel: 'B · 环境传感模块', referenceDocumentCode: 'D1', paragraphOrdinal: 2, conclusion: 'identical' },
          { featureLabel: 'B · 环境传感模块', referenceDocumentCode: 'D2', paragraphOrdinal: 1, conclusion: 'similar' },
          { featureLabel: 'C · 控制模块通信', referenceDocumentCode: 'D2', paragraphOrdinal: 2, conclusion: 'different' }
        ]
      },
      { claimNumber: 2, comparisonFailed: true },
      {
        claimNumber: 3,
        comparisons: [
          { featureLabel: 'F · 分级调节', referenceDocumentCode: 'D1', paragraphOrdinal: 3, conclusion: 'similar' }
        ]
      }
    ]
  }
}
const initialFeatures: Feature[] = [
  { id: 'feature-a', claimId: 'claim-1', label: 'A · 柜体', text: '柜体', parentId: null, referenceIds: [], supportIds: ['para-0012'], ownerRole: 'author', updatedAt: '2026-09-01T00:00:00.000Z' },
  { id: 'feature-b', claimId: 'claim-1', label: 'B · 环境传感模块', text: '设置于柜体内，用于采集温湿度数据', parentId: 'feature-a', referenceIds: [], supportIds: ['para-0012', 'para-0018'], ownerRole: 'author', updatedAt: '2026-09-01T00:00:00.000Z' },
  { id: 'feature-c', claimId: 'claim-1', label: 'C · 控制模块通信', text: '与环境传感模块通信', parentId: 'feature-a', referenceIds: ['feature-b'], supportIds: ['para-0012', 'para-0031'], ownerRole: 'author', updatedAt: '2026-09-01T00:00:00.000Z' },
  { id: 'feature-d', claimId: 'claim-1', label: 'D · 调节微环境', text: '根据温湿度数据调节柜体微环境', parentId: null, referenceIds: ['feature-b', 'feature-c'], supportIds: ['para-0024', 'para-0040'], ownerRole: 'author', updatedAt: '2026-09-01T00:00:00.000Z' },
  { id: 'feature-e', claimId: 'claim-2', label: 'E · 对角线布置', text: '多个温湿度传感器沿柜体对角线布置', parentId: null, referenceIds: [], supportIds: ['para-0018'], ownerRole: 'author', updatedAt: '2026-09-01T00:00:00.000Z' },
  { id: 'feature-f', claimId: 'claim-3', label: 'F · 分级调节', text: '基于历史数据与当前数据的偏差分级调节除湿单元', parentId: null, referenceIds: [], supportIds: ['para-0024'], ownerRole: 'author', updatedAt: '2026-09-01T00:00:00.000Z' }
]
const initialAnnotations: Annotation[] = [
  { id: 'annotation-1', featureId: 'feature-b', authorRole: 'examiner', authorName: '审查员 · 李岚', text: '“温湿度数据”是否包括露点等派生数据？建议在从属权利要求中限定。', updatedAt: '2026-09-24T03:10:00.000Z' },
  { id: 'annotation-2', featureId: 'feature-d', authorRole: 'author', authorName: '代理人 · 陈昊', text: '[0024] 已支持分级调节，发布前补充除湿单元与通信模块的连接关系。', updatedAt: '2026-09-24T04:05:00.000Z' }
]
function demoState(): WorkbenchState {
  return {
    claims: initialClaims, paragraphs: initialParagraphs, features: initialFeatures,
    annotations: initialAnnotations, orphanMappings: [], versions: [],
    referenceDocuments: initialReferenceDocuments, reports: [],
    role: 'author', currentUserRole: 'author', selectedClaimId: 'claim-1', selectedFeatureId: 'feature-b', activeTab: 'mapping'
  }
}
function clone<T>(value: T): T { return structuredClone(value) }

@Injectable({ providedIn: 'root' })
export class WorkbenchService implements OnDestroy {
  private readonly initialState = this.loadState()
  private readonly stateSubject = new BehaviorSubject<WorkbenchState>(this.initialState)
  private readonly historySubject = new BehaviorSubject<{ past: number; future: number }>({ past: 0, future: 0 })
  private past: WorkbenchState[] = []
  private future: WorkbenchState[] = []

  readonly state$ = this.stateSubject.asObservable()
  readonly history$ = this.historySubject.asObservable()
  readonly claims$ = this.state$.pipe(map(state => state.claims))
  readonly paragraphs$ = this.state$.pipe(map(state => state.paragraphs))
  readonly features$ = this.state$.pipe(map(state => state.features))
  readonly annotations$ = this.state$.pipe(map(state => state.annotations))
  readonly role$ = this.state$.pipe(map(state => state.role))
  readonly selectedClaim$ = this.state$.pipe(map(state => state.claims.find(claim => claim.id === state.selectedClaimId) || state.claims[0]))
  readonly selectedFeature$ = this.state$.pipe(map(state => state.features.find(feature => feature.id === state.selectedFeatureId) || null))
  readonly issues$ = this.state$.pipe(map(state => this.validate(state)))

  constructor() {
    if (typeof window !== 'undefined') window.addEventListener('beforeunload', () => this.savePosition())
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') window.removeEventListener('beforeunload', () => this.savePosition())
  }

  get snapshot(): WorkbenchState { return clone(this.stateSubject.value) }
  get canUndo(): boolean { return this.past.length > 0 }
  get canRedo(): boolean { return this.future.length > 0 }

  selectClaim(id: string): void {
    this.patchState(state => { state.selectedClaimId = id; state.selectedFeatureId = state.features.find(feature => feature.claimId === id)?.id || null })
    this.savePosition()
  }

  selectFeature(id: string | null): void {
    this.patchState(state => { state.selectedFeatureId = id })
    this.savePosition()
  }

  setRole(role: Role): void {
    this.patchState(state => { state.role = role; state.currentUserRole = role })
  }

  setTab(tab: string): void {
    this.patchState(state => { state.activeTab = tab })
    this.savePosition()
  }

  updateClaim(patch: Partial<Claim>): void {
    this.commit(state => {
      const claim = state.claims.find(item => item.id === state.selectedClaimId)
      if (claim) Object.assign(claim, patch)
    })
  }

  addClaim(): void {
    this.commit(state => {
      const number = Math.max(0, ...state.claims.map(claim => claim.number)) + 1
      const claim: Claim = { id: `claim-${Date.now()}`, number, title: `权利要求 ${number}`, independent: false, text: '请录入权利要求正文。' }
      state.claims.push(claim)
      state.selectedClaimId = claim.id
      state.selectedFeatureId = null
    })
  }

  addParagraph(): void {
    if (this.stateSubject.value.role === 'viewer') return
    this.commit(state => {
      const next = state.paragraphs.length + 1
      state.paragraphs.push({ id: `para-${Date.now()}`, section: `说明书 [${String(next * 5).padStart(4, '0')}]`, text: '' })
    })
  }

  updateParagraph(id: string, patch: Partial<Paragraph>): void {
    if (this.stateSubject.value.role === 'viewer') return
    this.commit(state => {
      const paragraph = state.paragraphs.find(item => item.id === id)
      if (paragraph) Object.assign(paragraph, patch)
    })
  }

  deleteParagraph(id: string): void {
    if (this.stateSubject.value.role === 'viewer') return
    this.commit(state => {
      state.paragraphs = state.paragraphs.filter(item => item.id !== id)
      state.features.forEach(feature => { feature.supportIds = feature.supportIds.filter(paragraphId => paragraphId !== id) })
      state.orphanMappings = state.orphanMappings.filter(item => item.paragraphId !== id)
    })
  }

  addFeature(): void {
    if (this.stateSubject.value.role === 'viewer') return
    this.commit(state => {
      const feature: Feature = {
        id: `feature-${Date.now()}`, claimId: state.selectedClaimId,
        label: `新特征 ${state.features.filter(item => item.claimId === state.selectedClaimId).length + 1}`,
        text: '', parentId: null, referenceIds: [], supportIds: [], ownerRole: state.role,
        updatedAt: new Date().toISOString()
      }
      state.features.push(feature)
      state.selectedFeatureId = feature.id
    })
  }

  updateFeature(id: string, patch: Partial<Feature>): void {
    if (this.stateSubject.value.role === 'viewer') return
    this.commit(state => {
      const feature = state.features.find(item => item.id === id)
      if (feature) { Object.assign(feature, patch); feature.updatedAt = new Date().toISOString() }
    })
  }

  deleteFeature(id: string): void {
    if (this.stateSubject.value.role === 'viewer') return
    this.commit(state => {
      const feature = state.features.find(item => item.id === id)
      if (!feature) return
      feature.supportIds.forEach(paragraphId => state.orphanMappings.push({
        id: `orphan-${Date.now()}-${paragraphId}`, featureLabel: feature.label, paragraphId,
        reason: `技术特征“${feature.label}”已删除，但支持段落映射仍被保留。`
      }))
      state.features = state.features.filter(item => item.id !== id)
      state.features.forEach(item => {
        item.referenceIds = item.referenceIds.filter(refId => refId !== id)
        if (item.parentId === id) item.parentId = null
      })
      state.annotations = state.annotations.filter(item => item.featureId !== id)
      state.selectedFeatureId = state.features.find(item => item.claimId === state.selectedClaimId)?.id || null
    })
  }

  toggleParagraphMapping(featureId: string, paragraphId: string): void {
    if (this.stateSubject.value.role === 'viewer') return
    this.commit(state => {
      const feature = state.features.find(item => item.id === featureId)
      if (!feature) return
      const index = feature.supportIds.indexOf(paragraphId)
      if (index >= 0) feature.supportIds.splice(index, 1)
      else feature.supportIds.push(paragraphId)
      feature.updatedAt = new Date().toISOString()
      state.orphanMappings = state.orphanMappings.filter(item => item.paragraphId !== paragraphId)
    })
  }

  clearOrphan(id: string): void {
    this.commit(state => { state.orphanMappings = state.orphanMappings.filter(item => item.id !== id) })
  }

  /** 模拟检索机构发回的原始报告（早先格式：部分比对只带段号） */
  sampleRawReport(): RawSearchReport { return sampleRawReport() }

  /**
   * 接收检索报告：按权利要求项逐项处理，每项独立事务。
   * 报告单独存放，绝不覆盖工作台的特征正文、层级、引用和支持段落（两边各留一份）。
   * 失败的项只回滚该项（不留半成品结果），成功项保留；返回成功/失败计数。
   */
  receiveReport(raw: RawSearchReport): { success: number; failed: number } {
    const receivedAt = new Date().toISOString()
    const report: SearchReport = {
      id: `report-${Date.now()}`,
      agency: raw.agency?.trim() || '检索机构',
      receivedAt,
      rawItems: clone(raw.items),
      items: raw.items.map(rawItem => this.processReportItem(this.stateSubject.value, rawItem, receivedAt))
    }
    this.commit(state => {
      state.reports.unshift(report)
      this.refreshComparisonStatus(state)
    })
    return {
      success: report.items.filter(item => item.status === 'success').length,
      failed: report.items.filter(item => item.status === 'failed').length
    }
  }

  /** 重试某份报告中所有失败的权利要求项：成功项原样保留，只重跑失败项。 */
  retryFailedItems(reportId: string): void {
    const receivedAt = new Date().toISOString()
    this.commit(state => {
      const report = state.reports.find(item => item.id === reportId)
      if (!report) return
      report.items = report.items.map((item, index) => {
        if (item.status !== 'failed') return item
        const raw = report.rawItems[index]
        const retried = this.processReportItem(state, raw, receivedAt)
        // 原型中模拟检索机构重新比对后返回结果（真实环境由机构重新发回）
        if (retried.status === 'failed' && raw.comparisonFailed) return this.simulateAgencyRecomparison(state, raw, receivedAt)
        return retried
      })
      this.refreshComparisonStatus(state)
    })
  }

  /** 代理人确认一条待核的比对结论。 */
  confirmResult(reportId: string, itemIndex: number, resultId: string): void {
    this.commit(state => {
      const result = state.reports.find(report => report.id === reportId)?.items[itemIndex]?.results.find(item => item.id === resultId)
      if (result) { result.status = 'confirmed'; result.staleReason = undefined }
    })
  }

  /** 处理单个权利要求项：返回该项的接收结果（成功则带比对结论，失败则只带原因，不写半成品）。 */
  private processReportItem(state: WorkbenchState, raw: RawReportItem, receivedAt: string): ReportClaimItem {
    const claim = state.claims.find(item => item.number === raw.claimNumber)
    if (!claim) {
      return { claimId: null, claimNumber: raw.claimNumber, status: 'failed', error: `未找到权利要求 ${raw.claimNumber}，该项比对结果未写入。`, results: [], agencyFeatureCount: raw.comparisons?.length ?? 0 }
    }
    if (raw.comparisonFailed) {
      return { claimId: claim.id, claimNumber: raw.claimNumber, status: 'failed', error: '检索机构比对失败，可在补充材料后重试该项。', results: [], agencyFeatureCount: raw.comparisons?.length ?? 0 }
    }
    const results: ComparisonResult[] = []
    const claimFeatures = state.features.filter(feature => feature.claimId === claim.id)
    for (const comp of raw.comparisons ?? []) {
      const feature = this.matchFeature(claimFeatures, comp.featureLabel)
      if (!feature) {
        return { claimId: claim.id, claimNumber: raw.claimNumber, status: 'failed', error: `特征“${comp.featureLabel}”与工作台特征不匹配，该项比对结果未写入。`, results: [], agencyFeatureCount: raw.comparisons?.length ?? 0 }
      }
      const refDoc = state.referenceDocuments.find(doc => doc.code === comp.referenceDocumentCode)
      if (!refDoc) {
        return { claimId: claim.id, claimNumber: raw.claimNumber, status: 'failed', error: `未找到对比文件 ${comp.referenceDocumentCode}，该项比对结果未写入。`, results: [], agencyFeatureCount: raw.comparisons?.length ?? 0 }
      }
      let refPara: ReferenceParagraph | undefined
      let paragraphNo = comp.paragraphNo?.trim() ?? ''
      let resolved = false
      if (paragraphNo) {
        refPara = refDoc.paragraphs.find(para => para.paragraphNo === paragraphNo)
      } else if (comp.paragraphOrdinal != null) {
        // 早先报告只带段号：收到时按段号补出段落号
        refPara = refDoc.paragraphs.find(para => para.ordinal === comp.paragraphOrdinal)
        if (refPara) { paragraphNo = refPara.paragraphNo; resolved = true }
      }
      results.push({
        id: `result-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        featureId: feature.id,
        featureLabel: comp.featureLabel,
        referenceDocumentId: refDoc.id,
        referenceDocumentCode: refDoc.code,
        referenceParagraphId: refPara?.id ?? null,
        paragraphOrdinal: comp.paragraphOrdinal ?? null,
        paragraphNo,
        paragraphResolved: resolved,
        conclusion: comp.conclusion,
        status: 'confirmed',
        receivedAt
      })
    }
    return { claimId: claim.id, claimNumber: raw.claimNumber, status: 'success', results, agencyFeatureCount: raw.comparisons?.length ?? 0 }
  }

  /** 按报告中的特征标识匹配工作台特征：先按标签归一化匹配，再按特征顺序兜底。 */
  private matchFeature(features: Feature[], label: string): Feature | undefined {
    const normalize = (value: string) => value.replace(/[\s·*\-_（）()【】\[\]]/g, '').toLowerCase()
    const target = normalize(label)
    const direct = features.find(feature => normalize(feature.label) === target || normalize(feature.text) === target)
    if (direct) return direct
    const byPrefix = features.find(feature => normalize(feature.label).startsWith(target) || target.startsWith(normalize(feature.label)))
    return byPrefix
  }

  /** 原型演示：检索机构重新比对后，为失败项的每个特征确定性地生成比对结论。 */
  private simulateAgencyRecomparison(state: WorkbenchState, raw: RawReportItem, receivedAt: string): ReportClaimItem {
    const claim = state.claims.find(item => item.number === raw.claimNumber)
    if (!claim) return { claimId: null, claimNumber: raw.claimNumber, status: 'failed', error: `未找到权利要求 ${raw.claimNumber}。`, results: [], agencyFeatureCount: 0 }
    const claimFeatures = state.features.filter(feature => feature.claimId === claim.id)
    const templates: Array<{ doc: string; ordinal: number; conclusion: ComparisonConclusion }> = [
      { doc: 'D1', ordinal: 2, conclusion: 'identical' },
      { doc: 'D2', ordinal: 1, conclusion: 'similar' },
      { doc: 'D1', ordinal: 3, conclusion: 'different' },
      { doc: 'D2', ordinal: 2, conclusion: 'similar' }
    ]
    const results: ComparisonResult[] = claimFeatures.map((feature, index) => {
      const template = templates[index % templates.length]
      const refDoc = state.referenceDocuments.find(doc => doc.code === template.doc)!
      const refPara = refDoc.paragraphs.find(para => para.ordinal === template.ordinal)
      return {
        id: `result-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
        featureId: feature.id,
        featureLabel: feature.label,
        referenceDocumentId: refDoc.id,
        referenceDocumentCode: refDoc.code,
        referenceParagraphId: refPara?.id ?? null,
        paragraphOrdinal: template.ordinal,
        paragraphNo: refPara?.paragraphNo ?? '',
        paragraphResolved: true,
        conclusion: template.conclusion,
        status: 'confirmed',
        receivedAt
      }
    })
    return { claimId: claim.id, claimNumber: claim.number, status: 'success', results, agencyFeatureCount: claimFeatures.length }
  }

  /**
   * 退回待核：报告中的比对结论挂着对比文件段落，
   * 如果代理人在收到报告之后动过这条特征，结论先退回待核。
   */
  private refreshComparisonStatus(state: WorkbenchState): void {
    for (const report of state.reports) {
      for (const item of report.items) {
        if (item.status !== 'success') continue
        for (const result of item.results) {
          const feature = state.features.find(item => item.id === result.featureId)
          if (!feature) {
            result.status = 'pending'
            result.staleReason = '特征已删除，比对结论待核'
          } else if (feature.updatedAt && new Date(feature.updatedAt).getTime() > new Date(result.receivedAt).getTime()) {
            result.status = 'pending'
            result.staleReason = '代理人在收到报告后修改了该特征，结论退回待核'
          }
        }
      }
    }
  }

  addAnnotation(featureId: string, text: string): void {
    const trimmed = text.trim()
    if (!trimmed) return
    const role = this.stateSubject.value.role
    const names: Record<Role, string> = { author: '代理人 · 陈昊', examiner: '审查员 · 李岚', viewer: '观察者' }
    this.commit(state => state.annotations.push({
      id: `annotation-${Date.now()}`, featureId, authorRole: role, authorName: names[role], text: trimmed, updatedAt: new Date().toISOString()
    }))
  }

  updateAnnotation(id: string, text: string): void {
    this.commit(state => {
      const annotation = state.annotations.find(item => item.id === id)
      if (annotation && annotation.authorRole === state.role) annotation.text = text
    })
  }

  deleteAnnotation(id: string): void {
    this.commit(state => {
      const annotation = state.annotations.find(item => item.id === id)
      if (annotation && annotation.authorRole === state.role) state.annotations = state.annotations.filter(item => item.id !== id)
    })
  }

  createVersion(name?: string): void {
    this.commit(state => {
      state.versions.unshift({
        id: `version-${Date.now()}`, name: name?.trim() || `快照 ${new Date().toLocaleString('zh-CN', { hour12: false })}`,
        createdAt: new Date().toISOString(), claims: clone(state.claims), features: clone(state.features)
      })
    })
  }

  restoreVersion(id: string): void {
    this.commit(state => {
      const version = state.versions.find(item => item.id === id)
      if (!version) return
      state.claims = clone(version.claims)
      state.features = clone(version.features)
      if (!state.claims.some(claim => claim.id === state.selectedClaimId)) state.selectedClaimId = state.claims[0]?.id || ''
      state.selectedFeatureId = state.features.find(feature => feature.claimId === state.selectedClaimId)?.id || null
    })
  }

  undo(): void {
    const previous = this.past.pop()
    if (!previous) return
    this.future.push(clone(this.stateSubject.value))
    this.stateSubject.next(previous)
    this.updateHistory()
    this.saveState()
  }

  redo(): void {
    const next = this.future.pop()
    if (!next) return
    this.past.push(clone(this.stateSubject.value))
    this.stateSubject.next(next)
    this.updateHistory()
    this.saveState()
  }

  savePosition(): void {
    if (typeof localStorage === 'undefined') return
    const state = this.stateSubject.value
    const position: Position = { tab: state.activeTab, claimId: state.selectedClaimId, featureId: state.selectedFeatureId, scrollY: window.scrollY }
    localStorage.setItem(POSITION_KEY, JSON.stringify(position))
    this.saveState()
  }

  readPosition(): Position {
    if (typeof localStorage === 'undefined') return { tab: this.initialState.activeTab, claimId: this.initialState.selectedClaimId, featureId: this.initialState.selectedFeatureId, scrollY: 0 }
    try { return { ...JSON.parse(localStorage.getItem(POSITION_KEY) || '{}'), ...this.stateSubject.value } } catch { return { tab: 'mapping', claimId: this.initialState.selectedClaimId, featureId: this.initialState.selectedFeatureId, scrollY: 0 } }
  }

  exportJson(): string { return JSON.stringify({ ...this.snapshot, validationIssues: this.validate(this.stateSubject.value) }, null, 2) }

  exportCsv(): string {
    const state = this.stateSubject.value
    const rows = state.features.map(feature => [
      state.claims.find(claim => claim.id === feature.claimId)?.number || '', feature.label, feature.text,
      state.features.find(item => item.id === feature.parentId)?.label || '',
      feature.referenceIds.map(id => state.features.find(item => item.id === id)?.label || id).join('；'),
      feature.supportIds.map(id => state.paragraphs.find(item => item.id === id)?.section || id).join('；')
    ])
    const csv = [['权利要求', '技术特征', '特征内容', '父级特征', '引用特征', '支持段落'], ...rows]
      .map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n')
    return `\uFEFF${csv}`
  }

  validate(state = this.stateSubject.value): ValidationIssue[] {
    const issues: ValidationIssue[] = []
    for (const feature of state.features) {
      if (!feature.text.trim()) issues.push({ id: `empty-${feature.id}`, severity: 'warning', type: 'empty-feature', featureId: feature.id, title: `${feature.label} 内容为空`, detail: '请补全技术特征文字，避免映射对象不明确。' })
      if (!feature.supportIds.length) issues.push({ id: `support-${feature.id}`, severity: 'error', type: 'missing-support', featureId: feature.id, title: `${feature.label} 缺少说明书依据`, detail: '至少为一个说明书段落建立支持映射。' })
      if (this.hasReferenceCycle(feature, state.features)) issues.push({ id: `cycle-${feature.id}`, severity: 'error', type: 'cycle', featureId: feature.id, title: `${feature.label} 存在循环引用`, detail: '特征层级或引用关系形成闭环，请移除其中一条关系。' })
    }
    state.orphanMappings.forEach(item => issues.push({ id: item.id, severity: 'warning', type: 'orphan-mapping', title: '存在待清理映射', detail: item.reason }))
    return issues
  }

  private hasReferenceCycle(start: Feature, features: Feature[]): boolean {
    const visited = new Set<string>()
    const visit = (id: string): boolean => {
      if (id === start.id && visited.size > 0) return true
      if (visited.has(id)) return false
      visited.add(id)
      const feature = features.find(item => item.id === id)
      if (!feature) return false
      if (feature.parentId && visit(feature.parentId)) return true
      return feature.referenceIds.some(visit)
    }
    return visit(start.id)
  }

  private commit(recipe: (state: WorkbenchState) => void): void {
    const current = clone(this.stateSubject.value)
    const next = clone(current)
    recipe(next)
    this.refreshComparisonStatus(next)
    this.past.push(current)
    if (this.past.length > 60) this.past.shift()
    this.future = []
    this.stateSubject.next(next)
    this.updateHistory()
    this.saveState()
  }

  private patchState(recipe: (state: WorkbenchState) => void): void {
    const next = clone(this.stateSubject.value)
    recipe(next)
    this.stateSubject.next(next)
    this.saveState()
  }

  private updateHistory(): void { this.historySubject.next({ past: this.past.length, future: this.future.length }) }
  private saveState(): void { if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(this.stateSubject.value)) }
  private loadState(): WorkbenchState {
    if (typeof localStorage === 'undefined') return demoState()
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? { ...demoState(), ...JSON.parse(stored) } : demoState()
    } catch { return demoState() }
  }
}
