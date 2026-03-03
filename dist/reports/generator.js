/**
 * TransparencyReportGenerator.
 *
 * Collects data from a TransparencyDataProvider and assembles
 * a complete TransparencyReport per Implementing Regulation 2024/2835.
 *
 * Tier-aware: only includes parts applicable to the platform's tier.
 */
export class TransparencyReportGenerator {
    config;
    constructor(config) {
        this.config = config;
    }
    /**
     * Generate a complete transparency report for the given period.
     */
    async generate(provider, period) {
        const tier = this.config.tierConfig.tier;
        const identification = {
            providerName: this.config.platformName,
            legalEntity: this.config.legalEntity,
            platformUrl: this.config.platformUrl,
            tier,
            isSmallEnterprise: this.config.tierConfig.isSmallEnterprise,
            reportingPeriod: period,
            publicationDate: new Date(),
            contactEmail: this.config.contactEmail,
        };
        // Part 3: Authority orders (all tiers)
        const authorityOrders = await provider.getAuthorityOrders(period);
        // Part 4: Notices (hosting services and above — PLATFORM, VLOP)
        const notices = (tier === 'PLATFORM' || tier === 'VLOP') && provider.getNoticeStats
            ? await provider.getNoticeStats(period)
            : undefined;
        // Part 5: Own initiative — illegal content (all tiers)
        const ownInitiativeIllegal = await provider.getOwnInitiativeStats(period);
        // Part 6: TOS violations + trusted flagger (PLATFORM, VLOP)
        const ownInitiativeTos = (tier === 'PLATFORM' || tier === 'VLOP') && provider.getTosViolationStats
            ? await provider.getTosViolationStats(period)
            : undefined;
        // Part 7: Complaints (platforms and above)
        const complaints = (tier === 'PLATFORM' || tier === 'VLOP') && provider.getComplaintStats
            ? await provider.getComplaintStats(period)
            : undefined;
        // Part 8: Automated means (all tiers)
        const automation = await provider.getAutomationStats(period);
        // Part 9: Human resources (VLOP only)
        const humanResources = tier === 'VLOP' && provider.getHumanResourceStats
            ? await provider.getHumanResourceStats(period)
            : undefined;
        // Part 10: AMAR (all tiers)
        const amar = await provider.getAmarStats(period);
        // Part 11: Qualitative (all tiers)
        const qualitative = await provider.getQualitativeData(period);
        // Processing times
        const processingTimes = await provider.getProcessingTimeStats(period);
        return {
            identification,
            authorityOrders,
            notices,
            ownInitiativeIllegal,
            ownInitiativeTos,
            complaints,
            automation,
            humanResources,
            amar,
            qualitative,
            processingTimes,
            generatedAt: new Date(),
        };
    }
}
export function createReportGenerator(config) {
    return new TransparencyReportGenerator(config);
}
//# sourceMappingURL=generator.js.map