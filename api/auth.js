function normalizePhone(input) {
  if (typeof input !== 'string') return '';
  const trimmed = input.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/[^\d]/g, '');
  return digits ? (hasPlus ? '+' : '') + digits : '';
}

function isE164(phone) {
  // Twilio Verify requires E.164: leading + and 8–15 digits total
  return /^\+\d{8,15}$/.test(phone);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawUrl = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!rawUrl || !key) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }
  const url = rawUrl.replace(/\/+$/, '').replace(/\/rest\/v1$/, '');

  async function callSupabase(path, init) {
    const fullUrl = `${url}${path}`;
    console.log('[auth] ->', init?.method || 'GET', fullUrl);
    const r = await fetch(fullUrl, init);
    const text = await r.text();
    console.log('[auth] <-', r.status, text.slice(0, 400));
    let data;
    try { data = JSON.parse(text); } catch { data = { message: text }; }
    return { ok: r.ok, status: r.status, data };
  }

  function supabaseError(data, fallback) {
    if (!data) return fallback;
    return data.message || data.error || data.hint || data.details || fallback;
  }

  const baseHeaders = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };

  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioVerifySid = process.env.TWILIO_VERIFY_SERVICE_SID;
  const twilioConfigured = Boolean(twilioSid && twilioToken && twilioVerifySid);

  async function twilioVerify(path, params) {
    const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
    const body = new URLSearchParams(params).toString();
    const fullUrl = `https://verify.twilio.com/v2/Services/${twilioVerifySid}${path}`;
    console.log('[auth] twilio ->', fullUrl, params);
    const r = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    const text = await r.text();
    console.log('[auth] twilio <-', r.status, text.slice(0, 400));
    let data;
    try { data = JSON.parse(text); } catch { data = { message: text }; }
    return { ok: r.ok, status: r.status, data };
  }

  const { action, phone, code, intent, name, profile_image } = req.body || {};
  const cleanPhone = normalizePhone(phone);

  // Play Store review bypass: lets Google's reviewers log in without receiving
  // a Georgian SMS. Activated only when both env vars are set and the inbound
  // phone matches. The OTP is checked locally instead of via Twilio Verify.
  const testPhone = normalizePhone(process.env.TEST_PHONE || '');
  const testOtp = (process.env.TEST_OTP || '').trim();
  const isTestPhone = Boolean(testPhone && testOtp && cleanPhone === testPhone);

  if (action === 'update_profile_image') {
    if (!cleanPhone || cleanPhone.replace('+', '').length < 6) {
      return res.status(400).json({ error: 'Enter a valid phone number' });
    }
    if (typeof profile_image !== 'string' && profile_image !== null) {
      return res.status(400).json({ error: 'Invalid profile image' });
    }
    const updated = await callSupabase(
      `/rest/v1/users?phone=eq.${encodeURIComponent(cleanPhone)}`,
      {
        method: 'PATCH',
        headers: { ...baseHeaders, Prefer: 'return=representation' },
        body: JSON.stringify({ profile_image }),
      }
    );
    if (!updated.ok) {
      return res.status(updated.status).json({
        error: supabaseError(updated.data, 'Could not update profile image'),
        supabase: updated.data,
      });
    }
    const row = Array.isArray(updated.data) ? updated.data[0] : updated.data;
    if (!row) return res.status(404).json({ error: 'User not found' });

    // Best-effort: propagate the new image to all of this user's existing offers
    // so the avatar in Browse reflects the change without requiring a repost.
    await callSupabase(
      `/rest/v1/offers?phone=eq.${encodeURIComponent(cleanPhone)}`,
      {
        method: 'PATCH',
        headers: baseHeaders,
        body: JSON.stringify({ profile_image }),
      }
    ).catch(() => {});

    return res.json({ id: row.id, phone: row.phone, name: row.name, profile_image: row.profile_image });
  }

  if (!isE164(cleanPhone)) {
    return res.status(400).json({ error: 'Enter a valid phone number with country code (e.g. +15551234567)' });
  }

  if (!twilioConfigured) {
    return res.status(500).json({
      error: 'SMS verification not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_VERIFY_SERVICE_SID.',
    });
  }

  if (action === 'send_code') {
    const wantsRegister = intent === 'register';
    const wantsLogin = intent === 'login';
    if (!wantsRegister && !wantsLogin) {
      return res.status(400).json({ error: 'Unknown intent' });
    }

    if (isTestPhone) {
      console.log('[auth] test-phone send_code bypass');
      return res.json({ status: 'sent' });
    }

    const existing = await callSupabase(
      `/rest/v1/users?phone=eq.${encodeURIComponent(cleanPhone)}&select=id`,
      { headers: baseHeaders }
    );
    if (!existing.ok) {
      return res.status(existing.status).json({
        error: supabaseError(existing.data, 'Could not reach users table'),
        supabase: existing.data,
      });
    }
    const userExists = Array.isArray(existing.data) && existing.data.length > 0;

    if (wantsRegister && userExists) {
      return res.status(409).json({ error: 'An account with this phone already exists' });
    }
    if (wantsLogin && !userExists) {
      return res.status(404).json({ error: 'No account found for this number' });
    }

    const sent = await twilioVerify('/Verifications', { To: cleanPhone, Channel: 'sms' });
    if (!sent.ok) {
      return res.status(sent.status).json({
        error: sent.data?.message || 'Could not send code. Try again.',
      });
    }
    return res.json({ status: 'sent' });
  }

  if (action === 'verify_code') {
    if (typeof code !== 'string' || !/^\d{4,10}$/.test(code.trim())) {
      return res.status(400).json({ error: 'Enter the code you received' });
    }
    const wantsRegister = intent === 'register';
    const wantsLogin = intent === 'login';
    if (!wantsRegister && !wantsLogin) {
      return res.status(400).json({ error: 'Unknown intent' });
    }

    if (isTestPhone) {
      console.log('[auth] test-phone verify_code bypass');
      if (code.trim() !== testOtp) {
        return res.status(401).json({ error: 'Incorrect or expired code' });
      }
      // Ensure-or-fetch: works for both register and login so reviewer can hit
      // either flow without server-state coordination.
      const found = await callSupabase(
        `/rest/v1/users?phone=eq.${encodeURIComponent(cleanPhone)}&select=id,phone,name,profile_image`,
        { headers: baseHeaders }
      );
      if (!found.ok) {
        return res.status(found.status).json({
          error: supabaseError(found.data, 'Could not reach users table'),
          supabase: found.data,
        });
      }
      const existingRow = Array.isArray(found.data) && found.data[0];
      if (existingRow) {
        return res.json({
          id: existingRow.id,
          phone: existingRow.phone,
          name: existingRow.name,
          profile_image: existingRow.profile_image || null,
        });
      }
      const cleanName = (typeof name === 'string' && name.trim()) || 'Play Store Reviewer';
      const insertPayload = { phone: cleanPhone, name: cleanName };
      if (typeof profile_image === 'string' && profile_image) {
        insertPayload.profile_image = profile_image;
      }
      const created = await callSupabase('/rest/v1/users', {
        method: 'POST',
        headers: { ...baseHeaders, Prefer: 'return=representation' },
        body: JSON.stringify(insertPayload),
      });
      if (!created.ok) {
        return res.status(created.status).json({
          error: supabaseError(created.data, 'Could not create account'),
          supabase: created.data,
        });
      }
      const row = Array.isArray(created.data) ? created.data[0] : created.data;
      return res.status(wantsRegister ? 201 : 200).json({
        id: row.id,
        phone: row.phone,
        name: row.name,
        profile_image: row.profile_image || null,
      });
    }

    const checked = await twilioVerify('/VerificationCheck', {
      To: cleanPhone,
      Code: code.trim(),
    });
    if (!checked.ok) {
      return res.status(checked.status).json({
        error: checked.data?.message || 'Could not verify code',
      });
    }
    if (checked.data?.status !== 'approved') {
      return res.status(401).json({ error: 'Incorrect or expired code' });
    }

    if (wantsRegister) {
      const cleanName = typeof name === 'string' ? name.trim() : '';
      if (!cleanName) return res.status(400).json({ error: 'Enter your name' });

      const existing = await callSupabase(
        `/rest/v1/users?phone=eq.${encodeURIComponent(cleanPhone)}&select=id`,
        { headers: baseHeaders }
      );
      if (!existing.ok) {
        return res.status(existing.status).json({
          error: supabaseError(existing.data, 'Could not reach users table'),
          supabase: existing.data,
        });
      }
      if (Array.isArray(existing.data) && existing.data.length > 0) {
        return res.status(409).json({ error: 'An account with this phone already exists' });
      }

      const insertPayload = { phone: cleanPhone, name: cleanName };
      if (typeof profile_image === 'string' && profile_image) {
        insertPayload.profile_image = profile_image;
      }
      const created = await callSupabase('/rest/v1/users', {
        method: 'POST',
        headers: { ...baseHeaders, Prefer: 'return=representation' },
        body: JSON.stringify(insertPayload),
      });
      if (!created.ok) {
        return res.status(created.status).json({
          error: supabaseError(created.data, 'Could not create account'),
          supabase: created.data,
        });
      }
      const row = Array.isArray(created.data) ? created.data[0] : created.data;
      return res.status(201).json({
        id: row.id,
        phone: row.phone,
        name: row.name,
        profile_image: row.profile_image || null,
      });
    }

    // login
    const found = await callSupabase(
      `/rest/v1/users?phone=eq.${encodeURIComponent(cleanPhone)}&select=id,phone,name,profile_image`,
      { headers: baseHeaders }
    );
    if (!found.ok) {
      return res.status(found.status).json({
        error: supabaseError(found.data, 'Could not reach users table'),
        supabase: found.data,
      });
    }
    const row = Array.isArray(found.data) ? found.data[0] : null;
    if (!row) return res.status(404).json({ error: 'No account found for this number' });
    return res.json({
      id: row.id,
      phone: row.phone,
      name: row.name,
      profile_image: row.profile_image || null,
    });
  }

  return res.status(400).json({ error: 'Unknown action' });
};
