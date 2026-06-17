import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { getFirebaseAuth, initAppCheck } from '@/lib/firebase';

export type RoleCheck = {
  uid: string;
  email: string | null;
  role: 'moderator' | 'superuser' | null;
  isModerator: boolean;
  isSuperuser: boolean;
};

export async function checkRole(user: User): Promise<RoleCheck> {
  const token = await user.getIdToken();
  const response = await fetch('/api/check-role', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    throw new Error('No se pudo verificar el rol.');
  }

  return response.json();
}

export async function requireModerator(superuserOnly = false) {
  initAppCheck();
  const auth = getFirebaseAuth();

  return new Promise<{ user: User; role: RoleCheck }>((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = '/login';
        return;
      }

      try {
        const role = await checkRole(user);
        if (!role.isModerator || (superuserOnly && !role.isSuperuser)) {
          window.location.href = '/login?denied=1';
          return;
        }

        const badge = document.querySelector<HTMLElement>('#role-badge');
        if (badge) {
          badge.textContent = role.role === 'superuser' ? 'Superusuario' : 'Moderador';
          badge.className = 'status-pill bg-blue-50 text-lagoon shadow-sm';
        }
        document.querySelector('#roles-link')?.classList.toggle('hidden', !role.isSuperuser);
        resolve({ user, role });
      } catch {
        window.location.href = '/login';
      }
    });
  });
}

export function wireLogout() {
  document.querySelector('#logout-button')?.addEventListener('click', async () => {
    await signOut(getFirebaseAuth());
    window.location.href = '/login';
  });
}
