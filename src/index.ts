/**
 * superagent-lite
 * Zero-dependency, native fetch HTTP client
 * Drop-in superagent replacement with modern features from ky, got, and axios
 */

// ============================================================================
// Types
// ============================================================================

export interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  timeout?: number | TimeoutOptions;
  retry?: number | RetryOptions;
  hooks?: Hooks;
  throwHttpErrors?: boolean;
  parseJson?: (text: string) => any;
  stringifyJson?: (data: any) => string;
  signal?: AbortSignal;
}

export interface TimeoutOptions {
  request?: number;
  response?: number;
}

export interface RetryOptions {
  limit?: number;
  methods?: string[];
  statusCodes?: number[];
  delay?: (attemptCount: number) => number;
}

export interface Hooks {
  beforeRequest?: BeforeRequestHook[];
  afterResponse?: AfterResponseHook[];
  beforeRetry?: BeforeRetryHook[];
  beforeError?: BeforeErrorHook[];
}

export type BeforeRequestHook = (request: Request) => Request | void | Promise<Request | void>;
export type AfterResponseHook = (response: Response) => Response | void | Promise<Response | void>;
export type BeforeRetryHook = (error: HTTPError, retryCount: number) => void | Promise<void>;
export type BeforeErrorHook = (error: HTTPError) => HTTPError | Promise<HTTPError>;

export interface ResponseHeaders {
  [key: string]: string;
}

// ============================================================================
// Response Class (superagent compatible)
// ============================================================================

export class Response {
  readonly status: number;
  readonly statusCode: number;
  readonly ok: boolean;
  readonly statusText: string;
  readonly headers: ResponseHeaders;
  readonly type: string;
  readonly charset: string;
  body: any;
  text: string;

  constructor(
    private readonly _response: globalThis.Response,
    text: string,
    body: any
  ) {
    this.status = _response.status;
    this.statusCode = _response.status;
    this.statusText = _response.statusText;
    this.ok = _response.ok;
    this.text = text;
    this.body = body;

    const contentType = _response.headers.get('content-type') || '';
    this.type = contentType.split(';')[0].trim();
    this.charset = this.extractCharset(contentType);

    // Convert headers to plain object
    this.headers = {};
    _response.headers.forEach((value, key) => {
      this.headers[key.toLowerCase()] = value;
    });
  }

  private extractCharset(contentType: string): string {
    const match = contentType.match(/charset=([^\s;]+)/i);
    return match ? match[1].trim() : 'utf-8';
  }

  get(header: string): string | undefined {
    return this.headers[header.toLowerCase()];
  }
}

// ============================================================================
// Error Classes
// ============================================================================

export class HTTPError extends Error {
  readonly response: Response;
  readonly status: number;

  constructor(response: Response) {
    super(`Request failed with status ${response.status}: ${response.statusText}`);
    this.name = 'HTTPError';
    this.response = response;
    this.status = response.status;
  }
}

export class TimeoutError extends Error {
  constructor(message = 'Request timed out') {
    super(message);
    this.name = 'TimeoutError';
  }
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_RETRY_METHODS = ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE'];
const DEFAULT_RETRY_STATUS_CODES = [408, 413, 429, 500, 502, 503, 504];
const DEFAULT_RETRY_LIMIT = 2;

function defaultRetryDelay(attemptCount: number): number {
  return Math.min(1000 * 2 ** (attemptCount - 1), 30000);
}

// ============================================================================
// Request Class (superagent compatible chaining API)
// ============================================================================

export class Request implements PromiseLike<Response> {
  private _url: string;
  private _method: string;
  private _headers: Record<string, string> = {};
  private _query: Record<string, string> = {};
  private _body: any = undefined;
  private _timeout: TimeoutOptions = {};
  private _retry: RetryOptions = { limit: 0 };
  private _hooks: Required<Hooks> = {
    beforeRequest: [],
    afterResponse: [],
    beforeRetry: [],
    beforeError: []
  };
  private _throwHttpErrors = true;
  private _parseJson: (text: string) => any = JSON.parse;
  private _stringifyJson: (data: any) => string = JSON.stringify;
  private _abortController: AbortController | null = null;
  private _externalSignal: AbortSignal | null = null;

  constructor(method: string, url: string, options: RequestOptions = {}) {
    this._method = method.toUpperCase();
    this._url = url;

    if (options.headers) this._headers = { ...options.headers };
    if (options.timeout) {
      this._timeout = typeof options.timeout === 'number'
        ? { request: options.timeout }
        : options.timeout;
    }
    if (options.retry !== undefined) {
      this._retry = typeof options.retry === 'number'
        ? { limit: options.retry }
        : options.retry;
    }
    if (options.hooks) this.mergeHooks(options.hooks);
    if (options.throwHttpErrors !== undefined) this._throwHttpErrors = options.throwHttpErrors;
    if (options.parseJson) this._parseJson = options.parseJson;
    if (options.stringifyJson) this._stringifyJson = options.stringifyJson;
    if (options.signal) this._externalSignal = options.signal;
  }

