/**
 * TransparencyDataProvider interface.
 *
 * Platforms implement this to feed data into the report generator.
 * Each method maps to one or more parts of the EU transparency report.
 */
import type { ReportingPeriod, AuthorityOrderData, NoticeStatsData, OwnInitiativeData, TosViolationData, ComplaintStatsData, AutomationStatsData, HumanResourceData, AmarData, QualitativeData, ProcessingTimeData } from './types.js';
export interface TransparencyDataProvider {
    /** Part 3: Orders received from member state authorities */
    getAuthorityOrders(period: ReportingPeriod): Promise<AuthorityOrderData>;
    /** Part 4: Notices received (hosting services and above) */
    getNoticeStats?(period: ReportingPeriod): Promise<NoticeStatsData>;
    /** Part 5: Own-initiative actions against illegal content */
    getOwnInitiativeStats(period: ReportingPeriod): Promise<OwnInitiativeData>;
    /** Part 6: Own-initiative actions against TOS violations + trusted flagger data */
    getTosViolationStats?(period: ReportingPeriod): Promise<TosViolationData>;
    /** Part 7: Complaints, disputes, and account suspensions (platforms and above) */
    getComplaintStats?(period: ReportingPeriod): Promise<ComplaintStatsData>;
    /** Part 8: Description of automated tools used */
    getAutomationStats(period: ReportingPeriod): Promise<AutomationStatsData>;
    /** Part 9: Human resources for content moderation (VLOP only) */
    getHumanResourceStats?(period: ReportingPeriod): Promise<HumanResourceData>;
    /** Part 10: Automated means assessment results */
    getAmarStats(period: ReportingPeriod): Promise<AmarData>;
    /** Part 11: Qualitative information */
    getQualitativeData(period: ReportingPeriod): Promise<QualitativeData>;
    /** Supplementary: Processing time statistics */
    getProcessingTimeStats(period: ReportingPeriod): Promise<ProcessingTimeData>;
}
//# sourceMappingURL=aggregator.d.ts.map