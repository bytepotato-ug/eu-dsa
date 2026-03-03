/**
 * Request/response type definitions for the EU Transparency Database API.
 *
 * API base URL: https://transparency.dsa.ec.europa.eu/api/v1/
 * Auth: Bearer token (Laravel Sanctum)
 */

import type {
  AccountType,
  AutomatedDecision,
  AutomatedDetection,
  Category,
  CategorySpecification,
  ContentType,
  DecisionAccount,
  DecisionGround,
  DecisionMonetary,
  DecisionProvision,
  DecisionVisibility,
  IncompatibleContentIllegal,
  SourceType,
  TerritorialScopeCode,
} from './enums.js';

// =============================================================================
// Statement of Reasons — submission payload
// =============================================================================

/** SoR submission payload for POST /api/v1/statement */
export interface SorSubmission {
  // --- Decision fields (at least one category required) ---
  decision_visibility?: DecisionVisibility[];
  decision_visibility_other?: string;
  decision_monetary?: DecisionMonetary;
  decision_monetary_other?: string;
  decision_provision?: DecisionProvision;
  decision_account?: DecisionAccount;
  account_type?: AccountType;

  // --- Decision ground (REQUIRED) ---
  decision_ground: DecisionGround;
  decision_ground_reference_url?: string;

  // --- Illegal content fields (required when ground = ILLEGAL_CONTENT) ---
  illegal_content_legal_ground?: string;
  illegal_content_explanation?: string;

  // --- Incompatible content fields (required when ground = INCOMPATIBLE_CONTENT) ---
  incompatible_content_ground?: string;
  incompatible_content_explanation?: string;
  incompatible_content_illegal?: IncompatibleContentIllegal;

  // --- Content description (REQUIRED) ---
  content_type: ContentType[];
  content_type_other?: string;

  // --- Category (REQUIRED) ---
  category: Category;
  category_addition?: Category[];
  category_specification?: CategorySpecification[];
  category_specification_other?: string;

  // --- Dates (REQUIRED) ---
  content_date: string;
  application_date: string;

  // --- End dates (optional — blank = indefinite) ---
  end_date_visibility_restriction?: string;
  end_date_monetary_restriction?: string;
  end_date_service_restriction?: string;
  end_date_account_restriction?: string;

  // --- Facts (REQUIRED, max 5000 chars) ---
  decision_facts: string;

  // --- Source (REQUIRED) ---
  source_type: SourceType;
  source_identity?: string;

  // --- Automation (REQUIRED) ---
  automated_detection: AutomatedDetection;
  automated_decision: AutomatedDecision;

  // --- Identifier (REQUIRED) ---
  puid: string;

  // --- Scope (REQUIRED) ---
  territorial_scope: TerritorialScopeCode[];
  content_language?: string;

  // --- Content ID (optional) ---
  content_id?: { 'EAN-13'?: string };
}

// =============================================================================
// API Responses
// =============================================================================

/** Response from POST /api/v1/statement (single submission, 201 Created) */
export interface SorSubmissionResponse extends SorSubmission {
  id: number;
  uuid: string;
  created_at: string;
  platform_name: string;
  permalink: string;
  self: string;
}

/** Response from POST /api/v1/statements (batch submission, 201 Created) */
export interface SorBatchResponse {
  statements: SorSubmissionResponse[];
}

/** Response from GET /api/v1/statement/existing-puid/{puid} — 302 Found */
export interface PuidFoundResponse {
  message: string;
  puid: string;
}

// =============================================================================
// API Error Responses
// =============================================================================

/** Standard validation error (422 Unprocessable Entity) */
export interface EuApiValidationError {
  message: string;
  errors: Record<string, string[]>;
}

/** PUID conflict error (422) — single submission */
export interface EuApiPuidConflictError {
  message: string;
  errors: { puid: string[] };
  existing: { puid: string };
}

/** PUID conflict error (422) — batch submission */
export interface EuApiBatchPuidConflictError {
  message: string;
  errors: {
    puid: string[];
    existing_puids: string[];
  };
}

/** Batch validation error (422) — per-statement errors */
export interface EuApiBatchValidationError {
  errors: Record<string, Record<string, string[]>>;
}

// =============================================================================
// Rate Limit Info
// =============================================================================

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: Date;
}
