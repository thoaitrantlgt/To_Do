import { betterAuth } from 'better-auth';

export interface Env {
  DB: D1Database;
  APP_ORIGIN: string;
  BETTER_AUTH_SECRET: string;
}
function trustedOrigins(env: Env): string[] {
  const configured = new URL(env.APP_ORIGIN);
  const origins = [configured.origin];
  if (configured.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(configured.hostname)) {
    configured.hostname = configured.hostname === 'localhost' ? '127.0.0.1' : 'localhost';
    origins.push(configured.origin);
  }
  return origins;
}
export function createAuth(env: Env) {
  return betterAuth({
    database: env.DB,
    baseURL: env.APP_ORIGIN,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: trustedOrigins(env),
    emailAndPassword: { enabled: true, minPasswordLength: 8 },
    advanced: {
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
      defaultCookieAttributes: {
        httpOnly: true,
        secure: env.APP_ORIGIN.startsWith('https:'),
        sameSite: 'lax',
      },
    },
  });
}
class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
const invalid = (message: string): never => {
  throw new ApiError(400, 'INVALID_INPUT', message);
};
function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
export function todayVN() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000'))
    return false;
  const date = new Date(value + 'T00:00:00Z');
  return !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
type TaskRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: 'todo' | 'done';
  created_at: string;
  updated_at: string;
};
function serialize(row: TaskRow, today: string) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    dueDate: row.due_date,
    status: row.status,
    overdue: row.status === 'todo' && !!row.due_date && row.due_date < today,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
async function input(request: Request, patch: boolean): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.includes('application/json'))
    invalid('Dữ liệu phải có định dạng JSON.');
  let body: any;
  try {
    body = await request.json();
  } catch {
    invalid('JSON không hợp lệ.');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalid('Dữ liệu không hợp lệ.');
  const allowed = patch
    ? ['title', 'description', 'dueDate', 'status']
    : ['title', 'description', 'dueDate'];
  if (Object.keys(body).some((k) => !allowed.includes(k)) || (patch && !Object.keys(body).length))
    invalid('Trường dữ liệu không hợp lệ.');
  if (!patch || 'title' in body) {
    if (
      typeof body.title !== 'string' ||
      body.title.trim().length < 1 ||
      body.title.trim().length > 120
    )
      invalid('Tiêu đề phải dài từ 1 đến 120 ký tự.');
    body.title = body.title.trim();
  }
  if ('description' in body && body.description !== null) {
    if (typeof body.description !== 'string' || body.description.length > 1000)
      invalid('Mô tả tối đa 1.000 ký tự.');
    if (!body.description.trim()) body.description = null;
  }
  if ('dueDate' in body && body.dueDate !== null && !validDate(body.dueDate))
    invalid('Ngày đến hạn không hợp lệ.');
  if ('status' in body && !['todo', 'done'].includes(body.status))
    invalid('Trạng thái không hợp lệ.');
  return body;
}
async function route(request: Request, env: Env) {
  const url = new URL(request.url),
    path = url.pathname,
    method = request.method;
  if (path === '/api/health' && method === 'GET') {
    try {
      await env.DB.prepare('SELECT 1').first();
      return json({ ok: true });
    } catch {
      return json({ ok: false }, 503);
    }
  }
  const auth = createAuth(env);
  if (path.startsWith('/api/auth/')) {
    const response = await auth.handler(request);
    const result = new Response(response.body, response);
    result.headers.set('Cache-Control', 'no-store');
    return result;
  }
  if (path !== '/api/tasks' && !/^\/api\/tasks\/[^/]+$/.test(path))
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy đường dẫn.');
  if (
    ['POST', 'PATCH', 'DELETE'].includes(method) &&
    !trustedOrigins(env).includes(request.headers.get('Origin') ?? '')
  )
    throw new ApiError(403, 'FORBIDDEN', 'Nguồn yêu cầu không được phép.');
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) throw new ApiError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập để tiếp tục.');
  const userId = session.user.id,
    today = todayVN();
  if (path === '/api/tasks' && method === 'GET') {
    const status = url.searchParams.get('status'),
      due = url.searchParams.get('due');
    if (status !== null && !['todo', 'done'].includes(status))
      invalid('Bộ lọc trạng thái không hợp lệ.');
    if (due !== null && !['today', 'overdue', 'upcoming'].includes(due))
      invalid('Bộ lọc hạn không hợp lệ.');
    const where = ['user_id = ?'];
    const params: string[] = [userId];
    if (status) {
      where.push('status = ?');
      params.push(status);
    }
    if (due) {
      where.push(
        due === 'overdue'
          ? "due_date < ? AND status = 'todo'"
          : due === 'today'
            ? 'due_date = ?'
            : 'due_date > ?',
      );
      params.push(today);
    }
    const { results } = await env.DB.prepare(
      `SELECT * FROM tasks WHERE ${where.join(' AND ')} ORDER BY due_date IS NULL, due_date ASC, created_at DESC, id ASC`,
    )
      .bind(...params)
      .all<TaskRow>();
    return json({ items: results.map((row) => serialize(row, today)) });
  }
  if (path === '/api/tasks' && method === 'POST') {
    const data = await input(request, false),
      id = crypto.randomUUID(),
      now = new Date().toISOString();
    const row = await env.DB.prepare(
      "INSERT INTO tasks (id,user_id,title,description,due_date,status,created_at,updated_at) VALUES (?,?,?,?,?,'todo',?,?) RETURNING *",
    )
      .bind(id, userId, data.title, data.description ?? null, data.dueDate ?? null, now, now)
      .first<TaskRow>();
    console.log(JSON.stringify({ event: 'task_created', taskId: id }));
    return json({ item: serialize(row!, today) }, 201);
  }
  const id = path.split('/')[3];
  if (id && method === 'PATCH') {
    const data = await input(request, true),
      columns: Record<string, string> = {
        title: 'title',
        description: 'description',
        dueDate: 'due_date',
        status: 'status',
      };
    const keys = Object.keys(data),
      params = keys.map((k) => data[k]);
    const row = await env.DB.prepare(
      `UPDATE tasks SET ${keys.map((k) => columns[k] + ' = ?').join(', ')}, updated_at = ? WHERE id = ? AND user_id = ? RETURNING *`,
    )
      .bind(...params, new Date().toISOString(), id, userId)
      .first<TaskRow>();
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy công việc.');
    return json({ item: serialize(row, today) });
  }
  if (id && method === 'DELETE') {
    const row = await env.DB.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ? RETURNING id')
      .bind(id, userId)
      .first();
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy công việc.');
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  }
  throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Phương thức không được hỗ trợ.');
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    let response: Response;
    try {
      response = await route(request, env);
    } catch (error) {
      const known = error instanceof ApiError;
      if (!known)
        console.error(JSON.stringify({ event: 'request_failed', code: 'INTERNAL_ERROR' }));
      response = json(
        {
          error: {
            code: known ? error.code : 'INTERNAL_ERROR',
            message: known ? error.message : 'Máy chủ gặp lỗi. Vui lòng thử lại.',
          },
        },
        known ? error.status : 500,
      );
    }
    console.log(
      JSON.stringify({
        method: request.method,
        path: new URL(request.url).pathname,
        status: response.status,
      }),
    );
    return response;
  },
};
