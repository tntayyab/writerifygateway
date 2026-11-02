import { scryptAsync } from '@noble/hashes/scrypt.js';
import { execAdminSql } from './admin-neon.js';

export interface GatewaySetting {
  id: number;
  key: string;
  value: string;
  description?: string;
  updated_at?: string;
}

export interface VerificationRecord {
  id: number;
  email: string;
  code: string;
  name: string;
  password_hash?: string;
  is_verified: boolean;
  expires_at: string;
  created_at: string;
}

// -------------------------------------------------------------
// 1. Password Hashing (100% Better Auth Scrypt Spec Compatible)
// -------------------------------------------------------------
export async function hashPasswordClient(password: string): Promise<string> {
  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  const saltHex = Array.from(saltBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Better Auth Scrypt parameters: N=16384, r=16, p=1, dkLen=64
  // Salt is passed as UTF-8 bytes of the hex string
  const saltUtf8 = new TextEncoder().encode(saltHex);
  const derivedKey = await scryptAsync(password.normalize('NFKC'), saltUtf8, {
    N: 16384,
    r: 16,
    p: 1,
    dkLen: 64,
    maxmem: 128 * 16384 * 16 * 2,
  });

  const keyHex = Array.from(derivedKey)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return `${saltHex}:${keyHex}`;
}

export function generateRandomId(length = 32): string {
  const bytes = new Uint8Array(Math.ceil(length / 2));
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, length);
}

// -------------------------------------------------------------
// 2. Gateway Settings Management (Stored in Neon)
// -------------------------------------------------------------
export async function getGatewaySettings(): Promise<Record<string, string>> {
  try {
    const rows = await execAdminSql<GatewaySetting>(
      "SELECT id, key, COALESCE(value, '') as value FROM public.kyros_gateway_settings;",
    );
    const map: Record<string, string> = {};
    for (const row of rows) {
      map[row.key] = row.value;
    }
    return map;
  } catch (err) {
    console.warn('[Kyros Settings] Failed to fetch settings:', err);
    return {};
  }
}

export async function updateGatewaySetting(key: string, value: string): Promise<boolean> {
  const escapedKey = key.trim().replace(/'/g, "''");
  const escapedValue = value.trim().replace(/'/g, "''");
  const query = `
    INSERT INTO public.kyros_gateway_settings (key, value, updated_at)
    VALUES ('${escapedKey}', '${escapedValue}', NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
  `;
  await execAdminSql(query);
  return true;
}

// -------------------------------------------------------------
// 3. Email Dispatcher via Resend API
// -------------------------------------------------------------
export async function sendEmailViaResend(options: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const settings = await getGatewaySettings();
    const apiKey = settings['resend_api_key']?.trim();
    const fromSender =
      settings['email_from']?.trim() || 'Writerify Gateway <onboarding@resend.dev>';

    if (!apiKey) {
      console.warn('[Resend] No RESEND_API_KEY set in kyros_gateway_settings.');
      return {
        success: false,
        error: 'Resend API key is not configured in Admin Settings. (Contact Writerify Admin)',
      };
    }

    const payload = {
      from: fromSender,
      to: [options.to],
      subject: options.subject,
      html: options.html,
      text: options.text || options.subject,
    };

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('[Resend Error]', data);
      return {
        success: false,
        error: data.message || `Resend error (${res.status})`,
      };
    }

    return { success: true, id: data.id };
  } catch (err: any) {
    console.error('[Resend Exception]', err);
    return { success: false, error: err.message || 'Failed to dispatch email' };
  }
}

