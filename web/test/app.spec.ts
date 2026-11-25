import { test, expect } from '@playwright/test';

test('127.0.0.1 supports signup, persisted session, task writes and signin', async ({ page }) => {
  await page.goto('http://127.0.0.1:8788');
  await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
  const email = `loopback-browser-${Date.now()}@example.com`;
  await page.getByLabel('Tên hiển thị').fill('Loopback Tester');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill('Cloudtask-browser-123!');
  await page.getByLabel('Xác nhận mật khẩu').fill('Cloudtask-browser-123!');
  await page.getByRole('button', { name: 'Đăng ký', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Chào mừng/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: /Chào mừng/ })).toBeVisible();
  await page.getByRole('button', { name: 'Thêm công việc', exact: true }).click();
  await page.getByLabel('Tiêu đề').fill('Công việc qua IP local');
  await page.getByRole('button', { name: 'Lưu công việc' }).click();
  const list = page.getByRole('region', { name: 'Danh sách công việc', exact: true });
  await expect(list.getByRole('heading', { name: 'Công việc qua IP local' })).toBeVisible();
  await list.getByRole('button', { name: 'Hoàn thành Công việc qua IP local' }).click();
  await expect(list.getByRole('button', { name: 'Mở lại Công việc qua IP local' })).toBeEnabled();
  await list.getByRole('button', { name: 'Xóa Công việc qua IP local' }).click();
  await page.getByRole('button', { name: 'Xác nhận xóa' }).click();
  await expect(list.getByRole('heading', { name: 'Công việc qua IP local' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill('Cloudtask-browser-123!');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Chào mừng/ })).toBeVisible();
});

