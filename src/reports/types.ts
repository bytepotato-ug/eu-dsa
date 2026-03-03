/**
 * Transparency report types per Implementing Regulation (EU) 2024/2835.
 *
 * Structure: 10 quantitative parts + 1 qualitative part.
 * Format: Annual for all tiers; semi-annual for VLOPs/VLOSEs.
 * Deadline: 2 months after reporting period end.
 */

// ---- DSA Tiers ----

export const DsaTier = {
  /** Art. 15 — all intermediary services */
  INTERMEDIARY: 'INTERMEDIARY',
  /** Art. 24 — online platforms (hosting + public dissemination) */
  PLATFORM: 'PLATFORM',
  /** Art. 42 — very large online platforms (45M+ monthly active EU users) */
  VLOP: 'VLOP',
} as const;

export type DsaTier = (typeof DsaTier)[keyof typeof DsaTier];

// ---- Reporting Period ----

export interface ReportingPeriod {
  start: Date;
  end: Date;
  year: number;
  half?: 1 | 2;
}

// ---- Report Identification (Part 1) ----

export interface ReportIdentification {
  providerName: string;
  legalEntity: string;
  platformUrl: string;
  tier: DsaTier;
  isSmallEnterprise: boolean;
  reportingPeriod: ReportingPeriod;
  publicationDate: Date;
  contactEmail?: string;
}

// ---- Part 3: Member State Orders ----

export interface AuthorityOrderEntry {
  memberState: string;
  category: string;
  ordersReceived: number;
  ordersComplied: number;
  medianResponseHours: number;
}

export interface AuthorityOrderData {
  entries: AuthorityOrderEntry[];
  totalReceived: number;
  totalComplied: number;
}

// ---- Part 4: Notices (Hosting+ only, Art. 15(1)(b)) ----

export interface NoticeStatsEntry {
  memberState: string;
  category: string;
  sourceType: string;
  totalReceived: number;
  actionTaken: number;
  noAction: number;
  basisIllegal: number;
  basisTos: number;
  medianHandlingHours: number;
  automatedProcessing: number;
}

export interface NoticeStatsData {
  entries: NoticeStatsEntry[];
  totalReceived: number;
  totalActionTaken: number;
}

// ---- Part 5: Own Initiative — Illegal Content (Art. 15(1)(c)) ----

export interface OwnInitiativeEntry {
  category: string;
  memberState: string;
  itemsActioned: number;
  restrictionType: string;
  automatedDetection: number;
  automatedDecision: number;
}

export interface OwnInitiativeData {
  entries: OwnInitiativeEntry[];
  totalActioned: number;
}

// ---- Part 6: Own Initiative — TOS Violations ----

export interface TosViolationEntry {
  category: string;
  memberState: string;
  itemsActioned: number;
  restrictionType: string;
  automatedDetection: number;
  automatedDecision: number;
  trustedFlaggerNotices: number;
}

export interface TosViolationData {
  entries: TosViolationEntry[];
  totalActioned: number;
  trustedFlaggerTotal: number;
}

// ---- Part 7: Complaints & Appeals (Platform+, Art. 24) ----

export interface ComplaintStatsData {
  complaintsByBasis: {
    illegalContent: number;
    tosViolation: number;
  };
  totalComplaints: number;
  decisionsReversed: number;
  medianResolutionDays: number;
  disputesSubmitted: number;
  disputeOutcomes: {
    inFavourComplainant: number;
    inFavourProvider: number;
    settled: number;
  };
  suspensionsImposed: number;
  suspensionsByCategory: Record<string, number>;
}

// ---- Part 8: Automated Means (Art. 15(1)(e)) ----

export interface AutomatedTool {
  toolName: string;
  purpose: 'detection' | 'decision' | 'both';
  description: string;
  categories: string[];
  safeguards: string;
}

export interface AutomationStatsData {
  tools: AutomatedTool[];
}

// ---- Part 9: Human Resources (VLOP only, Art. 42) ----

export interface HumanResourceEntry {
  language: string;
  moderatorCount: number;
  qualifications?: string;
}

export interface HumanResourceData {
  entries: HumanResourceEntry[];
  totalModerators: number;
}

// ---- Part 10: AMAR — Automated Means Assessment Results (Art. 15(1)(e)) ----

export interface AmarEntry {
  toolName: string;
  language: string;
  accuracyIndicator: number;
  errorRate: number;
  falsePositiveRate?: number;
  falseNegativeRate?: number;
}

export interface AmarData {
  entries: AmarEntry[];
}

// ---- Part 11: Qualitative Information ----

export interface QualitativeData {
  methodology?: string;
  challenges?: string;
  cooperationWithAuthorities?: string;
  outOfCourtSettlements?: string;
  other?: string;
}

// ---- Processing Time (supplementary) ----

export interface ProcessingTimeData {
  medianNoticeHandlingHours: number;
  medianOrderResponseHours: number;
  medianComplaintResolutionDays: number;
}

// ---- Full Transparency Report ----

export interface TransparencyReport {
  identification: ReportIdentification;
  authorityOrders: AuthorityOrderData;
  notices?: NoticeStatsData;
  ownInitiativeIllegal: OwnInitiativeData;
  ownInitiativeTos?: TosViolationData;
  complaints?: ComplaintStatsData;
  automation: AutomationStatsData;
  humanResources?: HumanResourceData;
  amar: AmarData;
  qualitative: QualitativeData;
  processingTimes: ProcessingTimeData;
  generatedAt: Date;
}
