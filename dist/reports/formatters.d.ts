/**
 * Output formatters for transparency reports.
 *
 * Supports CSV (11 parts per EU spec), JSON, and Markdown.
 * XLSX support requires exceljs — available as a separate package post-1.0.
 */
import type { TransparencyReport } from './types.js';
export interface CSVParts {
    part1_identification: string;
    part3_orders: string;
    part4_notices?: string;
    part5_own_initiative_illegal: string;
    part6_own_initiative_tos?: string;
    part7_complaints?: string;
    part8_automation: string;
    part9_human_resources?: string;
    part10_amar: string;
    part11_qualitative: string;
}
/**
 * Format a transparency report as CSV parts (one string per EU template part).
 */
export declare function toCSV(report: TransparencyReport): CSVParts;
/**
 * Format a transparency report as machine-readable JSON.
 */
export declare function toJSON(report: TransparencyReport): string;
/**
 * Format a transparency report as human-readable Markdown.
 */
export declare function toMarkdown(report: TransparencyReport): string;
//# sourceMappingURL=formatters.d.ts.map