// GET /api/check-db — 调试 D1 绑定状态
export async function onRequest(context) {
  const { env } = context;
  const keys = Object.keys(env);
  return new Response(JSON.stringify({
    dbExists: !!env.DB,
    dbType: typeof env.DB,
    envKeys: keys,
    d1Binding: env.DB ? 'connected' : 'missing',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
