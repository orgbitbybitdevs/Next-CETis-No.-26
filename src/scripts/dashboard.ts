import type { DocumentSnapshot } from 'firebase/firestore';
import { getReportsPage } from '@/lib/reports';
import { requireModerator, wireLogout } from './roleClient';

let cursor: DocumentSnapshot | undefined;
const tbody = document.querySelector<HTMLTableSectionElement>('#reports-body');
const loadMore = document.querySelector<HTMLButtonElement>('#load-more');
const statusFilter = document.querySelector<HTMLSelectElement>('#status-filter');
const typeFilter = document.querySelector<HTMLSelectElement>('#type-filter');

function label(value: string) {
  const map: Record<string, string> = {
    complaint: 'Queja',
    suggestion: 'Sugerencia',
    new: 'Nuevo',
    in_review: 'En revisión',
    resolved: 'Resuelto',
    rejected: 'Rechazado'
  };
  return map[value] ?? value;
}

function renderRow(id: string, data: any) {
  const tr = document.createElement('tr');
  tr.className = 'border-b border-zinc-100 transition hover:bg-zinc-50/70';
  const createdAt = data.createdAt?.toDate?.().toLocaleString('es-MX') ?? 'Pendiente';
  tr.innerHTML = `
    <td class="px-4 py-3 font-semibold text-ink"><a class="hover:text-lagoon" href="/dashboard/${id}">${data.title}</a></td>
    <td class="px-4 py-3">${label(data.type)}</td>
    <td class="px-4 py-3">${label(data.status)}</td>
    <td class="px-4 py-3">${data.category}</td>
    <td class="px-4 py-3">${createdAt}</td>
  `;
  tbody?.appendChild(tr);
}

async function load(reset = false) {
  if (!tbody) return;
  loadMore?.setAttribute('disabled', 'true');
  if (reset) {
    tbody.innerHTML = '';
    cursor = undefined;
  }

  const snapshot = await getReportsPage({
    status: statusFilter?.value,
    type: typeFilter?.value,
    cursor
  });

  snapshot.docs.forEach((item) => renderRow(item.id, item.data()));
  cursor = snapshot.docs.at(-1);
  loadMore?.toggleAttribute('disabled', snapshot.docs.length < 20);
}

await requireModerator();
wireLogout();
await load(true);
loadMore?.addEventListener('click', () => void load(false));
statusFilter?.addEventListener('change', () => void load(true));
typeFilter?.addEventListener('change', () => void load(true));
