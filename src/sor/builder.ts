/**
 * Fluent builder for constructing EU-compliant Statements of Reasons.
 */

import type { SorSubmission } from '../schemas/api-types.js';
import {
  AccountType,
  AutomatedDecision,
  Category,
  CategorySpecification,
  ContentType,
  DecisionAccount,
  DecisionGround,
  DecisionMonetary,
  DecisionProvision,
  DecisionVisibility,
  SourceType,
  type AutomatedDetection,
  type TerritorialScopeCode,
} from '../schemas/enums.js';
import { sorSubmissionSchema, type ValidatedSorSubmission } from '../schemas/sor-schema.js';
import { DsaValidationError } from '../api/errors.js';

export class SoRBuilder {
  private data: Partial<SorSubmission> = {};

  // ---- Decision Visibility ----

  visibility(...actions: (DecisionVisibility | keyof typeof DecisionVisibility)[]): this {
    const resolved = actions.map(a => (typeof a === 'string' && a in DecisionVisibility)
      ? DecisionVisibility[a as keyof typeof DecisionVisibility]
      : a as DecisionVisibility);
    this.data.decision_visibility = [...(this.data.decision_visibility ?? []), ...resolved];
    return this;
  }

  visibilityOther(description: string): this {
    this.data.decision_visibility_other = description;
    return this;
  }

  contentRemoved(): this {
    return this.visibility(DecisionVisibility.CONTENT_REMOVED);
  }

  contentDisabled(): this {
    return this.visibility(DecisionVisibility.CONTENT_DISABLED);
  }

  contentDemoted(): this {
    return this.visibility(DecisionVisibility.CONTENT_DEMOTED);
  }

  contentAgeRestricted(): this {
    return this.visibility(DecisionVisibility.CONTENT_AGE_RESTRICTED);
  }

  contentInteractionRestricted(): this {
    return this.visibility(DecisionVisibility.CONTENT_INTERACTION_RESTRICTED);
  }

  contentLabelled(): this {
    return this.visibility(DecisionVisibility.CONTENT_LABELLED);
  }

  // ---- Decision Monetary ----

  monetary(action: DecisionMonetary | keyof typeof DecisionMonetary): this {
    this.data.decision_monetary = (typeof action === 'string' && action in DecisionMonetary)
      ? DecisionMonetary[action as keyof typeof DecisionMonetary]
      : action as DecisionMonetary;
    return this;
  }

  monetaryOther(description: string): this {
    this.data.decision_monetary_other = description;
    return this;
  }

  // ---- Decision Provision ----

  provision(action: DecisionProvision | keyof typeof DecisionProvision): this {
    this.data.decision_provision = (typeof action === 'string' && action in DecisionProvision)
      ? DecisionProvision[action as keyof typeof DecisionProvision]
      : action as DecisionProvision;
    return this;
  }

  // ---- Decision Account ----

  account(action: DecisionAccount | keyof typeof DecisionAccount): this {
    this.data.decision_account = (typeof action === 'string' && action in DecisionAccount)
      ? DecisionAccount[action as keyof typeof DecisionAccount]
      : action as DecisionAccount;
    return this;
  }

  accountSuspended(): this {
    return this.account(DecisionAccount.SUSPENDED);
  }

  accountTerminated(): this {
    return this.account(DecisionAccount.TERMINATED);
  }

  accountType(type: AccountType | keyof typeof AccountType): this {
    this.data.account_type = (typeof type === 'string' && type in AccountType)
      ? AccountType[type as keyof typeof AccountType]
      : type as AccountType;
    return this;
  }

  // ---- Decision Ground ----

  illegalContent(legalGround: string, explanation: string): this {
    this.data.decision_ground = DecisionGround.ILLEGAL_CONTENT;
    this.data.illegal_content_legal_ground = legalGround;
    this.data.illegal_content_explanation = explanation;
    return this;
  }

  incompatibleContent(ground: string, explanation: string, alsoIllegal?: boolean): this {
    this.data.decision_ground = DecisionGround.INCOMPATIBLE_CONTENT;
    this.data.incompatible_content_ground = ground;
    this.data.incompatible_content_explanation = explanation;
    if (alsoIllegal !== undefined) {
      this.data.incompatible_content_illegal = alsoIllegal ? 'Yes' : 'No';
    }
    return this;
  }

