// GET /api/stats?password=xxx — 管理后台聚合统计数据
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

    // 1. 总览
    const total = await env.DB.prepare('SELECT COUNT(*) as c FROM reports').first();
    const aiCount = await env.DB.prepare("SELECT COUNT(*) as c FROM reports WHERE source='ai'").first();
    const localCount = await env.DB.prepare("SELECT COUNT(*) as c FROM reports WHERE source='local'").first();

    // 2. 定位强度分布
    const strength = await env.DB.prepare(
      "SELECT positioning_strength, COUNT(*) as c FROM reports WHERE positioning_strength != '' GROUP BY positioning_strength"
    ).all();

    // 3. 角色分布
    const roles = await env.DB.prepare(
      "SELECT role_label, COUNT(*) as c FROM reports GROUP BY role_label ORDER BY c DESC"
    ).all();

    // 4. 每日趋势（最近30天）
    const daily = await env.DB.prepare(
      "SELECT DATE(created_at) as date, COUNT(*) as c FROM reports WHERE created_at > datetime('now','-30 days') GROUP BY DATE(created_at) ORDER BY date"
    ).all();

    // 5. 来源分布
    const sources = await env.DB.prepare(
      "SELECT source, COUNT(*) as c FROM reports GROUP BY source"
    ).all();

    // 6. 关键词收集（最近50条）
    const keywords = await env.DB.prepare(
      "SELECT keywords FROM reports WHERE keywords != '[]' AND keywords != '' ORDER BY created_at DESC LIMIT 50"
    ).all();
    const kwMap = {};
    (keywords.results || []).forEach(row => {
      try {
        const kws = JSON.parse(row.keywords);
        kws.forEach(k => { kwMap[k] = (kwMap[k] || 0) + 1; });
      } catch {}
    });
    const topKeywords = Object.entries(kwMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([name, count]) => ({ name, count }));

    return new Response(JSON.stringify({
      ok: true,
      overview: {
        total: total?.c || 0,
        aiCount: aiCount?.c || 0,
        localCount: localCount?.c || 0,
      },
      strength: strength.results || [],
      roles: roles.results || [],
      daily: daily.results || [],
      sources: sources.results || [],
      topKeywords,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('/api/stats 错误:', err.message);
    return new Response(JSON.stringify({ error: true, message: '统计查询失败：' + err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
