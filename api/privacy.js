module.exports = function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Kheli — Privacy Policy</title>
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; max-width: 760px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; line-height: 1.6; }
    h1 { font-size: 30px; margin-bottom: 4px; }
    h2 { font-size: 20px; margin-top: 32px; border-bottom: 1px solid #eee; padding-bottom: 6px; }
    h3 { font-size: 16px; margin-top: 20px; margin-bottom: 6px; }
    .meta { color: #666; font-size: 14px; margin-bottom: 24px; }
    table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 14px; }
    th, td { border: 1px solid #ddd; padding: 8px 10px; text-align: left; vertical-align: top; }
    th { background: #f7f7f7; }
    code { background: #f4f4f4; padding: 1px 5px; border-radius: 3px; font-size: 14px; }
    a { color: #0a66c2; }
    .callout { background: #fff8e1; border-left: 4px solid #f5b400; padding: 12px 14px; margin: 16px 0; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>Privacy Policy</h1>
  <p class="meta">
    App: <strong>Kheli</strong> (Android, package <code>com.sabachiburashka.helpme</code>)<br/>
    Developer: sabachiburashka &middot; Contact: <a href="mailto:sabachiburashka7@gmail.com">sabachiburashka7@gmail.com</a><br/>
    Effective date: 2026-05-24 &middot; Last updated: 2026-05-24
  </p>

  <p>This Privacy Policy explains what information the Kheli mobile application (the "App") collects, how that information is used and shared, the choices you have, and how to contact us or delete your data. By using the App you agree to the practices described here.</p>

  <div class="callout">
    <strong>Important — content shared with other users.</strong>
    When you post a request, your <strong>display name, profile photo, phone number, request text, attached photos, and the location you pin on the map</strong> are visible to all other Kheli users browsing the area. Other users contact you directly by calling or messaging the phone number shown on your request. Do not post a request unless you are comfortable with your phone number being seen by other users of the App.
  </div>

  <h2>1. Data we collect</h2>
  <p>The categories below match the structure of the Google Play Data Safety form.</p>

  <table>
    <thead>
      <tr><th>Data type</th><th>Why collected</th><th>Shared with</th><th>Required / optional</th></tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Phone number</strong></td>
        <td>To create your account, send a one-time SMS verification code, identify you to the system, and let other users contact you about requests you post.</td>
        <td>Twilio (to deliver the SMS); Supabase (storage); other users of the App (shown on requests you post).</td>
        <td>Required</td>
      </tr>
      <tr>
        <td><strong>Name (display name)</strong></td>
        <td>Shown next to requests you post so other users can identify you.</td>
        <td>Supabase (storage); other users of the App.</td>
        <td>Required</td>
      </tr>
      <tr>
        <td><strong>Profile photo</strong></td>
        <td>Optional avatar shown next to your requests.</td>
        <td>Supabase (storage); other users of the App.</td>
        <td>Optional</td>
      </tr>
      <tr>
        <td><strong>Request content</strong> (text, price, category, attached photos)</td>
        <td>The content of requests you choose to publish in the App.</td>
        <td>Supabase (storage); OpenAI (only if you tap "auto-generate illustration", the request text is sent to OpenAI's image model); other users of the App.</td>
        <td>You control what to publish</td>
      </tr>
      <tr>
        <td><strong>Precise location</strong> (GPS coordinates)</td>
        <td>Read once, only when you tap "use my location", to pre-fill the map pin on a request you are composing. We do not track your location in the background.</td>
        <td>Supabase (stored as the coordinates of the request you publish); other users of the App (so they can find nearby requests).</td>
        <td>Optional — you can drag the map pin manually instead.</td>
      </tr>
      <tr>
        <td><strong>Photos &amp; media</strong> (from your device library or camera)</td>
        <td>Only the specific image(s) you pick when attaching photos to a request or setting your profile photo. We do not scan or upload other media.</td>
        <td>Supabase (storage); other users of the App.</td>
        <td>Optional</td>
      </tr>
      <tr>
        <td><strong>Authentication state on device</strong></td>
        <td>After you sign in, your account identifier is stored locally in encrypted AsyncStorage so you do not have to log in every time.</td>
        <td>Stays on your device. Cleared on log out or app uninstall.</td>
        <td>Automatic</td>
      </tr>
    </tbody>
  </table>

  <p>We do <strong>not</strong> collect: email address, contacts list, calendar, SMS messages, call logs, browser history, financial information, health data, device identifiers for advertising, or any analytics events. The App contains no advertising SDKs.</p>

  <h2>2. Android permissions we use</h2>
  <table>
    <thead>
      <tr><th>Permission</th><th>Why we ask for it</th></tr>
    </thead>
    <tbody>
      <tr><td><code>ACCESS_COARSE_LOCATION</code>, <code>ACCESS_FINE_LOCATION</code></td><td>Only when you tap "use my location" while composing a request, to read your current coordinates once and pre-fill the map pin. Never used in the background.</td></tr>
      <tr><td><code>READ_MEDIA_IMAGES</code> / photo picker</td><td>Only when you attach a photo to a request or pick a profile photo. We only read the specific image you pick.</td></tr>
      <tr><td><code>CAMERA</code></td><td>Only when you choose to take a new photo for a request or profile picture instead of picking from the gallery.</td></tr>
      <tr><td><code>INTERNET</code></td><td>To call our backend over HTTPS so requests can be sent and received.</td></tr>
    </tbody>
  </table>

  <h2>3. How your data is shared</h2>
  <h3>3.1 Sharing with other users</h3>
  <p>The App is a public marketplace of requests. When you publish a request, the data fields described above (name, profile photo if any, phone number, request text and photos, and pinned location) are shown to other users of the App. They may save, screenshot, or contact you using this information. Do not post information you do not want to be public.</p>

  <h3>3.2 Sharing with service providers (sub-processors)</h3>
  <table>
    <thead>
      <tr><th>Provider</th><th>Purpose</th><th>Data shared</th><th>Region</th><th>Policy</th></tr>
    </thead>
    <tbody>
      <tr><td>Twilio, Inc.</td><td>Delivers the one-time SMS verification code.</td><td>Your phone number.</td><td>United States</td><td><a href="https://www.twilio.com/legal/privacy">twilio.com/legal/privacy</a></td></tr>
      <tr><td>Supabase, Inc.</td><td>Database that stores accounts, requests, and uploaded images.</td><td>All account and request data described in Section 1.</td><td>United States / EU</td><td><a href="https://supabase.com/privacy">supabase.com/privacy</a></td></tr>
      <tr><td>Vercel Inc.</td><td>Hosts our backend API.</td><td>API request/response data in transit; standard server logs (IP address, timestamps) retained briefly for security and debugging.</td><td>United States / global edge</td><td><a href="https://vercel.com/legal/privacy-policy">vercel.com/legal/privacy-policy</a></td></tr>
      <tr><td>OpenAI, L.L.C.</td><td><em>Only if you tap "auto-generate illustration"</em>: generates an image based on your request text.</td><td>The request text you submit for illustration.</td><td>United States</td><td><a href="https://openai.com/policies/privacy-policy">openai.com/policies/privacy-policy</a></td></tr>
      <tr><td>OpenFreeMap / MapLibre</td><td>Serves map tiles when the map is displayed.</td><td>Standard map-tile requests (no account data).</td><td>Global CDN</td><td><a href="https://openfreemap.org/">openfreemap.org</a></td></tr>
    </tbody>
  </table>

  <h3>3.3 We do not sell your data</h3>
  <p>We do not sell or rent personal information to third parties, and we do not share data for advertising, profiling, cross-context behavioural advertising, or analytics purposes.</p>

  <h3>3.4 Legal requests</h3>
  <p>We may disclose data if required by valid legal process (court order, subpoena) from a competent authority, or to protect the rights, property, or safety of the App, our users, or the public.</p>

  <h2>4. International data transfers</h2>
  <p>Because our sub-processors (Twilio, Supabase, Vercel, OpenAI) are based primarily in the United States, your information will be transferred to and processed in countries outside your country of residence, including the United States, which may have data-protection laws different from those in your jurisdiction. By using the App you consent to this transfer.</p>

  <h2>5. Data retention</h2>
  <ul>
    <li><strong>Account data</strong> (phone, name, profile photo) — retained for as long as your account exists.</li>
    <li><strong>Requests you post</strong> — retained until you delete the request from the "My Requests" screen, or until your account is deleted.</li>
    <li><strong>SMS verification codes</strong> — managed by Twilio; expire within a few minutes and are not stored on our backend after verification.</li>
    <li><strong>Server logs</strong> — short-lived operational logs (typically less than 30 days) for debugging and abuse prevention.</li>
  </ul>

  <h2>6. Your rights and choices</h2>
  <p>You have the right to:</p>
  <ul>
    <li><strong>Access</strong> the data we hold about you.</li>
    <li><strong>Correct</strong> inaccurate data (your name and profile photo can be edited in the App; to correct your phone number, contact us).</li>
    <li><strong>Delete</strong> your account and all associated data — see Section 7.</li>
    <li><strong>Withdraw consent</strong> for optional permissions at any time by revoking them in Android Settings &rarr; Apps &rarr; Kheli &rarr; Permissions.</li>
    <li><strong>Object or restrict</strong> certain processing, where applicable under your local law.</li>
    <li><strong>Lodge a complaint</strong> with your local data-protection authority.</li>
  </ul>
  <p>To exercise any of these rights, email <a href="mailto:sabachiburashka7@gmail.com">sabachiburashka7@gmail.com</a> from the phone number on your account, or include enough information for us to verify your identity. We respond within 30 days.</p>

  <h2>7. Account and data deletion</h2>
  <p>You can request full deletion of your account and all associated data (profile, posted requests, uploaded images) at any time. A dedicated, public deletion-request page is available at:</p>
  <p><a href="/delete-account"><strong>https://helpme-jade-tau.vercel.app/delete-account</strong></a></p>
  <p>Deletion is processed within 30 days. Once complete, your account record and any requests you have posted are permanently removed from our database. Some short-lived operational logs that incidentally reference your phone number may persist for up to 30 additional days before being purged. SMS-delivery records held by Twilio are retained per Twilio's own policy.</p>

  <h2>8. Security</h2>
  <p>All traffic between the App and our backend is encrypted in transit using HTTPS. Data at rest is stored by Supabase, which provides encryption at rest. Authentication is based on phone-number ownership verified via one-time SMS codes; we do not store passwords. We use the principle of least privilege internally and review third-party sub-processors periodically.</p>
  <p>No method of transmission or storage is 100% secure. If a data incident affects you, we will notify you within the timeframe required by applicable law.</p>

  <h2>9. Children</h2>
  <p>The App is not directed to children under the age of 13 (or the equivalent minimum age in your jurisdiction — for example 16 in parts of the EEA). We do not knowingly collect personal data from children. If you believe a child has provided us with personal data, please contact us and we will delete it.</p>

  <h2>10. Changes to this policy</h2>
  <p>If we make material changes to this policy, we will update the "Effective date" above and, where appropriate, notify you in the App on the next launch. Continued use of the App after a change indicates acceptance of the revised policy.</p>

  <h2>11. Contact</h2>
  <p>
    Questions, requests, or complaints about this policy or our data practices:<br/>
    <strong>sabachiburashka</strong><br/>
    Email: <a href="mailto:sabachiburashka7@gmail.com">sabachiburashka7@gmail.com</a>
  </p>
</body>
</html>`);
};
