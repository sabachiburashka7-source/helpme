module.exports = function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>helpme — Privacy Policy</title>
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; max-width: 720px; margin: 40px auto; padding: 0 20px; color: #222; line-height: 1.55; }
    h1 { font-size: 28px; margin-bottom: 4px; }
    h2 { font-size: 18px; margin-top: 28px; }
    .meta { color: #888; font-size: 14px; margin-bottom: 24px; }
    code { background: #f4f4f4; padding: 1px 5px; border-radius: 3px; font-size: 14px; }
    a { color: #0a66c2; }
  </style>
</head>
<body>
  <h1>Privacy Policy</h1>
  <p class="meta">App: helpme &middot; Developer: sabachiburashka &middot; Last updated: 2026-05-22</p>

  <p>This policy describes what information the helpme mobile app ("the app") collects, why we collect it, how we use it, and the choices you have.</p>

  <h2>1. Information we collect</h2>
  <p><strong>Phone number.</strong> We collect your phone number to create your account and to send a one-time SMS verification code. The verification code is sent through our SMS provider, Twilio.</p>
  <p><strong>Name and profile photo.</strong> You provide a display name and (optionally) a profile photo when you sign up. These are shown to other users next to requests you post.</p>
  <p><strong>Requests you post.</strong> When you create a request, the text, images, and the location you pick on the map are stored on our backend so they can be shown to other users browsing the area.</p>
  <p><strong>Precise device location.</strong> When you tap "use my location" we read your device's GPS coordinates once, to pre-fill the map. We do not track your location in the background.</p>
  <p><strong>Photos.</strong> When you attach an image, the app reads the selected image from your device's photo library or camera and uploads it with the request.</p>

  <h2>2. How we use the information</h2>
  <p>We use the information above solely to operate the app: authenticating you, showing your requests to nearby users, and letting users contact each other by phone. We do not sell or rent your data, and we do not use it for advertising.</p>

  <h2>3. Third-party services</h2>
  <ul>
    <li><strong>Twilio</strong> &mdash; sends the SMS verification code. Twilio receives your phone number for the purpose of delivering the code. See Twilio's privacy policy at <a href="https://www.twilio.com/legal/privacy">twilio.com/legal/privacy</a>.</li>
    <li><strong>Supabase</strong> &mdash; hosts the database that stores accounts, requests, and images. See <a href="https://supabase.com/privacy">supabase.com/privacy</a>.</li>
    <li><strong>OpenAI</strong> &mdash; if you choose to auto-generate an illustration for a request, the request text is sent to OpenAI's image model. See <a href="https://openai.com/policies/privacy-policy">openai.com/policies/privacy-policy</a>.</li>
    <li><strong>OpenFreeMap / MapLibre</strong> &mdash; map tiles are loaded from OpenFreeMap when you use the map. No account data is sent.</li>
  </ul>

  <h2>4. Data retention and deletion</h2>
  <p>Account data is retained while your account exists. To delete your account and all associated data (profile, posted requests, images), email <a href="mailto:sabachiburashka7@gmail.com">sabachiburashka7@gmail.com</a> from the phone number on your account, or use the in-app account deletion option when available. We will process deletion within 30 days.</p>

  <h2>5. Children</h2>
  <p>The app is not intended for children under 13, and we do not knowingly collect data from them.</p>

  <h2>6. Security</h2>
  <p>Data is transmitted over HTTPS. Our backend runs on Vercel and our database is hosted by Supabase, both of which provide encryption at rest and in transit.</p>

  <h2>7. Changes to this policy</h2>
  <p>If we make material changes we will update the "Last updated" date above and, where appropriate, notify you in the app.</p>

  <h2>8. Contact</h2>
  <p>Questions or requests? Email <a href="mailto:sabachiburashka7@gmail.com">sabachiburashka7@gmail.com</a>.</p>
</body>
</html>`);
};
