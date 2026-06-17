import type { APIRoute } from 'astro';
import { verifyFirebaseIdToken } from '@/lib/server/firebaseAuth';
import { getRole } from '@/lib/server/firestoreRest';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const env = (locals as any).runtime?.env ?? import.meta.env;
    const projectId = env.PUBLIC_FIREBASE_PROJECT_ID;
    const authHeader = request.headers.get('authorization') ?? '';
    const idToken = authHeader.replace(/^Bearer\s+/i, '');
    const user = await verifyFirebaseIdToken(request, projectId);
    const role = await getRole(projectId, idToken, user.uid);

    return Response.json({
      uid: user.uid,
      email: user.email ?? null,
      role,
      isModerator: role === 'moderator' || role === 'superuser',
      isSuperuser: role === 'superuser'
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return new Response('Unable to check role.', { status: 500 });
  }
};
