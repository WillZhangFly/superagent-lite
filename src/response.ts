/**
 * Response class - superagent compatible
 */

import type { ResponseHeaders } from './types.js';

export class Response {
  readonly status: number;
  readonly statusCode: number;
  readonly ok: boolean;
  readonly statusText: string;
  readonly headers: ResponseHeaders;
  readonly type: string;
  readonly charset: string;
  readonly _response: globalThis.Response;
  body: any;
  text: string;

  constructor(
    nativeResponse: globalThis.Response,
    text: string,
    body: any
  ) {
    this._response = nativeResponse;
    this.status = nativeResponse.status;
    this.statusCode = nativeResponse.status;
    this.statusText = nativeResponse.statusText;
    this.ok = nativeResponse.ok;
    this.text = text;
    this.body = body;

    const contentType = nativeResponse.headers.get('content-type') || '';
    this.type = contentType.split(';')[0].trim();
    this.charset = this.extractCharset(contentType);

    // Convert headers to plain object
    this.headers = {};
    nativeResponse.headers.forEach((value, key) => {
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