  private mergeHooks(hooks: Hooks): void {
    if (hooks.beforeRequest) this._hooks.beforeRequest.push(...hooks.beforeRequest);
    if (hooks.afterResponse) this._hooks.afterResponse.push(...hooks.afterResponse);
    if (hooks.beforeRetry) this._hooks.beforeRetry.push(...hooks.beforeRetry);
    if (hooks.beforeError) this._hooks.beforeError.push(...hooks.beforeError);
  }

  // ============================================================================
  // Chaining Methods (superagent compatible)
  // ============================================================================

  set(field: string | Record<string, string>, value?: string): this {
    if (typeof field === 'object') {
      for (const key of Object.keys(field)) {
        this._headers[key.toLowerCase()] = field[key];
      }
    } else if (value !== undefined) {
      this._headers[field.toLowerCase()] = value;
    }
    return this;
  }

  query(params: Record<string, any> | string): this {
    if (typeof params === 'string') {
      const searchParams = new URLSearchParams(params);
      searchParams.forEach((value, key) => {
        this._query[key] = value;
      });
    } else {
      for (const key of Object.keys(params)) {
        const value = params[key];
        if (value !== undefined && value !== null) {
          this._query[key] = String(value);
        }
      }
    }
    return this;
  }

  send(data: any): this {
    if (this._body && typeof this._body === 'object' && typeof data === 'object') {
      this._body = { ...this._body, ...data };
    } else {
      this._body = data;
    }

    // Auto-set content-type for objects
    if (typeof data === 'object' && !this._headers['content-type']) {
      this._headers['content-type'] = 'application/json';
    }

    return this;
  }

  type(contentType: string): this {
    const types: Record<string, string> = {
      json: 'application/json',
      form: 'application/x-www-form-urlencoded',
      html: 'text/html',
      text: 'text/plain',
      xml: 'application/xml'
    };
    this._headers['content-type'] = types[contentType] || contentType;
    return this;
  }

  accept(acceptType: string): this {
    const types: Record<string, string> = {
      json: 'application/json',
      html: 'text/html',
      text: 'text/plain',
      xml: 'application/xml'
    };
    this._headers['accept'] = types[acceptType] || acceptType;
    return this;
  }

  timeout(ms: number | TimeoutOptions): this {
    this._timeout = typeof ms === 'number' ? { request: ms } : ms;
    return this;
  }

  retry(count: number | RetryOptions): this {
    this._retry = typeof count === 'number' ? { limit: count } : count;
    return this;
  }

  auth(user: string, pass?: string, options?: { type?: 'basic' | 'bearer' }): this {
    const type = options?.type || (pass === undefined ? 'bearer' : 'basic');
    if (type === 'bearer') {
      this._headers['authorization'] = `Bearer ${user}`;
    } else {
      const credentials = Buffer.from(`${user}:${pass || ''}`).toString('base64');
      this._headers['authorization'] = `Basic ${credentials}`;
    }
    return this;
  }

  // ============================================================================
  // Hook Methods (inspired by got/ky)
  // ============================================================================

  hook(name: keyof Hooks, fn: any): this {
    (this._hooks[name] as any[]).push(fn);
    return this;
  }

  // ============================================================================
  // Execution Control
  // ============================================================================

  abort(): this {
    this._abortController?.abort();
    return this;
  }

  // ============================================================================
  // Request Execution
  // ============================================================================

