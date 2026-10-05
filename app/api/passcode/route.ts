import { NextResponse } from "next/server";
import sql from "@/lib/db";
import {
  decryptPasscode,
  encryptPasscode,
  isUnlocked,
  PASSCODE_COOKIE,
  UNLOCK_COOKIE_OPTS as COOKIE_OPTS,
} from "@/lib/session";
import { removeAllCredentials } from "@/lib/webauthn";
import { sendEmail } from "@/lib/email";

/**
 * The only lock in the app — no accounts, no sign-in. The passcode is
 * encrypted (not hashed) precisely so "recover" can work. Unlocking sets a
 * session cookie holding the encrypted value itself, never the plain
 * passcode, so every later request is just a string compare (isUnlocked).
 *
 * "unlock" and "recover" are the only actions allowed while locked — every
 * other action requires already being unlocked, so a passcode can never be
 * changed, removed, or read by someone who doesn't already have it.
 *
 * Biometric unlock (Touch ID / Face ID, see /api/webauthn) is a second way
 * to end up with the same cookie; it never replaces any of this.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const action = body?.action;

  if (action === "unlock") {
    const passcode = typeof body?.passcode === "string" ? body.passcode : "";
    const [row] = await sql<{ passcode_enc: string | null }[]>`
      select passcode_enc from user_settings where singleton = true
    `;
    if (!row?.passcode_enc || decryptPasscode(row.passcode_enc) !== passcode) {
      return NextResponse.json({ error: "That passcode isn't right" }, { status: 401 });
    }
    const res = NextResponse.json({ ok: true });
    res.cookies.set(PASSCODE_COOKIE, row.passcode_enc, COOKIE_OPTS);
    return res;
  }

  if (action === "recover") {
    const [row] = await sql<{ passcode_enc: string | null; notify_email: string }[]>`
      select passcode_enc, notify_email from user_settings where singleton = true
    `;
    if (!row?.passcode_enc) {
      return NextResponse.json({ error: "No passcode is set" }, { status: 400 });
    }
    const passcode = decryptPasscode(row.passcode_enc);
    const ok = await sendEmail({
      to: row.notify_email,
      subject: "Your System passcode",
      html: `<!doctype html><html><head><meta charset="utf-8" /></head><body style="margin:0;background:#110f0c;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:420px;background:#1b1813;border:1px solid #2a251c;border-radius:16px;padding:32px">
<tr><td>
<p style="margin:0 0 4px;color:#c9a05a;font-size:12px;font-weight:700;letter-spacing:2px">SYSTEM</p>
<h1 style="margin:0 0 16px;color:#ede6d8;font-size:20px">Your passcode</h1>
<p style="margin:0 0 12px;color:#ede6d8;font-size:15px;line-height:1.6">It's <strong style="letter-spacing:2px;font-size:20px">${passcode}</strong>.</p>
<p style="margin:0;color:#a39a87;font-size:14px;line-height:1.6">Change it from Settings once you're back in.</p>
</td></tr></table></td></tr></table></body></html>`,
    });
    if (!ok) return NextResponse.json({ error: "Couldn't send the email" }, { status: 502 });
    return NextResponse.json({ ok: true });
  }

  if (!(await isUnlocked())) return NextResponse.json({ error: "Locked" }, { status: 401 });

  if (action === "set") {
    const passcode = typeof body?.passcode === "string" ? body.passcode : "";
    if (passcode.length < 4 || passcode.length > 64) {
      return NextResponse.json({ error: "Use at least 4 characters" }, { status: 400 });
    }
    const [row] = await sql<{ passcode_enc: string | null }[]>`
      select passcode_enc from user_settings where singleton = true
    `;
    if (row?.passcode_enc) {
      return NextResponse.json(
        { error: "A passcode is already set — use Change instead" },
        { status: 400 }
      );
    }
    const enc = encryptPasscode(passcode);
    await sql`update user_settings set passcode_enc = ${enc}, updated_at = now() where singleton = true`;
    const res = NextResponse.json({ ok: true });
    res.cookies.set(PASSCODE_COOKIE, enc, COOKIE_OPTS);
    return res;
  }

  if (action === "change") {
    const current = typeof body?.currentPasscode === "string" ? body.currentPasscode : "";
    const next = typeof body?.newPasscode === "string" ? body.newPasscode : "";
    if (next.length < 4 || next.length > 64) {
      return NextResponse.json({ error: "New passcode needs at least 4 characters" }, { status: 400 });
    }
    const [row] = await sql<{ passcode_enc: string | null }[]>`
      select passcode_enc from user_settings where singleton = true
    `;
    if (!row?.passcode_enc || decryptPasscode(row.passcode_enc) !== current) {
      return NextResponse.json({ error: "Current passcode isn't right" }, { status: 401 });
    }
    const enc = encryptPasscode(next);
    await sql`update user_settings set passcode_enc = ${enc}, updated_at = now() where singleton = true`;
    const res = NextResponse.json({ ok: true });
    res.cookies.set(PASSCODE_COOKIE, enc, COOKIE_OPTS);
    return res;
  }

  if (action === "remove") {
    const passcode = typeof body?.passcode === "string" ? body.passcode : "";
    const [row] = await sql<{ passcode_enc: string | null }[]>`
      select passcode_enc from user_settings where singleton = true
    `;
    if (row?.passcode_enc && decryptPasscode(row.passcode_enc) !== passcode) {
      return NextResponse.json({ error: "That passcode isn't right" }, { status: 401 });
    }
    await sql`update user_settings set passcode_enc = null, updated_at = now() where singleton = true`;
    // Biometric unlock only exists on top of a passcode, so it goes with it.
    await removeAllCredentials();
    const res = NextResponse.json({ ok: true });
    res.cookies.delete(PASSCODE_COOKIE);
    return res;
  }

  if (action === "lock") {
    const res = NextResponse.json({ ok: true });
    res.cookies.delete(PASSCODE_COOKIE);
    return res;
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
