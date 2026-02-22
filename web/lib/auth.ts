import { SignJWT, jwtVerify } from 'jose'

const getSecret = () => {
  const secret = process.env.JWT_SECRET || 'betwhisper-dev-secret-change-in-prod'
  return new TextEncoder().encode(secret)
}

export async function signJWT(payload: { wallet: string }, expiresInSeconds = 300): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${expiresInSeconds}s`)
    .sign(getSecret())
}

export async function verifyJWT(token: string): Promise<{ wallet: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] })
    return payload as { wallet: string }
  } catch {
    return null
  }
}

export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null
  return authHeader.slice(7)
}
