/**
 * Error classes for superagent-lite
 */

import type { Response } from './response.js';

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
