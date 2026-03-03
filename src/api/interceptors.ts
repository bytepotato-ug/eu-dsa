/**
 * Request/response interceptor types for audit logging.
 */

export interface RequestContext {
  method: 'GET' | 'POST';
  url: string;
  headers: Record<string, string>;
  body?: unknown;
  timestamp: Date;
  requestId: string;
}

export interface ResponseContext {
  request: RequestContext;
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
  durationMs: number;
  timestamp: Date;
}

export type RequestInterceptor = (context: RequestContext) => RequestContext | Promise<RequestContext>;
export type ResponseInterceptor = (context: ResponseContext) => void | Promise<void>;
