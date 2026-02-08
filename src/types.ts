/**
 * Type definitions for superagent-lite
 */

// Fetch API types for cross-environment compatibility
export type FetchCredentials = 'omit' | 'same-origin' | 'include';
export type FetchRedirect = 'follow' | 'error' | 'manual';

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

// Forward declarations for hook types
export type BeforeRequestHook = (request: any) => any | void | Promise<any | void>;
export type AfterResponseHook = (response: any) => any | void | Promise<any | void>;
export type BeforeRetryHook = (error: any, retryCount: number) => void | Promise<void>;
export type BeforeErrorHook = (error: any) => any | Promise<any>;

export interface FileAttachment {
  name: string;
  file: Blob | Buffer | string;
  filename?: string;
}

export interface ResponseHeaders {
  [key: string]: string;
}

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
  credentials?: FetchCredentials;
  redirect?: FetchRedirect;
  fetch?: typeof fetch;
}

export interface InstanceOptions extends RequestOptions {
  baseURL?: string;
  prefixUrl?: string; // ky-style alias for baseURL
  headers?: Record<string, string>;
}
