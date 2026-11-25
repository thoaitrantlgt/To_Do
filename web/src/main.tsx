import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createAuthClient } from 'better-auth/react';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/montserrat/400.css';
import '@fontsource/montserrat/500.css';
import '@fontsource/montserrat/600.css';
import '@fontsource/montserrat/700.css';
import assets from './design-assets.json';
import './styles.css';

const auth = createAuthClient();
const d = assets['16:35'],
  loginAssets = assets['449:1406'],
  registerAssets = assets['449:1440'];
type Task = {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: 'todo' | 'done';
  overdue: boolean;
  createdAt: string;
  updatedAt: string;
};
type User = { id: string; name: string; email: string };
class RequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
async function api<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch('/api' + path, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new RequestError('Không thể kết nối. Hãy kiểm tra mạng và thử lại.', 0);
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new RequestError(
      data?.error?.message || 'Có lỗi xảy ra. Vui lòng thử lại.',
      response.status,
    );
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
function Img({ src, className = '' }: { src: string; className?: string }) {
  return <img src={src} alt="" className={className} aria-hidden="true" />;
}
function Icon({ type }: { type: 'edit' | 'delete' | 'plus' | 'logout' | 'check' }) {
  const glyphs = { edit: '✎', delete: '×', plus: '+', logout: '↪', check: '✓' };
  return (
    <span className="glyph" aria-hidden="true">
      {glyphs[type]}
    </span>
  );
}
function App() {
  const { data, isPending, error, refetch } = auth.useSession();
  const [expired, setExpired] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  useEffect(() => {
    if (!isPending && !error) setSessionChecked(true);
  }, [isPending, error]);
  // Background session refreshes must not unmount forms with unsaved input.
  if (isPending && !sessionChecked)
    return (
      <div className="full-state" role="status">
        <span className="spinner" />
        Đang kiểm tra phiên…
      </div>
    );
  if (error && !expired && !sessionChecked)
    return (
      <div className="full-state">
        <h1>Không thể kiểm tra phiên</h1>
        <p>Kiểm tra kết nối và thử lại.</p>
        <button className="primary" onClick={() => refetch()}>
          Thử lại
        </button>
      </div>
    );
  if (!data?.user || expired)
    return (
      <AuthScreen
        expired={expired}
        onSuccess={async () => {
          setExpired(false);
          await refetch();
        }}
      />
    );
  return (
    <Dashboard
      key={data.user.id}
      user={data.user}
      onExpired={() => {
        setExpired(true);
      }}
      onLogout={async () => {
        await refetch();
      }}
    />
  );
}
function AuthScreen({ onSuccess, expired }: { onSuccess: () => Promise<void>; expired: boolean }) {
  const [register, setRegister] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [name, setName] = useState(''),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState('');
  const [remember, setRemember] = useState(true);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    if (register && !name.trim()) {
      setError('Vui lòng nhập tên hiển thị.');
      return;
    }
    if (register && password !== confirm) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    setBusy(true);
    try {
      const result = register
        ? await auth.signUp.email({ name: name.trim(), email, password })
        : await auth.signIn.email({ email, password, rememberMe: remember });
      if (result.error) {
        setError(
          result.error.code === 'INVALID_EMAIL_OR_PASSWORD'
            ? 'Email hoặc mật khẩu không đúng.'
            : result.error.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL'
              ? 'Email này đã được đăng ký.'
              : result.error.message || 'Không thể xác thực. Vui lòng thử lại.',
        );
        return;
      }
      await onSuccess();
    } catch {
      setError('Không thể kết nối máy chủ. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className={'auth-page ' + (register ? 'register-page' : '')}>
      <div className="auth-pattern">
        <Img src={loginAssets.imgIstockphoto14838634472048X20482} />
      </div>
      <section className="auth-card">
        <div className="auth-illustration">
          <Img src={register ? registerAssets.imgR2 : loginAssets.imgAch31} />
          <div className="auth-caption">Mỗi ngày, một bước tiến.</div>
        </div>
        <form className="auth-form" onSubmit={submit}>
          <a className="wordmark" href="/">
            Cloud<span>Task</span>
            <small>NEON</small>
          </a>
          <h1>{register ? 'Tạo tài khoản' : 'Đăng nhập'}</h1>
          <p className="auth-intro">
            {register
              ? 'Một nơi cho mọi công việc của bạn.'
              : 'Chào bạn, cùng bắt đầu một ngày hiệu quả.'}
          </p>
          {expired && <p className="notice">Phiên đã hết hạn. Vui lòng đăng nhập lại.</p>}
          {error && (
            <p role="alert" className="error-banner">
              {error}
            </p>
          )}
          <fieldset disabled={busy}>
            {register && (
              <label className="auth-input">
                <Img src={registerAssets.imgMdiUser} />
                <span className="sr-only">Tên hiển thị</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tên hiển thị"
                  autoComplete="name"
                  required
                  maxLength={100}
                />
              </label>
            )}
            <label className="auth-input">
              <Img src={registerAssets.imgIcBaselineEmail} />
              <span className="sr-only">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Địa chỉ email"
                autoComplete="email"
                required
              />
            </label>
            <label className="auth-input">
              <Img src={loginAssets.imgMdiPassword} />
              <span className="sr-only">Mật khẩu</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mật khẩu"
                minLength={8}
                maxLength={128}
                autoComplete={register ? 'new-password' : 'current-password'}
                required
              />
            </label>
            {register && (
              <>
                <label className="auth-input">
                  <Img src={registerAssets.imgMdiPasswordOutline} />
                  <span className="sr-only">Xác nhận mật khẩu</span>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Xác nhận mật khẩu"
                    minLength={8}
                    maxLength={128}
                    autoComplete="new-password"
                    required
                  />
                </label>
                <p className="field-hint">Dùng ít nhất 8 ký tự cho mật khẩu.</p>
              </>
            )}
            {!register && (
              <label className="remember">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />{' '}
                Ghi nhớ đăng nhập
              </label>
            )}
            <button className="primary auth-submit" type="submit">
              {busy ? 'Đang xử lý…' : register ? 'Đăng ký' : 'Đăng nhập'}
            </button>
          </fieldset>
          <p className="switch-auth">
            {register ? 'Bạn đã có tài khoản?' : 'Bạn chưa có tài khoản?'}{' '}
            <button
              disabled={busy}
              type="button"
              onClick={() => {
                setRegister(!register);
                setError('');
              }}
            >
              {register ? 'Đăng nhập' : 'Tạo tài khoản'}
            </button>
          </p>
        </form>
      </section>
      <p className="auth-footer">CloudTask · Không gian làm việc cá nhân của bạn</p>
    </main>
  );
}

function Dashboard({
  user,
  onExpired,
  onLogout,
}: {
  user: User;
  onExpired: () => void;
  onLogout: () => Promise<void>;
}) {
  const [items, setItems] = useState<Task[]>([]),
    [all, setAll] = useState<Task[]>([]);
  const [status, setStatus] = useState(''),
    [due, setDue] = useState(''),
    [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [busy, setBusy] = useState('');
  const [editing, setEditing] = useState<Task | 'new' | null>(null),
    [deleting, setDeleting] = useState<Task | null>(null);
  const [view, setView] = useState('dashboard'),
    [toast, setToast] = useState('');
  const requestSeq = useRef(0),
    abort = useRef<AbortController | null>(null);
  const currentFilters = useRef({ status, due });
  currentFilters.current = { status, due };
  function handleError(err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') return;
    if (err instanceof RequestError && err.status === 401) {
      setItems([]);
      setAll([]);
      onExpired();
      return;
    }
    setError(err instanceof Error ? err.message : 'Có lỗi xảy ra. Vui lòng thử lại.');
  }
  async function load() {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    const sequence = ++requestSeq.current;
    setLoading(true);
    setError('');
    const filters = currentFilters.current;
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.due) params.set('due', filters.due);
    try {
      const [filtered, total] = await Promise.all([
        api<{ items: Task[] }>('/tasks?' + params, 'GET', undefined, controller.signal),
        api<{ items: Task[] }>('/tasks', 'GET', undefined, controller.signal),
      ]);
      if (sequence === requestSeq.current) {
        setItems(filtered.items);
        setAll(total.items);
      }
    } catch (err) {
      if (sequence === requestSeq.current) handleError(err);
    } finally {
      if (sequence === requestSeq.current) setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    return () => {
      abort.current?.abort();
      requestSeq.current++;
    };
  }, [status, due]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(timer);
  }, [toast]);
  async function toggle(task: Task) {
    setBusy(task.id);
    setError('');
    try {
      await api('/tasks/' + task.id, 'PATCH', { status: task.status === 'done' ? 'todo' : 'done' });
      setToast(task.status === 'done' ? 'Đã mở lại công việc.' : 'Đã hoàn thành công việc.');
      await load();
    } catch (err) {
      handleError(err);
    } finally {
      setBusy('');
    }
  }
  async function remove() {
    if (!deleting) return;
    setBusy(deleting.id);
    setError('');
    try {
      await api('/tasks/' + deleting.id, 'DELETE');
      setDeleting(null);
      setToast('Đã xóa công việc.');
      await load();
    } catch (err) {
      handleError(err);
    } finally {
      setBusy('');
    }
  }
  async function logout() {
    setBusy('logout');
    setError('');
    try {
      const result = await auth.signOut();
      if (result.error) throw new Error('Không thể đăng xuất. Vui lòng thử lại.');
      abort.current?.abort();
      requestSeq.current++;
      setItems([]);
      setAll([]);
      await onLogout();
    } catch (err) {
      handleError(err);
    } finally {
      setBusy('');
    }
  }
  function navigate(next: string) {
    setView(next);
    setStatus('');
    setDue(next === 'overdue' ? 'overdue' : '');
    setSearch('');
  }
  const visible = items.filter((t) =>
    (t.title + ' ' + (t.description || ''))
      .toLocaleLowerCase('vi')
      .includes(search.toLocaleLowerCase('vi')),
  );
  const doneCount = all.filter((t) => t.status === 'done').length,
    todoCount = all.length - doneCount;
  const date = new Date(),
    today = new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      dateStyle: 'short',
    }).format(date);
  const nav = [
    { id: 'dashboard', text: 'Tổng quan', icon: d.imgVector2 },
    { id: 'overdue', text: 'Công việc quá hạn', icon: d.imgVector1 },
    { id: 'tasks', text: 'Công việc của tôi', icon: d.imgMyTask },
  ];
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="wordmark" href="/">
          Cloud<span>Task</span>
        </a>
        <label className="search">
          <span className="sr-only">Tìm công việc</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm công việc của bạn…"
          />
          <Img src={d.imgSearchICon} />
        </label>
        <div className="header-date">
          <Img src={d.imgCal} />
          <div>
            <strong>
              {new Intl.DateTimeFormat('vi-VN', {
                timeZone: 'Asia/Ho_Chi_Minh',
                weekday: 'long',
              }).format(date)}
            </strong>
            <span>{today}</span>
          </div>
        </div>
      </header>
      <aside className="sidebar">
        <div className="profile">
          <div className="avatar">
            {user.name
              .trim()
              .split(/\s+/)
              .slice(-2)
              .map((s) => s[0])
              .join('')
              .toUpperCase()}
          </div>
          <strong>{user.name}</strong>
          <span>{user.email}</span>
        </div>
        <nav aria-label="Điều hướng chính">
          {nav.map((n) => (
            <button
              key={n.id}
              className={view === n.id ? 'active' : ''}
              aria-current={view === n.id ? 'page' : undefined}
              onClick={() => navigate(n.id)}
            >
              <Img src={n.icon} />
              {n.text}
              {n.id === 'overdue' && all.some((t) => t.overdue) && (
                <span className="nav-count">{all.filter((t) => t.overdue).length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <p>
            Một việc nhỏ hôm nay.
            <br />
            Một bước tiến ngày mai.
          </p>
          <button disabled={!!busy} onClick={logout}>
            <Icon type="logout" />
            {busy === 'logout' ? 'Đang đăng xuất…' : 'Đăng xuất'}
          </button>
        </div>
      </aside>
      <main className="workspace">
        <div className="welcome">
          <div>
            <h1>
              {view === 'dashboard'
                ? `Chào mừng trở lại, ${user.name.split(' ').at(-1)}`
                : view === 'overdue'
                  ? 'Công việc quá hạn'
                  : 'Công việc của tôi'}
              {view === 'dashboard' && <Img src={d.imgProperty1Default} />}
            </h1>
            <p>
              {view === 'overdue'
                ? 'Ưu tiên hoàn thành những việc còn đang chờ bạn.'
                : 'Sắp xếp công việc, dành thời gian cho điều quan trọng.'}
            </p>
          </div>
          <button className="primary" onClick={() => setEditing('new')}>
            <Icon type="plus" /> Thêm công việc
          </button>
        </div>
        {error && (
          <div role="alert" className="error-banner">
            {error} <button onClick={() => void load()}>Thử lại</button>
          </div>
        )}
        <div className="filters">
          <div className="filter-label">
            Danh sách công việc <span>{all.length}</span>
          </div>
          <label>
            <span className="sr-only">Lọc theo trạng thái</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Tất cả trạng thái</option>
              <option value="todo">Chưa hoàn thành</option>
              <option value="done">Hoàn thành</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Lọc theo hạn</span>
            <select value={due} onChange={(e) => setDue(e.target.value)}>
              <option value="">Tất cả thời hạn</option>
              <option value="today">Hôm nay</option>
              <option value="overdue">Quá hạn</option>
              <option value="upcoming">Sắp tới</option>
            </select>
          </label>
          {(status || due || search) && (
            <button
              className="text-button"
              onClick={() => {
                setStatus('');
                setDue('');
                setSearch('');
              }}
            >
              Bỏ lọc
            </button>
          )}
        </div>
        <div className="dashboard-grid">
          <section className="panel task-panel" aria-label="Danh sách công việc">
            <div className="panel-heading">
              <h2>
                <Img src={d.imgPending} />
                {status === 'done' ? 'Hoàn thành' : 'Công việc'}
              </h2>
              <button className="text-button" onClick={() => setEditing('new')}>
                <Icon type="plus" /> Thêm mới
              </button>
            </div>
            <p className="list-date">
              {today}
              <span> • Hôm nay</span>
            </p>
            {loading ? (
              <div className="empty-state" role="status">
                <span className="spinner" />
                Đang tải công việc…
              </div>
            ) : visible.length ? (
              <div className="task-list">
                {visible.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    busy={!!busy}
                    onToggle={() => void toggle(task)}
                    onEdit={() => setEditing(task)}
                    onDelete={() => {
                      setError('');
                      setDeleting(task);
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-symbol">✓</div>
                <h3>{all.length ? 'Không có kết quả phù hợp' : 'Bắt đầu một ngày hiệu quả'}</h3>
                <p>
                  {all.length
                    ? 'Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.'
                    : 'Thêm công việc đầu tiên và từng bước hoàn thành mục tiêu.'}
                </p>
                {!all.length && (
                  <button className="primary" onClick={() => setEditing('new')}>
                    Thêm công việc đầu tiên
                  </button>
                )}
              </div>
            )}
          </section>
          <div className="right-column">
            <section className="panel status-panel">
              <div className="panel-heading">
                <h2>
                  <Img src={d.imgTaskComplete} />
                  Tiến độ công việc
                </h2>
              </div>
              <div className="progress-rings">
                <Progress
                  value={doneCount}
                  total={all.length}
                  color="var(--success)"
                  label="Hoàn thành"
                />
                <Progress
                  value={todoCount}
                  total={all.length}
                  color="var(--accent)"
                  label="Chưa hoàn thành"
                />
              </div>
              <p className="progress-summary">
                {doneCount}/{all.length} công việc đã hoàn thành
              </p>
            </section>
            <section className="panel completed-panel">
              <div className="panel-heading">
                <h2>
                  <Img src={d.imgBook} />
                  Đã hoàn thành
                </h2>
                <span className="count-pill">{doneCount}</span>
              </div>
              {all
                .filter((t) => t.status === 'done')
                .slice(0, 3)
                .map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    compact
                    busy={!!busy}
                    onToggle={() => void toggle(task)}
                    onEdit={() => setEditing(task)}
                    onDelete={() => {
                      setError('');
                      setDeleting(task);
                    }}
                  />
                ))}
              {!doneCount && (
                <div className="completed-empty">
                  <span>✓</span>
                  <p>
                    Mỗi công việc hoàn thành
                    <br />
                    là một bước tiến của bạn.
                  </p>
                </div>
              )}
              {doneCount > 3 && (
                <button
                  className="text-button"
                  onClick={() => {
                    setStatus('done');
                    setDue('');
                  }}
                >
                  Xem tất cả {doneCount} công việc
                </button>
              )}
            </section>
          </div>
        </div>
        <footer className="workspace-footer">
          CloudTask <span>Được tạo bởi NEON</span>
        </footer>
      </main>
      {toast && (
        <div className="toast" role="status">
          <span>✓</span>
          {toast}
        </div>
      )}
      {editing && (
        <TaskForm
          task={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            setToast('Đã lưu công việc.');
            await load();
          }}
          onExpired={onExpired}
        />
      )}
      {deleting && (
        <Modal
          title="Xóa công việc?"
          onClose={() => {
            if (!busy) setDeleting(null);
          }}
        >
          {error && (
            <p className="error-banner" role="alert">
              {error}
            </p>
          )}
          <p className="delete-copy">
            Bạn muốn xóa <strong>“{deleting.title}”</strong>? Thao tác này không thể hoàn tác.
          </p>
          <div className="modal-actions">
            <button className="secondary" disabled={!!busy} onClick={() => setDeleting(null)}>
              Hủy
            </button>
            <button className="primary" disabled={!!busy} onClick={() => void remove()}>
              {busy ? 'Đang xóa…' : 'Xác nhận xóa'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function Progress({
  value,
  total,
  color,
  label,
}: {
  value: number;
  total: number;
  color: string;
  label: string;
}) {
  const percent = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="progress-item">
      <div
        className="ring"
        style={{ '--progress': percent + '%', '--ring-color': color } as React.CSSProperties}
        role="img"
        aria-label={`${label}: ${percent}%`}
      >
        <span>{percent}%</span>
      </div>
      <p>
        <i style={{ background: color }} />
        {label}
      </p>
    </div>
  );
}
function TaskCard({
  task,
  busy,
  compact,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: Task;
  busy: boolean;
  compact?: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article
      className={
        'task-card ' + (compact ? 'compact ' : '') + (task.status === 'done' ? 'is-done' : '')
      }
    >
      <button
        disabled={busy}
        className="task-check"
        aria-label={(task.status === 'done' ? 'Mở lại ' : 'Hoàn thành ') + task.title}
        onClick={onToggle}
      >
        {task.status === 'done' && '✓'}
      </button>
      <div className="task-body">
        <h3>{task.title}</h3>
        {task.description && <p className="description">{task.description}</p>}
        <div className="task-meta">
          <span className={'task-status ' + task.status}>
            {task.status === 'done' ? 'Hoàn thành' : 'Chưa hoàn thành'}
          </span>
          {task.dueDate && (
            <span className={task.overdue ? 'overdue' : 'due-date'}>
              {task.overdue ? 'Quá hạn · ' : 'Hạn · '}
              {task.dueDate.split('-').reverse().join('/')}
            </span>
          )}
        </div>
        {!compact && (
          <p className="created-date">
            Đã tạo{' '}
            {new Intl.DateTimeFormat('vi-VN', {
              timeZone: 'Asia/Ho_Chi_Minh',
              dateStyle: 'short',
            }).format(new Date(task.createdAt))}
          </p>
        )}
      </div>
      <div className="task-actions">
        <button disabled={busy} aria-label={'Sửa ' + task.title} onClick={onEdit}>
          <Icon type="edit" />
        </button>
        <button disabled={busy} aria-label={'Xóa ' + task.title} onClick={onDelete}>
          <Icon type="delete" />
        </button>
      </div>
    </article>
  );
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    ref.current?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={(e) => {
        e.preventDefault();
        closeRef.current();
      }}
      aria-labelledby="modal-title"
    >
      <div className="modal-header">
        <h2 id="modal-title">{title}</h2>
        <button className="text-button" onClick={onClose}>
          Quay lại
        </button>
      </div>
      {children}
    </dialog>
  );
}
function TaskForm({
  task,
  onClose,
  onSaved,
  onExpired,
}: {
  task: Task | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onExpired: () => void;
}) {
  const [title, setTitle] = useState(task?.title || ''),
    [description, setDescription] = useState(task?.description || ''),
    [dueDate, setDueDate] = useState(task?.dueDate || '');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [titleError, setTitleError] = useState('');
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setTitleError('');
    if (!title.trim() || title.trim().length > 120) {
      setTitleError('Tiêu đề phải dài từ 1 đến 120 ký tự.');
      return;
    }
    setBusy(true);
    try {
      await api(task ? '/tasks/' + task.id : '/tasks', task ? 'PATCH' : 'POST', {
        title: title.trim(),
        description: description || null,
        dueDate: dueDate || null,
      });
      await onSaved();
    } catch (err) {
      if (err instanceof RequestError && err.status === 401) onExpired();
      else setError(err instanceof Error ? err.message : 'Không thể lưu công việc.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={task ? 'Chỉnh sửa công việc' : 'Thêm công việc mới'}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form onSubmit={save} className="task-form">
        {error && (
          <p className="error-banner" role="alert">
            {error}
          </p>
        )}
        <fieldset disabled={busy}>
          <div className="form-fields">
            <label>
              Tiêu đề <span className="required">*</span>
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                aria-invalid={!!titleError}
                aria-describedby={titleError ? 'title-error' : undefined}
                placeholder="Bạn cần làm gì?"
              />
              {titleError && (
                <span id="title-error" className="field-error" role="alert">
                  {titleError}
                </span>
              )}
            </label>
            <label>
              Ngày đến hạn
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                min="0001-01-01"
                max="9999-12-31"
              />
              <span className="field-hint">Không bắt buộc · Tính theo giờ Việt Nam</span>
            </label>
            <label>
              Mô tả
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                maxLength={1000}
                placeholder="Thêm chi tiết cho công việc…"
              />
              <span className="field-hint character-count">{description.length}/1.000</span>
            </label>
          </div>
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={onClose}>
              Hủy
            </button>
            <button className="primary" type="submit">
              {busy ? 'Đang lưu…' : 'Lưu công việc'}
            </button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
