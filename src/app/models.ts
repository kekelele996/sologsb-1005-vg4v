export type Role = 'author' | 'examiner' | 'viewer'

export interface Claim {
  id: string
  number: number
  title: string
  text: string
  independent: boolean
}

export interface Paragraph {
  id: string
  section: string
  text: string
}

export interface Feature {
  id: string
  claimId: string
  label: string
  text: string
  parentId: string | null
  referenceIds: string[]
  supportIds: string[]
  ownerRole: Role
  /** 代理人最后修改时间；用于判断比对结论是否需要退回待核 */
  updatedAt: string
}

/** 比对结论：相同 / 相近 / 区别 */
export type ComparisonConclusion = 'identical' | 'similar' | 'different'
/** 结论状态：已确认 / 待核（代理人在收到报告后改动过特征） */
export type ComparisonStatus = 'confirmed' | 'pending'
/** 权利要求项接收状态：成功 / 失败待重试 */
export type ReportItemStatus = 'success' | 'failed'

/** 对比文件段落：检索机构引用的现有技术文献中的段落 */
export interface ReferenceParagraph {
  id: string
  /** 段号：早先报告只带段号（检索机构使用的顺序号） */
  ordinal: number
  /** 段落号：公开文本中的段落编号，如 [0015] */
  paragraphNo: string
  text: string
}

/** 对比文件：检索机构发回报告中引用的现有技术文献 */
export interface ReferenceDocument {
  id: string
  /** 文献编号，如 D1 */
  code: string
  title: string
  paragraphs: ReferenceParagraph[]
}

/** 一条比对结论：挂在某条特征与某篇对比文件段落之间 */
export interface ComparisonResult {
  id: string
  featureId: string
  /** 报告中使用的特征标识，用于与工作台特征匹配 */
  featureLabel: string
  referenceDocumentId: string
  referenceDocumentCode: string
  referenceParagraphId: string | null
  /** 段号：早先报告只带段号 */
  paragraphOrdinal: number | null
  /** 段落号：收到时按段号补出 */
  paragraphNo: string
  /** 段落号是否由段号补出 */
  paragraphResolved: boolean
  conclusion: ComparisonConclusion
  status: ComparisonStatus
  receivedAt: string
  /** 退回待核的原因 */
  staleReason?: string
}

/** 权利要求项的接收结果：按项独立成事务，失败只回滚该项 */
export interface ReportClaimItem {
  claimId: string | null
  claimNumber: number
  status: ReportItemStatus
  error?: string
  results: ComparisonResult[]
  /** 机构报告中该项的特征数量，用于对照 */
  agencyFeatureCount: number
}

/** 检索报告：检索机构发回的比对结果，与工作台数据分开存放（两边各留一份） */
export interface SearchReport {
  id: string
  agency: string
  receivedAt: string
  items: ReportClaimItem[]
  /** 原始报告数据，供失败项重试 */
  rawItems: RawReportItem[]
}

/** 检索机构发回的原始报告（JSON 交换格式） */
export interface RawComparison {
  featureLabel: string
  referenceDocumentCode: string
  /** 段号：早先报告只带段号 */
  paragraphOrdinal?: number
  /** 段落号：新报告直接带段落号 */
  paragraphNo?: string
  conclusion: ComparisonConclusion
}

export interface RawReportItem {
  claimNumber: number
  comparisons?: RawComparison[]
  /** 机构比对失败，待重试 */
  comparisonFailed?: boolean
}

export interface RawSearchReport {
  agency?: string
  items: RawReportItem[]
}

export interface Annotation {
  id: string
  featureId: string
  authorRole: Role
  authorName: string
  text: string
  updatedAt: string
}

export interface OrphanMapping {
  id: string
  featureLabel: string
  paragraphId: string
  reason: string
}

export interface ClaimVersion {
  id: string
  name: string
  createdAt: string
  claims: Claim[]
  features: Feature[]
}

export interface Position {
  tab: string
  claimId: string
  featureId: string | null
  scrollY: number
}

export interface WorkbenchState {
  claims: Claim[]
  paragraphs: Paragraph[]
  features: Feature[]
  annotations: Annotation[]
  orphanMappings: OrphanMapping[]
  versions: ClaimVersion[]
  referenceDocuments: ReferenceDocument[]
  reports: SearchReport[]
  role: Role
  selectedClaimId: string
  selectedFeatureId: string | null
  activeTab: string
  currentUserRole: Role
}

export interface ValidationIssue {
  id: string
  severity: 'error' | 'warning'
  type: 'cycle' | 'missing-support' | 'orphan-mapping' | 'empty-feature'
  featureId?: string
  title: string
  detail: string
}
