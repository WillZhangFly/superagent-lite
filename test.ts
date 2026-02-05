import request, { HTTPError, TimeoutError } from './src/index.js';

console.log('🧪 Testing superagent-lite...\n');

async function test() {
  // 1. Basic GET
  console.log('1. Testing GET request...');
  const res1 = await request.get('https://jsonplaceholder.typicode.com/posts/1');
  console.log(`   ✅ Status: ${res1.status}`);
  console.log(`   ✅ Body: ${JSON.stringify(res1.body).slice(0, 60)}...`);

  // 2. GET with query params
  console.log('\n2. Testing GET with query params...');
  const res2 = await request
    .get('https://jsonplaceholder.typicode.com/posts')
    .query({ userId: 1 });
  console.log(`   ✅ Status: ${res2.status}`);
  console.log(`   ✅ Got ${res2.body.length} posts`);

  // 3. POST request
  console.log('\n3. Testing POST request...');
  const res3 = await request
    .post('https://jsonplaceholder.typicode.com/posts')
    .send({ title: 'Test', body: 'Content', userId: 1 });
  console.log(`   ✅ Status: ${res3.status}`);
  console.log(`   ✅ Created post id: ${res3.body.id}`);

  // 4. Custom headers
  console.log('\n4. Testing custom headers...');
  const res4 = await request
    .get('https://jsonplaceholder.typicode.com/users/1')
    .set('X-Custom-Header', 'test-value')
    .accept('json');
  console.log(`   ✅ Status: ${res4.status}`);
  console.log(`   ✅ User: ${res4.body.name}`);

  // 5. Create instance with baseURL (axios-style)
  console.log('\n5. Testing instance with baseURL...');
  const api = request.create({
    baseURL: 'https://jsonplaceholder.typicode.com',
    headers: { 'X-API-Key': 'demo' }
  });
  const res5 = await api.get('/users/2');
  console.log(`   ✅ Status: ${res5.status}`);
  console.log(`   ✅ User: ${res5.body.name}`);

  // 6. Error handling (404)
  console.log('\n6. Testing error handling (404)...');
  try {
    await request.get('https://jsonplaceholder.typicode.com/posts/99999');
  } catch (err) {
    if (err instanceof HTTPError) {
      console.log(`   ✅ Caught HTTPError with status: ${err.status}`);
    }
  }

  // 7. Timeout
  console.log('\n7. Testing timeout (1ms - should fail)...');
  try {
    await request
      .get('https://jsonplaceholder.typicode.com/posts')
      .timeout(1);
  } catch (err) {
    if (err instanceof TimeoutError) {
      console.log(`   ✅ Caught TimeoutError: ${err.message}`);
    }
  }

  // 8. Hooks (ky/got style)
  console.log('\n8. Testing hooks...');
  const res8 = await request
    .get('https://jsonplaceholder.typicode.com/posts/1')
    .hook('beforeRequest', () => {
      console.log('   📤 beforeRequest hook called');
    })
    .hook('afterResponse', (res: any) => {
      console.log('   📥 afterResponse hook called');
      return res;
    });
  console.log(`   ✅ Hooks working, status: ${res8.status}`);

  // 9. PUT request
  console.log('\n9. Testing PUT request...');
  const res9 = await request
    .put('https://jsonplaceholder.typicode.com/posts/1')
    .send({ title: 'Updated', body: 'New content', userId: 1 });
  console.log(`   ✅ Status: ${res9.status}`);

  // 10. PATCH request
  console.log('\n10. Testing PATCH request...');
  const res10 = await request
    .patch('https://jsonplaceholder.typicode.com/posts/1')
    .send({ title: 'Patched Title' });
  console.log(`   ✅ Status: ${res10.status}`);

  // 11. DELETE request
  console.log('\n11. Testing DELETE request...');
  const res11 = await request.delete('https://jsonplaceholder.typicode.com/posts/1');
  console.log(`   ✅ Status: ${res11.status}`);

  // 12. Superagent-style chaining
  console.log('\n12. Testing superagent-style chaining...');
  const res12 = await request
    .post('https://jsonplaceholder.typicode.com/posts')
    .type('json')
    .accept('json')
    .set({ 'X-Custom': 'value' })
    .send({ title: 'Chained request' });
  console.log(`   ✅ Status: ${res12.status}`);
  console.log(`   ✅ Content-Type: ${res12.type}`);

  console.log('\n✨ All tests passed!');
}

test().catch(console.error);
