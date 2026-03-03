import { describe, it, expect } from 'vitest';
import { TransparencyReportGenerator, createReportGenerator } from '../../src/reports/generator.js';
import type { TransparencyDataProvider } from '../../src/reports/aggregator.js';
import type { ReportingPeriod } from '../../src/reports/types.js';
import { toCSV, toJSON, toMarkdown } from '../../src/reports/formatters.js';

const period: ReportingPeriod = {
  start: new Date('2025-01-01'),
  end: new Date('2025-12-31'),
  year: 2025,
};

function createMockProvider(overrides?: Partial<TransparencyDataProvider>): TransparencyDataProvider {
  return {
    getAuthorityOrders: async () => ({
      entries: [
        { memberState: 'DE', category: 'Illegal Speech', ordersReceived: 5, ordersComplied: 4, medianResponseHours: 12 },
        { memberState: 'FR', category: 'Terrorism', ordersReceived: 2, ordersComplied: 2, medianResponseHours: 6 },
      ],
      totalReceived: 7,
      totalComplied: 6,
    }),
    getNoticeStats: async () => ({
      entries: [
        { memberState: 'DE', category: 'Hate Speech', sourceType: 'Article 16', totalReceived: 100, actionTaken: 60, noAction: 40, basisIllegal: 50, basisTos: 10, medianHandlingHours: 8, automatedProcessing: 30 },
      ],
      totalReceived: 100,
      totalActionTaken: 60,
    }),
    getOwnInitiativeStats: async () => ({
      entries: [
        { category: 'Terrorism', memberState: 'DE', itemsActioned: 15, restrictionType: 'Removal', automatedDetection: 10, automatedDecision: 5 },
      ],
      totalActioned: 15,
    }),
    getTosViolationStats: async () => ({
      entries: [
        { category: 'Spam', memberState: 'DE', itemsActioned: 200, restrictionType: 'Removal', automatedDetection: 180, automatedDecision: 150, trustedFlaggerNotices: 10 },
      ],
      totalActioned: 200,
      trustedFlaggerTotal: 10,
    }),
    getComplaintStats: async () => ({
      complaintsByBasis: { illegalContent: 30, tosViolation: 20 },
      totalComplaints: 50,
      decisionsReversed: 8,
      medianResolutionDays: 14,
      disputesSubmitted: 5,
      disputeOutcomes: { inFavourComplainant: 2, inFavourProvider: 2, settled: 1 },
      suspensionsImposed: 3,
      suspensionsByCategory: { 'Repeat Offender': 3 },
    }),
    getAutomationStats: async () => ({
      tools: [
        {
          toolName: 'GPT-4o Classifier',
          purpose: 'detection' as const,
          description: 'AI content classification for harmful content detection',
          categories: ['Hate Speech', 'Terrorism', 'CSAM'],
          safeguards: 'Human review required for all automated detections. No auto-removal except CSAM.',
        },
      ],
    }),
    getHumanResourceStats: async () => ({
      entries: [
        { language: 'DE', moderatorCount: 5, qualifications: 'Trained on DSA requirements' },
        { language: 'EN', moderatorCount: 3, qualifications: 'Certified content moderators' },
      ],
      totalModerators: 8,
    }),
    getAmarStats: async () => ({
      entries: [
        { toolName: 'GPT-4o Classifier', language: 'DE', accuracyIndicator: 0.94, errorRate: 0.06 },
        { toolName: 'GPT-4o Classifier', language: 'EN', accuracyIndicator: 0.96, errorRate: 0.04 },
      ],
    }),
    getQualitativeData: async () => ({
      methodology: 'Reports are reviewed by trained moderators using a tiered system.',
      challenges: 'Cross-language content moderation remains challenging.',
      cooperationWithAuthorities: 'Regular exchange with BNetzA.',
    }),
    getProcessingTimeStats: async () => ({
      medianNoticeHandlingHours: 8,
      medianOrderResponseHours: 12,
      medianComplaintResolutionDays: 14,
    }),
    ...overrides,
  };
}

