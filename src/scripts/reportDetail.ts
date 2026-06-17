import { getReport, updateReport } from '@/lib/reports';
import { getFirebaseAuth } from '@/lib/firebase';
import { requireModerator, wireLogout } from './roleClient';
import { geminiSummarySchema, type GeminiSummary } from '@/lib/schemas';

const root = document.querySelector<HTMLElement>('#report-detail');
const reportId = root?.dataset.reportId ?? '';
const content = document.querySelector<HTMLElement>('#report-content');
const form = document.querySelector<HTMLFormElement>('#review-form');
const geminiButton = document.querySelector<HTMLButtonElement>('#gemini-button');
const geminiLocalButton = document.querySelector<HTMLButtonElement>('#gemini-local-button');
const geminiOutput = document.querySelector<HTMLElement>('#gemini-output');

function renderSummary(summary: GeminiSummary) {
  if (!geminiOutput) return;
  geminiOutput.classList.remove('hidden');
  geminiOutput.textContent = JSON.stringify(summary, null, 2);
}

function renderReport(data: any) {
  if (!content || !form) return;
  const identity = data.isAnonymous
    ? 'Anonimo'
    : `${data.contactName || 'Sin nombre'} ${data.contactEmail ? `<${data.contactEmail}>` : ''}`;
  content.innerHTML = `
    <section class="apple-panel grid gap-4 p-6 sm:p-8">
      <div>
        <p class="text-sm font-semibold text-lagoon">${data.type === 'complaint' ? 'Queja' : 'Sugerencia'}</p>
        <h1 class="mt-2 text-3xl font-semibold sm:text-4xl">${data.title}</h1>
      </div>
      <dl class="grid gap-3 text-sm sm:grid-cols-3">
        <div><dt class="font-semibold">Categoria</dt><dd>${data.category}</dd></div>
        <div><dt class="font-semibold">Estado</dt><dd>${data.status}</dd></div>
        <div><dt class="font-semibold">Identidad</dt><dd>${identity}</dd></div>
      </dl>
      <p class="whitespace-pre-wrap leading-7 text-zinc-700">${data.description}</p>
      ${
        data.image?.secureUrl
          ? `<div class="rounded-md border border-zinc-200/80 bg-zinc-50/70 p-3">
              <p class="mb-2 text-sm font-semibold">Imagen: ${data.imageReviewStatus}</p>
              <img src="${data.image.secureUrl}" alt="Evidencia del reporte" class="max-h-[520px] rounded-md object-contain" />
            </div>`
          : ''
      }
    </section>
  `;
  form.status.value = data.status;
  form.moderatorNotes.value = data.moderatorNotes ?? '';
  form.imageReviewStatus.value = data.imageReviewStatus ?? 'none';
  form.dataset.title = data.title;
  form.dataset.description = data.description;
}

await requireModerator();
wireLogout();
const snapshot = await getReport(reportId);
if (snapshot.exists()) {
  renderReport(snapshot.data());
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  await updateReport(reportId, {
    status: String(data.get('status')) as any,
    moderatorNotes: String(data.get('moderatorNotes') ?? ''),
    imageReviewStatus: String(data.get('imageReviewStatus')) as any
  });
  window.location.reload();
});

geminiButton?.addEventListener('click', async () => {
  const user = getFirebaseAuth().currentUser;
  if (!user || !form) return;
  const response = await fetch('/api/gemini-summary', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await user.getIdToken()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ title: form.dataset.title, description: form.dataset.description })
  });
  if (response.ok) renderSummary(await response.json());
});

geminiLocalButton?.addEventListener('click', async () => {
  if (!form) return;
  const key = window.localStorage.getItem('gemini_api_key') || window.prompt('Gemini API key local');
  if (!key) return;
  window.localStorage.setItem('gemini_api_key', key);
  const prompt = `Return only JSON with summary, category, priority, sentiment, riskFlags, recommendedAction.\nTitle: ${form.dataset.title}\nDescription: ${form.dataset.description}`;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' }
    })
  });
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
  renderSummary(geminiSummarySchema.parse(JSON.parse(text)));
});
