# Buzon CETis No. 26

Astro + TypeScript app for private complaint and suggestion intake, with Firebase Auth, Firestore RBAC, App Check, Cloudinary image uploads, and optional Gemini 2.5 Flash summaries for moderators.

## Stack

- Astro with the Cloudflare adapter
- TypeScript
- Tailwind CSS
- Firebase Auth and Firestore on Spark
- Firestore Security Rules and indexes
- Firebase App Check
- Cloudinary restricted upload preset
- Zod validation
- Optional Gemini 2.5 Flash summarization

No Firebase Cloud Functions, Firebase Admin SDK, or custom backend are used. Cloudflare Pages Functions are used only for secure server-side routes.

## Project Structure

```text
src/
  components/          Reusable Astro components
  layouts/             Base shell
  lib/                 Firebase, schemas, Cloudinary, server helpers
  pages/               Astro pages and Cloudflare server routes
  scripts/             Browser TypeScript flows
  styles/              Tailwind globals
firestore.rules        Firestore validation and RBAC
firestore.indexes.json Composite indexes
firebase.json          Firebase deploy config
.env.example           Required environment variables
SECURITY_CHECKLIST.md  Deployment and security checklist
```

## Firestore Data Model

`reports/{reportId}`

- `type`: `complaint` or `suggestion`
- `title`, `description`, `category`, `group`
- `isAnonymous`
- `contactName`, `contactEmail`, `submitterUid`
- `image`: null or Cloudinary metadata
- `imageReviewStatus`: `none`, `hidden_until_review`, `approved`, `rejected`
- `status`: `new`, `in_review`, `resolved`, `rejected`
- `moderatorNotes`
- `createdAt`, `updatedAt`

Anonymous reports write `submitterUid: null` and blank contact fields, so moderators do not receive the submitter identity.

`roles/{uid}`

- `role`: `moderator` or `superuser`
- `displayName`
- `email`
- `active`
- `updatedAt`

The first superuser must be bootstrapped manually in Firebase Console.

`rateLimits/{uid_yyyy-mm-dd_scope}`

- `uid`
- `scope`: `reportSubmit` or `cloudinaryUpload`
- `day`
- `count`
- `updatedAt`

This avoids storing rate-limit state inside public report documents.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in public Firebase and Cloudinary values.

3. In Firebase Console:

   - Enable Email/Password Auth for moderators.
   - Enable Anonymous Auth for public submissions.
   - Enable Firestore.
   - Enable App Check enforcement for Firestore after testing.
   - Manually create the first `roles/{uid}` document:

     ```json
     {
       "role": "superuser",
       "displayName": "Initial Admin",
       "email": "admin@example.edu",
       "active": true,
       "updatedAt": "server timestamp"
     }
     ```

4. Deploy Firestore rules and indexes:

   ```bash
   firebase deploy --only firestore
   ```

5. In Cloudinary:

   - Create a restricted preset named like `cetis26_reports_unsigned`.
   - Allow only image uploads.
   - Restrict formats to jpg, jpeg, png, webp.
   - Set max file size near 2 MB.
   - Use a dedicated folder such as `cetis26/reportes`.
   - Treat uploaded images as hidden until a moderator approves visibility in Firestore.

6. In Cloudflare Pages, set the same public env vars plus server-only secrets:

   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
   - `CLOUDINARY_UPLOAD_FOLDER`
   - `GEMINI_API_KEY` optional

7. Build locally:

   ```bash
   npm run build
   ```

Cloudflare adapter note: Astro 6 may create a `SESSION` KV binding in generated Cloudflare output. Create a Cloudflare KV namespace and bind it as `SESSION` if Cloudflare asks for it during deployment.

## Cloudflare Routes

- `POST /api/cloudinary-signature`: verifies Firebase ID token, permits complaints only, rate-limits by UID/day, and returns Cloudinary upload params. If Cloudinary API credentials are configured, it also signs the upload params server-side.
- `POST /api/gemini-summary`: verifies Firebase ID token and moderator/superuser role before calling Gemini.
- `POST /api/moderate-text`: verifies moderator/superuser role and returns advisory risk flags.
- `POST /api/check-role`: verifies Firebase ID token and returns the caller role.

Gemini summaries are advisory only. Moderators make all final decisions. The detail page also supports a moderator-pasted Gemini key stored only in `localStorage`.

## Query Optimization

- Dashboard tables use `limit(20)`.
- Pagination uses `startAfter(lastDocument)`.
- Filters are covered by composite indexes in `firestore.indexes.json`.
- Public users never read `reports`.
- Broad realtime listeners are avoided; dashboard reads are paginated one-shot queries.
- Role management lists only 20 recent role documents and is superuser-only.

## Development

```bash
npm run dev
```

Open the local URL printed by Astro.

## Deployment

Deploy to Cloudflare Pages with:

- Framework preset: Astro
- Build command: `npm run build`
- Output directory: `dist`

The Astro Cloudflare adapter is already configured.
