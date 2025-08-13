## Build the Email Signatures page (React + Vite)

- Create a new page `Email Signatures` and add a side-menu nav item under the Contacts tab linking to this page.
- Base URL: `http://localhost:8383`
- All protected endpoints require headers:
  - `Authorization: Bearer <ID_TOKEN_OR_DEV_TEST_TOKEN>`
  - `Content-Type: application/json`

---

## Endpoints

- Public
  - GET `/api/public/signature-templates`

- User signature management (protected; user routes are mounted at root `/`)
  - PATCH `/Users/:id/email-signature`
  - GET `/Users/:id/email-signature`
  - DELETE `/Users/:id/email-signature`

- Signature preview and test (protected; mounted under `/api`)
  - POST `/api/Users/:id/signature-preview`
  - POST `/api/Users/:id/test-signature`

- Enterprise bulk operations (protected; mounted under `/api`)
  - PATCH `/api/enterprise/:enterpriseId/bulk-signatures`

- Diagnostics
  - GET `/` (root – JSON welcome/info)
  - GET `/api/health`

Do not change port `8383` or mounts.

---

## Request payloads (frontend → server)

### PATCH `/Users/:id/email-signature`
```json
{
  "signatureText": "Best regards,",
  "includeName": true,
  "includeTitle": true,
  "includeCompany": true,
  "includePhone": true,
  "includeEmail": true,
  "includeWebsite": false,
  "includeSocials": false,
  "signatureStyle": "professional",
  "isActive": true
}
```

### GET `/Users/:id/email-signature`
- No body

### DELETE `/Users/:id/email-signature`
- No body

### POST `/api/Users/:id/signature-preview`
- Important: send a flat payload (not nested under `signatureData`).
```json
{
  "signatureText": "Best regards,",
  "includeName": true,
  "includeTitle": true,
  "includeCompany": true,
  "includePhone": true,
  "includeEmail": true,
  "includeWebsite": false,
  "includeSocials": false,
  "signatureStyle": "professional"
}
```

### POST `/api/Users/:id/test-signature`
```json
{ "testEmail": "someone@example.com" }
```

### PATCH `/api/enterprise/:enterpriseId/bulk-signatures`
```json
{
  "signatureTemplate": "Best regards,",
  "includeName": true,
  "includeTitle": true,
  "includeCompany": true,
  "includePhone": true,
  "includeEmail": true,
  "includeWebsite": false,
  "includeSocials": false,
  "signatureStyle": "professional",
  "isActive": true
}
```

### GET `/api/public/signature-templates`
- No body

---

## Response payloads (server → frontend)

### GET `/api/public/signature-templates` 200
```json
{
  "templates": [
    { "id": "professional", "name": "Professional", "description": "..." },
    { "id": "modern", "name": "Modern", "description": "..." },
    { "id": "minimal", "name": "Minimal", "description": "..." }
  ],
  "message": "Signature templates retrieved successfully"
}
```

### PATCH `/Users/:id/email-signature` 200
```json
{
  "message": "Signature updated successfully",
  "signature": {
    "signatureText": "Best regards,",
    "signatureHtml": "<div>...</div>",
    "includeName": true,
    "includeTitle": true,
    "includeCompany": true,
    "includePhone": true,
    "includeEmail": true,
    "includeWebsite": false,
    "includeSocials": false,
    "signatureStyle": "professional",
    "isActive": true,
    "updatedAt": "2025-08-09T18:54:00.000Z"
  }
}
```

### GET `/Users/:id/email-signature` 200
```json
{
  "signature": {
    "signatureText": "Best regards,",
    "signatureHtml": "<div>...</div>",
    "includeName": true,
    "includeTitle": true,
    "includeCompany": true,
    "includePhone": true,
    "includeEmail": true,
    "includeWebsite": false,
    "includeSocials": false,
    "signatureStyle": "minimal",
    "isActive": true
  }
}
```

### DELETE `/Users/:id/email-signature` 200
```json
{ "message": "Signature deleted successfully" }
```

### POST `/api/Users/:id/signature-preview` 200
```json
{
  "preview": "<div style=\"...\"> ... </div>",
  "message": "Signature preview generated successfully"
}
```

### POST `/api/Users/:id/test-signature` 200
```json
{
  "message": "Test email sent successfully",
  "emailResult": { "success": true, "accepted": ["someone@example.com"], "rejected": [] }
}
```

