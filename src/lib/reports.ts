import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
  type DocumentSnapshot
} from 'firebase/firestore';
import { getFirebaseDb } from './firebase';
import { reportCreateSchema, reportUpdateSchema, type ReportCreateInput, type ReportUpdateInput } from './schemas';

export async function createReport(input: ReportCreateInput, uid: string) {
  const parsed = reportCreateSchema.parse(input);
  const anonymousPayload = parsed.isAnonymous
    ? { contactName: '', contactEmail: parsed.contactEmail ?? '', submitterUid: null }
    : {
        contactName: parsed.contactName ?? '',
        contactEmail: parsed.contactEmail ?? '',
        submitterUid: uid
      };

  return addDoc(collection(getFirebaseDb(), 'reports'), {
    type: parsed.type,
    title: parsed.title,
    description: parsed.description,
    category: parsed.category,
    group: parsed.group ?? '',
    isAnonymous: parsed.isAnonymous,
    ...anonymousPayload,
    image: parsed.image ?? null,
    imageReviewStatus: parsed.image ? 'hidden_until_review' : 'none',
    status: 'new',
    moderatorNotes: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function updateReport(id: string, input: ReportUpdateInput) {
  const parsed = reportUpdateSchema.parse(input);
  return updateDoc(doc(getFirebaseDb(), 'reports', id), {
    ...parsed,
    updatedAt: serverTimestamp()
  });
}

export async function getReport(id: string) {
  return getDoc(doc(getFirebaseDb(), 'reports', id));
}

export async function getReportsPage(options: { status?: string; type?: string; cursor?: DocumentSnapshot }) {
  const clauses = [];
  if (options.status && options.status !== 'all') clauses.push(where('status', '==', options.status));
  if (options.type && options.type !== 'all') clauses.push(where('type', '==', options.type));

  const base = [
    collection(getFirebaseDb(), 'reports'),
    ...clauses,
    orderBy('createdAt', 'desc'),
    limit(20)
  ] as const;

  const snapshot = await getDocs(options.cursor ? query(...base, startAfter(options.cursor)) : query(...base));
  return snapshot;
}
