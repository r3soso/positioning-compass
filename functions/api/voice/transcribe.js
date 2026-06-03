// POST /api/voice/transcribe — 语音转写
// 使用 Cloudflare Workers AI Whisper（免费，国内可用）

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: true, message: '仅支持 POST' }), {
      status: 405, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio');

    if (!audioFile) {
      return new Response(JSON.stringify({ error: true, message: '未收到音频文件' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    // 优先使用 Cloudflare Workers AI（免费，国内可直连）
    if (env.AI) {
      try {
        const arrayBuffer = await audioFile.arrayBuffer();
        const input = { audio: [...new Uint8Array(arrayBuffer)] };

        const result = await env.AI.run('@cf/openai/whisper', input);

        return new Response(JSON.stringify({
          error: false, text: result.text || '', fallback: false,
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (aiErr) {
        console.error('CF AI Whisper 失败:', aiErr.message);
        // AI 转写失败，继续尝试 OpenAI Whisper
      }
    }

    // 回退到 OpenAI Whisper API
    const whisperKey = env.WHISPER_API_KEY;
    if (whisperKey) {
      const whisperForm = new FormData();
      whisperForm.append('model', 'whisper-1');
      whisperForm.append('language', 'zh');
      whisperForm.append('response_format', 'json');
      whisperForm.append('file', audioFile);

      const whisperResp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${whisperKey}` },
        body: whisperForm,
        signal: AbortSignal.timeout(25000),
      });

      if (whisperResp.ok) {
        const data = await whisperResp.json();
        return new Response(JSON.stringify({
          error: false, text: data.text || '', fallback: false,
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // 所有服务都不可用，返回 fallback
    return new Response(JSON.stringify({
      error: false, text: '', fallback: true,
      message: '语音转写服务未配置',
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('/api/voice/transcribe 错误:', err.message);
    return new Response(JSON.stringify({
      error: false, text: '', fallback: true, message: '语音转写服务异常',
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
