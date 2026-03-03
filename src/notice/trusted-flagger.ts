/**
 * Trusted flagger integration per DSA Art. 22.
 *
 * Trusted flaggers are entities recognized by Digital Services Coordinators
 * for expertise in detecting illegal content. Their notices receive
 * priority processing.
 */

export interface TrustedFlaggerConfig {
  /** Priority multiplier for trusted flagger notices (default: 2.0) */
  priorityMultiplier?: number;
  /** Minimum number of reports before evaluating accuracy (default: 10) */
  minimumReports?: number;
  /** Minimum accuracy rate to maintain status (default: 0.75 = 75%) */
  minimumAccuracy?: number;
}

const DEFAULT_CONFIG: Required<TrustedFlaggerConfig> = {
  priorityMultiplier: 2.0,
  minimumReports: 10,
  minimumAccuracy: 0.75,
};

export interface FlaggerStats {
  totalReports: number;
  actionTakenCount: number;
  noActionCount: number;
  pendingCount: number;
}

export interface FlaggerEvaluation {
  eligible: boolean;
  accuracy: number | null;
  totalReports: number;
  reason?: string;
}

/**
 * Calculate priority for a notice, applying trusted flagger multiplier.
 */
export function calculatePriority(
  basePriority: number,
  isTrustedFlagger: boolean,
  config?: TrustedFlaggerConfig,
): number {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  return isTrustedFlagger
    ? Math.round(basePriority * cfg.priorityMultiplier)
    : basePriority;
}

/**
 * Evaluate whether a flagger meets the trusted flagger quality threshold.
 *
 * Per DSA Art. 22(3), trusted flaggers must maintain accuracy and
 * submit notices diligently. We check a minimum 75% accuracy rate
 * with at least 10 reports to avoid premature evaluation.
 */
export function evaluateFlaggerStatus(
  stats: FlaggerStats,
  config?: TrustedFlaggerConfig,
): FlaggerEvaluation {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const resolved = stats.actionTakenCount + stats.noActionCount;

  if (stats.totalReports < cfg.minimumReports) {
    return {
      eligible: true,
      accuracy: null,
      totalReports: stats.totalReports,
      reason: `Insufficient reports for evaluation (${stats.totalReports}/${cfg.minimumReports})`,
    };
  }

  if (resolved === 0) {
    return {
      eligible: true,
      accuracy: null,
      totalReports: stats.totalReports,
      reason: 'No resolved reports to evaluate',
    };
  }

  const accuracy = stats.actionTakenCount / resolved;

  if (accuracy < cfg.minimumAccuracy) {
    return {
      eligible: false,
      accuracy,
      totalReports: stats.totalReports,
      reason: `Accuracy ${(accuracy * 100).toFixed(1)}% is below minimum ${(cfg.minimumAccuracy * 100).toFixed(1)}%`,
    };
  }

  return {
    eligible: true,
    accuracy,
    totalReports: stats.totalReports,
  };
}

/**
 * Apply community bonus scoring — multiple reporters on the same content
 * increase risk score. Default: +5% per additional reporter (max +25%),
 * only when base risk >= threshold.
 */
export function applyCommunityBonus(
  basePriority: number,
  reporterCount: number,
  options?: {
    bonusPerReporter?: number;
    maxBonus?: number;
    minimumBasePriority?: number;
  },
): number {
  const bonusPerReporter = options?.bonusPerReporter ?? 5;
  const maxBonus = options?.maxBonus ?? 25;
  const minimumBase = options?.minimumBasePriority ?? 20;

  if (basePriority < minimumBase || reporterCount <= 1) {
    return basePriority;
  }

  const additionalReporters = reporterCount - 1;
  const bonus = Math.min(additionalReporters * bonusPerReporter, maxBonus);
  return basePriority + bonus;
}