// -------------------------------------------------------------
// 4. Branded Email Templates
// -------------------------------------------------------------
export function buildOtpEmailHtml(name: string, code: string): string {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>Writerify Gateway Verification</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0b0f19; padding: 40px 20px;">
      <tr>
        <td align="center">
          <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #111827; border-radius: 16px; border: 1px solid #1f2937; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
            <!-- Header -->
            <tr>
              <td style="padding: 32px 32px 20px 32px; text-align: center; border-bottom: 1px solid #1f2937;">
                <div style="display: inline-block; padding: 8px 16px; background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 9999px; font-size: 13px; font-weight: 700; color: #38bdf8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">
                  KYROS AI NETWORK
                </div>
                <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                  Writerify Gateway
                </h1>
                <p style="margin: 6px 0 0 0; font-size: 14px; color: #94a3b8;">
                  Account Verification Code
                </p>
              </td>
            </tr>
            <!-- Content -->
            <tr>
              <td style="padding: 32px;">
                <p style="margin: 0 0 16px 0; font-size: 16px; color: #e2e8f0; line-height: 1.5;">
                  Hello <strong>${name || 'Member'}</strong>,
                </p>
                <p style="margin: 0 0 24px 0; font-size: 14px; color: #94a3b8; line-height: 1.6;">
                  Thank you for requesting access to Writerify Gateway. Please enter the following 6-digit verification code to confirm your email address:
                </p>
                
                <!-- Code Box -->
                <div style="background-color: #0a0e17; border: 2px dashed #0284c7; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
                  <span style="font-family: monospace, Courier; font-size: 34px; font-weight: 800; letter-spacing: 10px; color: #38bdf8;">
                    ${code}
                  </span>
                </div>

                <p style="margin: 0 0 12px 0; font-size: 13px; color: #64748b; line-height: 1.5; text-align: center;">
                  ⏳ This code expires in <strong>15 minutes</strong>.
                </p>
                <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.5; text-align: center;">
                  After verifying your email, your account will be queued for Admin approval.
                </p>
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="padding: 20px 32px; background-color: #0b0f19; border-top: 1px solid #1f2937; text-align: center;">
                <p style="margin: 0; font-size: 12px; color: #475569;">
                  &copy; ${new Date().getFullYear()} Writerify Gateway &bull; Secured by KYROS Super Admin
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;
}

export function buildApprovalEmailHtml(name: string, email: string): string {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>Account Approved - Writerify Gateway</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0b0f19; padding: 40px 20px;">
      <tr>
        <td align="center">
          <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #111827; border-radius: 16px; border: 1px solid #1f2937; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
            <!-- Header -->
            <tr>
              <td style="padding: 32px 32px 20px 32px; text-align: center; border-bottom: 1px solid #1f2937;">
                <div style="display: inline-block; padding: 8px 16px; background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 9999px; font-size: 13px; font-weight: 700; color: #4ade80; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">
                  🎉 ACCESS GRANTED
                </div>
                <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                  Welcome to Writerify Gateway
                </h1>
                <p style="margin: 6px 0 0 0; font-size: 14px; color: #94a3b8;">
                  Your account has been officially approved!
                </p>
              </td>
            </tr>
            <!-- Content -->
            <tr>
              <td style="padding: 32px;">
                <p style="margin: 0 0 16px 0; font-size: 16px; color: #e2e8f0; line-height: 1.5;">
                  Hello <strong>${name || 'Member'}</strong>,
                </p>
                <p style="margin: 0 0 20px 0; font-size: 14px; color: #94a3b8; line-height: 1.6;">
                  Great news! Your Writerify Gateway account (<strong>${email}</strong>) has been reviewed and <strong style="color: #4ade80;">approved by Writerify</strong>.
                </p>
                <p style="margin: 0 0 28px 0; font-size: 14px; color: #94a3b8; line-height: 1.6;">
                  You now have full access to our multi-model AI routing, high-performance harnesses, fallback engines, and intelligent playground.
                </p>
                
                <!-- CTA Button -->
                <div style="text-align: center; margin-bottom: 28px;">
                  <a href="https://gateway.writerify.org/login" style="background: linear-gradient(135deg, #0284c7, #2563eb); color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 4px 15px rgba(2, 132, 199, 0.4);">
                    Log In to Writerify Gateway &rarr;
                  </a>
                </div>

                <div style="background-color: #0f172a; border-radius: 8px; padding: 16px; font-size: 13px; color: #64748b; line-height: 1.5;">
                  <strong>Quick tip:</strong> Sign in with your registered email and password. If you ever need help, reach out directly to Admin at <a href="mailto:itsinjamul@gmail.com" style="color: #38bdf8; text-decoration: none;">itsinjamul@gmail.com</a>.
                </div>
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="padding: 20px 32px; background-color: #0b0f19; border-top: 1px solid #1f2937; text-align: center;">
                <p style="margin: 0; font-size: 12px; color: #475569;">
                  &copy; ${new Date().getFullYear()} Writerify Gateway &bull; https://gateway.writerify.org
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;
}

