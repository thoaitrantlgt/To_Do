import { env, SELF, applyD1Migrations } from 'cloudflare:test';
import { beforeAll, expect, test } from 'vitest';
import worker from '../src/index';

const origin = 'http://localhost:8788';
let cookieA = '',
  cookieB = '',
  taskId = '';
async function call(
  path: string,
  method = 'GET',
  body?: unknown,
  cookie = cookieA,
  requestOrigin = origin,
) {
  return SELF.fetch(origin + path, {
    method,
    headers: { Origin: requestOrigin, Cookie: cookie, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});
test('health executes D1 query', async () => {
  const res = await call('/api/health');
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true });
});
test('unauthenticated tasks are rejected', async () => {
  expect((await call('/api/tasks')).status).toBe(401);
});

test('loopback alias supports cookie auth and task mutations without trusting other origins', async () => {
  const alias = 'http://127.0.0.1:8788';
  const signup = await call(
    '/api/auth/sign-up/email',
    'POST',
    { name: 'Local user', email: 'loopback@example.com', password: 'Cloudtask-test-123!' },
    '',
    alias,
  );
  expect(signup.status).toBe(200);
  const cookie = signup.headers.get('set-cookie')!.split(';')[0];
  const created = await call('/api/tasks', 'POST', { title: 'Loopback task' }, cookie, alias);
  expect(created.status).toBe(201);
  const { item }: any = await created.json();
  expect(
    (await call('/api/tasks/' + item.id, 'PATCH', { status: 'done' }, cookie, alias)).status,
  ).toBe(200);
  expect((await call('/api/tasks/' + item.id, 'DELETE', undefined, cookie, alias)).status).toBe(
    204,
  );
  expect((await call('/api/auth/sign-out', 'POST', {}, cookie, alias)).status).toBe(200);
  const signin = await call(
    '/api/auth/sign-in/email',
    'POST',
    { email: 'loopback@example.com', password: 'Cloudtask-test-123!' },
    '',
    alias,
  );
  expect(signin.status).toBe(200);
  for (const badOrigin of [
    'http://127.0.0.1:8789',
    'http://localhost.evil.test:8788',
    'https://other.test',
  ]) {
    expect((await call('/api/tasks', 'POST', { title: 'Blocked' }, cookie, badOrigin)).status).toBe(
      403,
    );
    expect(
      (
        await call(
          '/api/auth/sign-in/email',
          'POST',
          { email: 'loopback@example.com', password: 'Cloudtask-test-123!' },
          '',
          badOrigin,
        )
      ).status,
    ).toBe(403);
  }
});

