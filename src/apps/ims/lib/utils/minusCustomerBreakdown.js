import { isMinusBoxUidSelected } from "@/apps/ims/modules/stock-adjustment/stockAdjustmentViewBoxes";
import { masterService } from "@/apps/ims/lib/services/master";

function normalizeAccCode(value) {
  if (value == null || value === "") return null;
  const s = String(value).trim();
  return s === "" || s === "-" ? null : s;
}

/** Match backend effectiveBoxCustomerAcc — override first, else packing/prod customer. */
export function boxRowAccCode(box) {
  if (!box) return null;
  const override = normalizeAccCode(box.override_cust);
  const packing = normalizeAccCode(box.prod_acc_code ?? box.acc_code);
  if (!override) return packing;
  if (packing && override === packing) return packing;
  return override;
}

function parseRemovedBoxPayload(raw) {
  if (raw == null || raw === "") return { customer_lines: null };
  if (Array.isArray(raw)) return { customer_lines: null };
  try {
    let parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (typeof parsed === "string") parsed = JSON.parse(parsed);
    if (Array.isArray(parsed)) return { customer_lines: null };
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.customer_lines)) {
      return { customer_lines: parsed.customer_lines };
    }
  } catch {
    /* fall through */
  }
  return { customer_lines: null };
}

/** Saved minus customer snapshot from API field or removed_box_ids JSON. */
export function parseMinusCustomerLinesFromRow(row) {
  const fromApi = row?.minus_customer_lines;
  if (Array.isArray(fromApi) && fromApi.length) {
    return fromApi.map((l) => ({
      packing_number: l.packing_number ?? row?.packing_number ?? null,
      acc_code: l.acc_code ?? null,
      acc_name: l.acc_name || l.acc_code || "—",
      qty: Math.abs(parseInt(l.qty, 10) || 0),
      box_count: parseInt(l.box_count, 10) || 0,
    }));
  }
  const { customer_lines } = parseRemovedBoxPayload(row?.removed_box_ids);
  if (!Array.isArray(customer_lines) || !customer_lines.length) return [];
  const defaultPn = String(row?.packing_number ?? "").trim();
  return customer_lines.map((l) => ({
    packing_number: l.packing_number || defaultPn || null,
    acc_code: l.acc_code ?? null,
    acc_name: l.acc_name || l.acc_code || "—",
    qty: Math.abs(parseInt(l.qty, 10) || 0),
    box_count: parseInt(l.box_count, 10) || 0,
  }));
}

export function boxRowCustomerLabel(box) {
  const code = boxRowAccCode(box);
  const name = box?.acc_name != null ? String(box.acc_name).trim() : "";
  if (name && name !== "-" && (!code || name !== String(code))) {
    return name;
  }
  return code || "—";
}

/** Resolve ledger names for minus breakdown when API only had acc codes. */
export async function enrichMinusBoxCustomerNames(boxes, itemDcode) {
  if (!Array.isArray(boxes) || !boxes.length) return boxes;
  const codes = [
    ...new Set(
      boxes
        .map((b) => boxRowAccCode(b))
        .filter((c) => c != null && String(c).trim() !== "")
        .map((c) => String(c).trim())
    ),
  ];
  if (!codes.length) return boxes;

  const nameByCode = new Map();
  await Promise.all(
    codes.map(async (code) => {
      try {
        const res = await masterService.getLedgerViewById(code, {
          permission_module: "stock_adjustment",
          permission_action: "view",
          itemdcode: itemDcode ?? undefined,
        });
        const nm = res?.data?.acc_name;
        if (nm != null && String(nm).trim() !== "") {
          nameByCode.set(code, String(nm).trim());
        }
      } catch {
        /* optional */
      }
    })
  );

  if (!nameByCode.size) return boxes;
  return boxes.map((b) => {
    const code = boxRowAccCode(b);
    if (!code) return b;
    const resolved = nameByCode.get(String(code));
    if (!resolved) return b;
    return { ...b, acc_name: resolved, acc_code: b.acc_code ?? code };
  });
}

function selectedUidSet(minusSelectedUids) {
  return minusSelectedUids instanceof Set
    ? minusSelectedUids
    : new Set(
        Array.isArray(minusSelectedUids)
          ? minusSelectedUids.map((u) => String(u))
          : []
      );
}

/** Group selected minus boxes by customer — packing, name, qty per customer. */
export function groupSelectedMinusBoxesByCustomer(boxes, minusSelectedUids, defaultPacking = "") {
  const uidSet = selectedUidSet(minusSelectedUids);
  const groups = new Map();
  for (const box of boxes || []) {
    if (!isMinusBoxUidSelected(uidSet, box.box_uid)) continue;
    const code = boxRowAccCode(box);
    if (!code) continue;
    const qty = Math.abs(parseInt(box.qty, 10) || 0);
    const pn = String(box.packing_number ?? defaultPacking ?? "").trim();
    if (!groups.has(code)) {
      groups.set(code, {
        acc_code: code,
        acc_name: boxRowCustomerLabel(box),
        packing_number: pn,
        qty: 0,
        box_count: 0,
      });
    }
    const g = groups.get(code);
    g.qty += qty;
    g.box_count += 1;
    if (!g.packing_number && pn) g.packing_number = pn;
    if (g.acc_name === code && boxRowCustomerLabel(box) !== code) {
      g.acc_name = boxRowCustomerLabel(box);
    }
  }
  return [...groups.values()];
}

export function resolveMinusAccCodeFromSelection(boxes, minusSelectedUids, form, packingPreview) {
  const groups = groupSelectedMinusBoxesByCustomer(
    boxes,
    minusSelectedUids,
    packingPreview?.dailyprod?.doc_no ?? ""
  );
  if (groups.length >= 1) {
    return groups.map((g) => g.acc_code).join(",");
  }
  if (form?.acc_code != null && String(form.acc_code).trim() !== "") {
    return String(form.acc_code).trim();
  }
  const fromPacking = packingPreview?.dailyprod?.acc_code;
  if (fromPacking != null && String(fromPacking).trim() !== "") {
    return String(fromPacking).trim();
  }
  return null;
}