  groundReferenceUrl(url: string): this {
    this.data.decision_ground_reference_url = url;
    return this;
  }

  // ---- Content Type ----

  contentType(...types: (ContentType | keyof typeof ContentType)[]): this {
    const resolved = types.map(t => (typeof t === 'string' && t in ContentType)
      ? ContentType[t as keyof typeof ContentType]
      : t as ContentType);
    this.data.content_type = [...(this.data.content_type ?? []), ...resolved];
    return this;
  }

  contentTypeOther(description: string): this {
    this.data.content_type_other = description;
    return this;
  }

  // ---- Category ----

  category(cat: Category | keyof typeof Category): this {
    this.data.category = (typeof cat === 'string' && cat in Category)
      ? Category[cat as keyof typeof Category]
      : cat as Category;
    return this;
  }

  categoryAddition(...cats: (Category | keyof typeof Category)[]): this {
    const resolved = cats.map(c => (typeof c === 'string' && c in Category)
      ? Category[c as keyof typeof Category]
      : c as Category);
    this.data.category_addition = [...(this.data.category_addition ?? []), ...resolved];
    return this;
  }

  categorySpecification(...specs: (CategorySpecification | keyof typeof CategorySpecification)[]): this {
    const resolved = specs.map(s => (typeof s === 'string' && s in CategorySpecification)
      ? CategorySpecification[s as keyof typeof CategorySpecification]
      : s as CategorySpecification);
    this.data.category_specification = [...(this.data.category_specification ?? []), ...resolved];
    return this;
  }

  categorySpecificationOther(description: string): this {
    this.data.category_specification_other = description;
    return this;
  }

  // ---- Dates ----

  dates(dates: { content: string; application: string }): this {
    this.data.content_date = dates.content;
    this.data.application_date = dates.application;
    return this;
  }

  endDates(dates: {
    visibility?: string;
    monetary?: string;
    service?: string;
    account?: string;
  }): this {
    if (dates.visibility) this.data.end_date_visibility_restriction = dates.visibility;
    if (dates.monetary) this.data.end_date_monetary_restriction = dates.monetary;
    if (dates.service) this.data.end_date_service_restriction = dates.service;
    if (dates.account) this.data.end_date_account_restriction = dates.account;
    return this;
  }

  // ---- Facts & Source ----

  facts(description: string): this {
    this.data.decision_facts = description;
    return this;
  }

  source(type: SourceType | keyof typeof SourceType, identity?: string): this {
    this.data.source_type = (typeof type === 'string' && type in SourceType)
      ? SourceType[type as keyof typeof SourceType]
      : type as SourceType;
    if (identity) this.data.source_identity = identity;
    return this;
  }

  // ---- Automation ----

  automatedDetection(used: boolean): this {
    this.data.automated_detection = (used ? 'Yes' : 'No') as AutomatedDetection;
    return this;
  }

  automatedDecision(level: AutomatedDecision | keyof typeof AutomatedDecision): this {
    this.data.automated_decision = (typeof level === 'string' && level in AutomatedDecision)
      ? AutomatedDecision[level as keyof typeof AutomatedDecision]
      : level as AutomatedDecision;
    return this;
  }

  // ---- Identifier & Scope ----

  puid(puid: string): this {
    this.data.puid = puid;
    return this;
  }

  territorialScope(countries: TerritorialScopeCode[]): this {
    this.data.territorial_scope = countries;
    return this;
  }

  contentLanguage(lang: string): this {
    this.data.content_language = lang.toUpperCase();
    return this;
  }

  contentId(ean13: string): this {
    this.data.content_id = { 'EAN-13': ean13 };
    return this;
  }

  // ---- Build ----

  build(): ValidatedSorSubmission {
    const result = sorSubmissionSchema.safeParse(this.data);
    if (!result.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      throw new DsaValidationError('Statement of Reasons validation failed', fieldErrors);
    }
    return result.data;
  }

  toJSON(): Partial<SorSubmission> {
    return structuredClone(this.data);
  }

  validate(): { valid: boolean; errors?: Record<string, string[]> } {
    const result = sorSubmissionSchema.safeParse(this.data);
    if (result.success) return { valid: true };

    const errors: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join('.');
      if (!errors[path]) errors[path] = [];
      errors[path].push(issue.message);
    }
    return { valid: false, errors };
  }

  reset(): this {
    this.data = {};
    return this;
  }
}
