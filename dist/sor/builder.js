/**
 * Fluent builder for constructing EU-compliant Statements of Reasons.
 */
import { AccountType, AutomatedDecision, Category, CategorySpecification, ContentType, DecisionAccount, DecisionGround, DecisionMonetary, DecisionProvision, DecisionVisibility, SourceType, } from '../schemas/enums.js';
import { sorSubmissionSchema } from '../schemas/sor-schema.js';
import { DsaValidationError } from '../api/errors.js';
export class SoRBuilder {
    data = {};
    // ---- Decision Visibility ----
    visibility(...actions) {
        const resolved = actions.map(a => (typeof a === 'string' && a in DecisionVisibility)
            ? DecisionVisibility[a]
            : a);
        this.data.decision_visibility = [...(this.data.decision_visibility ?? []), ...resolved];
        return this;
    }
    visibilityOther(description) {
        this.data.decision_visibility_other = description;
        return this;
    }
    contentRemoved() {
        return this.visibility(DecisionVisibility.CONTENT_REMOVED);
    }
    contentDisabled() {
        return this.visibility(DecisionVisibility.CONTENT_DISABLED);
    }
    contentDemoted() {
        return this.visibility(DecisionVisibility.CONTENT_DEMOTED);
    }
    contentAgeRestricted() {
        return this.visibility(DecisionVisibility.CONTENT_AGE_RESTRICTED);
    }
    contentInteractionRestricted() {
        return this.visibility(DecisionVisibility.CONTENT_INTERACTION_RESTRICTED);
    }
    contentLabelled() {
        return this.visibility(DecisionVisibility.CONTENT_LABELLED);
    }
    // ---- Decision Monetary ----
    monetary(action) {
        this.data.decision_monetary = (typeof action === 'string' && action in DecisionMonetary)
            ? DecisionMonetary[action]
            : action;
        return this;
    }
    monetaryOther(description) {
        this.data.decision_monetary_other = description;
        return this;
    }
    // ---- Decision Provision ----
    provision(action) {
        this.data.decision_provision = (typeof action === 'string' && action in DecisionProvision)
            ? DecisionProvision[action]
            : action;
        return this;
    }
    // ---- Decision Account ----
    account(action) {
        this.data.decision_account = (typeof action === 'string' && action in DecisionAccount)
            ? DecisionAccount[action]
            : action;
        return this;
    }
    accountSuspended() {
        return this.account(DecisionAccount.SUSPENDED);
    }
    accountTerminated() {
        return this.account(DecisionAccount.TERMINATED);
    }
    accountType(type) {
        this.data.account_type = (typeof type === 'string' && type in AccountType)
            ? AccountType[type]
            : type;
        return this;
    }
    // ---- Decision Ground ----
    illegalContent(legalGround, explanation) {
        this.data.decision_ground = DecisionGround.ILLEGAL_CONTENT;
        this.data.illegal_content_legal_ground = legalGround;
        this.data.illegal_content_explanation = explanation;
        return this;
    }
    incompatibleContent(ground, explanation, alsoIllegal) {
        this.data.decision_ground = DecisionGround.INCOMPATIBLE_CONTENT;
        this.data.incompatible_content_ground = ground;
        this.data.incompatible_content_explanation = explanation;
        if (alsoIllegal !== undefined) {
            this.data.incompatible_content_illegal = alsoIllegal ? 'Yes' : 'No';
        }
        return this;
    }
    groundReferenceUrl(url) {
        this.data.decision_ground_reference_url = url;
        return this;
    }
    // ---- Content Type ----
    contentType(...types) {
        const resolved = types.map(t => (typeof t === 'string' && t in ContentType)
            ? ContentType[t]
            : t);
        this.data.content_type = [...(this.data.content_type ?? []), ...resolved];
        return this;
    }
    contentTypeOther(description) {
        this.data.content_type_other = description;
        return this;
    }
    // ---- Category ----
    category(cat) {
        this.data.category = (typeof cat === 'string' && cat in Category)
            ? Category[cat]
            : cat;
        return this;
    }
    categoryAddition(...cats) {
        const resolved = cats.map(c => (typeof c === 'string' && c in Category)
            ? Category[c]
            : c);
        this.data.category_addition = [...(this.data.category_addition ?? []), ...resolved];
        return this;
    }
    categorySpecification(...specs) {
        const resolved = specs.map(s => (typeof s === 'string' && s in CategorySpecification)
            ? CategorySpecification[s]
            : s);
        this.data.category_specification = [...(this.data.category_specification ?? []), ...resolved];
        return this;
    }
    categorySpecificationOther(description) {
        this.data.category_specification_other = description;
        return this;
    }
    // ---- Dates ----
    dates(dates) {
        this.data.content_date = dates.content;
        this.data.application_date = dates.application;
        return this;
    }
    endDates(dates) {
        if (dates.visibility)
            this.data.end_date_visibility_restriction = dates.visibility;
        if (dates.monetary)
            this.data.end_date_monetary_restriction = dates.monetary;
        if (dates.service)
            this.data.end_date_service_restriction = dates.service;
        if (dates.account)
            this.data.end_date_account_restriction = dates.account;
        return this;
    }
    // ---- Facts & Source ----
    facts(description) {
        this.data.decision_facts = description;
        return this;
    }
    source(type, identity) {
        this.data.source_type = (typeof type === 'string' && type in SourceType)
            ? SourceType[type]
            : type;
        if (identity)
            this.data.source_identity = identity;
        return this;
    }
    // ---- Automation ----
    automatedDetection(used) {
        this.data.automated_detection = (used ? 'Yes' : 'No');
        return this;
    }
    automatedDecision(level) {
        this.data.automated_decision = (typeof level === 'string' && level in AutomatedDecision)
            ? AutomatedDecision[level]
            : level;
        return this;
    }
    // ---- Identifier & Scope ----
    puid(puid) {
        this.data.puid = puid;
        return this;
    }
    territorialScope(countries) {
        this.data.territorial_scope = countries;
        return this;
    }
    contentLanguage(lang) {
        this.data.content_language = lang.toUpperCase();
        return this;
    }
    contentId(ean13) {
        this.data.content_id = { 'EAN-13': ean13 };
        return this;
    }
    // ---- Build ----
    build() {
        const result = sorSubmissionSchema.safeParse(this.data);
        if (!result.success) {
            const fieldErrors = {};
            for (const issue of result.error.issues) {
                const path = issue.path.join('.');
                if (!fieldErrors[path])
                    fieldErrors[path] = [];
                fieldErrors[path].push(issue.message);
            }
            throw new DsaValidationError('Statement of Reasons validation failed', fieldErrors);
        }
        return result.data;
    }
    toJSON() {
        return structuredClone(this.data);
    }
    validate() {
        const result = sorSubmissionSchema.safeParse(this.data);
        if (result.success)
            return { valid: true };
        const errors = {};
        for (const issue of result.error.issues) {
            const path = issue.path.join('.');
            if (!errors[path])
                errors[path] = [];
            errors[path].push(issue.message);
        }
        return { valid: false, errors };
    }
    reset() {
        this.data = {};
        return this;
    }
}
//# sourceMappingURL=builder.js.map