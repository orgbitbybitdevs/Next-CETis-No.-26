import { decodeProtectedHeader, importX509, jwtVerify, type JWTPayload } from 'jose';

const certUrl =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

type CertCache = {
  expiresAt: number;
  certs: Record<string, string>;
};

let certCache: CertCache | undefined;

async function getCerts() {
  const now = Date.now();
  if (certCache && certCache.expiresAt > now) {
    return certCache.certs;
  }

  const response = await fetch(certUrl);
  if (!response.ok) {
    throw new Error('Unable to fetch Firebase token certificates.');
  }

  const cacheControl = response.headers.get('cache-control') ?? '';
  const maxAgeMatch = /max-age=(\d+)/.exec(cacheControl);
  const maxAge = maxAgeMatch ? Number(maxAgeMatch[1]) * 1000 : 60 * 60 * 1000;

  certCache = {
    expiresAt: now + maxAge,
    certs: (await response.json()) as Record<string, string>
  };

  return certCache.certs;
}

export async function verifyFirebaseIdToken(request: Request, projectId: string) {
  const header = request.headers.get('authorization') ?? '';
  const match = /^Bearer (.+)$/.exec(header);
  if (!match) {
    throw new Response('Missing Firebase ID token.', { status: 401 });
  }

  const token = match[1];
  const protectedHeader = decodeProtectedHeader(token);

  if (!protectedHeader.kid || protectedHeader.alg !== 'RS256') {
    throw new Response('Invalid Firebase ID token header.', { status: 401 });
  }

  const certs = await getCerts();
  const cert = certs[protectedHeader.kid];
  if (!cert) {
    throw new Response('Unknown Firebase token certificate.', { status: 401 });
  }

  const key = await importX509(cert, 'RS256');
  const result = await jwtVerify(token, key, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId
  });

  const payload = result.payload as JWTPayload & {
    user_id?: string;
    email?: string;
    firebase?: { sign_in_provider?: string };
  };

  const uid = payload.sub ?? payload.user_id;
  if (!uid) {
    throw new Response('Firebase token is missing uid.', { status: 401 });
  }

  return {
    uid,
    email: payload.email,
    signInProvider: payload.firebase?.sign_in_provider,
    payload
  };
}
