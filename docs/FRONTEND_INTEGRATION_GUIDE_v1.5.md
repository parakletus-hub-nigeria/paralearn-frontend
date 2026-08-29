# ParaLearn RMS & Finance v1.5: Frontend Integration Guide & API Reference

> **Comprehensive Developer Handbook for Frontend Engineers**  
> **Version:** 1.5.0  
> **Target Platforms:** ParaLearn Web App (Next.js/React), Student/Parent Portal, Teacher App, Staff RMS Dashboard  
> **Base URL:** `https://api.pln.ng` (Production) / `http://localhost:3000` (Local Dev)

---

## 📋 Table of Contents

1. [Global Architecture, Headers & Auth Conventions](#1-global-architecture-headers--auth-conventions)
2. [Feature 1: Multi-Tenancy, Subdomains & Dynamic School Branding](#2-feature-1-multi-tenancy-subdomains--dynamic-school-branding)
3. [Feature 2: School Finance, Bursary Dashboard & Fee Management](#3-feature-2-school-finance-bursary-dashboard--fee-management)
4. [Feature 3: Student Fees Portal & Paystack Checkout](#4-feature-3-student-fees-portal--paystack-checkout)
5. [Feature 4: Report Card Paywall Guard (HTTP 402) & Admin Fee Override](#5-feature-4-report-card-paywall-guard-http-402--admin-fee-override)
6. [Feature 5: Multi-Tier Digital Signatures & Public Verification Portal](#6-feature-5-multi-tier-digital-signatures--public-verification-portal)
7. [Feature 6: Multi-Channel Report Card Dispatch (WhatsApp & Email)](#7-feature-6-multi-channel-report-card-dispatch-whatsapp--email)
8. [Feature 7: Psychomotor & Affective Domain 1–5 Star Evaluation](#8-feature-7-psychomotor--affective-domain-15-star-evaluation)
9. [Feature 8: Complete Role-Based Access Control (RBAC) Matrix](#9-feature-8-complete-role-based-access-control-rbac-matrix)
10. [Standard Error Envelope & Axios/Fetch Interceptor Recipe](#10-standard-error-envelope--axiosfetch-interceptor-recipe)

---

## 1. Global Architecture, Headers & Auth Conventions

### 1.1 Request Headers
Every request sent by the frontend must include:

| Header Name | Type | Required? | Description & Example |
|---|---|---|---|
| `Authorization` | `string` | **Yes** (Protected routes) | `Bearer <JWT_TOKEN>` obtained upon login. |
| `x-tenant-subdomain` | `string` | **Optional** (Fallback/Dev) | Subdomain slug (e.g. `greenwood`). Primary resolution happens automatically via the `Host` header. |
| `Content-Type` | `string` | **Yes** (POST/PATCH/PUT) | `application/json` |

### 1.2 Response Headers Sent by Backend
The backend automatically resolves the tenant and injects diagnostic and branding headers in every HTTP response:

| Response Header | Description | Example |
|---|---|---|
| `X-Tenant-ID` | CUID of the resolved school | `clx_school_12345` |
| `X-Tenant-Name` | Full institutional name | `King's College Lagos` |
| `X-Tenant-Subdomain` | Subdomain slug | `kingscollege` |
| `X-Tenant-Domain` | Custom domain (if configured) | `portal.kingscollege.edu.ng` |
| `X-Tenant-Detection-Method` | How tenant was resolved | `subdomain`, `custom-domain`, or `header` |
| `X-School-Primary-Color` | Primary HEX brand color | `#1e3a8a` |
| `X-School-Logo` | Cloudinary URL for school crest | `https://res.cloudinary.com/.../logo.png` |

---

## 2. Feature 1: Multi-Tenancy, Subdomains & Dynamic School Branding

### 2.1 Resolution Architecture
The frontend application dynamically brands itself according to the current URL:
- **Wildcard Subdomains:** `https://kingscollege.pln.ng` $\rightarrow$ `kingscollege`
- **Custom Domains:** `https://portal.kingscollege.edu.ng` $\rightarrow$ Custom Domain match
- **Local Dev:** `http://kingscollege.localhost:3000` $\rightarrow$ `kingscollege`

### 2.2 Endpoints

#### `GET /tenant/resolve`
Resolves school metadata by host, subdomain, or domain parameter.
- **Auth:** Public
- **Query Params:** `?host=...` or `?subdomain=...` or `?domain=...`
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "id": "cuid_school_123",
    "name": "King's College Lagos",
    "subdomain": "kingscollege",
    "domain": "portal.kingscollege.edu.ng",
    "logoUrl": "https://res.cloudinary.com/pln/image/upload/v1/kc-crest.png",
    "primaryColor": "#1e3a8a",
    "secondaryColor": "#172554",
    "accentColor": "#3b82f6",
    "settings": {
      "motto": "Floreat Collegium",
      "address": "3 Catholic Mission Street, Lagos Island",
      "phoneNumber": "+2348012345678",
      "email": "info@kingscollege.edu.ng"
    }
  }
}
```

#### `GET /school-settings/branding`
Fetches branding & visual identity settings for the current school.
- **Auth:** `admin`, `accountant`
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "School branding retrieved successfully",
  "data": {
    "schoolId": "cuid_school_123",
    "name": "King's College Lagos",
    "subdomain": "kingscollege",
    "domain": "portal.kingscollege.edu.ng",
    "logoUrl": "https://res.cloudinary.com/pln/image/upload/v1/kc-crest.png",
    "primaryColor": "#1e3a8a",
    "secondaryColor": "#172554",
    "accentColor": "#3b82f6",
    "motto": "Floreat Collegium",
    "landingPageEnabled": true
  }
}
```

#### `PATCH /school-settings/branding`
Updates school colors, logo, motto, or custom domain.
- **Auth:** `admin` only
- **Payload:**
```json
{
  "primaryColor": "#0f766e",
  "secondaryColor": "#134e4a",
  "accentColor": "#14b8a6",
  "motto": "Excellence and Integrity",
  "domain": "portal.kingscollege.edu.ng"
}
```

---

## 3. Feature 2: School Finance, Bursary Dashboard & Fee Management

### 3.1 Currency & Kobo Convention
> [!IMPORTANT]
> All monetary values in the backend API are represented as **integers in KOBO** ($1 \text{ NGN} = 100 \text{ kobo}$).  
> For example, $\text{₦}50,000.00$ is sent as `5000000`.  
> Display in UI: `(amountKobo / 100).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })`.

### 3.2 Bursary Financial Dashboard

#### `GET /fees/bursary/dashboard`
High-level financial overview metrics, invoice settlement statistics, and recent transactions.
- **Auth:** `admin`, `accountant`, `principal` (*Vice Principals, Teachers, Students strictly blocked*)
- **Query Params:**
  - `termId` *(optional)*: Filter by Academic Term ID
  - `sessionId` *(optional)*: Filter by Academic Session ID
  - `classId` *(optional)*: Filter by specific class
- **Response `200 OK`:**
```json
{
  "summary": {
    "totalExpectedKobo": 30000000,
    "formattedTotalExpected": "₦300,000.00",
    "totalCollectedKobo": 14000000,
    "formattedTotalCollected": "₦140,000.00",
    "totalOutstandingKobo": 16000000,
    "formattedTotalOutstanding": "₦160,000.00",
    "collectionRatePercentage": 46.7
  },
  "distribution": {
    "totalInvoices": 30,
    "paid": { "count": 14, "percentage": 46.7 },
    "partial": { "count": 6, "percentage": 20.0 },
    "pending": { "count": 10, "percentage": 33.3 },
    "waived": { "count": 0, "percentage": 0.0 },
    "overridden": { "count": 2, "percentage": 6.7 }
  },
  "recentPayments": [
    {
      "id": "cuid_pay_1",
      "reference": "MANUAL-a1b2c3d4",
      "amountKobo": 5000000,
      "formattedAmount": "₦50,000.00",
      "platformFeeKobo": 0,
      "method": "CASH",
      "status": "SUCCESS",
      "paidAt": "2026-08-29T10:30:00.000Z",
      "createdAt": "2026-08-29T10:30:00.000Z",
      "studentName": "Emeka Chukwu",
      "studentEmail": "emeka.chukwu@school.ng",
      "term": "First Term",
      "session": "2025/2026",
      "invoiceId": "cuid_inv_101"
    }
  ]
}
```

### 3.3 Fee Structures

#### `POST /fees/structures`
Defines a termly fee structure item (e.g. Tuition, PTA Levy).
- **Auth:** `admin`, `accountant`
- **Payload:**
```json
{
  "termId": "cuid_term_1",
  "name": "First Term Tuition",
  "classLevel": "JSS1", // null for school-wide fee
  "amount": 5000000,    // 50,000.00 NGN in kobo
  "isActive": true
}
```

#### `GET /fees/structures?termId=cuid_term_1`
Lists fee structures for the school.
- **Auth:** `admin`, `accountant`

### 3.4 Invoicing Engine

#### `POST /fees/invoices/generate`
Batch generates invoices for all active enrollments for a given term.
- **Auth:** `admin`, `accountant`
- **Payload:**
```json
{
  "termId": "cuid_term_1",
  "classId": "cuid_class_jss1", // optional: target specific class
  "studentIds": ["cuid_std_1", "cuid_std_2"], // optional: target specific students
  "dueDate": "2026-09-30T00:00:00.000Z"
}
```
- **Response `201 Created`:**
```json
{
  "generated": 45,
  "skipped": 2,
  "invoices": [...]
}
```

#### `GET /fees/invoices`
Lists invoices with filters (`termId`, `status`, `studentId`).
- **Auth:** `admin`, `accountant`

#### `POST /fees/invoices/:id/payments/manual`
Records an offline payment received at the bursar's office (Cash, Bank Transfer, POS).
- **Auth:** `admin`, `accountant`
- **Payload:**
```json
{
  "amount": 5000000, // in kobo
  "method": "POS",   // "CASH" | "BANK_TRANSFER" | "POS"
  "note": "POS Terminal Ref #987654"
}
```

---

## 4. Feature 3: Student Fees Portal & Paystack Checkout

### 4.1 Student Invoices

#### `GET /fees/invoices/me`
Fetches all invoices belonging to the currently authenticated student.
- **Auth:** `student`, `admin`, `teacher`
- **Response `200 OK`:**
```json
[
  {
    "id": "cuid_inv_101",
    "termId": "cuid_term_1",
    "totalAmount": 7500000,
    "amountPaid": 2500000,
    "status": "PARTIAL",
    "dueDate": "2026-09-30T00:00:00.000Z",
    "adminOverride": false,
    "items": [
      { "id": "item_1", "description": "Tuition Fee", "amount": 6000000 },
      { "id": "item_2", "description": "PTA Levy", "amount": 1500000 }
    ],
    "payments": [
      {
        "id": "pay_1",
        "amount": 2500000,
        "method": "PAYSTACK",
        "status": "SUCCESS",
        "paidAt": "2026-08-25T14:00:00.000Z",
        "reference": "INV-cuid_inv_101-9f2b"
      }
    ]
  }
]
```

### 4.2 Initializing Paystack Checkout

#### `POST /fees/payments/paystack/initialize`
Initiates a split payment checkout on Paystack for the student's outstanding balance.
- **Auth:** `student` (Caller can only initiate checkout for their own invoice)
- **Payload:**
```json
{
  "invoiceId": "cuid_inv_101"
}
```
- **Response `200 OK`:**
```json
{
  "authorizationUrl": "https://checkout.paystack.com/3x9y8z7w6v5u",
  "reference": "INV-cuid_inv_101-7a8b9c"
}
```
- **Frontend Action:** Redirect student window to `authorizationUrl` or launch Paystack Inline Modal with the reference.

---

## 5. Feature 4: Report Card Paywall Guard (HTTP 402) & Admin Fee Override

### 5.1 HTTP 402 `Payment Required` Contract
When a student or parent attempts to view, preview, or download a report card while having an outstanding fee balance, the backend rejects the request with **HTTP 402**.

```http
HTTP/1.1 402 Payment Required
Content-Type: application/json
```
```json
{
  "statusCode": 402,
  "error": "Payment Required",
  "message": "Report card access is locked pending fee clearance for this term.",
  "data": {
    "studentId": "usr_10294",
    "term": "First Term",
    "session": "2025/2026",
    "invoiceId": "cuid_inv_101",
    "totalAmount": 7500000,
    "amountPaid": 2500000,
    "outstandingBalance": 5000000,
    "formattedBalance": "₦50,000.00",
    "paymentUrl": "/student/fees"
  }
}
```

### 5.2 Frontend Paywall Component Flow (`ReportCardPaywallGuard.tsx`)
1. In the Report Card Page (`/student/report-card`), if the API returns status `402`:
   - Catch error and read `error.response.data.data`.
   - Render the blurred report card background overlay.
   - Display lock banner:
     > 🔒 **Terminal Report Card Locked**  
     > *Fee clearance for First Term 2025/2026 is pending.*  
     > **Outstanding Balance:** `₦50,000.00`  
     > **[Pay Now via Paystack]** button linking to `paymentUrl`.

### 5.3 Administrative Fee Override (Scholarships & Hardship)
Allows school admins, bursars, and principals to grant report card access without wiping the student's debt from the accounting ledger.

#### `POST /fees/invoices/:id/override`
- **Auth:** `admin`, `accountant`, `principal`
- **Payload:**
```json
{
  "adminOverride": true,
  "overrideReason": "Full Academic Merit Scholarship - Approved by Principal",
  "adminName": "Mrs. Adebayo (Bursar)"
}
```
- **Response `200 OK`:**
```json
{
  "id": "cuid_inv_101",
  "adminOverride": true,
  "overrideReason": "Full Academic Merit Scholarship - Approved by Principal",
  "overrideAdminName": "Mrs. Adebayo (Bursar)",
  "overrideAt": "2026-08-29T12:00:00.000Z",
  "status": "PARTIAL",
  "totalAmount": 7500000,
  "amountPaid": 2500000
}
```

#### `DELETE /fees/invoices/:id/override`
Revokes an override, instantly re-locking report cards if balances remain unpaid.
- **Auth:** `admin`, `accountant`, `principal`

---

## 6. Feature 5: Multi-Tier Digital Signatures & Public Verification Portal

### 6.1 Multi-Tier Signature Pipeline
1. **Teacher Submission:** When a class teacher submits grades for approval (`POST /reports/submit-for-approval`), the system computes HMAC-SHA256 digest `TEACHER_SUBMITTED`.
2. **Principal Institutional Approval:** When the Principal or Admin approves reports (`POST /reports/approve`), the system seals the payload with `PRINCIPAL_APPROVED` HMAC-SHA256 signature and attaches a tamper-proof verification checksum.

### 6.2 Public Verification Portal

#### `GET /api/proxy/reports/verify/:signatureProof`
Publicly verifies report authenticity by checking the HMAC checksum.
- **Auth:** Public (No token required)
- **Response `200 OK`:**
```json
{
  "verified": true,
  "student": {
    "name": "Chidi Okafor",
    "id": "std_101",
    "class": "JSS 1 Gold",
    "term": "First Term",
    "session": "2025/2026"
  },
  "academicSummary": {
    "totalScore": 680,
    "average": 85.0,
    "position": "1st of 35",
    "decision": "PASSED"
  },
  "signatures": [
    {
      "role": "CLASS_TEACHER",
      "signerName": "Mr. S. Adekunle",
      "signedAt": "2026-08-28T14:30:00.000Z"
    },
    {
      "role": "PRINCIPAL",
      "signerName": "Dr. O. Okonkwo",
      "signedAt": "2026-08-29T09:15:00.000Z"
    }
  ],
  "verificationProof": "sig_a9f8b7c6d5e4f3...",
  "verifiedAt": "2026-08-29T12:30:00.000Z"
}
```

#### `GET /reports/:id/audit-trail`
Fetches complete chronological signature events for the audit modal.
- **Auth:** `admin`, `principal`, `vp`, `teacher`

---

## 7. Feature 6: Multi-Channel Report Card Dispatch (WhatsApp & Email)

### 7.1 Bulk Sharing

#### `POST /reports/share/bulk`
Queues asynchronous BullMQ background jobs to dispatch WhatsApp templates and PDF email attachments to parents.
- **Auth:** `admin`, `principal`, `teacher`
- **Payload:**
```json
{
  "studentIds": ["cuid_std_1", "cuid_std_2", "cuid_std_3"],
  "term": "First Term",
  "session": "2025/2026"
}
```
- **Response `202 Accepted`:**
```json
{
  "success": true,
  "message": "Bulk report card sharing queued successfully.",
  "data": {
    "queued": 3,
    "skipped": 0,
    "jobIds": ["job_1", "job_2", "job_3"]
  }
}
```

---

## 8. Feature 7: Psychomotor & Affective Domain 1–5 Star Evaluation

### 8.1 Traits & Domain Rubric
Ratings use a standard 1–5 scale:
- `1`: Poor / Unsatisfactory
- `2`: Fair / Below Average
- `3`: Good / Average
- `4`: Very Good / Commendable
- `5`: Excellent / Outstanding

Supported trait keys (backend automatically converts camelCase keys to TitleCase for PDF badges):
- **Affective Traits:** `punctuality`, `neatness`, `politeness`, `honesty`, `attentiveness`, `peerRelationship`
- **Psychomotor Traits:** `handwriting`, `sportsAndGames`, `crafts`, `musicalSkills`, `leadership`

### 8.2 Endpoints

#### `POST /psychomotor/ratings`
- **Auth:** `teacher`, `admin`
- **Payload:**
```json
{
  "reportCardId": "cuid_report_101",
  "studentId": "cuid_std_1",
  "ratings": {
    "punctuality": 5,
    "neatness": 4,
    "leadership": 5,
    "sportsAndGames": 4,
    "peerRelationship": 5
  }
}
```

---

## 9. Feature 8: Complete Role-Based Access Control (RBAC) Matrix

| Endpoint | Method | `admin` / `principal` | `accountant` | `vp` | `teacher` | `student` | Public |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `/tenant/resolve` | `GET` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/school-settings/branding` | `GET` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/school-settings/branding` | `PATCH` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/fees/bursary/dashboard` | `GET` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/fees/structures` | `GET` / `POST` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/fees/invoices/generate` | `POST` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/fees/invoices/:id/payments/manual` | `POST` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/fees/invoices/:id/override` | `POST` / `DELETE` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/fees/invoices/me` | `GET` | ✅ | ✅ | ✅ | ✅ | ✅ (Own) | ❌ |
| `/fees/payments/paystack/initialize`| `POST` | ❌ | ❌ | ❌ | ❌ | ✅ (Own) | ❌ |
| `/reports/student/:id/report-card/preview` | `GET` | ✅ | ✅ | ✅ | ✅ | ✅ (Gated 402) | ❌ |
| `/reports/student/:id/report-card/pdf` | `GET` | ✅ | ✅ | ✅ | ✅ | ✅ (Gated 402) | ❌ |
| `/reports/submit-for-approval` | `POST` | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| `/reports/approve` | `POST` | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| `/reports/share/bulk` | `POST` | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| `/api/proxy/reports/verify/:proof` | `GET` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 10. Standard Error Envelope & Axios/Fetch Interceptor Recipe

### 10.1 Standard Error Format
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Detailed human-readable error explanation",
  "data": null
}
```

### 10.2 Frontend Axios Interceptor Recipe (`apiClient.ts`)

```typescript
import axios from 'axios';

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'https://api.pln.ng',
  headers: {
    'Content-Type': 'application/json',
  },
});

// 1. Request Interceptor: Attach Auth Token and Subdomain
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // If in local dev or explicit proxy mode, pass subdomain
  const subdomain = window.location.hostname.split('.')[0];
  if (subdomain && subdomain !== 'localhost' && subdomain !== 'app') {
    config.headers['x-tenant-subdomain'] = subdomain;
  }

  return config;
});

// 2. Response Interceptor: Global 402 Paywall & 401 Auth Handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 402) {
      // 402 Payment Required: Throw structured paywall data for UI component handling
      console.warn('Report card locked pending fee clearance:', error.response.data);
      return Promise.reject(error);
    }

    if (error.response?.status === 401) {
      // 401 Unauthorized: Redirect to login
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);
```
