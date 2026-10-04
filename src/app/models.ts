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

export type ConclusionStatus = 'confirmed' | 'pending'

export interface ComparisonConclusion {
  id: string
  reportId: string
  claimId: string
  featureId: string
  verdict: string
  citedParagraphIds: string[]
  note: string
  status: ConclusionStatus
  createdAt: string
  updatedAt: string
}

export interface ReportFeatureEntry {
  featureId: string
  text?: string
  parentId?: string | null
  referenceIds?: string[]
  supportRefs: string[]
}

export interface ReportConclusionEntry {
  featureId: string
  verdict: string
  citedRefs: string[]
  note: string
}

export type ReportItemStatus = 'pending' | 'matched' | 'failed'

export interface ClaimReportItem {
  claimId: string | null
  claimNumber: number
  status: ReportItemStatus
  error?: string
  features: ReportFeatureEntry[]
  conclusions: ReportConclusionEntry[]
}

export interface SearchReport {
  id: string
  name: string
  source: string
  receivedAt: string
  appliedAt: string | null
  items: ClaimReportItem[]
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
  reports: SearchReport[]
  conclusions: ComparisonConclusion[]
  role: Role
  selectedClaimId: string
  selectedFeatureId: string | null
  activeTab: string
  currentUserRole: Role
}

export interface ValidationIssue {
  id: string
  severity: 'error' | 'warning'
  type: 'cycle' | 'missing-support' | 'orphan-mapping' | 'empty-feature' | 'pending-conclusion'
  featureId?: string
  title: string
  detail: string
}
