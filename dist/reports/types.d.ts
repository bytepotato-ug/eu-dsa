/**
 * Transparency report types per Implementing Regulation (EU) 2024/2835.
 *
 * Structure: 10 quantitative parts + 1 qualitative part.
 * Format: Annual for all tiers; semi-annual for VLOPs/VLOSEs.
 * Deadline: 2 months after reporting period end.
 */
export declare const DsaTier: {
    /** Art. 15 — all intermediary services */
    readonly INTERMEDIARY: "INTERMEDIARY";
    /** Art. 24 — online platforms (hosting + public dissemination) */
    readonly PLATFORM: "PLATFORM";
    /** Art. 42 — very large online platforms (45M+ monthly active EU users) */
    readonly VLOP: "VLOP";
};
export type DsaTier = (typeof DsaTier)[keyof typeof DsaTier];
export interface ReportingPeriod {
    start: Date;
    end: Date;
    year: number;
    half?: 1 | 2;
}
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
export interface HumanResourceEntry {
    language: string;
    moderatorCount: number;
    qualifications?: string;
}
export interface HumanResourceData {
    entries: HumanResourceEntry[];
    totalModerators: number;
}
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
export interface QualitativeData {
    methodology?: string;
    challenges?: string;
    cooperationWithAuthorities?: string;
    outOfCourtSettlements?: string;
    other?: string;
}
export interface ProcessingTimeData {
    medianNoticeHandlingHours: number;
    medianOrderResponseHours: number;
    medianComplaintResolutionDays: number;
}
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
//# sourceMappingURL=types.d.ts.map