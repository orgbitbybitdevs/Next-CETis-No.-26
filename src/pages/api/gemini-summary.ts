import type { APIRoute } from 'astro';
import { geminiSummarySchema } from '@/lib/schemas';
import { verifyFirebaseIdToken } from '@/lib/server/firebaseAuth';
import { assertModerator } from '@/lib/server/firestoreRest';

const instruction = `Return only JSON with keys summary, category, priority, sentiment, riskFlags, recommendedAction.
The output is advisory for school moderators. Do not make final decisions.`;

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const env = (locals as any).runtime?.env ?? import.meta.env;
    const projectId = env.PUBLIC_FIREBASE_PROJECT_ID;
    const idToken = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    const user = await verifyFirebaseIdToken(request, projectId);
    await assertModerator(projectId, idToken, user.uid);

    if (!env.GEMINI_API_KEY) {
      return new Response('Gemini server key is not configured.', { status: 501 });
    }

    const body = (await request.json()) as { title?: string; description?: string };
    const prompt = `${instruction}\n\nTitle: ${body.title ?? ''}\nDescription: ${body.description ?? ''}`;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      }
    );

    if (!response.ok) {
      return new Response('Gemini request failed.', { status: 502 });
    }

    const data = (await response.json()) as any;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
    const parsed = geminiSummarySchema.parse(JSON.parse(text));
    return Response.json(parsed);
  } catch (error) {
    if (error instanceof Response) return error;
    return new Response('Unable to generate summary.', { status: 500 });
  }
};
