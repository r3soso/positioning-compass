// GET /api/summary-by-role?password=xxx
// 一键AI总结：按四个角色聚合所有问卷，AI生成总结报告

// 角色定义（与前端 roles.js 保持一致）
const ROLE_DEFS = {
  manager:   { label: '区域销售经理', icon: '📊', desc: '管理视角 — 关注竞争格局、渠道、区域策略' },
  dealer:    { label: '经销商/代理商', icon: '🏪', desc: '渠道视角 — 直面终端、清楚什么好卖' },
  guide:     { label: '门店导购',     icon: '🛍️', desc: '一线视角 — 每天接触顾客、最懂抗拒和心动' },
  service:   { label: '售后人员',     icon: '🔧', desc: '用户视角 — 处理产品问题、知道客户在意什么' },
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

    // 密码验证
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

    // 按角色查询所有报告
    const summaries = {};
    for (const [roleId, roleDef] of Object.entries(ROLE_DEFS)) {
      const { results } = await env.DB.prepare(
        'SELECT answers, followups, cross_answers, role_label, answer_count, created_at FROM reports WHERE role = ? ORDER BY created_at DESC'
      ).bind(roleId).all();

      if (!results || results.length === 0) {
        summaries[roleId] = {
          role: roleId,
          roleLabel: roleDef.label,
          icon: roleDef.icon,
          desc: roleDef.desc,
          reportCount: 0,
          summary: null,
          note: '暂无该角色的问卷数据',
        };
        continue;
      }

      // 聚合所有回答
      const allAnswers = [];
      results.forEach(row => {
        const answers = parseJSON(row.answers);
        const followups = parseJSON(row.followups);
        const crossAnswers = parseJSON(row.cross_answers);

        if (answers && Object.keys(answers).length > 0) {
          const qa = [];
          Object.entries(answers).forEach(([k, v]) => {
            if (v) qa.push(`Q(${k}): ${v}`);
          });
          if (followups) {
            Object.entries(followups).forEach(([k, v]) => {
              if (v) qa.push(`追问(${k}): ${v}`);
            });
          }
          if (crossAnswers) {
            Object.entries(crossAnswers).forEach(([k, v]) => {
              if (v) qa.push(`交叉(${k}): ${v}`);
            });
          }
          if (qa.length > 0) {
            allAnswers.push(`--- 问卷 #${allAnswers.length + 1} ---\n${qa.join('\n')}`);
          }
        }
      });

      if (allAnswers.length === 0) {
        summaries[roleId] = {
          role: roleId,
          roleLabel: roleDef.label,
          icon: roleDef.icon,
          desc: roleDef.desc,
          reportCount: results.length,
          summary: null,
          note: '有记录但无有效问答内容',
        };
        continue;
      }

      // 调用 AI 生成总结（取最多15份问卷，避免 token 溢出）
      const sampled = allAnswers.slice(0, 15);
      const prompt = buildRolePrompt(roleDef, sampled, results.length);
      const aiResult = await callDeepSeek(env, prompt);

      summaries[roleId] = {
        role: roleId,
        roleLabel: roleDef.label,
        icon: roleDef.icon,
        desc: roleDef.desc,
        reportCount: results.length,
        sampledCount: sampled.length,
        summary: aiResult,
      };
    }

    return new Response(JSON.stringify({
      ok: true,
      generatedAt: new Date().toISOString(),
      summaries,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('/api/summary-by-role 错误:', err.message);
    return new Response(JSON.stringify({ error: true, message: '总结生成失败：' + err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ── 构建 Prompt ──

function buildRolePrompt(roleDef, sampledAnswers, totalCount) {
  const joined = sampledAnswers.join('\n\n');
  return `你是一位资深品牌战略顾问，正在帮助一个品牌团队分析来自不同角色的调研问卷。

当前角色：${roleDef.label}（${roleDef.desc}）
总问卷数：${totalCount} 份（以下展示 ${sampledAnswers.length} 份样本）

下面是该角色团队成员的原始问答记录：

${joined}

请基于以上所有问答，从"${roleDef.label}"的视角做一份结构化的总结报告。严格按照以下 JSON 格式返回（不要添加任何 markdown 标记）：

{
  "coreFindings": ["核心发现1（一句话，含具体细节）", "核心发现2", ...],
  "commonPainPoints": ["共性痛点1", "共性痛点2", ...],
  "competitiveInsights": ["竞争洞察1", "竞争洞察2", ...],
  "customerVoices": ["来自一线的顾客原声或行为描述1", ...],
  "suggestions": ["给品牌团队的具体建议1", "给品牌团队的具体建议2", ...],
  "oneLineSummary": "一句话总结该角色的核心诉求（30字以内）"
}

分析要求：
1. 每项 2-5 条，基于实际回答，不编造
2. 语言精炼，每条 15-40 字
3. 关注该角色独有的视角和洞察
4. 发现跨问卷的共性模式，而非孤立个案`;
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
        { role: 'system', content: '你是一位专业的品牌调研分析师。只返回要求的 JSON 格式，不添加额外说明或 markdown。' },
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

  // 解析 JSON
  try {
    const cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    // 解析失败时返回原始文本
    return { raw: content, parseError: true };
  }
}

// ── 工具函数 ──

function parseJSON(val) {
  if (!val) return null;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return null; }
}
