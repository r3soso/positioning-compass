// GET /api/report-detail?id=xxx&password=xxx
// 管理员查看完整报告详情（含原始问答）

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
    const id = url.searchParams.get('id');

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

    const report = await env.DB.prepare('SELECT * FROM reports WHERE id = ?').bind(id).first();

    if (!report) {
      return new Response(JSON.stringify({ error: true, message: '报告不存在' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 解析 JSON 字段
    return new Response(JSON.stringify({
      ok: true,
      report: parseReportJSON(report),
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('/api/report-detail 错误:', err.message);
    return new Response(JSON.stringify({ error: true, message: '查询失败：' + err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

function parseReportJSON(row) {
  const jsonFields = ['keywords', 'competitors', 'usps', 'taglines', 'differentiators',
    'painPoints', 'triggers', 'nextSteps', 'answers', 'followups', 'crossAnswers'];
  const parsed = { ...row };
  for (const field of jsonFields) {
    if (typeof parsed[field] === 'string') {
      try { parsed[field] = JSON.parse(parsed[field]); } catch { /* keep as string */ }
    }
  }
  return parsed;
}
