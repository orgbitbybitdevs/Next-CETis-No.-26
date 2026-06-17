import { doc, runTransaction, Timestamp } from 'firebase/firestore';
import { ensureAnonymousUser, getFirebaseDb, initAppCheck } from '@/lib/firebase';
import { createReport } from '@/lib/reports';
import { prepareReportImage, uploadUnsignedComplaintImage } from '@/lib/cloudinary';
import { reportCreateSchema } from '@/lib/schemas';

const form = document.querySelector<HTMLFormElement>('#report-form');
const errorBox = document.querySelector<HTMLElement>('#form-error');
const successBox = document.querySelector<HTMLElement>('#form-success');
const anonymous = document.querySelector<HTMLInputElement>('#anonymous');
const anonymousContact = document.querySelector<HTMLElement>('#anonymous-contact');
const wantsContactEmail = document.querySelector<HTMLInputElement>('#wants-contact-email');
const anonymousContactEmailWrap = document.querySelector<HTMLElement>('#anonymous-contact-email-wrap');
const anonymousContactEmail = document.querySelector<HTMLInputElement>('#anonymousContactEmail');
const contactFields = document.querySelector<HTMLElement>('#contact-fields');
const identityContactEmail = document.querySelector<HTMLInputElement>('#identityContactEmail');
const contactEmail = document.querySelector<HTMLInputElement>('#contactEmail');
const imageInput = document.querySelector<HTMLInputElement>('#image');
const imageDropzone = document.querySelector<HTMLElement>('#image-dropzone');
const imagePreview = document.querySelector<HTMLElement>('#image-preview');
const imagePreviewImg = document.querySelector<HTMLImageElement>('#image-preview-img');
const imagePreviewName = document.querySelector<HTMLElement>('#image-preview-name');

function setFieldError(field: string, message = '') {
  const box = document.querySelector<HTMLElement>(`[data-field-error="${field}"]`);
  if (!box) return;
  box.textContent = message;
  box.classList.toggle('hidden', !message);
}

function syncContactEmail() {
  if (!contactEmail) return;
  contactEmail.value = anonymous?.checked
    ? wantsContactEmail?.checked
      ? (anonymousContactEmail?.value ?? '')
      : ''
    : (identityContactEmail?.value ?? '');
}

function show(box: HTMLElement | null, message: string) {
  if (!box) return;
  box.textContent = message;
  box.classList.remove('hidden');
}

function hide(box: HTMLElement | null) {
  box?.classList.add('hidden');
}

function todayId() {
  return new Date().toISOString().slice(0, 10);
}

anonymous?.addEventListener('change', () => {
  if (contactFields) {
    contactFields.hidden = anonymous.checked;
  }
  if (anonymousContact) {
    anonymousContact.hidden = !anonymous.checked;
  }
  syncContactEmail();
});

wantsContactEmail?.addEventListener('change', () => {
  if (anonymousContactEmailWrap) {
    anonymousContactEmailWrap.hidden = !wantsContactEmail.checked;
  }
  if (!wantsContactEmail.checked && anonymousContactEmail) {
    anonymousContactEmail.value = '';
  }
  syncContactEmail();
});

anonymousContactEmail?.addEventListener('input', syncContactEmail);
identityContactEmail?.addEventListener('input', syncContactEmail);

imageInput?.addEventListener('change', () => {
  const file = imageInput.files?.[0];
  setFieldError('image');
  if (!file || !imagePreview || !imagePreviewImg || !imagePreviewName) {
    imagePreview?.classList.add('hidden');
    return;
  }
  if (!file.type.startsWith('image/')) {
    setFieldError('image', 'Selecciona una imagen válida.');
    imagePreview.classList.add('hidden');
    return;
  }
  imagePreviewImg.src = URL.createObjectURL(file);
  imagePreviewName.textContent = file.name;
  imagePreview.classList.remove('hidden');
});

imageDropzone?.addEventListener('dragover', (event) => {
  event.preventDefault();
  imageDropzone.classList.add('border-rosewood', 'bg-rosewood/5');
});

imageDropzone?.addEventListener('dragleave', () => {
  imageDropzone.classList.remove('border-rosewood', 'bg-rosewood/5');
});

imageDropzone?.addEventListener('drop', (event) => {
  event.preventDefault();
  imageDropzone.classList.remove('border-rosewood', 'bg-rosewood/5');
  const file = event.dataTransfer?.files[0];
  if (!file || !imageInput) return;
  const files = new DataTransfer();
  files.items.add(file);
  imageInput.files = files.files;
  imageInput.dispatchEvent(new Event('change', { bubbles: true }));
});

