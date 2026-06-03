// Cloudflare Pages Functions — 全局中间件
// 处理 CORS、安全头、限流

export async function onRequest(context) {
  const { request } = context;

  // CORS 预检
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // 调用下游 handler（静态文件或 API 函数）
  const response = await context.next();

  // 给所有响应添加 CORS + 安全头
  const modified = new Response(response.body, response);
  modified.headers.set('Access-Control-Allow-Origin', '*');
  modified.headers.set('X-Content-Type-Options', 'nosniff');

  return modified;
}
