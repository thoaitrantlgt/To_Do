// Explicit local-only demo setup. No remote URLs or credentials are accepted.
const base = 'http://localhost:8788';
const password = 'CloudTaskDemo2026!';
for (const [name, email] of [
  ['Gia Thoại', 'demo.a@cloudtask.local'],
  ['Minh Phương', 'demo.b@cloudtask.local'],
]) {
  let response = await fetch(base + '/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base },
    body: JSON.stringify({ name, email, password }),
  });
  if (!response.ok)
    response = await fetch(base + '/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: base },
      body: JSON.stringify({ email, password }),
    });
  if (!response.ok) throw new Error(`Could not initialize ${email}: ${response.status}`);
  const cookie = response.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
  const headers = { Cookie: cookie, Origin: base, 'Content-Type': 'application/json' };
  const result = await fetch(base + '/api/tasks', { headers });
  if (!result.ok) throw new Error('Could not list demo tasks');
  if ((await result.json()).items.length) {
    console.log(`${email}: existing data kept`);
    continue;
  }
  const day = (offset) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + offset);
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(date);
  };
  const tasks = email.includes('demo.a')
    ? [
        {
          title: 'Chuẩn bị demo CloudTask',
          description:
            'Kiểm tra luồng tạo công việc từ Pages qua Worker và lưu vào D1. Chuẩn bị hai tài khoản để minh họa phân quyền.',
          dueDate: day(-1),
        },
        {
          title: 'Hoàn thiện bài thuyết trình',
          description:
            'Tổng hợp kiến trúc serverless, kết quả kiểm thử và ảnh chụp minh họa cho nhóm NEON.',
          dueDate: day(0),
        },
        {
          title: 'Rà soát giao diện trên điện thoại',
          description: 'Thử tạo, chỉnh sửa và lọc công việc ở màn hình 390 px.',
          dueDate: day(1),
        },
        {
          title: 'Tìm hiểu Cloudflare Workers',
          description: 'Đọc tài liệu về Service Binding và cách kết nối với D1.',
          dueDate: day(-2),
          done: true,
        },
        {
          title: 'Thống nhất kế hoạch của nhóm',
          description: 'Phân chia đầu việc frontend, backend và triển khai.',
          dueDate: day(-1),
          done: true,
        },
      ]
    : [
        {
          title: 'Kiểm tra dữ liệu tài khoản B',
          description: 'Tài khoản B chỉ nhìn thấy công việc của chính mình.',
          dueDate: day(0),
        },
      ];
  for (const { done, ...task } of tasks) {
    const created = await fetch(base + '/api/tasks', {
      method: 'POST',
      headers,
      body: JSON.stringify(task),
    });
    if (created.status !== 201) throw new Error('Could not create demo task');
    const { item } = await created.json();
    if (done) {
      const updated = await fetch(base + '/api/tasks/' + item.id, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: 'done' }),
      });
      if (!updated.ok) throw new Error('Could not complete demo task');
    }
  }
  console.log(`${email}: demo ready`);
}
console.log('Local demo password: ' + password);
