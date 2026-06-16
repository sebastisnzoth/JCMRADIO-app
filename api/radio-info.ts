// Vercel serverless function — proxies the SonicPanel radio data
// to avoid CORS issues from the browser.

export default async function handler(req: Request): Promise<Response> {
  try {
    const upstream = await fetch('https://sp.aljania.com/cp/get_info.php?p=8120', {
      headers: { 'User-Agent': 'JCMRadio/1.0' },
      signal: AbortSignal.timeout(8_000),
    });

    if (!upstream.ok) {
      return new Response(JSON.stringify({ error: 'Upstream offline' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await upstream.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export const config = { runtime: 'edge' };
