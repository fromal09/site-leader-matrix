import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "slm_auth";
const ALG = "HS256";

function getSecret() {
  const secret = process.env.AUTH_SECRET || process.env.SITE_PASSWORD || "dev-secret-change-me";
  return new TextEncoder().encode(secret);
}

export type Network = "fansided" | "onsi";
export type Session = { name: string; network: Network };

export async function createSession(name: string, network: Network) {
  const token = await new SignJWT({ name, network })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.name === "string") {
      const network: Network = payload.network === "onsi" ? "onsi" : "fansided";
      return { name: payload.name, network };
    }
    return null;
  } catch {
    return null;
  }
}