### PATCH `/api/enterprise/:enterpriseId/bulk-signatures` 200
```json
{
  "message": "Bulk signature update completed successfully",
  "usersUpdated": 12,
  "updatedUsers": ["uid-1", "uid-2", "..."]
}
```

---

## Error responses

### 400 Invalid preview/test email
```json
{ "message": "Invalid test email address" }
```

### 400 No active signature to test
```json
{ "message": "No active email signature found" }
```

### 401 Unauthorized (missing/invalid token)
```json
{ "message": "Authentication required. Please provide a valid token." }
```

### 404 User not found
```json
{ "message": "User not found" }
```

### 404 Enterprise not found
```json
{ "message": "Enterprise not found" }
```

### 404 No users for enterprise (acceptable in dev)
```json
{ "message": "No users found for this enterprise" }
```

### 500 Preview generation failure
```json
{ "message": "Failed to generate signature preview", "error": "<details>" }
```

### 500 Email send failure (e.g., SMTP restrictions)
```json
{ "message": "Failed to send test email", "error": { "code": "ESOCKET", "command": "CONN" } }
```

### 500 Bulk update failure
```json
{ "message": "Failed to update signatures in bulk", "error": "<details>" }
```

---

## Frontend structure and flows

- Add `Email Signatures` nav link under Contacts.
- Page sections:
  - Templates: fetch via `GET /api/public/signature-templates`.
  - Editor: fields for text, include toggles, style select, active toggle.
  - Actions:
    - Save: `PATCH /Users/:id/email-signature`.
    - Get current: `GET /Users/:id/email-signature`.
    - Preview: `POST /api/Users/:id/signature-preview` (flat payload), render `preview` HTML.
    - Send Test Email (optional): `POST /api/Users/:id/test-signature` (may fail in dev SMTP).
  - Enterprise (optional admin): bulk apply via `PATCH /api/enterprise/:enterpriseId/bulk-signatures`.

- Always include headers:
```ts
Authorization: Bearer <token>
Content-Type: application/json
```

- Base URL: `http://localhost:8383` (do not change).
- Show server messages verbatim on non-2xx responses.

---

## Minimal TypeScript interfaces

```ts
export type SignatureStyle = 'professional' | 'modern' | 'minimal';

export interface SignaturePayload {
  signatureText?: string;
  includeName?: boolean;
  includeTitle?: boolean;
  includeCompany?: boolean;
  includePhone?: boolean;
  includeEmail?: boolean;
  includeWebsite?: boolean;
  includeSocials?: boolean;
  signatureStyle?: SignatureStyle;
  isActive?: boolean; // only for save
}

export interface Signature {
  signatureText: string;
  signatureHtml?: string;
  includeName: boolean;
  includeTitle: boolean;
  includeCompany: boolean;
  includePhone: boolean;
  includeEmail: boolean;
  includeWebsite: boolean;
  includeSocials: boolean;
  signatureStyle: SignatureStyle;
  isActive: boolean;
}

export interface PreviewResponse { preview: string; message: string; }
export interface GetSignatureResponse { signature: Signature | null; }
export interface UpdateSignatureResponse { message: string; signature: Signature; }
export interface DeleteSignatureResponse { message: string; }
export interface TemplatesResponse {
  templates: Array<{ id: SignatureStyle; name: string; description: string }>;
  message: string;
}
export interface BulkUpdateResponse {
  message: string;
  usersUpdated: number;
  updatedUsers: string[];
}
```

---

## Test plan (mirror of working test-interface)

- Config: GET `/` → expect 200 JSON
- Auth: GET `/Users/:id/email-signature` with token → expect 200/404
- Create/Update: PATCH `/Users/:id/email-signature` for styles `professional`, `modern`, `minimal` → expect 200
- Get: GET `/Users/:id/email-signature` → expect 200; check `signature.signatureStyle`
- Preview: POST `/api/Users/:id/signature-preview` with flat payload → 200 and `preview`
- Enterprise (optional):
  - Create or reuse an enterprise ID
  - PATCH `/api/enterprise/:enterpriseId/bulk-signatures` → accept 200 success OR 404 with `"No users found for this enterprise"`
- Performance: 3 concurrent PATCH `/Users/:id/email-signature` → all 200
- Error handling: GET `/Users/invalid-user-id/email-signature` → 404 or 400

---

## Notes

- Do not change port `8383` or endpoint mounts.
- For preview, send flattened fields and read `preview` (not `previewHtml`).
- Enterprise bulk in dev may return `No users found for this enterprise`; treat as acceptable if endpoint works.
- In dev, a test token can be used; in production, use a Firebase ID token.







