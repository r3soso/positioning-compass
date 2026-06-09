// POST /api/trigger-news — 触发 GitHub Actions 早报 workflow
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

    return new Response(JSON.stringify({
      ok: resp.ok, status: resp.status,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, reason: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
