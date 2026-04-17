import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    `https://${request.headers.get('host')}`

  const script = `
;(function () {
  var params = new URLSearchParams(window.location.search);
  var slug = params.get('ref');
  if (slug) {
    sessionStorage.setItem('kol_ref', slug);
  } else {
    slug = sessionStorage.getItem('kol_ref');
  }
  if (!slug) return;

  var sid = sessionStorage.getItem('kol_sid');
  if (!sid) {
    sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem('kol_sid', sid);
  }

  window.kolTrack = function (eventType) {
    fetch('${appUrl}/api/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: slug, event_type: eventType || 'register', session_id: sid }),
    }).catch(function () {});
  };
})();
`.trim()

  return new NextResponse(script, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
