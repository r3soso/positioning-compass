// POST /api/save-report — 保存分析报告到 D1
// 无需认证，由前端在分析完成后自动调用

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: true, message: '仅支持 POST' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();

    // 如果 D1 未配置，静默返回成功（向后兼容）
    if (!env.DB) {
      return new Response(JSON.stringify({ ok: true, saved: false, reason: 'DB not configured' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const id = body.id || crypto.randomUUID();
    const now = new Date().toISOString();

    await env.DB.prepare(`
      INSERT INTO reports (id, created_at, role, role_label, source, province,
        slot_sentence, miss_element, keywords, competitors, usps, taglines,
        positioning_strength, category_fit, analysis_summary,
        differentiators, pain_points, triggers, next_steps,
        answer_count, answers, followups, cross_answers, raw_report)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, now,
      body.role || '', body.roleLabel || '',
      body.source || 'ai',
      body.province || '',
      body.slotSentence || '', body.missElement || '',
      JSON.stringify(body.keywords || []),
      JSON.stringify(body.competitors || []),
      JSON.stringify(body.usps || []),
      JSON.stringify(body.taglines || []),
      body.positioningStrength || '', body.categoryFit || '',
      body.analysisSummary || '',
      JSON.stringify(body.differentiators || []),
      JSON.stringify(body.painPoints || []),
      JSON.stringify(body.triggers || []),
      JSON.stringify(body.nextSteps || []),
      body.answerCount || 0,
      JSON.stringify(body.answers || {}),
      JSON.stringify(body.followups || {}),
      JSON.stringify(body.crossAnswers || {}),
      JSON.stringify(body)
    ).run();

    return new Response(JSON.stringify({ ok: true, saved: true, id }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('/api/save-report 错误:', err.message);
    return new Response(JSON.stringify({ ok: true, saved: false, reason: err.message }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
