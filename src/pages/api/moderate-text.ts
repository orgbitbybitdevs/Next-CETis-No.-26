import type { APIRoute } from 'astro';
import { verifyFirebaseIdToken } from '@/lib/server/firebaseAuth';
import { assertModerator } from '@/lib/server/firestoreRest';

const riskyTerms = ['arma', 'amenaza', 'suicidio', 'acoso', 'violencia', 'extorsion'];

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const env = (locals as any).runtime?.env ?? import.meta.env;
    const projectId = env.PUBLIC_FIREBASE_PROJECT_ID;
    const idToken = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    const user = await verifyFirebaseIdToken(request, projectId);
    await assertModerator(projectId, idToken, user.uid);

    const body = (await request.json()) as { text?: string };
    const text = (body.text ?? '').toLowerCase();
    const flags = riskyTerms.filter((term) => text.includes(term));

    return Response.json({
      flags,
      needsUrgentReview: flags.length > 0,
      advisoryOnly: true
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return new Response('Unable to moderate text.', { status: 500 });
  }
};
