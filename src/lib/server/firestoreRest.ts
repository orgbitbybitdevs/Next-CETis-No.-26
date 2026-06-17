export type RoleName = 'moderator' | 'superuser';
type FirestoreField =
  | { stringValue: string }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { timestampValue: string }
  | { nullValue: null }
  | { arrayValue: { values: FirestoreField[] } }
  | { mapValue: { fields: Record<string, FirestoreField> } };

function documentUrl(projectId: string, path: string) {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`;
}

function fieldValue(value: unknown): FirestoreField {
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number' && Number.isInteger(value)) return { integerValue: String(value) };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (value === null || value === undefined) return { nullValue: null };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(fieldValue) } };
  if (typeof value === 'object') {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, fieldValue(item)])
        )
      }
    };
  }

  return { stringValue: String(value) };
}

function parseField(field: any): unknown {
  if ('stringValue' in field) return field.stringValue;
  if ('booleanValue' in field) return field.booleanValue;
  if ('integerValue' in field) return Number(field.integerValue);
  if ('doubleValue' in field) return Number(field.doubleValue);
  if ('timestampValue' in field) return field.timestampValue;
  if ('arrayValue' in field) return (field.arrayValue.values ?? []).map(parseField);
  if ('mapValue' in field) {
    return Object.fromEntries(
      Object.entries(field.mapValue.fields ?? {}).map(([key, value]) => [key, parseField(value)])
    );
  }
  return null;
}

export async function getRole(projectId: string, idToken: string, uid: string) {
  const response = await fetch(documentUrl(projectId, `roles/${uid}`), {
    headers: { Authorization: `Bearer ${idToken}` }
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Response('Unable to read role document.', { status: 403 });
  }

  const doc = (await response.json()) as { fields?: Record<string, unknown> };
  const data = Object.fromEntries(
    Object.entries(doc.fields ?? {}).map(([key, value]) => [key, parseField(value)])
  ) as { role?: RoleName; active?: boolean };

  if (data.active === false) {
    return null;
  }

  return data.role ?? null;
}

async function getRateLimit(projectId: string, idToken: string, id: string) {
  const response = await fetch(documentUrl(projectId, `rateLimits/${id}`), {
    headers: { Authorization: `Bearer ${idToken}` }
  });

  if (response.status === 404) return { count: 0 };
  if (!response.ok) throw new Response('Rate limit check failed.', { status: 429 });
  const doc = (await response.json()) as { fields?: Record<string, unknown> };
  const data = Object.fromEntries(
    Object.entries(doc.fields ?? {}).map(([key, value]) => [key, parseField(value)])
  ) as { count?: number };
  return { count: data.count ?? 0 };
}

export async function writeRateLimit(
  projectId: string,
  idToken: string,
  id: string,
  data: Record<string, unknown>,
  max = 5
) {
  const current = await getRateLimit(projectId, idToken, id);
  if (current.count >= max) {
    throw new Response('Daily rate limit reached.', { status: 429 });
  }

  const response = await fetch(documentUrl(projectId, `rateLimits/${id}`), {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fields: Object.fromEntries(
        Object.entries({ ...data, count: current.count + 1 }).map(([key, value]) => [key, fieldValue(value)])
      )
    })
  });

  if (!response.ok) {
    throw new Response('Rate limit check failed.', { status: 429 });
  }
}

export async function assertModerator(projectId: string, idToken: string, uid: string) {
  const role = await getRole(projectId, idToken, uid);
  if (role !== 'moderator' && role !== 'superuser') {
    throw new Response('Moderator role required.', { status: 403 });
  }

  return role;
}
