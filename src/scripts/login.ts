import { signInWithEmailAndPassword } from 'firebase/auth';
import { getFirebaseAuth, initAppCheck } from '@/lib/firebase';
import { checkRole } from './roleClient';

const form = document.querySelector<HTMLFormElement>('#login-form');
const errorBox = document.querySelector<HTMLElement>('#login-error');
const emailInput = document.querySelector<HTMLInputElement>('#email');
const passwordInput = document.querySelector<HTMLInputElement>('#password');
const emailError = document.querySelector<HTMLElement>('#login-email-error');
const passwordError = document.querySelector<HTMLElement>('#login-password-error');

function showError(message: string) {
  if (!errorBox) return;
  errorBox.textContent = message;
  errorBox.classList.remove('hidden');
}

function setInlineError(box: HTMLElement | null, message = '') {
  if (!box) return;
  box.textContent = message;
  box.classList.toggle('hidden', !message);
}

function validateLogin() {
  let valid = true;
  setInlineError(emailError);
  setInlineError(passwordError);

  if (!emailInput?.value.trim()) {
    setInlineError(emailError, 'Ingresa tu correo institucional.');
    valid = false;
  }

  if (!passwordInput?.value) {
    setInlineError(passwordError, 'Ingresa tu contraseña.');
    valid = false;
  }

  return valid;
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorBox?.classList.add('hidden');
  if (!validateLogin()) return;

  const data = new FormData(form);
  const submitButton = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const submitText = submitButton?.querySelector('span');
  const submitLabel = submitButton?.dataset.submitLabel ?? submitText?.textContent ?? '';
  const loadingLabel = submitButton?.dataset.loadingLabel ?? 'Verificando...';
  submitButton?.setAttribute('disabled', 'true');
  if (submitText) submitText.textContent = loadingLabel;

  try {
    initAppCheck();
    const credential = await signInWithEmailAndPassword(
      getFirebaseAuth(),
      String(data.get('email') ?? ''),
      String(data.get('password') ?? '')
    );
    const role = await checkRole(credential.user);
    if (!role.isModerator) {
      showError('Tu cuenta no tiene rol de moderacion.');
      return;
    }
    window.location.href = '/dashboard';
  } catch {
    showError('No se pudo iniciar sesion o verificar el rol.');
  } finally {
    submitButton?.removeAttribute('disabled');
    if (submitText) submitText.textContent = submitLabel;
  }
});