// -------------------------------------------------------------
// 5. Direct Registration Workflow (No Verification OTP Needed)
// -------------------------------------------------------------
export async function submitDirectRegistration(
  name: string,
  email: string,
  password: string,
): Promise<{ success: boolean; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name.trim();

  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, error: 'Please enter a valid email address.' };
  }
  if (!password || password.length < 8) {
    return { success: false, error: 'Password must be at least 8 characters long.' };
  }

  // 1. Check if email has been blocked/rejected by Admin
  const accessRows = await execAdminSql<{ status: string }>(
    `SELECT status FROM public.kyros_access_control WHERE LOWER(email) = LOWER('${cleanEmail.replace(/'/g, "''")}');`,
  );
  if (
    accessRows.length > 0 &&
    (accessRows[0].status === 'rejected' || accessRows[0].status === 'revoked')
  ) {
    return {
      success: false,
      error: 'Access Denied: This account has been blocked by Admin (Boss TN TAYYAB).',
    };
  }

  // 2. Check if email already has an approved account
  const existingUsers = await execAdminSql<{ id: string; email: string }>(
    `SELECT id, email FROM public.user WHERE LOWER(email) = LOWER('${cleanEmail.replace(/'/g, "''")}');`,
  );
  if (existingUsers.length > 0) {
    return {
      success: false,
      error: 'An account with this email already exists. Please log in instead.',
    };
  }

  // 3. Compute password hash with Scrypt NFKC
  const passwordHash = await hashPasswordClient(password);
  const escapedEmail = cleanEmail.replace(/'/g, "''");
  const escapedName = cleanName.replace(/'/g, "''");
  const escapedHash = passwordHash.replace(/'/g, "''");

  // 4. Save directly into kyros_access_control as 'pending'
  await execAdminSql(`
    INSERT INTO public.kyros_access_control (email, name, role, status, plan, notes, password_hash, is_email_verified, created_at, updated_at)
    VALUES ('${escapedEmail}', '${escapedName}', 'member', 'pending', 'free_trial', 'Direct Registration - Pending Admin Approval', '${escapedHash}', true, NOW(), NOW())
    ON CONFLICT (email) DO UPDATE 
    SET name = EXCLUDED.name, 
        password_hash = EXCLUDED.password_hash, 
        status = 'pending', 
        is_email_verified = true,
        notes = 'Direct Registration - Pending Admin Approval', 
        updated_at = NOW();
  `);

  return { success: true };
}

// -------------------------------------------------------------
// 5b. Verification OTP Workflow (Optional/Legacy)
// -------------------------------------------------------------
export async function requestRegistrationOtp(
  name: string,
  email: string,
  password: string,
): Promise<{ success: boolean; error?: string; otpCode?: string; emailSent?: boolean }> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name.trim();

  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, error: 'Please enter a valid email address.' };
  }
  if (!password || password.length < 8) {
    return { success: false, error: 'Password must be at least 8 characters long.' };
  }

  // Check if email has been blocked/rejected by Admin
  const accessRows = await execAdminSql<{ status: string }>(
    `SELECT status FROM public.kyros_access_control WHERE LOWER(email) = LOWER('${cleanEmail.replace(/'/g, "''")}');`,
  );
  if (
    accessRows.length > 0 &&
    (accessRows[0].status === 'rejected' || accessRows[0].status === 'revoked')
  ) {
    return {
      success: false,
      error: 'Access Denied: This account has been blocked by Admin (Boss TN TAYYAB).',
    };
  }

  // Check if email already has an approved account
  const existingUsers = await execAdminSql<{ id: string; email: string }>(
    `SELECT id, email FROM public.user WHERE LOWER(email) = LOWER('${cleanEmail.replace(/'/g, "''")}');`,
  );
  if (existingUsers.length > 0) {
    return {
      success: false,
      error: 'An account with this email already exists. Please log in instead.',
    };
  }

  // Generate 6-digit OTP code
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  // Compute password hash
  const passwordHash = await hashPasswordClient(password);

  // Store OTP into public.kyros_email_verifications (expires in 15 mins)
  const escapedEmail = cleanEmail.replace(/'/g, "''");
  const escapedName = cleanName.replace(/'/g, "''");
  const escapedHash = passwordHash.replace(/'/g, "''");

  await execAdminSql(`
    INSERT INTO public.kyros_email_verifications (email, code, name, password_hash, is_verified, expires_at, created_at, updated_at)
    VALUES ('${escapedEmail}', '${code}', '${escapedName}', '${escapedHash}', false, NOW() + INTERVAL '15 minutes', NOW(), NOW());
  `);

  // Ensure record is also queued in kyros_access_control as 'pending'
  await execAdminSql(`
    INSERT INTO public.kyros_access_control (email, name, role, status, plan, notes, password_hash, created_at, updated_at)
    VALUES ('${escapedEmail}', '${escapedName}', 'member', 'pending', 'free_trial', 'OTP Sent - Pending Email Verification', '${escapedHash}', NOW(), NOW())
    ON CONFLICT (email) DO UPDATE 
    SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash, updated_at = NOW();
  `);

  // Dispatch OTP email via Resend
  const html = buildOtpEmailHtml(cleanName, code);
  const sendRes = await sendEmailViaResend({
    to: cleanEmail,
    subject: `Your Writerify Gateway Verification Code: ${code}`,
    html,
    text: `Your Writerify Gateway verification code is: ${code}. Valid for 15 minutes.`,
  });

  return {
    success: true,
    otpCode: code,
    emailSent: sendRes.success,
    error: sendRes.success ? undefined : sendRes.error,
  };
}

export async function verifyRegistrationOtp(
  email: string,
  code: string,
): Promise<{ success: boolean; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = code.trim();

  const escapedEmail = cleanEmail.replace(/'/g, "''");
  const escapedCode = cleanCode.replace(/'/g, "''");

  // Query latest unexpired verification record
  const records = await execAdminSql<VerificationRecord>(`
    SELECT id, email, code, name, password_hash, is_verified, expires_at, created_at
    FROM public.kyros_email_verifications
    WHERE LOWER(email) = LOWER('${escapedEmail}') AND code = '${escapedCode}' AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1;
  `);

  if (records.length === 0) {
    return {
      success: false,
      error: 'Invalid or expired verification code. Please check your email or request a new code.',
    };
  }

  const record = records[0];

  // Mark verification as complete
  await execAdminSql(`
    UPDATE public.kyros_email_verifications
    SET is_verified = true, updated_at = NOW()
    WHERE id = ${record.id};
  `);

  // Update kyros_access_control to pending admin approval
  await execAdminSql(`
    UPDATE public.kyros_access_control
    SET is_email_verified = true,
        status = 'pending',
        notes = 'Email Verified! Pending Admin Approval',
        password_hash = COALESCE(password_hash, '${(record.password_hash || '').replace(/'/g, "''")}'),
        updated_at = NOW()
    WHERE LOWER(email) = LOWER('${escapedEmail}');
  `);

  return { success: true };
}

// -------------------------------------------------------------
// 6. Admin Approval Workflow (Admin Portal Step)
// -------------------------------------------------------------
export async function approveUserAccount(
  email: string,
  approver = 'Writerify',
): Promise<{ success: boolean; error?: string; emailSent?: boolean }> {
  const cleanEmail = email.trim().toLowerCase();
  const escapedEmail = cleanEmail.replace(/'/g, "''");
  const escapedApprover = approver.replace(/'/g, "''");

  // Fetch access control record to get name & password_hash
  const memberRows = await execAdminSql<{
    id: number;
    email: string;
    name: string;
    password_hash: string;
  }>(`
    SELECT id, email, name, password_hash
    FROM public.kyros_access_control
    WHERE LOWER(email) = LOWER('${escapedEmail}');
  `);

  if (memberRows.length === 0) {
    return { success: false, error: 'User record not found in access control.' };
  }

  const member = memberRows[0];
  const userName = member.name || 'Member';
  const escapedName = userName.replace(/'/g, "''");

  // Check if user already exists in public.user
  const existingUsers = await execAdminSql<{ id: string; email: string }>(`
    SELECT id, email FROM public.user WHERE LOWER(email) = LOWER('${escapedEmail}');
  `);

  let userId = existingUsers[0]?.id;

  if (!userId) {
    userId = generateRandomId(32);
    const accountId = generateRandomId(32);
    const passwordHash = member.password_hash || '';

    // Insert user row
    await execAdminSql(`
      INSERT INTO public.user (id, name, email, "emailVerified", "createdAt", "updatedAt")
      VALUES ('${userId}', '${escapedName}', '${escapedEmail}', true, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET "emailVerified" = true, "updatedAt" = NOW();
    `);

    // Insert account row if password hash exists
    if (passwordHash) {
      const escapedHash = passwordHash.replace(/'/g, "''");
      await execAdminSql(`
        INSERT INTO public.account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
        VALUES ('${accountId}', '${userId}', 'credential', '${userId}', '${escapedHash}', NOW(), NOW())
        ON CONFLICT (id) DO NOTHING;
      `);
    }
  } else {
    // If user already exists, ensure emailVerified is true
    await execAdminSql(`
      UPDATE public.user SET "emailVerified" = true, "updatedAt" = NOW() WHERE id = '${userId}';
    `);
  }

  // Update status to 'approved' in kyros_access_control
  await execAdminSql(`
    UPDATE public.kyros_access_control
    SET status = 'approved',
        approved_by = '${escapedApprover}',
        is_email_verified = true,
        notes = 'Approved by Admin (Full Access Granted)',
        updated_at = NOW()
    WHERE LOWER(email) = LOWER('${escapedEmail}');
  `);

  // Reactivate agent API keys so Writerify requests can resume if previously blocked
  await execAdminSql(`
    UPDATE public.agent_api_keys 
    SET is_active = true 
    WHERE tenant_id IN (
      SELECT t.id FROM public.tenants t 
      JOIN public.user u ON t.owner_user_id = u.id 
      WHERE LOWER(u.email) = LOWER('${escapedEmail}')
    );
  `);

  // Dispatch confirmation email to approved user
  const approvalHtml = buildApprovalEmailHtml(userName, cleanEmail);
  const emailRes = await sendEmailViaResend({
    to: cleanEmail,
    subject: '🎉 Congratulations! Your Writerify Gateway Account is Approved',
    html: approvalHtml,
    text: `Hello ${userName}, your Writerify Gateway account has been approved by Writerify. You can now log in at https://gateway.writerify.org/login`,
  });

  return {
    success: true,
    emailSent: emailRes.success,
    error: emailRes.success ? undefined : emailRes.error,
  };
}

export async function getRecentVerifications(): Promise<VerificationRecord[]> {
  try {
    return await execAdminSql<VerificationRecord>(`
      SELECT id, email, code, name, is_verified, expires_at, created_at
      FROM public.kyros_email_verifications
      ORDER BY created_at DESC
      LIMIT 15;
    `);
  } catch {
    return [];
  }
}
