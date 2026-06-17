import { collection, doc, getDocs, limit, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { roleWriteSchema } from '@/lib/schemas';
import { requireModerator, wireLogout } from './roleClient';

const form = document.querySelector<HTMLFormElement>('#role-form');
const list = document.querySelector<HTMLElement>('#roles-list');
const message = document.querySelector<HTMLElement>('#roles-message');

function setMessage(text: string) {
  if (!message) return;
  message.textContent = text;
  message.classList.remove('hidden');
}

async function loadRoles() {
  if (!list) return;
  const snapshot = await getDocs(query(collection(getFirebaseDb(), 'roles'), orderBy('updatedAt', 'desc'), limit(20)));
  list.innerHTML = '';
  snapshot.docs.forEach((item) => {
    const data = item.data();
    const row = document.createElement('div');
    row.className = 'grid gap-2 border-b border-zinc-100 px-4 py-3 text-sm transition hover:bg-zinc-50/70 sm:grid-cols-4';
    row.innerHTML = `
      <span class="font-mono text-xs">${item.id}</span>
      <span>${data.displayName || 'Sin nombre'}</span>
      <span class="font-semibold">${data.role}</span>
      <span>${data.active === false ? 'Inactivo' : 'Activo'}</span>
    `;
    list.appendChild(row);
  });
}

await requireModerator(true);
wireLogout();
await loadRoles();

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const parsed = roleWriteSchema.parse({
    uid: String(data.get('uid') ?? ''),
    role: String(data.get('role') ?? ''),
    displayName: String(data.get('displayName') ?? ''),
    email: String(data.get('email') ?? ''),
    active: data.get('active') === 'on'
  });

  await setDoc(
    doc(getFirebaseDb(), 'roles', parsed.uid),
    {
      role: parsed.role,
      displayName: parsed.displayName ?? '',
      email: parsed.email ?? '',
      active: parsed.active,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
  setMessage('Rol guardado.');
  form.reset();
  await loadRoles();
});