function validateForm() {
  let valid = true;
  const title = form?.querySelector<HTMLInputElement>('#title');
  const description = form?.querySelector<HTMLTextAreaElement>('#description');
  syncContactEmail();

  setFieldError('title');
  setFieldError('description');
  setFieldError('contactEmail');
  setFieldError('identityContactEmail');
  setFieldError('image');

  if ((title?.value.trim().length ?? 0) < 8) {
    setFieldError('title', 'Escribe un título de al menos 8 caracteres.');
    valid = false;
  }

  if ((description?.value.trim().length ?? 0) < 30) {
    setFieldError('description', 'Describe la situación con al menos 30 caracteres.');
    valid = false;
  }

  if (!anonymous?.checked && !identityContactEmail?.value.trim()) {
    setFieldError('identityContactEmail', 'Agrega un correo si decides identificarte.');
    valid = false;
  }

  if (!anonymous?.checked && identityContactEmail?.value && !identityContactEmail.validity.valid) {
    setFieldError('identityContactEmail', 'Ingresa un correo válido.');
    valid = false;
  }

  if (anonymous?.checked && wantsContactEmail?.checked && anonymousContactEmail?.value && !anonymousContactEmail.validity.valid) {
    setFieldError('contactEmail', 'Ingresa un correo válido.');
    valid = false;
  }

  if (imageInput?.files?.[0] && imageInput.files[0].size > 2_000_000) {
    setFieldError('image', 'La imagen no debe superar 2 MB.');
    valid = false;
  }

  return valid;
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  hide(errorBox);
  hide(successBox);
  if (!validateForm()) return;

  const submitButton = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const submitText = submitButton?.querySelector('span');
  const submitLabel = submitButton?.dataset.submitLabel ?? submitText?.textContent ?? '';
  const loadingLabel = submitButton?.dataset.loadingLabel ?? 'Enviando...';
  submitButton?.setAttribute('disabled', 'true');
  if (submitText) submitText.textContent = loadingLabel;

  try {
    initAppCheck();
    const user = await ensureAnonymousUser();
    const formData = new FormData(form);
    const type = form.dataset.reportType === 'complaint' ? 'complaint' : 'suggestion';
    const imageFile = formData.get('image');
    let image;

    const limitRef = doc(getFirebaseDb(), 'rateLimits', `${user.uid}_${todayId()}_submit`);
    await runTransaction(getFirebaseDb(), async (transaction) => {
      const snapshot = await transaction.get(limitRef);
      const count = snapshot.exists() ? Number(snapshot.data().count ?? 0) : 0;
      if (count >= 5) {
        throw new Error('Llegaste al limite diario de envios.');
      }
      transaction.set(limitRef, {
        uid: user.uid,
        scope: 'reportSubmit',
        day: todayId(),
        count: count + 1,
        updatedAt: Timestamp.now()
      });
    });

    if (type === 'complaint' && imageFile instanceof File && imageFile.size > 0) {
      const prepared = await prepareReportImage(imageFile);
      const uploaded = await uploadUnsignedComplaintImage({
        file: prepared,
        uid: user.uid,
        idToken: await user.getIdToken()
      });
      image = {
        publicId: uploaded.public_id,
        secureUrl: uploaded.secure_url,
        width: uploaded.width,
        height: uploaded.height,
        bytes: uploaded.bytes,
        format: uploaded.format as 'jpg' | 'jpeg' | 'png' | 'webp'
      };
    }

    const payload = reportCreateSchema.parse({
      type,
      title: String(formData.get('title') ?? ''),
      category: String(formData.get('category') ?? ''),
      description: String(formData.get('description') ?? ''),
      isAnonymous: formData.get('isAnonymous') === 'on',
      contactName: String(formData.get('contactName') ?? ''),
      contactEmail: String(formData.get('contactEmail') ?? ''),
      group: String(formData.get('group') ?? ''),
      image
    });

    await createReport(payload, user.uid);
    form.reset();
    if (contactFields) contactFields.hidden = true;
    if (anonymousContact) anonymousContact.hidden = false;
    if (anonymousContactEmailWrap) anonymousContactEmailWrap.hidden = true;
    imagePreview?.classList.add('hidden');
    show(successBox, 'Tu reporte fue enviado. Gracias por ayudar a mejorar el plantel.');
  } catch (error) {
    show(errorBox, error instanceof Error ? error.message : 'No se pudo enviar el reporte.');
  } finally {
    submitButton?.removeAttribute('disabled');
    if (submitText) submitText.textContent = submitLabel;
  }
});
