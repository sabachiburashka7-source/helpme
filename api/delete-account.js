module.exports = function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Kheli — Delete your account</title>
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; max-width: 720px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; line-height: 1.6; }
    h1 { font-size: 28px; margin-bottom: 4px; }
    h2 { font-size: 18px; margin-top: 28px; }
    .meta { color: #666; font-size: 14px; margin-bottom: 24px; }
    a { color: #0a66c2; }
    code { background: #f4f4f4; padding: 1px 5px; border-radius: 3px; font-size: 14px; }
    .box { background: #f7faff; border: 1px solid #d6e4ff; padding: 16px 18px; border-radius: 8px; margin: 16px 0; }
    ul { padding-left: 22px; }
  </style>
</head>
<body>
  <h1>Delete your Kheli account</h1>
  <p class="meta">App: Kheli (<code>com.sabachiburashka.helpme</code>) &middot; Last updated: 2026-05-24</p>

  <p>This page explains how to permanently delete your Kheli account and all of the personal data associated with it. The process is free and works whether or not the App is still installed on your device.</p>

  <h2>How to request deletion</h2>
  <div class="box">
    <p>Send an email to <a href="mailto:sabachiburashka7@gmail.com?subject=Delete%20my%20Kheli%20account">sabachiburashka7@gmail.com</a> from the phone number on your account, including:</p>
    <ul>
      <li>The subject line "<strong>Delete my Kheli account</strong>"</li>
      <li>The phone number you signed up with (in international format, e.g. <code>+995...</code>)</li>
      <li>The display name on your account, if you remember it</li>
    </ul>
    <p>We use the phone number to verify ownership (we will send a one-time confirmation code to that number before deleting).</p>
  </div>

  <h2>What gets deleted</h2>
  <ul>
    <li>Your account record (phone number, display name, profile photo).</li>
    <li>All requests you have posted (text, price, category, attached photos, pinned location).</li>
    <li>Authentication state stored locally on your device, on next app launch.</li>
  </ul>

  <h2>What is retained, and for how long</h2>
  <ul>
    <li><strong>Short-lived operational logs</strong> — up to 30 additional days, used for security and debugging. They are then purged automatically.</li>
    <li><strong>SMS-delivery records held by Twilio</strong> — retained per <a href="https://www.twilio.com/legal/privacy">Twilio's privacy policy</a>, not under our control.</li>
    <li>We do not retain copies of your data for any other purpose. Deleted requests cannot be recovered.</li>
  </ul>

  <h2>Timeframe</h2>
  <p>Deletion requests are processed within <strong>30 days</strong> of verifying your identity. In most cases we complete the deletion within a few business days.</p>

  <h2>Uninstalling the App</h2>
  <p>Uninstalling the App removes the locally cached authentication state from your device, but does <strong>not</strong> delete your account from our backend. To fully delete your account, please use the email process above.</p>

  <h2>Questions</h2>
  <p>If you have any questions about deletion, please email <a href="mailto:sabachiburashka7@gmail.com">sabachiburashka7@gmail.com</a>. Our full <a href="/privacy">Privacy Policy</a> describes all of our data practices in detail.</p>
</body>
</html>`);
};
