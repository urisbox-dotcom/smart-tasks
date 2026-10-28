// אימות בסיסמה אחת. קוקי חתום ב-HMAC (Web Crypto, עובד גם ב-proxy).
export const COOKIE_NAME = "tasks_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const enc = new TextEncoder();

async function hmac(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(password: string): Promise<string> {
  const exp = Date.now() + MAX_AGE_SECONDS * 1000;
  const sig = await hmac(`session.${exp}`, password);
  return `${exp}.${sig}`;
}

export async function verifySessionToken(token: string | undefined, password: string | undefined) {
  if (!token || !password) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const expected = await hmac(`session.${exp}`, password);
  return safeEqual(sig, expected);
}

export async function passwordMatches(input: string, password: string | undefined) {
  if (!password) return false;
  // משווים גיבובים כדי לא לדלוף אורך
  const [a, b] = await Promise.all([hmac(input, "pw"), hmac(password, "pw")]);
  return safeEqual(a, b);
}

export const SESSION_MAX_AGE = MAX_AGE_SECONDS;
