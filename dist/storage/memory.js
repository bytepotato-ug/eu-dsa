/**
 * In-memory StorageAdapter implementation for testing.
 */
function deepMergeUpdate(existing, data) {
    const result = { ...existing };
    for (const [key, value] of Object.entries(data)) {
        if (value !== undefined &&
            typeof value === 'object' &&
            value !== null &&
            !Array.isArray(value) &&
            !(value instanceof Date)) {
            // Merge plain objects (timestamps, metadata, source, etc.) instead of replacing
            result[key] = {
                ...(existing[key] ?? {}),
                ...value,
            };
        }
        else if (value !== undefined) {
            result[key] = value;
        }
    }
    return result;
}
function paginate(items, options) {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;
    const page = items.slice(offset, offset + limit);
    return { items: page, total: items.length, limit, offset };
}
function matchesNoticeFilters(notice, filters) {
    if (filters.state) {
        const states = Array.isArray(filters.state) ? filters.state : [filters.state];
        if (!states.includes(notice.state))
            return false;
    }
    if (filters.sourceType && notice.source.type !== filters.sourceType)
        return false;
    if (filters.isTrustedFlagger !== undefined && notice.source.isTrustedFlagger !== filters.isTrustedFlagger)
        return false;
    if (filters.contentId && notice.content.contentId !== filters.contentId)
        return false;
    if (filters.assignedTo && notice.assignedTo !== filters.assignedTo)
        return false;
    if (filters.receivedAfter && notice.timestamps.received < filters.receivedAfter)
        return false;
    if (filters.receivedBefore && notice.timestamps.received > filters.receivedBefore)
        return false;
    return true;
}
function matchesAppealFilters(appeal, filters) {
    if (filters.state) {
        const states = Array.isArray(filters.state) ? filters.state : [filters.state];
        if (!states.includes(appeal.state))
            return false;
    }
    if (filters.appellantId && appeal.appellantId !== filters.appellantId)
        return false;
    if (filters.assignedReviewer && appeal.assignedReviewer !== filters.assignedReviewer)
        return false;
    if (filters.submittedAfter && appeal.timestamps.submitted < filters.submittedAfter)
        return false;
    if (filters.submittedBefore && appeal.timestamps.submitted > filters.submittedBefore)
        return false;
    return true;
}
export function createInMemoryStorage() {
    const notices = new Map();
    const appeals = new Map();
    const queue = new Map();
    return {
        notices: {
            async save(notice) {
                const stored = structuredClone(notice);
                notices.set(stored.id, stored);
                return structuredClone(stored);
            },
            async findById(id) {
                const notice = notices.get(id);
                return notice ? structuredClone(notice) : null;
            },
            async findByContentId(contentId) {
                return [...notices.values()]
                    .filter(n => n.content.contentId === contentId)
                    .map(n => structuredClone(n));
            },
            async findByState(state, options) {
                const filtered = [...notices.values()].filter(n => n.state === state);
                return paginate(filtered.map(n => structuredClone(n)), options);
            },
            async find(filters, options) {
                const filtered = [...notices.values()].filter(n => matchesNoticeFilters(n, filters));
                return paginate(filtered.map(n => structuredClone(n)), options);
            },
            async update(id, data) {
                const existing = notices.get(id);
                if (!existing)
                    throw new Error(`Notice ${id} not found`);
                const cloned = structuredClone(existing);
                const updated = deepMergeUpdate(cloned, data);
                updated.id = id;
                notices.set(id, updated);
                return structuredClone(updated);
            },
            async delete(id) {
                return notices.delete(id);
            },
            async count(filters) {
                if (!filters)
                    return notices.size;
                return [...notices.values()].filter(n => matchesNoticeFilters(n, filters)).length;
            },
        },
        appeals: {
            async save(appeal) {
                const stored = structuredClone(appeal);
                appeals.set(stored.id, stored);
                return structuredClone(stored);
            },
            async findById(id) {
                const appeal = appeals.get(id);
                return appeal ? structuredClone(appeal) : null;
            },
            async findByAppellant(appellantId, options) {
                const filtered = [...appeals.values()].filter(a => a.appellantId === appellantId);
                return paginate(filtered.map(a => structuredClone(a)), options);
            },
            async findByStatement(ref) {
                return [...appeals.values()]
                    .filter(a => a.statementReference === ref)
                    .map(a => structuredClone(a));
            },
            async find(filters, options) {
                const filtered = [...appeals.values()].filter(a => matchesAppealFilters(a, filters));
                return paginate(filtered.map(a => structuredClone(a)), options);
            },
            async update(id, data) {
                const existing = appeals.get(id);
                if (!existing)
                    throw new Error(`Appeal ${id} not found`);
                const cloned = structuredClone(existing);
                const updated = deepMergeUpdate(cloned, data);
                updated.id = id;
                appeals.set(id, updated);
                return structuredClone(updated);
            },
            async delete(id) {
                return appeals.delete(id);
            },
            async count(filters) {
                if (!filters)
                    return appeals.size;
                return [...appeals.values()].filter(a => matchesAppealFilters(a, filters)).length;
            },
        },
        queue: {
            async save(item) {
                const stored = structuredClone(item);
                queue.set(stored.id, stored);
                return structuredClone(stored);
            },
            async findPending(limit) {
                return [...queue.values()]
                    .filter(i => i.status === 'pending')
                    .slice(0, limit)
                    .map(i => structuredClone(i));
            },
            async markCompleted(id) {
                queue.delete(id);
            },
            async markFailed(id, error) {
                const item = queue.get(id);
                if (item) {
                    item.attempts += 1;
                    item.lastAttemptAt = new Date();
                    item.lastError = error;
                    item.status = item.attempts >= 5 ? 'failed' : 'pending';
                }
            },
            async count() {
                return queue.size;
            },
        },
    };
}
//# sourceMappingURL=memory.js.map