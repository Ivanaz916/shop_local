const allowedEvents = new Map([
  ['request_created', 'New community post'],
  ['reply_created', 'New community reply'],
  ['request_flagged', 'Community post flagged'],
]);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const expectedSecret = Deno.env.get('MODERATION_WEBHOOK_SECRET');
  const suppliedSecret = request.headers.get('x-webhook-secret');
  if (!expectedSecret || suppliedSecret !== expectedSecret) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  let payload: { event?: unknown; record_id?: unknown };
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const event = typeof payload?.event === 'string' ? payload.event : '';
  const eventLabel = allowedEvents.get(event);
  const recordId = payload?.record_id;
  if (!eventLabel || typeof recordId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(recordId)) {
    return jsonResponse({ error: 'Invalid moderation event' }, 400);
  }

  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    console.error('RESEND_API_KEY is not configured');
    return jsonResponse({ error: 'Email service is not configured' }, 500);
  }

  const alertEmail = Deno.env.get('MODERATION_ALERT_EMAIL') ||
    'ivana.rocci131@gmail.com';
  const senderEmail = Deno.env.get('MODERATION_FROM_EMAIL');
  if (!senderEmail) {
    console.error('MODERATION_FROM_EMAIL is not configured');
    return jsonResponse({ error: 'Sender is not configured' }, 500);
  }

  const projectRef = Deno.env.get('SUPABASE_URL')?.match(
    /^https:\/\/([a-z0-9-]+)\.supabase\.co$/i,
  )?.[1];
  const dashboardUrl = projectRef
    ? `https://supabase.com/dashboard/project/${projectRef}/editor`
    : 'https://supabase.com/dashboard';

  const emailResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: ['Bearer', resendApiKey].join(' '),
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: senderEmail,
      to: [alertEmail],
      subject: `[Local Revolt moderation] ${eventLabel}`,
      text: `${eventLabel}\n\nRecord ID: ${recordId}\nReview: ${dashboardUrl}`,
    }),
  });

  if (!emailResponse.ok) {
    console.error('Moderation email failed:', emailResponse.status);
    return jsonResponse({ error: 'Email delivery failed' }, 502);
  }

  return jsonResponse({ delivered: true });
});