  private async execute(): Promise<Response> {
    const retryLimit = this._retry.limit ?? 0;
    const retryMethods = this._retry.methods ?? DEFAULT_RETRY_METHODS;
    const retryStatusCodes = this._retry.statusCodes ?? DEFAULT_RETRY_STATUS_CODES;
    const retryDelay = this._retry.delay ?? defaultRetryDelay;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retryLimit; attempt++) {
      try {
        return await this.doFetch();
      } catch (error) {
        lastError = error as Error;

        // Don't retry if not a retryable method
        if (!retryMethods.includes(this._method)) {
          throw lastError;
        }

        // Don't retry on timeout
        if (lastError instanceof TimeoutError) {
          throw lastError;
        }

        // Check if status code is retryable
        if (lastError instanceof HTTPError) {
          if (!retryStatusCodes.includes(lastError.status)) {
            throw lastError;
          }
        }

        // Don't retry on last attempt
        if (attempt >= retryLimit) {
          throw lastError;
        }

        // Call beforeRetry hooks
        for (const hook of this._hooks.beforeRetry) {
          await hook(lastError as HTTPError, attempt + 1);
        }

        // Wait before retry
        const delay = retryDelay(attempt + 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  private async doFetch(): Promise<Response> {
    // Build URL with query params
    let url = this._url;
    const queryKeys = Object.keys(this._query);
    if (queryKeys.length > 0) {
      const searchParams = new URLSearchParams(this._query);
      const separator = url.includes('?') ? '&' : '?';
      url = `${url}${separator}${searchParams.toString()}`;
    }

    // Prepare body
    let body: string | undefined;
    if (this._body !== undefined) {
      const contentType = this._headers['content-type'] || '';
      if (typeof this._body === 'object') {
        if (contentType.includes('form-urlencoded')) {
          body = new URLSearchParams(this._body).toString();
        } else {
          body = this._stringifyJson(this._body);
          if (!this._headers['content-type']) {
            this._headers['content-type'] = 'application/json';
          }
        }
      } else {
        body = String(this._body);
      }
    }

    // Setup abort controller for timeout
    this._abortController = new AbortController();
    const signal = this._abortController.signal;

    // Link external signal if provided
    if (this._externalSignal) {
      this._externalSignal.addEventListener('abort', () => this._abortController?.abort());
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutMs = this._timeout.request || this._timeout.response;

    if (timeoutMs) {
      timeoutId = setTimeout(() => {
        this._abortController?.abort();
      }, timeoutMs);
    }

    // Call beforeRequest hooks
    for (const hook of this._hooks.beforeRequest) {
      await hook(this);
    }

    try {
      const fetchResponse = await fetch(url, {
        method: this._method,
        headers: this._headers,
        body,
        signal
      });

      // Parse response
      const text = await fetchResponse.text();
      let responseBody: any = text;

      const contentType = fetchResponse.headers.get('content-type') || '';
      if (contentType.includes('application/json') && text) {
        try {
          responseBody = this._parseJson(text);
        } catch {
          // Keep as text if JSON parsing fails
        }
      }

      let response = new Response(fetchResponse, text, responseBody);

      // Call afterResponse hooks
      for (const hook of this._hooks.afterResponse) {
        const result = await hook(response);
        if (result) response = result;
      }

      // Throw on HTTP errors if enabled
      if (this._throwHttpErrors && !fetchResponse.ok) {
        let error = new HTTPError(response);
        for (const hook of this._hooks.beforeError) {
          error = await hook(error);
        }
        throw error;
      }

      return response;

    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new TimeoutError();
      }
      throw error;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  // ============================================================================
  // Promise Interface
  // ============================================================================

  then<TResult1 = Response, TResult2 = never>(
    onfulfilled?: ((value: Response) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null
  ): Promise<Response | TResult> {
    return this.execute().catch(onrejected);
  }

  finally(onfinally?: (() => void) | null): Promise<Response> {
    return this.execute().finally(onfinally);
  }

  // Legacy callback interface (superagent compatibility)
  end(callback?: (err: Error | null, res?: Response) => void): void {
    this.execute()
      .then(res => callback?.(null, res))
      .catch(err => callback?.(err));
  }
}

// ============================================================================
// Instance Factory (axios-style)
// ============================================================================

export interface InstanceOptions extends RequestOptions {
  baseURL?: string;
  headers?: Record<string, string>;
}

export interface RequestInstance {
  (method: string, url: string): Request;
  get: (url: string) => Request;
  post: (url: string) => Request;
  put: (url: string) => Request;
  patch: (url: string) => Request;
  delete: (url: string) => Request;
  del: (url: string) => Request;
  head: (url: string) => Request;
  options: (url: string) => Request;
  create: (options?: InstanceOptions) => RequestInstance;
  defaults: InstanceOptions;
}

function createInstance(options: InstanceOptions = {}): RequestInstance {
  const defaults: InstanceOptions = { ...options };

  const resolveUrl = (url: string): string => {
    if (defaults.baseURL && !url.startsWith('http://') && !url.startsWith('https://')) {
      const base = defaults.baseURL.endsWith('/') ? defaults.baseURL.slice(0, -1) : defaults.baseURL;
      const path = url.startsWith('/') ? url : `/${url}`;
      return `${base}${path}`;
    }
    return url;
  };

  const createRequest = (method: string, url: string): Request => {
    const req = new Request(method, resolveUrl(url), {
      headers: defaults.headers,
      timeout: defaults.timeout,
      retry: defaults.retry,
      hooks: defaults.hooks,
      throwHttpErrors: defaults.throwHttpErrors,
      parseJson: defaults.parseJson,
      stringifyJson: defaults.stringifyJson
    });
    return req;
  };

  const instance = ((method: string, url: string) => createRequest(method, url)) as RequestInstance;

  instance.get = (url: string) => createRequest('GET', url);
  instance.post = (url: string) => createRequest('POST', url);
  instance.put = (url: string) => createRequest('PUT', url);
  instance.patch = (url: string) => createRequest('PATCH', url);
  instance.delete = (url: string) => createRequest('DELETE', url);
  instance.del = (url: string) => createRequest('DELETE', url);
  instance.head = (url: string) => createRequest('HEAD', url);
  instance.options = (url: string) => createRequest('OPTIONS', url);
  instance.create = (opts?: InstanceOptions) => createInstance({ ...defaults, ...opts });
  instance.defaults = defaults;

  return instance;
}

// ============================================================================
// Default Export
// ============================================================================

const request = createInstance();

export default request;
export { request, createInstance as create };

// Named exports for convenience
export const get = request.get;
export const post = request.post;
export const put = request.put;
export const patch = request.patch;
export const del = request.delete;
export const head = request.head;
export const options = request.options;
