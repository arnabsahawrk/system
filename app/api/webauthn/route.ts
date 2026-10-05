import { NextResponse } from "next/server";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import sql from "@/lib/db";
import { isUnlocked, PASSCODE_COOKIE, UNLOCK_COOKIE_OPTS } from "@/lib/session";
import {
  ALGORITHMS,
  RP_NAME,
  TRANSPORTS,
  cleanLabel,
  consumeChallenge,
  findCredential,
  isMissingTable,
  listCredentials,
  markCredentialUsed,
  relyingParty,
  removeCredential,
  saveCredential,
  storeChallenge,
} from "@/lib/webauthn";

type Body = Record<string, unknown>;

/** Biometric unlock: a second way past the passcode, never a replacement.
 *
 * Two actions work while the app is locked, because getting in is their
 * whole job:
 *   unlock-options  hands out a one-time challenge for a known credential
 *   unlock-verify   checks the device's signed answer and, if it holds up,
 *                   sets the same unlock cookie a correct passcode does
 *
 * Everything else (register-*, list, remove) needs the app to be unlocked
 * already, with a passcode set. So a new device can only ever be added by
 * someone who got in the normal way. */
export async function POST(req: Request) {
  const body: Body = await req.json().catch(() => ({}));

  try {
    switch (body.action) {
      case "unlock-options":
        return await unlockOptions(req, body);
      case "unlock-verify":
        return await unlockVerify(req, body);
      case "register-options":
        return await registerOptions(req);
      case "register-verify":
        return await registerVerify(req, body);
      case "list":
        return await list();
      case "remove":
        return await remove(body);
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json(
        { error: "Biometric tables are missing. Run section 5 of schema.sql in Neon." },
        { status: 503 },
      );
    }
    console.error("webauthn:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

async function passcodeValue(): Promise<string | null> {
  const [row] = await sql<{ passcode_enc: string | null }[]>`
    select passcode_enc from user_settings where singleton = true
  `;
  return row?.passcode_enc ?? null;
}

/** For everything that changes what can unlock the app: a passcode must
 * exist, and this request must already be past it. */
async function requireSession(): Promise<NextResponse | null> {
  if (!(await passcodeValue())) {
    return NextResponse.json({ error: "Set a passcode first" }, { status: 400 });
  }
  if (!(await isUnlocked())) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }
  return null;
}

// ---------- unlocking (works while locked) ----------

async function unlockOptions(req: Request, body: Body) {
  const id = typeof body.credentialId === "string" ? body.credentialId : "";
  const credential = id.length > 0 && id.length <= 1024 ? await findCredential(id) : null;
  // Same answer whether the credential is unknown or no passcode is set, and
  // challenges are only ever issued for a credential that really exists, so
  // this can't be used to fill the table.
  if (!credential || !(await passcodeValue())) {
    return NextResponse.json({ error: "Unknown credential" }, { status: 404 });
  }

  const { rpID } = relyingParty(req);
  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: [{ id: credential.id, transports: TRANSPORTS }],
    userVerification: "required",
    timeout: 60_000,
  });
  await storeChallenge("unlock", options.challenge);
  return NextResponse.json(options);
}

async function unlockVerify(req: Request, body: Body) {
  const response = body.response as AuthenticationResponseJSON | undefined;
  const refused = () => NextResponse.json({ error: "Couldn't verify it" }, { status: 401 });

  if (!response || typeof response.id !== "string" || response.id.length > 1024) return refused();

  const [credential, passcode] = await Promise.all([findCredential(response.id), passcodeValue()]);
  if (!credential || !passcode) return refused();

  const { rpID, origin } = relyingParty(req);
  try {
    const result = await verifyAuthenticationResponse({
      response,
      // Checked against, and deleted from, the table in one step: a
      // challenge can be answered once and only once.
      expectedChallenge: (challenge) => consumeChallenge("unlock", challenge),
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: { id: credential.id, publicKey: credential.publicKey, counter: credential.counter },
      requireUserVerification: true,
    });
    if (!result.verified) return refused();
    await markCredentialUsed(credential.id, result.authenticationInfo.newCounter);
  } catch (err) {
    console.warn("webauthn unlock refused:", err instanceof Error ? err.message : err);
    return refused();
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(PASSCODE_COOKIE, passcode, UNLOCK_COOKIE_OPTS);
  return res;
}

// ---------- adding a device (unlocked only) ----------

async function registerOptions(req: Request) {
  const blocked = await requireSession();
  if (blocked) return blocked;

  const { rpID } = relyingParty(req);
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userName: RP_NAME,
    userDisplayName: RP_NAME,
    attestationType: "none",
    supportedAlgorithmIDs: ALGORITHMS,
    timeout: 60_000,
    authenticatorSelection: {
      // The sensor in the device itself, never a USB security key.
      authenticatorAttachment: "platform",
      userVerification: "required",
      residentKey: "discouraged",
    },
  });
  await storeChallenge("register", options.challenge);
  return NextResponse.json(options);
}

async function registerVerify(req: Request, body: Body) {
  const blocked = await requireSession();
  if (blocked) return blocked;

  const response = body.response as RegistrationResponseJSON | undefined;
  if (!response || typeof response.id !== "string") {
    return NextResponse.json({ error: "Missing response" }, { status: 400 });
  }

  const { rpID, origin } = relyingParty(req);
  let result;
  try {
    result = await verifyRegistrationResponse({
      response,
      expectedChallenge: (challenge) => consumeChallenge("register", challenge),
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      supportedAlgorithmIDs: ALGORITHMS,
    });
  } catch (err) {
    console.warn("webauthn register refused:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Couldn't verify this device" }, { status: 400 });
  }
  if (!result.verified) {
    return NextResponse.json({ error: "Couldn't verify this device" }, { status: 400 });
  }

  const { credential } = result.registrationInfo;
  await saveCredential({
    id: credential.id,
    publicKey: credential.publicKey,
    counter: credential.counter,
    label: cleanLabel(body.label),
  });
  return NextResponse.json({ ok: true, credentialId: credential.id });
}

// ---------- managing devices (unlocked only) ----------

async function list() {
  const blocked = await requireSession();
  if (blocked) return blocked;
  return NextResponse.json({ devices: await listCredentials() });
}

async function remove(body: Body) {
  const blocked = await requireSession();
  if (blocked) return blocked;

  const id = typeof body.credentialId === "string" ? body.credentialId : "";
  if (!id || id.length > 1024) {
    return NextResponse.json({ error: "Missing credential" }, { status: 400 });
  }
  await removeCredential(id);
  return NextResponse.json({ ok: true });
}
