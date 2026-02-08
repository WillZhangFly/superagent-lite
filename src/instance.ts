/**
 * Instance factory - axios-style instance creation
 */

import type { InstanceOptions } from './types.js';
import { Request } from './request.js';

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
  extend: (options?: InstanceOptions) => RequestInstance;
  defaults: InstanceOptions;
}

export function createInstance(options: InstanceOptions = {}): RequestInstance {
  const defaults: InstanceOptions = { ...options };

  // Support ky-style prefixUrl
  if (defaults.prefixUrl && !defaults.baseURL) {
    defaults.baseURL = defaults.prefixUrl;
  }

  const resolveUrl = (url: string): string => {
    if (defaults.baseURL && !url.startsWith('http://') && !url.startsWith('https://')) {
      const base = defaults.baseURL.endsWith('/') ? defaults.baseURL.slice(0, -1) : defaults.baseURL;
      const path = url.startsWith('/') ? url : `/${url}`;
      return `${base}${path}`;
    }
    return url;
  };

  const createRequest = (method: string, url: string): Request => {
    return new Request(method, resolveUrl(url), {
      headers: defaults.headers,
      timeout: defaults.timeout,
      retry: defaults.retry,
      hooks: defaults.hooks,
      throwHttpErrors: defaults.throwHttpErrors,
      parseJson: defaults.parseJson,
      stringifyJson: defaults.stringifyJson,
      credentials: defaults.credentials,
      redirect: defaults.redirect,
      fetch: defaults.fetch
    });
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
  instance.extend = (opts?: InstanceOptions) => createInstance({ ...defaults, ...opts });
  instance.defaults = defaults;

  return instance;
}