describe('TransparencyReportGenerator', () => {
  describe('generate', () => {
    it('generates a VLOP report with all parts', async () => {
      const generator = createReportGenerator({
        platformName: 'TestPlatform',
        legalEntity: 'Test GmbH',
        platformUrl: 'https://test.example.com',
        tierConfig: { tier: 'VLOP', isSmallEnterprise: false },
      });

      const report = await generator.generate(createMockProvider(), period);

      expect(report.identification.providerName).toBe('TestPlatform');
      expect(report.identification.tier).toBe('VLOP');
      expect(report.authorityOrders.totalReceived).toBe(7);
      expect(report.notices).toBeTruthy();
      expect(report.notices!.totalReceived).toBe(100);
      expect(report.ownInitiativeIllegal.totalActioned).toBe(15);
      expect(report.ownInitiativeTos).toBeTruthy();
      expect(report.complaints).toBeTruthy();
      expect(report.complaints!.totalComplaints).toBe(50);
      expect(report.automation.tools).toHaveLength(1);
      expect(report.humanResources).toBeTruthy();
      expect(report.humanResources!.totalModerators).toBe(8);
      expect(report.amar.entries).toHaveLength(2);
      expect(report.generatedAt).toBeInstanceOf(Date);
    });

    it('generates a PLATFORM report (no human resources part)', async () => {
      const generator = createReportGenerator({
        platformName: 'SmallPlatform',
        legalEntity: 'Small UG',
        platformUrl: 'https://small.example.com',
        tierConfig: { tier: 'PLATFORM', isSmallEnterprise: false },
      });

      const report = await generator.generate(createMockProvider(), period);

      expect(report.notices).toBeTruthy();
      expect(report.complaints).toBeTruthy();
      expect(report.humanResources).toBeUndefined();
    });

    it('generates an INTERMEDIARY report (minimal parts)', async () => {
      const generator = createReportGenerator({
        platformName: 'CDN Service',
        legalEntity: 'CDN Corp',
        platformUrl: 'https://cdn.example.com',
        tierConfig: { tier: 'INTERMEDIARY', isSmallEnterprise: true },
      });

      const report = await generator.generate(createMockProvider(), period);

      expect(report.identification.isSmallEnterprise).toBe(true);
      expect(report.notices).toBeUndefined();
      expect(report.ownInitiativeTos).toBeUndefined();
      expect(report.complaints).toBeUndefined();
      expect(report.humanResources).toBeUndefined();
      // These are always included
      expect(report.authorityOrders).toBeTruthy();
      expect(report.ownInitiativeIllegal).toBeTruthy();
      expect(report.automation).toBeTruthy();
      expect(report.amar).toBeTruthy();
    });
  });
});

