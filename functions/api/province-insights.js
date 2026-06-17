// GET /api/province-insights?password=xxx
// 省份维度分析：按省份×角色统计样本数，AI分析各角色共性需求及频次

const ROLE_DEFS = {
  manager: { label: '区域销售经理', icon: '📊' },
  dealer:  { label: '经销商/代理商', icon: '🏪' },
  guide:   { label: '门店导购',     icon: '🛍️' },
  service: { label: '售后人员',     icon: '🔧' },
};

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

    // ── 第一步：省份×角色 交叉统计 ──
    const gridResult = await env.DB.prepare(`
      SELECT province, role, role_label, COUNT(*) as cnt
      FROM reports
      WHERE province != ''
      GROUP BY province, role
      ORDER BY province, cnt DESC
    `).all();

    // 构建省份×角色矩阵
    const provinceMap = {}; // { province: { manager: {cnt,label}, dealer: {...}, ... } }
    (gridResult.results || []).forEach(row => {
      if (!provinceMap[row.province]) {
        provinceMap[row.province] = {};
      }
      provinceMap[row.province][row.role] = {
        count: row.cnt,
        roleLabel: row.role_label || ROLE_DEFS[row.role]?.label || row.role,
      };
    });

    // 各省份总样本数
    const provinceTotal = {};
    const gridRows = Object.entries(provinceMap)
      .sort((a, b) => {
        const sumA = Object.values(a[1]).reduce((s, v) => s + v.count, 0);
        const sumB = Object.values(b[1]).reduce((s, v) => s + v.count, 0);
        return sumB - sumA;
      })
      .map(([province, roles]) => {
        const total = Object.values(roles).reduce((s, v) => s + v.count, 0);
        provinceTotal[province] = total;
        return { province, roles, total };
      });

    // ── 第二步：AI 共性需求分析（按角色聚合，附省份标注）──
    const themeResults = {};
    for (const [roleId, roleDef] of Object.entries(ROLE_DEFS)) {
      // 只取有省份信息的该角色问卷（最多20份样本）
      const { results } = await env.DB.prepare(
        'SELECT province, answers FROM reports WHERE role = ? AND province != \'\' AND answers IS NOT NULL ORDER BY created_at DESC LIMIT 20'
      ).bind(roleId).all();

      if (!results || results.length < 2) {
        themeResults[roleId] = {
          role: roleId,
          roleLabel: roleDef.label,
          icon: roleDef.icon,
          totalCount: results?.length || 0,
          themes: [],
          note: '样本不足（需 ≥2 份），无法进行共性分析',
        };
        continue;
      }

      // 聚合回答，附带省份标注
      const samples = [];
      results.forEach((row, i) => {
        const answers = parseJSON(row.answers);
        if (answers && Object.keys(answers).length > 0) {
          const qa = [];
          Object.entries(answers).forEach(([k, v]) => {
            if (v && k !== '_province') qa.push(`${k}: ${v}`);
          });
          if (qa.length > 0) {
            samples.push(`[${row.province}] ${qa.join(' | ')}`);
          }
        }
      });

      if (samples.length < 2) {
        themeResults[roleId] = {
          role: roleId,
          roleLabel: roleDef.label,
          icon: roleDef.icon,
          totalCount: results.length,
          themes: [],
          note: '有效问答不足',
        };
        continue;
      }

      // AI 分析
      const prompt = buildThemePrompt(roleDef, samples);
      const aiResult = await callDeepSeek(env, prompt);

      themeResults[roleId] = {
        role: roleId,
        roleLabel: roleDef.label,
        icon: roleDef.icon,
        totalCount: results.length,
        sampledCount: samples.length,
        themes: aiResult.themes || [],
        summary: aiResult.summary || '',
      };
    }

    return new Response(JSON.stringify({
      ok: true,
      generatedAt: new Date().toISOString(),
      grid: gridRows,
      themeResults,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('/api/province-insights 错误:', err.message);
    return new Response(JSON.stringify({ error: true, message: '省份分析失败：' + err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ── Prompt ──

function buildThemePrompt(roleDef, samples) {
  const joined = samples.join('\n\n');
  return `你是一位品牌调研分析师。以下是从"${roleDef.label}"角色收集的问卷回答（共${samples.length}份），每条前面标注了[省份]。

${joined}

请分析以上回答，提炼出该角色最关心的共性需求和痛点。返回严格 JSON（不要 markdown）：

{
  "themes": [
    {"theme": "主题名称（5-15字）", "frequency": 数字, "detail": "该主题的具体描述（20-40字）", "provinces": ["出现省份1", "省份2"]}
  ],
  "summary": "该角色核心诉求的一句话总结（30字以内）"
}

要求：
1. 提取 3-6 个最突出的共性主题
2. frequency = 提及该主题的问卷数量（粗略统计即可）
3. provinces = 该主题主要出现在哪些省份
4. 主题应基于回答中的实际细节，不编造
5. 合并相似表述为同一主题`;
}

// ── DeepSeek 调用 ──

async function callDeepSeek(env, userPrompt) {
  const apiKey = env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY 未配置');

  const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: '你是一位品牌调研分析师。只返回要求的 JSON 格式，不添加额外说明或 markdown。' },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.5,
      max_tokens: 3072,
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`DeepSeek API 返回错误 ${resp.status}: ${errText}`);
  }

  const data = await resp.json();
  const content = data.choices[0].message.content.trim();

  try {
    const cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return { themes: [], summary: content.substring(0, 100), parseError: true };
  }
}

function parseJSON(val) {
  if (!val) return null;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return null; }
}
