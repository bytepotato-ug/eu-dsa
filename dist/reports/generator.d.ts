/**
 * TransparencyReportGenerator.
 *
 * Collects data from a TransparencyDataProvider and assembles
 * a complete TransparencyReport per Implementing Regulation 2024/2835.
 *
 * Tier-aware: only includes parts applicable to the platform's tier.
 */
import type { TransparencyDataProvider } from './aggregator.js';
import type { DsaTier, ReportingPeriod, TransparencyReport } from './types.js';
export interface ReportGeneratorConfig {
    platformName: string;
    legalEntity: string;
    platformUrl: string;
    tierConfig: {
        tier: DsaTier;
        isSmallEnterprise: boolean;
    };
    contactEmail?: string;
}
export declare class TransparencyReportGenerator {
    private readonly config;
    constructor(config: ReportGeneratorConfig);
    /**
     * Generate a complete transparency report for the given period.
     */
    generate(provider: TransparencyDataProvider, period: ReportingPeriod): Promise<TransparencyReport>;
}
export declare function createReportGenerator(config: ReportGeneratorConfig): TransparencyReportGenerator;
//# sourceMappingURL=generator.d.ts.map