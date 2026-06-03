// GET /api/list-reports?password=xxx&page=1&limit=20
// 管理员查询所有报告摘要列表

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: true, message: '仅支持 GET' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const url = new URL(request.url);
    const password = url.searchParams.get('password');

    // 密码验证
    if (!env.ADMIN_PASSWORD || password !== env.ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ error: true, message: '密码错误' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // D1 未配置
    if (!env.DB) {
      return new Response(JSON.stringify({ error: true, message: '数据库未配置' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit')) || 20));
    const offset = (page - 1) * limit;

    // 查询总数
    const countResult = await env.DB.prepare('SELECT COUNT(*) as total FROM reports').first();
    const total = countResult?.total || 0;

    // 查询摘要列表
    const { results } = await env.DB.prepare(`
      SELECT id, created_at, role, role_label, source,
             slot_sentence, positioning_strength, category_fit,
             analysis_summary, answer_count
      FROM reports
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(limit, offset).all();

    return new Response(JSON.stringify({
      ok: true,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      reports: (results || []).map(r => ({
        ...r,
        keywords: undefined, // 摘要不含关键词数组
      })),
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('/api/list-reports 错误:', err.message);
    return new Response(JSON.stringify({ error: true, message: '查询失败：' + err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
