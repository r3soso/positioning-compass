// POST /api/generate-followup — AI 智能追问生成

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: true, message: '仅支持 POST' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { role, roleLabel, originalQuestion, userAnswer } = await request.json();

    if (!userAnswer) {
      return new Response(JSON.stringify({ error: true, message: '缺少用户回答' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `你是一位特劳特定位理论的资深访谈顾问。根据用户的回答生成深度追问。
要求：追问30-60字，基于用户具体回答而非模板，引导品牌差异化思考。
返回JSON：{ "question": "追问内容", "hint": "简短提示（15字以内）" }`;

    const userMessage = `角色：${roleLabel || role}\n原始问题：${originalQuestion}\n用户回答：${userAnswer}`;

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
        temperature: 0.8,
        max_tokens: 300,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!resp.ok) throw new Error(`DeepSeek API 错误 ${resp.status}`);

    const data = await resp.json();
    const content = data.choices[0].message.content;

    let followup;
    try {
      const cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      followup = JSON.parse(cleaned);
    } catch {
      return new Response(JSON.stringify({ error: true, code: 'PARSE_ERROR', message: '追问生成失败' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: false, ...followup }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('/api/generate-followup 错误:', err.message);
    return new Response(JSON.stringify({ error: true, message: '追问生成服务暂时不可用' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
