/**
 * superagent-lite
 * Zero-dependency, native fetch HTTP client
 * Drop-in superagent replacement with modern features from ky, got, and axios
 */

// Types
export type {
  RequestOptions,
  TimeoutOptions,
  RetryOptions,
  Hooks,
  BeforeRequestHook,
  AfterResponseHook,
  BeforeRetryHook,
  BeforeErrorHook,
  FileAttachment,
  ResponseHeaders,
  InstanceOptions,
  FetchCredentials,
  FetchRedirect
} from './types.js';

// Classes
export { Response } from './response.js';
export { Request } from './request.js';
export { HTTPError, TimeoutError } from './errors.js';

// Instance factory
export { createInstance, type RequestInstance } from './instance.js';

// Create default instance
import { createInstance } from './instance.js';

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