for (const mode of ['login', 'register'] as const) {
  for (const sessionFailure of [false, true]) {
    test(`${mode} preserves entered credentials on tab return (${sessionFailure ? 'failed' : 'successful'} session refresh)`, async ({
      page,
    }) => {
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Đăng nhập', exact: true })).toBeVisible();
      if (mode === 'register') {
        await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
        await page.getByLabel('Tên hiển thị').fill('Tên đang nhập');
        await page.getByLabel('Xác nhận mật khẩu').fill('Unsubmitted-password!');
      }
      await page.getByLabel('Email', { exact: true }).fill('unfinished@example.com');
      await page.getByLabel('Mật khẩu', { exact: true }).fill('Unsubmitted-password!');
      let release!: () => void;
      const barrier = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route('**/api/auth/get-session', async (route) => {
        await barrier;
        if (sessionFailure)
          return route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'Temporary outage' }),
          });
        return route.continue();
      });
      const refreshRequest = page.waitForRequest((r) => r.url().includes('/api/auth/get-session'));
      await page.evaluate(() => {
        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
        document.dispatchEvent(new Event('visibilitychange'));
        Object.defineProperty(document, 'visibilityState', {
          configurable: true,
          value: 'visible',
        });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await refreshRequest;
      const refreshResponse = page.waitForResponse((r) =>
        r.url().includes('/api/auth/get-session'),
      );
      try {
        await expect(page.getByLabel('Email', { exact: true })).toHaveValue(
          'unfinished@example.com',
        );
        await expect(page.getByLabel('Mật khẩu', { exact: true })).toHaveValue(
          'Unsubmitted-password!',
        );
      } finally {
        release();
      }
      await refreshResponse;
      await expect(
        page.getByRole('heading', {
          name: mode === 'register' ? 'Tạo tài khoản' : 'Đăng nhập',
          exact: true,
        }),
      ).toBeVisible();
      await expect(page.getByLabel('Email', { exact: true })).toHaveValue('unfinished@example.com');
      await expect(page.getByLabel('Mật khẩu', { exact: true })).toHaveValue(
        'Unsubmitted-password!',
      );
      if (mode === 'register') {
        await expect(page.getByLabel('Tên hiển thị')).toHaveValue('Tên đang nhập');
        await expect(page.getByLabel('Xác nhận mật khẩu')).toHaveValue('Unsubmitted-password!');
      }
    });
  }
}
test('account, persistent CRUD, combined filters and logout at desktop and mobile', async ({
  page,
}) => {
  const list = page.getByRole('region', { name: 'Danh sách công việc', exact: true });
  const email = `browser-${Date.now()}@example.com`;
  await page.goto('/');
  await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
  await page.getByLabel('Tên hiển thị').fill('NEON Tester');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill('Cloudtask-browser-123!');
  await page.getByLabel('Xác nhận mật khẩu').fill('Cloudtask-browser-123!');
  await page.getByRole('button', { name: 'Đăng ký', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Chào mừng/ })).toBeVisible();
  await page.getByRole('button', { name: 'Thêm công việc', exact: true }).first().click();
  await page.getByLabel('Tiêu đề').fill('Chuẩn bị demo CloudTask');
  await page.getByLabel('Mô tả').fill('Pages → Worker → D1');
  await page.getByLabel('Ngày đến hạn').fill('2020-01-01');
  await page.getByRole('button', { name: 'Lưu công việc' }).click();
  await expect(list.getByRole('heading', { name: 'Chuẩn bị demo CloudTask' })).toBeVisible();
  await page.reload();
  await expect(list.getByRole('heading', { name: 'Chuẩn bị demo CloudTask' })).toBeVisible();
  await page.getByLabel('Lọc theo hạn').selectOption('overdue');
  await expect(list.getByRole('heading', { name: 'Chuẩn bị demo CloudTask' })).toBeVisible();
  await page.getByRole('button', { name: 'Hoàn thành Chuẩn bị demo CloudTask' }).click();
  await expect(list.getByRole('heading', { name: 'Chuẩn bị demo CloudTask' })).toHaveCount(0);
  await page.getByLabel('Lọc theo hạn').selectOption('');
  await page.getByLabel('Lọc theo trạng thái').selectOption('done');
  await list.getByRole('button', { name: 'Sửa Chuẩn bị demo CloudTask' }).click();
  await page.getByLabel('Tiêu đề').fill('Demo đã cập nhật');
  await page.getByLabel('Ngày đến hạn').fill('');
  await page.getByRole('button', { name: 'Lưu công việc' }).click();
  await expect(list.getByRole('heading', { name: 'Demo đã cập nhật' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await list.getByRole('button', { name: 'Sửa Demo đã cập nhật' }).click();
  await expect(page.getByLabel('Tiêu đề')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Hủy', exact: true }).click();
  await list.getByRole('button', { name: 'Xóa Demo đã cập nhật' }).click();
  await page.getByRole('button', { name: 'Xác nhận xóa' }).click();
  await expect(list.getByRole('heading', { name: 'Demo đã cập nhật' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Đăng xuất' }).click();
  await expect(page.getByRole('heading', { name: 'Đăng nhập', exact: true })).toBeVisible();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill('Incorrect-password');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByLabel('Mật khẩu', { exact: true }).fill('Cloudtask-browser-123!');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Chào mừng/ })).toBeVisible();
});

test('changing filters while a mutation response is delayed keeps the current filter', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
  await page.getByLabel('Tên hiển thị').fill('Race Tester');
  await page.getByLabel('Email', { exact: true }).fill(`race-${Date.now()}@example.com`);
  await page.getByLabel('Mật khẩu', { exact: true }).fill('Cloudtask-browser-123!');
  await page.getByLabel('Xác nhận mật khẩu').fill('Cloudtask-browser-123!');
  await page.getByRole('button', { name: 'Đăng ký', exact: true }).click();
  await page.getByRole('button', { name: 'Thêm công việc', exact: true }).click();
  await page.getByLabel('Tiêu đề').fill('Delayed task');
  await page.getByRole('button', { name: 'Lưu công việc' }).click();
  const list = page.getByRole('region', { name: 'Danh sách công việc', exact: true });
  let release!: () => void, stored!: () => void;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  const saved = new Promise<void>((resolve) => {
    stored = resolve;
  });
  await page.route('**/api/tasks/*', async (route) => {
    if (route.request().method() !== 'PATCH') return route.continue();
    const response = await route.fetch();
    stored();
    await barrier;
    await route.fulfill({ response });
  });
  await list.getByRole('button', { name: 'Hoàn thành Delayed task' }).click();
  await saved;
  await page.getByLabel('Lọc theo trạng thái').selectOption('todo');
  await expect(list.getByRole('heading', { name: 'Delayed task' })).toHaveCount(0);
  const patch = page.waitForResponse((r) => r.request().method() === 'PATCH');
  release();
  await patch;
  await expect(
    page.getByRole('status').filter({ hasText: 'Đã hoàn thành công việc.' }),
  ).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Đang tải công việc' })).toHaveCount(0);
  await expect(page.getByLabel('Lọc theo trạng thái')).toHaveValue('todo');
  await expect(list.getByRole('heading', { name: 'Delayed task' })).toHaveCount(0);
});

test('network errors preserve form and confirmed task state, retry works, and 401 returns to login', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
  await page.getByLabel('Tên hiển thị').fill('Failure Tester');
  await page.getByLabel('Email', { exact: true }).fill(`failure-${Date.now()}@example.com`);
  await page.getByLabel('Mật khẩu', { exact: true }).fill('Cloudtask-browser-123!');
  await page.getByLabel('Xác nhận mật khẩu').fill('Cloudtask-browser-123!');
  await page.getByRole('button', { name: 'Đăng ký', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Chào mừng/ })).toBeVisible();
  let failedMethod = 'GET',
    expired = false;
  await page.route('**/api/tasks**', (route) => {
    const method = route.request().method();
    if (expired || method === failedMethod)
      return route.fulfill({
        status: expired ? 401 : 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: expired ? 'UNAUTHORIZED' : 'INTERNAL_ERROR',
            message: expired ? 'Phiên hết hạn' : 'Lỗi kết nối thử nghiệm',
          },
        }),
      });
    return route.continue();
  });
  await page.getByLabel('Lọc theo trạng thái').selectOption('todo');
  await expect(page.getByRole('alert')).toContainText('Lỗi kết nối thử nghiệm');
  failedMethod = '';
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', { name: 'Thêm công việc', exact: true }).click();
  await page.getByLabel('Tiêu đề').fill('Giữ dữ liệu khi lỗi');
  failedMethod = 'POST';
  await page.getByRole('button', { name: 'Lưu công việc' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('Tiêu đề')).toHaveValue('Giữ dữ liệu khi lỗi');
  failedMethod = '';
  await page.getByRole('button', { name: 'Lưu công việc' }).click();
  const list = page.getByRole('region', { name: 'Danh sách công việc', exact: true });
  await expect(list.getByRole('heading', { name: 'Giữ dữ liệu khi lỗi' })).toBeVisible();
  failedMethod = 'PATCH';
  await list.getByRole('button', { name: 'Hoàn thành Giữ dữ liệu khi lỗi' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(list.getByRole('button', { name: 'Hoàn thành Giữ dữ liệu khi lỗi' })).toBeEnabled();
  failedMethod = 'DELETE';
  await list.getByRole('button', { name: 'Xóa Giữ dữ liệu khi lỗi' }).click();
  await page.getByRole('button', { name: 'Xác nhận xóa' }).click();
  await expect(page.getByRole('button', { name: 'Xác nhận xóa' })).toBeEnabled();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Lỗi kết nối thử nghiệm');
  await page.getByRole('button', { name: 'Hủy', exact: true }).click();
  await expect(list.getByRole('heading', { name: 'Giữ dữ liệu khi lỗi' })).toBeVisible();
  expired = true;
  await page.getByLabel('Lọc theo hạn').selectOption('today');
  await expect(page.getByRole('heading', { name: 'Đăng nhập', exact: true })).toBeVisible();
  await expect(page.getByText('Phiên đã hết hạn. Vui lòng đăng nhập lại.')).toBeVisible();
});