describe('Formatters', () => {
  async function makeReport() {
    const generator = createReportGenerator({
      platformName: 'TestPlatform',
      legalEntity: 'Test GmbH',
      platformUrl: 'https://test.example.com',
      tierConfig: { tier: 'VLOP', isSmallEnterprise: false },
    });
    return generator.generate(createMockProvider(), period);
  }

  describe('toCSV', () => {
    it('produces all 10 CSV parts for VLOP', async () => {
      const report = await makeReport();
      const csv = toCSV(report);

      expect(csv.part1_identification).toContain('TestPlatform');
      expect(csv.part3_orders).toContain('DE');
      expect(csv.part4_notices).toBeTruthy();
      expect(csv.part4_notices).toContain('Hate Speech');
      expect(csv.part5_own_initiative_illegal).toContain('Terrorism');
      expect(csv.part6_own_initiative_tos).toBeTruthy();
      expect(csv.part6_own_initiative_tos).toContain('Spam');
      expect(csv.part7_complaints).toBeTruthy();
      expect(csv.part7_complaints).toContain('50');
      expect(csv.part8_automation).toContain('GPT-4o');
      expect(csv.part9_human_resources).toBeTruthy();
      expect(csv.part10_amar).toContain('0.94');
      expect(csv.part11_qualitative).toContain('Methodology');
    });

    it('handles CSV-special characters', async () => {
      const generator = createReportGenerator({
        platformName: 'Test, "Platform"',
        legalEntity: 'Test GmbH',
        platformUrl: 'https://test.example.com',
        tierConfig: { tier: 'INTERMEDIARY', isSmallEnterprise: false },
      });
      const report = await generator.generate(createMockProvider(), period);
      const csv = toCSV(report);

      // Should be escaped in CSV
      expect(csv.part1_identification).toContain('"Test, ""Platform"""');
    });

    it('omits optional parts for INTERMEDIARY', async () => {
      const generator = createReportGenerator({
        platformName: 'Simple CDN',
        legalEntity: 'CDN Corp',
        platformUrl: 'https://cdn.example.com',
        tierConfig: { tier: 'INTERMEDIARY', isSmallEnterprise: false },
      });
      const report = await generator.generate(createMockProvider(), period);
      const csv = toCSV(report);

      expect(csv.part4_notices).toBeUndefined();
      expect(csv.part6_own_initiative_tos).toBeUndefined();
      expect(csv.part7_complaints).toBeUndefined();
      expect(csv.part9_human_resources).toBeUndefined();
    });
  });

  describe('toJSON', () => {
    it('produces valid JSON with dates as ISO strings', async () => {
      const report = await makeReport();
      const json = toJSON(report);
      const parsed = JSON.parse(json);

      expect(parsed.identification.providerName).toBe('TestPlatform');
      expect(typeof parsed.generatedAt).toBe('string');
      expect(parsed.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('toMarkdown', () => {
    it('produces readable Markdown with all sections', async () => {
      const report = await makeReport();
      const md = toMarkdown(report);

      expect(md).toContain('# Transparency Report — TestPlatform');
      expect(md).toContain('## Part 3: Member State Orders');
      expect(md).toContain('## Part 4: Notices');
      expect(md).toContain('## Part 7: Complaints and Appeals');
      expect(md).toContain('## Part 8: Automated Means');
      expect(md).toContain('GPT-4o Classifier');
      expect(md).toContain('## Part 9: Human Resources');
      expect(md).toContain('## Part 10: Automated Means Assessment Results');
      expect(md).toContain('94.0%');
      expect(md).toContain('## Part 11: Qualitative Information');
      expect(md).toContain('## Processing Times');
      expect(md).toContain('eu-dsa');
    });

    it('omits optional sections for INTERMEDIARY', async () => {
      const generator = createReportGenerator({
        platformName: 'Simple CDN',
        legalEntity: 'CDN Corp',
        platformUrl: 'https://cdn.example.com',
        tierConfig: { tier: 'INTERMEDIARY', isSmallEnterprise: false },
      });
      const report = await generator.generate(createMockProvider(), period);
      const md = toMarkdown(report);

      expect(md).not.toContain('## Part 4: Notices');
      expect(md).not.toContain('## Part 7: Complaints');
      expect(md).not.toContain('## Part 9: Human Resources');
    });

    it('includes outOfCourtSettlements section when populated', async () => {
      const generator = createReportGenerator({
        platformName: 'TestPlatform',
        legalEntity: 'Test GmbH',
        platformUrl: 'https://test.example.com',
        tierConfig: { tier: 'VLOP', isSmallEnterprise: false },
      });
      const report = await generator.generate(createMockProvider({
        getQualitativeData: async () => ({
          methodology: 'Standard approach.',
          outOfCourtSettlements: 'Participated in 5 out-of-court settlements via certified body.',
        }),
      }), period);
      const md = toMarkdown(report);

      expect(md).toContain('### Out-of-Court Settlements');
      expect(md).toContain('Participated in 5 out-of-court settlements');
    });

    it('includes other qualitative section when populated', async () => {
      const generator = createReportGenerator({
        platformName: 'TestPlatform',
        legalEntity: 'Test GmbH',
        platformUrl: 'https://test.example.com',
        tierConfig: { tier: 'VLOP', isSmallEnterprise: false },
      });
      const report = await generator.generate(createMockProvider({
        getQualitativeData: async () => ({
          methodology: 'Standard approach.',
          other: 'Additional notes on DSA compliance measures.',
        }),
      }), period);
      const md = toMarkdown(report);

      expect(md).toContain('### Other');
      expect(md).toContain('Additional notes on DSA compliance');
    });

    it('includes both outOfCourtSettlements and other in correct order', async () => {
      const generator = createReportGenerator({
        platformName: 'TestPlatform',
        legalEntity: 'Test GmbH',
        platformUrl: 'https://test.example.com',
        tierConfig: { tier: 'VLOP', isSmallEnterprise: false },
      });
      const report = await generator.generate(createMockProvider({
        getQualitativeData: async () => ({
          methodology: 'Standard approach.',
          cooperationWithAuthorities: 'Quarterly reports.',
          outOfCourtSettlements: 'Used certified ADR body in 3 cases.',
          other: 'Invested in AI safety research.',
        }),
      }), period);
      const md = toMarkdown(report);

      expect(md).toContain('### Out-of-Court Settlements');
      expect(md).toContain('### Other');
      const ocsIndex = md.indexOf('### Out-of-Court Settlements');
      const otherIndex = md.indexOf('### Other');
      expect(ocsIndex).toBeLessThan(otherIndex);
    });
  });
});
