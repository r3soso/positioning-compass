export async function onRequest() {
  return new Response('Admin hello! Functions working.', {
    headers: { 'Content-Type': 'text/plain' },
  });
}
