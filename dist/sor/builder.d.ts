/**
 * Fluent builder for constructing EU-compliant Statements of Reasons.
 */
import type { SorSubmission } from '../schemas/api-types.js';
import { AccountType, AutomatedDecision, Category, CategorySpecification, ContentType, DecisionAccount, DecisionMonetary, DecisionProvision, DecisionVisibility, SourceType, type TerritorialScopeCode } from '../schemas/enums.js';
import { type ValidatedSorSubmission } from '../schemas/sor-schema.js';
export declare class SoRBuilder {
    private data;
    visibility(...actions: (DecisionVisibility | keyof typeof DecisionVisibility)[]): this;
    visibilityOther(description: string): this;
    contentRemoved(): this;
    contentDisabled(): this;
    contentDemoted(): this;
    contentAgeRestricted(): this;
    contentInteractionRestricted(): this;
    contentLabelled(): this;
    monetary(action: DecisionMonetary | keyof typeof DecisionMonetary): this;
    monetaryOther(description: string): this;
    provision(action: DecisionProvision | keyof typeof DecisionProvision): this;
    account(action: DecisionAccount | keyof typeof DecisionAccount): this;
    accountSuspended(): this;
    accountTerminated(): this;
    accountType(type: AccountType | keyof typeof AccountType): this;
    illegalContent(legalGround: string, explanation: string): this;
    incompatibleContent(ground: string, explanation: string, alsoIllegal?: boolean): this;
    groundReferenceUrl(url: string): this;
    contentType(...types: (ContentType | keyof typeof ContentType)[]): this;
    contentTypeOther(description: string): this;
    category(cat: Category | keyof typeof Category): this;
    categoryAddition(...cats: (Category | keyof typeof Category)[]): this;
    categorySpecification(...specs: (CategorySpecification | keyof typeof CategorySpecification)[]): this;
    categorySpecificationOther(description: string): this;
    dates(dates: {
        content: string;
        application: string;
    }): this;
    endDates(dates: {
        visibility?: string;
        monetary?: string;
        service?: string;
        account?: string;
    }): this;
    facts(description: string): this;
    source(type: SourceType | keyof typeof SourceType, identity?: string): this;
    automatedDetection(used: boolean): this;
    automatedDecision(level: AutomatedDecision | keyof typeof AutomatedDecision): this;
    puid(puid: string): this;
    territorialScope(countries: TerritorialScopeCode[]): this;
    contentLanguage(lang: string): this;
    contentId(ean13: string): this;
    build(): ValidatedSorSubmission;
    toJSON(): Partial<SorSubmission>;
    validate(): {
        valid: boolean;
        errors?: Record<string, string[]>;
    };
    reset(): this;
}
//# sourceMappingURL=builder.d.ts.map