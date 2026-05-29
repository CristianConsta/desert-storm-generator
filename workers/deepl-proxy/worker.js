/**
 * Cloudflare Worker — DeepL Translation Proxy
 *
 * Forwards translation requests to the DeepL API, adding the API key
 * server-side so it is never exposed in the browser.
 *
 * Environment variables (set via `wrangler secret put`):
 *   DEEPL_API_KEY  — your DeepL auth key
 *
 * Allowed origins are restricted to the GitHub Pages domain.
 */

const DEEPL_API_URL = 'https://api-free.deepl.com/v2/translate';

const ALLOWED_ORIGINS = [
  'https://cristianconsta.github.io',
];

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function isAllowedOrigin(request) {
  const origin = request.headers.get('Origin') || '';
  // Also allow file:// during local dev (Origin will be 'null' string)
  return ALLOWED_ORIGINS.includes(origin) || origin === 'null';
}

function getOriginHeader(request) {
  const origin = request.headers.get('Origin') || '';
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (origin === 'null') return '*';
  return ALLOWED_ORIGINS[0];
}

export default {
  async fetch(request, env) {
    const origin = getOriginHeader(request);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    if (!isAllowedOrigin(request)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!env.DEEPL_API_KEY) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    try {
      const body = await request.json();

      // Only allow expected fields through
      const payload = {
        text: body.text,
        source_lang: body.source_lang,
        target_lang: body.target_lang,
        tag_handling: body.tag_handling,
      };

      const deeplResponse = await fetch(DEEPL_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': 'DeepL-Auth-Key ' + env.DEEPL_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const responseBody = await deeplResponse.text();

      return new Response(responseBody, {
        status: deeplResponse.status,
        headers: {
          ...corsHeaders(origin),
          'Content-Type': 'application/json',
        },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Proxy error: ' + err.message }), {
        status: 500,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }
  },
};
