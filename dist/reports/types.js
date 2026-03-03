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
};
//# sourceMappingURL=types.js.map