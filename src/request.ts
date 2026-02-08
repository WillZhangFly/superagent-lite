/**
 * Request class - superagent compatible chaining API
 */

import type {
  RequestOptions,
  TimeoutOptions,
  RetryOptions,
  Hooks,
  FetchCredentials,
  FetchRedirect,
  FileAttachment
} from './types.js';
import { Response } from './response.js';
import { HTTPError, TimeoutError } from './errors.js';

// Default retry configuration
const DEFAULT_RETRY_METHODS = ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE'];
const DEFAULT_RETRY_STATUS_CODES = [408, 413, 429, 500, 502, 503, 504];

function defaultRetryDelay(attemptCount: number): number {
  return Math.min(1000 * 2 ** (attemptCount - 1), 30000);
}

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
  private _credentials: FetchCredentials = 'same-origin';
  private _redirect: FetchRedirect = 'follow';
  private _customFetch: typeof fetch = globalThis.fetch;
  private _attachments: FileAttachment[] = [];
  private _formFields: Record<string, string> = {};

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
    if (options.credentials) this._credentials = options.credentials;
    if (options.redirect) this._redirect = options.redirect;
    if (options.fetch) this._customFetch = options.fetch;
  }

  private mergeHooks(hooks: Hooks): void {
    if (hooks.beforeRequest) this._hooks.beforeRequest.push(...hooks.beforeRequest);
    if (hooks.afterResponse) this._hooks.afterResponse.push(...hooks.afterResponse);
    if (hooks.beforeRetry) this._hooks.beforeRetry.push(...hooks.beforeRetry);
    if (hooks.beforeError) this._hooks.beforeError.push(...hooks.beforeError);
  }

  // ==========================================================================
  // Chaining Methods (superagent compatible)
  // ==========================================================================

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

  withCredentials(enabled = true): this {
    this._credentials = enabled ? 'include' : 'same-origin';
    return this;
  }

  redirects(count: number | boolean): this {
    this._redirect = count === false || count === 0 ? 'manual' : 'follow';
    return this;
  }

  attach(name: string, file: Blob | Buffer | string, filename?: string): this {
    this._attachments.push({ name, file, filename });
    return this;
  }

  field(name: string | Record<string, string>, value?: string): this {
    if (typeof name === 'object') {
      Object.assign(this._formFields, name);
    } else if (value !== undefined) {
      this._formFields[name] = value;
    }
    return this;
  }

  // ==========================================================================
  // Hook Methods (inspired by got/ky)
  // ==========================================================================

  hook(name: keyof Hooks, fn: any): this {
    (this._hooks[name] as any[]).push(fn);
    return this;
  }

  // ==========================================================================
  // Execution Control
  // ==========================================================================

  abort(): this {
    this._abortController?.abort();
    return this;
  }

  // ==========================================================================
  // Request Execution
  // ==========================================================================

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

        if (!retryMethods.includes(this._method)) throw lastError;
        if (lastError instanceof TimeoutError) throw lastError;
        if (lastError instanceof HTTPError && !retryStatusCodes.includes(lastError.status)) {
          throw lastError;
        }
        if (attempt >= retryLimit) throw lastError;

        for (const hook of this._hooks.beforeRetry) {
          await hook(lastError as HTTPError, attempt + 1);
        }

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
    let body: string | FormData | undefined;
    const hasAttachments = this._attachments.length > 0;
    const hasFormFields = Object.keys(this._formFields).length > 0;

    if (hasAttachments || hasFormFields) {
      const formData = new FormData();
      for (const [key, value] of Object.entries(this._formFields)) {
        formData.append(key, value);
      }
      for (const { name, file, filename } of this._attachments) {
        if (typeof file === 'string') {
          formData.append(name, new Blob([file]), filename);
        } else if (Buffer.isBuffer(file)) {
          formData.append(name, new Blob([file]), filename);
        } else {
          formData.append(name, file, filename);
        }
      }
      body = formData;
      delete this._headers['content-type'];
    } else if (this._body !== undefined) {
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

    // Setup abort controller
    this._abortController = new AbortController();
    const signal = this._abortController.signal;

    if (this._externalSignal) {
      this._externalSignal.addEventListener('abort', () => this._abortController?.abort());
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutMs = this._timeout.request || this._timeout.response;

    if (timeoutMs) {
      timeoutId = setTimeout(() => this._abortController?.abort(), timeoutMs);
    }

    for (const hook of this._hooks.beforeRequest) {
      await hook(this);
    }

    try {
      const fetchResponse = await this._customFetch(url, {
        method: this._method,
        headers: this._headers,
        body,
        signal,
        credentials: this._credentials,
        redirect: this._redirect
      });

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

      for (const hook of this._hooks.afterResponse) {
        const result = await hook(response);
        if (result) response = result;
      }

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

  // ==========================================================================
  // Promise Interface
  // ==========================================================================

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

  end(callback?: (err: Error | null, res?: Response) => void): void {
    this.execute()
      .then(res => callback?.(null, res))
      .catch(err => callback?.(err));
  }

  // ==========================================================================
  // Response Shortcut Methods (ky-style)
  // ==========================================================================

  async json<T = any>(): Promise<T> {
    const res = await this.execute();
    return res.body;
  }

  async text(): Promise<string> {
    const res = await this.execute();
    return res.text;
  }

  async blob(): Promise<Blob> {
    const response = await this.doFetch();
    return response._response.blob();
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    const response = await this.doFetch();
    return response._response.arrayBuffer();
  }
}
