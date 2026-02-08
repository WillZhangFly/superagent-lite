# superagent-lite

Zero-dependency, lightweight drop-in replacement for [superagent](https://github.com/ladjs/superagent) built on native `fetch`.

Takes the best from **superagent**, **axios**, **got**, and **ky** while fixing their weaknesses.

## Why?

| Feature | superagent | axios | got | ky | **superagent-lite** |
|---------|------------|-------|-----|-----|---------------------|
| Bundle size | 19.9KB | 11KB | 48KB | 3KB | **~4KB** |
| Dependencies | 9 | 3 | 11 | 0 | **0** |
| Native fetch | ❌ | ❌ | ❌ | ✅ | **✅** |
| TypeScript | Partial | ✅ | ✅ | ✅ | **✅** |
| Chaining API | ✅ | ❌ | ❌ | ❌ | **✅** |
| Hooks/Interceptors | ❌ | ✅ | ✅ | ✅ | **✅** |
| Instance creation | ❌ | ✅ | ✅ | ✅ | **✅** |
| Smart retry | ❌ | ❌ | ✅ | ✅ | **✅** |
| Response shortcuts | ❌ | ❌ | ❌ | ✅ | **✅** |
| File uploads | ✅ | ✅ | ✅ | ❌ | **✅** |

## Installation

```bash
npm install superagent-lite
```

## Quick Start

```typescript
import request from 'superagent-lite';

// GET request
const res = await request.get('https://api.example.com/users');
console.log(res.body);

// POST with JSON body
await request
  .post('https://api.example.com/users')
  .send({ name: 'John', email: 'john@example.com' });

// Chaining (superagent-style)
await request
  .get('https://api.example.com/posts')
  .query({ page: 1, limit: 10 })
  .set('Authorization', 'Bearer token')
  .accept('json');

// Response shortcuts (ky-style)
const data = await request.get('/api/users').json();
const html = await request.get('/page').text();
```

## Superagent Drop-in Replacement

```typescript
// Before (superagent)
import request from 'superagent';

// After (superagent-lite) - same API!
import request from 'superagent-lite';

request
  .post('/api/users')
  .set('Content-Type', 'application/json')
  .send({ name: 'John' })
  .then(res => console.log(res.body));
```

## API

### HTTP Methods

```typescript
request.get(url)
request.post(url)
request.put(url)
request.patch(url)
request.delete(url)  // or request.del(url)
request.head(url)
request.options(url)
```

### Chaining Methods

```typescript
.set(header, value)       // Set header
.set({ headers })         // Set multiple headers
.query({ params })        // Add query parameters
.query('key=value')       // Add query string
.send(data)               // Set request body
.type('json')             // Set Content-Type
.accept('json')           // Set Accept header
.timeout(ms)              // Set timeout
.timeout({ request, response })
.retry(count)             // Enable retries
.retry({ limit, methods, statusCodes, delay })
.auth(user, pass)         // Basic auth
.auth(token, { type: 'bearer' })  // Bearer token
.withCredentials()        // Include cookies (CORS)
.redirects(false)         // Disable redirects
.hook(name, fn)           // Add hook
.abort()                  // Abort request
```

### File Uploads

```typescript
// Upload files with multipart/form-data
await request
  .post('/upload')
  .attach('avatar', file, 'photo.jpg')
  .field('name', 'John')
  .field({ email: 'john@example.com' });
```

### Response Shortcuts (ky-style)

```typescript
// Get parsed JSON directly
const users = await request.get('/api/users').json<User[]>();

// Get text response
const html = await request.get('/page').text();

// Get binary data
const buffer = await request.get('/image.png').arrayBuffer();
const blob = await request.get('/file.pdf').blob();
```

### Response Object

```typescript
res.status      // HTTP status code
res.statusCode  // Alias for status
res.ok          // true if status 2xx
res.body        // Parsed response body
res.text        // Raw response text
res.headers     // Response headers object
res.type        // Content-Type
res.get(header) // Get specific header
```

## Create Instance (axios-style)

```typescript
const api = request.create({
  baseURL: 'https://api.example.com',
  headers: {
    'Authorization': 'Bearer token'
  },
  timeout: 5000,
  retry: 2
});

// All requests use the base configuration
await api.get('/users');
await api.post('/users').send({ name: 'John' });

// Extend instance (ky-style)
const adminApi = api.extend({
  headers: { 'X-Admin': 'true' }
});
```

### Instance Options

```typescript
request.create({
  baseURL: 'https://api.example.com',  // Base URL for requests
  prefixUrl: 'https://api.example.com', // ky-style alias
  headers: { ... },                     // Default headers
  timeout: 5000,                        // Request timeout
  retry: 2,                             // Retry count
  credentials: 'include',               // Fetch credentials mode
  redirect: 'follow',                   // Redirect behavior
  throwHttpErrors: true,                // Throw on non-2xx
  parseJson: JSON.parse,                // Custom JSON parser
  stringifyJson: JSON.stringify,        // Custom JSON serializer
  fetch: customFetch                    // Custom fetch implementation
});
```

## Hooks (got/ky-style)

```typescript
// Per-request hooks
await request
  .get('/api/data')
  .hook('beforeRequest', (req) => {
    console.log('Sending request...');
  })
  .hook('afterResponse', (res) => {
    console.log('Got response:', res.status);
    return res;
  });

// Instance-level hooks
const api = request.create({
  hooks: {
    beforeRequest: [(req) => { /* modify request */ }],
    afterResponse: [(res) => { /* modify response */ }],
    beforeRetry: [(error, retryCount) => { /* log retry */ }],
    beforeError: [(error) => { /* transform error */ }]
  }
});
```

## Retry with Exponential Backoff

```typescript
await request
  .get('/api/flaky-endpoint')
  .retry({
    limit: 3,
    methods: ['GET', 'PUT', 'DELETE'],
    statusCodes: [408, 429, 500, 502, 503, 504],
    delay: (attempt) => Math.min(1000 * 2 ** attempt, 30000)
  });
```

## Error Handling

```typescript
import request, { HTTPError, TimeoutError } from 'superagent-lite';

try {
  await request.get('/api/data').timeout(5000);
} catch (error) {
  if (error instanceof HTTPError) {
    console.log('HTTP error:', error.status);
    console.log('Response:', error.response.body);
  } else if (error instanceof TimeoutError) {
    console.log('Request timed out');
  }
}
```

## TypeScript

Full TypeScript support with exported types:

```typescript
import request, {
  Request,
  Response,
  HTTPError,
  TimeoutError,
  RequestOptions,
  InstanceOptions,
  Hooks,
  RequestInstance
} from 'superagent-lite';
```

## Migration from superagent

Most superagent code works without changes:

```typescript
// ✅ Works
request.get(url).query(params).set(headers).then(...)
request.post(url).send(data).type('json').then(...)
request.put(url).auth(user, pass).send(data).then(...)

// ✅ Also works - legacy callback style
request.get(url).end((err, res) => { ... });

// ✅ File uploads
request.post(url).attach('file', buffer, 'name.txt').field('key', 'value')
```

## Project Structure

```
src/
├── index.ts      # Main exports
├── types.ts      # TypeScript interfaces
├── request.ts    # Request class with chaining API
├── response.ts   # Response wrapper class
├── instance.ts   # Instance factory
└── errors.ts     # HTTPError, TimeoutError
```

## License

MIT

---

If you find this useful, consider [buying me a coffee](https://buymeacoffee.com/willzhangfly)!
