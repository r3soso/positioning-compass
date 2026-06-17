// GET /api/province-counts?password=xxx
// 轻量统计：按省份×角色（经销商/导购/售后）返回提交份数

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: true, message: '仅支持 GET' }), {
      status: 405, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const url = new URL(request.url);
    const password = url.searchParams.get('password');

    if (!env.ADMIN_PASSWORD || password !== env.ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ error: true, message: '密码错误' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!env.DB) {
      return new Response(JSON.stringify({ error: true, message: '数据库未配置' }), {
        status: 503, headers: { 'Content-Type': 'application/json' },
      });
    }

    // 按省份×角色统计
    const { results } = await env.DB.prepare(`
      SELECT province, role, role_label, COUNT(*) as cnt
      FROM reports
      WHERE province != '' AND role IN ('dealer', 'guide', 'service')
      GROUP BY province, role
      ORDER BY province, cnt DESC
    `).all();

    // 构建表格数据
    const map = {}; // { province: { dealer: count, guide: count, service: count } }
    (results || []).forEach(row => {
      if (!map[row.province]) map[row.province] = { dealer: 0, guide: 0, service: 0, province: row.province };
      map[row.province][row.role] = row.cnt;
    });

    // 按总份数降序排列
    const rows = Object.values(map).sort((a, b) => {
      const sumA = a.dealer + a.guide + a.service;
      const sumB = b.dealer + b.guide + b.service;
      return sumB - sumA;
    });

    // 汇总行
    const totals = { dealer: 0, guide: 0, service: 0, province: '合计' };
    rows.forEach(r => { totals.dealer += r.dealer; totals.guide += r.guide; totals.service += r.service; });

    return new Response(JSON.stringify({
      ok: true,
      rows,
      totals,
      totalProvinces: rows.length,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('/api/province-counts 错误:', err.message);
    return new Response(JSON.stringify({ error: true, message: '统计查询失败：' + err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
