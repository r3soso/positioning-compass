// POST /api/delete-report
// 管理员删除报告 {id, password}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: true, message: '仅支持 POST' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { id, password } = await request.json();

    // 密码验证
    if (!env.ADMIN_PASSWORD || password !== env.ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ error: true, message: '密码错误' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!id) {
      return new Response(JSON.stringify({ error: true, message: '缺少报告 id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!env.DB) {
      return new Response(JSON.stringify({ error: true, message: '数据库未配置' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await env.DB.prepare('DELETE FROM reports WHERE id = ?').bind(id).run();

    if (result.changes === 0) {
      return new Response(JSON.stringify({ ok: true, deleted: false, message: '报告不存在或已删除' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, deleted: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('/api/delete-report 错误:', err.message);
    return new Response(JSON.stringify({ error: true, message: '删除失败：' + err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
