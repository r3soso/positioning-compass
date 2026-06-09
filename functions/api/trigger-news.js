// Cloudflare Worker Cron — 准时触发 GitHub Actions 早报
// 每天 08:05 CST 调用，作为 GitHub 自身 cron 的兜底保障

export async function onRequest(context) {
  const { env } = context;

  const token = env.GH_PAT;
  if (!token) {
    return new Response(JSON.stringify({ ok: false, reason: 'GH_PAT not set' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const resp = await fetch(
      'https://api.github.com/repos/r3soso/songgang-morning-news/dispatches',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ event_type: 'morning-news' }),
      }
    );

    if (resp.ok) {
      return new Response(JSON.stringify({ ok: true, status: resp.status }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      ok: false, status: resp.status, body: await resp.text().catch(() => ''),
    }), {
      status: resp.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, reason: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Also handle scheduled cron trigger via email/ping
export async function scheduled(event, env, ctx) {
  const token = env.GH_PAT;
  if (!token) return;

  await fetch(
    'https://api.github.com/repos/r3soso/songgang-morning-news/dispatches',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ event_type: 'morning-news' }),
    }
  );
}
