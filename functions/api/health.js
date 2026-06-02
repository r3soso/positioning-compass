// GET /api/health — 服务健康检查

export async function onRequest(context) {
  const { env } = context;

  return new Response(JSON.stringify({
    status: 'ok',
    platform: 'Cloudflare Pages',
    aiAvailable: !!env.DEEPSEEK_API_KEY,
    whisperAvailable: !!env.WHISPER_API_KEY,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