test('production rejects loopback origins for auth and tasks', async () => {
  const productionEnv = { ...env, APP_ORIGIN: 'https://cloudtask-neon.pages.dev' };
  for (const path of ['/api/tasks', '/api/auth/sign-in/email']) {
    const request = new Request(productionEnv.APP_ORIGIN + path, {
      method: 'POST',
      headers: { Origin: 'http://127.0.0.1:8788', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'loopback@example.com', password: 'Cloudtask-test-123!' }),
    });
    expect((await worker.fetch(request, productionEnv)).status).toBe(403);
  }
});
test('register two real accounts and establish cookie sessions', async () => {
  for (const [name, email] of [
    ['Alice', 'a@example.com'],
    ['Bob', 'b@example.com'],
  ]) {
    const res = await call(
      '/api/auth/sign-up/email',
      'POST',
      { name, email, password: 'Cloudtask-test-123!' },
      '',
    );
    expect(res.status).toBe(200);
    const cookie = res.headers.get('set-cookie')!.split(';')[0];
    expect(cookie).toContain('session_token');
    if (name === 'Alice') cookieA = cookie;
    else cookieB = cookie;
  }
  const session: any = await (await call('/api/auth/get-session')).json();
  expect(session.user.name).toBe('Alice');
});
test('validates task input before writing', async () => {
  for (const body of [
    { title: '  ' },
    { title: 'Test', dueDate: '2026-02-30' },
    { title: 'Test', userId: 'other' },
    { title: 'a'.repeat(121) },
    { title: 'Test', description: 'x'.repeat(1001) },
  ]) {
    expect((await call('/api/tasks', 'POST', body)).status).toBe(400);
  }
});
test('create persists trimmed task with default status', async () => {
  const res = await call('/api/tasks', 'POST', {
    title: '  Demo  ',
    description: 'Cloudflare',
    dueDate: '2020-01-01',
  });
  expect(res.status).toBe(201);
  const { item }: any = await res.json();
  taskId = item.id;
  expect(item).toMatchObject({
    title: 'Demo',
    status: 'todo',
    overdue: true,
    dueDate: '2020-01-01',
  });
  const { items }: any = await (await call('/api/tasks')).json();
  expect(items.map((t: any) => t.id)).toContain(taskId);
});
test('another account cannot read, patch or delete an owned task', async () => {
  expect(await (await call('/api/tasks', 'GET', undefined, cookieB)).json()).toEqual({ items: [] });
  expect((await call('/api/tasks/' + taskId, 'PATCH', { title: 'Hijacked' }, cookieB)).status).toBe(
    404,
  );
  expect((await call('/api/tasks/' + taskId, 'DELETE', undefined, cookieB)).status).toBe(404);
});
test('rejects foreign origin and invalid queries or patches', async () => {
  expect(
    (await call('/api/tasks', 'POST', { title: 'CSRF' }, cookieA, 'https://other.test')).status,
  ).toBe(403);
  for (const path of ['/api/tasks?status=invalid', '/api/tasks?due=invalid'])
    expect((await call(path)).status).toBe(400);
  for (const body of [{}, { status: 'invalid' }, { userId: 'other' }, { title: null }])
    expect((await call('/api/tasks/' + taskId, 'PATCH', body)).status).toBe(400);
});
test('completion removes overdue flag and combines status and due filters', async () => {
  const res = await call('/api/tasks/' + taskId, 'PATCH', { status: 'done' });
  expect(res.status).toBe(200);
  expect(((await res.json()) as any).item.overdue).toBe(false);
  expect(await (await call('/api/tasks?due=overdue')).json()).toEqual({ items: [] });
  expect(((await (await call('/api/tasks?status=done')).json()) as any).items).toHaveLength(1);
  expect(await (await call('/api/tasks?status=todo&due=overdue')).json()).toEqual({ items: [] });
});
test('partial update clears optional fields and preserves title', async () => {
  const res = await call('/api/tasks/' + taskId, 'PATCH', { description: null, dueDate: null });
  expect(((await res.json()) as any).item).toMatchObject({
    title: 'Demo',
    description: null,
    dueDate: null,
    status: 'done',
  });
});
test('delete returns empty 204 and record stays deleted', async () => {
  const res = await call('/api/tasks/' + taskId, 'DELETE');
  expect(res.status).toBe(204);
  expect(await res.text()).toBe('');
  expect(await (await call('/api/tasks')).json()).toEqual({ items: [] });
});
test('sign out revokes session', async () => {
  expect((await call('/api/auth/sign-out', 'POST', {})).status).toBe(200);
  expect((await call('/api/tasks')).status).toBe(401);
});
test('date filters use Vietnam calendar, combine with status, and sort null dates last', async () => {
  expect(
    (
      await call(
        '/api/auth/sign-in/email',
        'POST',
        { email: 'a@example.com', password: 'wrong-password' },
        '',
      )
    ).status,
  ).toBe(401);
  const login = await call(
    '/api/auth/sign-in/email',
    'POST',
    { email: 'a@example.com', password: 'Cloudtask-test-123!' },
    '',
  );
  expect(login.status).toBe(200);
  cookieA = login.headers.get('set-cookie')!.split(';')[0];
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(
    new Date(),
  );
  const samples = [
    { title: 'No date' },
    { title: 'Tomorrow', dueDate: '2099-01-01' },
    { title: 'Today done', dueDate: today },
    { title: 'Today todo', dueDate: today },
    { title: 'Past todo', dueDate: '2020-01-01' },
    { title: 'Past done', dueDate: '2020-01-01' },
  ];
  const ids: string[] = [];
  for (const sample of samples) {
    const created = await call('/api/tasks', 'POST', sample);
    expect(created.status).toBe(201);
    const { item }: any = await created.json();
    ids.push(item.id);
    if (sample.title.endsWith('done'))
      expect((await call('/api/tasks/' + item.id, 'PATCH', { status: 'done' })).status).toBe(200);
  }
  for (const [query, titles] of [
    ['due=today', ['Today done', 'Today todo']],
    ['due=today&status=done', ['Today done']],
    ['due=overdue', ['Past todo']],
    ['due=overdue&status=done', []],
    ['due=upcoming', ['Tomorrow']],
  ] as [string, string[]][]) {
    const response = await call('/api/tasks?' + query);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const { items }: any = await response.json();
    expect(items.map((t: any) => t.title).sort()).toEqual(titles.sort());
  }
  const { items }: any = await (await call('/api/tasks')).json();
  expect(items.at(-1).title).toBe('No date');
  expect(items.at(-2).title).toBe('Tomorrow');
  const expected = [...items].sort(
    (a: any, b: any) =>
      (a.dueDate === null ? 1 : 0) - (b.dueDate === null ? 1 : 0) ||
      (a.dueDate || '').localeCompare(b.dueDate || '') ||
      b.createdAt.localeCompare(a.createdAt) ||
      a.id.localeCompare(b.id),
  );
  expect(items.map((t: any) => t.id)).toEqual(expected.map((t: any) => t.id));
  for (const id of ids) await call('/api/tasks/' + id, 'DELETE');
});
