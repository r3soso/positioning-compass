// POST /api/analyze — AI 定位分析
// 调用 DeepSeek API 生成结构化定位报告

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: true, message: '仅支持 POST' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { role, roleLabel, answers, followups, crossAnswers } = await request.json();

    if (!role || !answers) {
      return new Response(JSON.stringify({ error: true, message: '缺少必要参数' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 构建问答文本
    let qaText = `角色：${roleLabel || role}\n\n`;
    if (answers) {
      Object.entries(answers).forEach(([field, text]) => {
        qaText += `问题(${field})：${text}\n`;
      });
    }
    if (followups) {
      Object.entries(followups).forEach(([field, text]) => {
        qaText += `追问(${field})：${text}\n`;
      });
    }
    if (crossAnswers) {
      Object.entries(crossAnswers).forEach(([field, text]) => {
        qaText += `交叉问题(${field})：${text}\n`;
      });
    }

    const systemPrompt = `你是一位特劳特定位理论的资深品牌顾问，精通《定位》《商战》《与众不同》等经典著作。
你的任务是基于用户（一位品牌团队成员）的问答记录，进行专业的品牌定位分析。

请严格按以下JSON格式返回分析结果（不要添加任何额外文字，不要用markdown代码块包裹）：
{
  "slotSentence": "品牌定位语句",
  "missElement": "如果品牌消失，顾客最想念什么（50字以内）",
  "usps": [{"type": "差异化优势|购买驱动|客户价值|核心优势", "content": "具体描述"}],
  "keywords": ["关键词"],
  "taglines": ["宣传语候选（4-20字）"],
  "competitors": ["竞品"],
  "differentiators": ["差异化点"],
  "painPoints": ["客户痛点"],
  "triggers": ["购买决策触发点"],
  "nextSteps": ["行动建议"],
  "analysisSummary": "200字以内综合分析",
  "positioningStrength": "强|中等|弱",
  "categoryFit": "品类定位建议（30字以内）"
}

分析原则：
1. 严格遵循特劳特定位理论：心智阶梯、差异化、聚焦法则、语言钉
2. 基于用户实际回答，不编造信息
3. 宣传语短小精悍，能成为"语言钉"
4. 信息不足时填写"需要更多信息来准确判断"
5. 所有输出使用中文`;

    const content = await callDeepSeek(env, systemPrompt, qaText, 0.7);

    let analysis;
    try {
      const cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      analysis = JSON.parse(cleaned);
    } catch {
      return new Response(JSON.stringify({
        error: true, code: 'PARSE_ERROR', message: 'AI分析结果解析失败，请重试',
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: false, ...analysis }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('/api/analyze 错误:', err.message);
    return new Response(JSON.stringify({
      error: true, code: 'AI_UNAVAILABLE', message: 'AI分析服务暂时不可用：' + err.message,
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ── DeepSeek API 调用 ──

async function callDeepSeek(env, systemPrompt, userMessage, temperature = 0.7) {
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
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature,
      max_tokens: 2048,
    }),
    signal: AbortSignal.timeout(25000),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`DeepSeek API 返回错误 ${resp.status}: ${errText}`);
  }

  const data = await resp.json();
  return data.choices[0].message.content;
}
