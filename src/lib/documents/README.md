# Frontend uploads

Single file: **`index.js`**. Sync module keys, folders, and allowed extensions with  
`backend/src/lib/documents/documents.config.js` (`DOC_FILE_LINKS`).

## API

```js
import { uploadUrl, uploadAccept } from "@/lib/documents";

// Preview / download — API usually returns full `uploads/…` path
uploadUrl(path);

// Legacy bare filename only (e.g. old QC note)
uploadUrl(path, "rm_qc_check");

// File input
<input accept={uploadAccept("rm_qc_check")} type="file" />
```

**Validation:** multer on the backend (`docUpload`, `exts`, `maxMb`). Do not add duplicate size/type checks on the FE.

## When you change something

| Change | Edit |
|--------|------|
| New v5 document module | Backend `DOC_FILE_LINKS` + FE `CFG` entry (same key, folder, exts) |
| New allowed extension | Both configs; use `uploadAccept(key)` on the screen |
| New screen with uploads | Import `@/lib/documents` only — no local `resolveDocUrl` / hardcoded `accept` |

## Invoice Receiving

`invoiceReceivingUtils.js` still handles ERP `"null"` strings. Paths use `uploadUrl(…, "invoice_receiving")`; `expandIrUploadPath` keeps bare filenames under `uploads/ims/invoice-receiving/`.

## Outside this module

Task self-note, recurring, CL task, spreadsheet import — not backend `documents` v5; their multer paths stay in task/IMS middleware.
