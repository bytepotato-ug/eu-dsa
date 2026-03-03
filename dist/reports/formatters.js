/**
 * Output formatters for transparency reports.
 *
 * Supports CSV (11 parts per EU spec), JSON, and Markdown.
 * XLSX support requires exceljs — available as a separate package post-1.0.
 */
// ---- CSV Formatter ----
function escapeCSV(value) {
    const str = String(value ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}
function toCSVRows(headers, rows) {
    const headerLine = headers.map(escapeCSV).join(',');
    const dataLines = rows.map(row => row.map(escapeCSV).join(','));
    return [headerLine, ...dataLines].join('\n');
}
/**
 * Format a transparency report as CSV parts (one string per EU template part).
 */
export function toCSV(report) {
    const id = report.identification;
    // Part 1: Report Identification
    const part1 = toCSVRows(['Field', 'Value'], [
        ['Provider Name', id.providerName],
        ['Legal Entity', id.legalEntity],
        ['Platform URL', id.platformUrl],
        ['Tier', id.tier],
        ['Small Enterprise', id.isSmallEnterprise ? 'Yes' : 'No'],
        ['Period Start', id.reportingPeriod.start.toISOString().split('T')[0]],
        ['Period End', id.reportingPeriod.end.toISOString().split('T')[0]],
        ['Publication Date', id.publicationDate.toISOString().split('T')[0]],
        ['Contact Email', id.contactEmail ?? ''],
    ]);
    // Part 3: Authority Orders
    const part3 = toCSVRows(['Member State', 'Category', 'Orders Received', 'Orders Complied', 'Median Response (hours)'], report.authorityOrders.entries.map(e => [
        e.memberState, e.category, e.ordersReceived, e.ordersComplied, e.medianResponseHours,
    ]));
    // Part 4: Notices
    const part4 = report.notices
        ? toCSVRows(['Member State', 'Category', 'Source Type', 'Total Received', 'Action Taken', 'No Action', 'Basis: Illegal', 'Basis: TOS', 'Median Handling (hours)', 'Automated Processing'], report.notices.entries.map(e => [
            e.memberState, e.category, e.sourceType, e.totalReceived, e.actionTaken, e.noAction, e.basisIllegal, e.basisTos, e.medianHandlingHours, e.automatedProcessing,
        ]))
        : undefined;
    // Part 5: Own Initiative — Illegal
    const part5 = toCSVRows(['Category', 'Member State', 'Items Actioned', 'Restriction Type', 'Automated Detection', 'Automated Decision'], report.ownInitiativeIllegal.entries.map(e => [
        e.category, e.memberState, e.itemsActioned, e.restrictionType, e.automatedDetection, e.automatedDecision,
    ]));
    // Part 6: TOS Violations
    const part6 = report.ownInitiativeTos
        ? toCSVRows(['Category', 'Member State', 'Items Actioned', 'Restriction Type', 'Automated Detection', 'Automated Decision', 'Trusted Flagger Notices'], report.ownInitiativeTos.entries.map(e => [
            e.category, e.memberState, e.itemsActioned, e.restrictionType, e.automatedDetection, e.automatedDecision, e.trustedFlaggerNotices,
        ]))
        : undefined;
    // Part 7: Complaints
    const part7 = report.complaints
        ? toCSVRows(['Metric', 'Value'], [
            ['Complaints (Illegal Content)', report.complaints.complaintsByBasis.illegalContent],
            ['Complaints (TOS Violation)', report.complaints.complaintsByBasis.tosViolation],
            ['Total Complaints', report.complaints.totalComplaints],
            ['Decisions Reversed', report.complaints.decisionsReversed],
            ['Median Resolution (days)', report.complaints.medianResolutionDays],
            ['Disputes Submitted', report.complaints.disputesSubmitted],
            ['Disputes: In Favour of Complainant', report.complaints.disputeOutcomes.inFavourComplainant],
            ['Disputes: In Favour of Provider', report.complaints.disputeOutcomes.inFavourProvider],
            ['Disputes: Settled', report.complaints.disputeOutcomes.settled],
            ['Account Suspensions', report.complaints.suspensionsImposed],
        ])
        : undefined;
    // Part 8: Automated Means
    const part8 = toCSVRows(['Tool Name', 'Purpose', 'Description', 'Categories', 'Safeguards'], report.automation.tools.map(t => [
        t.toolName, t.purpose, t.description, t.categories.join('; '), t.safeguards,
    ]));
    // Part 9: Human Resources
    const part9 = report.humanResources
        ? toCSVRows(['Language', 'Moderator Count', 'Qualifications'], report.humanResources.entries.map(e => [
            e.language, e.moderatorCount, e.qualifications ?? '',
        ]))
        : undefined;
    // Part 10: AMAR
    const part10 = toCSVRows(['Tool Name', 'Language', 'Accuracy Indicator', 'Error Rate', 'False Positive Rate', 'False Negative Rate'], report.amar.entries.map(e => [
        e.toolName, e.language, e.accuracyIndicator, e.errorRate, e.falsePositiveRate ?? '', e.falseNegativeRate ?? '',
    ]));
    // Part 11: Qualitative
    const part11 = toCSVRows(['Section', 'Content'], [
        ['Methodology', report.qualitative.methodology ?? ''],
        ['Challenges', report.qualitative.challenges ?? ''],
        ['Cooperation with Authorities', report.qualitative.cooperationWithAuthorities ?? ''],
        ['Out-of-Court Settlements', report.qualitative.outOfCourtSettlements ?? ''],
        ['Other', report.qualitative.other ?? ''],
    ]);
    return {
        part1_identification: part1,
        part3_orders: part3,
        part4_notices: part4,
        part5_own_initiative_illegal: part5,
        part6_own_initiative_tos: part6,
        part7_complaints: part7,
        part8_automation: part8,
        part9_human_resources: part9,
        part10_amar: part10,
        part11_qualitative: part11,
    };
}
// ---- JSON Formatter ----
/**
 * Format a transparency report as machine-readable JSON.
 */
export function toJSON(report) {
    return JSON.stringify(report, (_key, value) => {
        if (value instanceof Date)
            return value.toISOString();
        return value;
    }, 2);
}
// ---- Markdown Formatter ----
/**
 * Format a transparency report as human-readable Markdown.
 */
export function toMarkdown(report) {
    const id = report.identification;
    const lines = [];
    lines.push(`# Transparency Report — ${id.providerName}`);
    lines.push('');
    lines.push(`**Legal Entity:** ${id.legalEntity}`);
    lines.push(`**Platform:** ${id.platformUrl}`);
    lines.push(`**Tier:** ${id.tier}${id.isSmallEnterprise ? ' (Small Enterprise)' : ''}`);
    lines.push(`**Reporting Period:** ${id.reportingPeriod.start.toISOString().split('T')[0]} to ${id.reportingPeriod.end.toISOString().split('T')[0]}`);
    lines.push(`**Publication Date:** ${id.publicationDate.toISOString().split('T')[0]}`);
    lines.push('');
    // Part 3: Orders
    lines.push('## Part 3: Member State Orders');
    lines.push('');
    if (report.authorityOrders.entries.length > 0) {
        lines.push('| Member State | Category | Received | Complied | Median Response (h) |');
        lines.push('|---|---|---|---|---|');
        for (const e of report.authorityOrders.entries) {
            lines.push(`| ${e.memberState} | ${e.category} | ${e.ordersReceived} | ${e.ordersComplied} | ${e.medianResponseHours} |`);
        }
        lines.push('');
        lines.push(`**Total Received:** ${report.authorityOrders.totalReceived} | **Total Complied:** ${report.authorityOrders.totalComplied}`);
    }
    else {
        lines.push('No orders received during this period.');
    }
    lines.push('');
    // Part 4: Notices
    if (report.notices) {
        lines.push('## Part 4: Notices');
        lines.push('');
        lines.push(`**Total Received:** ${report.notices.totalReceived} | **Action Taken:** ${report.notices.totalActionTaken}`);
        lines.push('');
        if (report.notices.entries.length > 0) {
            lines.push('| Member State | Category | Source | Received | Action | No Action | Median (h) |');
            lines.push('|---|---|---|---|---|---|---|');
            for (const e of report.notices.entries) {
                lines.push(`| ${e.memberState} | ${e.category} | ${e.sourceType} | ${e.totalReceived} | ${e.actionTaken} | ${e.noAction} | ${e.medianHandlingHours} |`);
            }
        }
        lines.push('');
    }
    // Part 5: Own Initiative — Illegal
    lines.push('## Part 5: Own-Initiative Actions (Illegal Content)');
    lines.push('');
    lines.push(`**Total Actioned:** ${report.ownInitiativeIllegal.totalActioned}`);
    lines.push('');
    // Part 6: TOS Violations
    if (report.ownInitiativeTos) {
        lines.push('## Part 6: Own-Initiative Actions (TOS Violations)');
        lines.push('');
        lines.push(`**Total Actioned:** ${report.ownInitiativeTos.totalActioned}`);
        lines.push(`**Trusted Flagger Total:** ${report.ownInitiativeTos.trustedFlaggerTotal}`);
        lines.push('');
        if (report.ownInitiativeTos.entries.length > 0) {
            lines.push('| Category | Member State | Actioned | Restriction | Trusted Flagger |');
            lines.push('|---|---|---|---|---|');
            for (const e of report.ownInitiativeTos.entries) {
                lines.push(`| ${e.category} | ${e.memberState} | ${e.itemsActioned} | ${e.restrictionType} | ${e.trustedFlaggerNotices} |`);
            }
        }
        lines.push('');
    }
    // Part 7: Complaints
    if (report.complaints) {
        lines.push('## Part 7: Complaints and Appeals');
        lines.push('');
        lines.push(`**Total Complaints:** ${report.complaints.totalComplaints}`);
        lines.push(`**Decisions Reversed:** ${report.complaints.decisionsReversed}`);
        lines.push(`**Median Resolution:** ${report.complaints.medianResolutionDays} days`);
        lines.push(`**Disputes Submitted:** ${report.complaints.disputesSubmitted}`);
        lines.push(`**Account Suspensions:** ${report.complaints.suspensionsImposed}`);
        lines.push('');
    }
    // Part 8: Automated Means
    lines.push('## Part 8: Automated Means');
    lines.push('');
    for (const tool of report.automation.tools) {
        lines.push(`### ${tool.toolName}`);
        lines.push(`**Purpose:** ${tool.purpose}`);
        lines.push(`**Categories:** ${tool.categories.join(', ')}`);
        lines.push(`**Description:** ${tool.description}`);
        lines.push(`**Safeguards:** ${tool.safeguards}`);
        lines.push('');
    }
    // Part 9: Human Resources
    if (report.humanResources) {
        lines.push('## Part 9: Human Resources');
        lines.push('');
        lines.push(`**Total Moderators:** ${report.humanResources.totalModerators}`);
        lines.push('');
        lines.push('| Language | Count | Qualifications |');
        lines.push('|---|---|---|');
        for (const e of report.humanResources.entries) {
            lines.push(`| ${e.language} | ${e.moderatorCount} | ${e.qualifications ?? ''} |`);
        }
        lines.push('');
    }
    // Part 10: AMAR
    lines.push('## Part 10: Automated Means Assessment Results');
    lines.push('');
    if (report.amar.entries.length > 0) {
        lines.push('| Tool | Language | Accuracy | Error Rate |');
        lines.push('|---|---|---|---|');
        for (const e of report.amar.entries) {
            lines.push(`| ${e.toolName} | ${e.language} | ${(e.accuracyIndicator * 100).toFixed(1)}% | ${(e.errorRate * 100).toFixed(1)}% |`);
        }
    }
    lines.push('');
    // Part 11: Qualitative
    lines.push('## Part 11: Qualitative Information');
    lines.push('');
    if (report.qualitative.methodology) {
        lines.push(`### Methodology\n${report.qualitative.methodology}\n`);
    }
    if (report.qualitative.challenges) {
        lines.push(`### Challenges\n${report.qualitative.challenges}\n`);
    }
    if (report.qualitative.cooperationWithAuthorities) {
        lines.push(`### Cooperation with Authorities\n${report.qualitative.cooperationWithAuthorities}\n`);
    }
    if (report.qualitative.outOfCourtSettlements) {
        lines.push(`### Out-of-Court Settlements\n${report.qualitative.outOfCourtSettlements}\n`);
    }
    if (report.qualitative.other) {
        lines.push(`### Other\n${report.qualitative.other}\n`);
    }
    // Processing times
    lines.push('## Processing Times');
    lines.push('');
    lines.push(`- Median notice handling: ${report.processingTimes.medianNoticeHandlingHours}h`);
    lines.push(`- Median order response: ${report.processingTimes.medianOrderResponseHours}h`);
    lines.push(`- Median complaint resolution: ${report.processingTimes.medianComplaintResolutionDays} days`);
    lines.push('');
    lines.push('---');
    lines.push(`*Generated by eu-dsa on ${report.generatedAt.toISOString().split('T')[0]}*`);
    return lines.join('\n');
}
//# sourceMappingURL=formatters.js.map