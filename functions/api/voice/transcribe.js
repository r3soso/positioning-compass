// POST /api/voice/transcribe — 语音转写
// 通过 OpenAI Whisper API 实现高精度中文语音识别

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: true, message: '仅支持 POST' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio');

    if (!audioFile || !(audioFile instanceof File)) {
      return new Response(JSON.stringify({ error: true, message: '未收到音频文件' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const whisperKey = env.WHISPER_API_KEY;
    if (!whisperKey) {
      return new Response(JSON.stringify({
        error: false, text: '', fallback: true, message: '语音转写服务未配置',
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 转发到 Whisper API
    const whisperForm = new FormData();
    whisperForm.append('model', 'whisper-1');
    whisperForm.append('language', 'zh');
    whisperForm.append('response_format', 'json');
    whisperForm.append('file', audioFile, 'recording.wav');

    const whisperResp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${whisperKey}` },
      body: whisperForm,
      signal: AbortSignal.timeout(25000),
    });

    if (!whisperResp.ok) {
      return new Response(JSON.stringify({
        error: false, text: '', fallback: true, message: '语音转写失败，使用浏览器内置识别结果',
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await whisperResp.json();
    return new Response(JSON.stringify({
      error: false, text: data.text || '', fallback: false,
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
