"use client";

import { useState, useEffect, useRef, useCallback, Fragment } from "react";
import { toast } from "react-toastify";
import { AlertCircle, Loader2, Shield, Plus, Trash2, Eye, Package, Copy } from "lucide-react";
import { notify } from "@/apps/rmstore/lib/utils/notify";

import { specService } from "@/apps/rmstore/lib/services/spec";
import { productionErpHelpers } from "@/apps/rmstore/lib/services/production";
import RmStoreDrawerFooter from "@/apps/rmstore/lib/helpers/RmStoreDrawerFooter";
import SearchableSelect from "@/ui/common/forms/SearchableSelect";
import Drawer from "@/ui/primitives/Drawer";
import ModuleSopAcknowledgment from "@/ui/common/system/ModuleSopAcknowledgment";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { useSelector } from "react-redux";
import { selectUser } from "@/platform/store/slices/authSlice";
import { canTypeSpecValues } from "@/apps/rmstore/lib/utils/rmstoreSpecialPermissions";
import { SpecColoredHeaderField, SpecPlainHeaderField, SpecSizeField } from "./specHeaderUi";
import { ERR_INPUT, OK_INPUT } from "@/ui/common/Constants";
import { focusFirstError } from "@/platform/utils/form/formFocus";

const MODULE = "rm_spec_master";
const FIELD_ORDER = ["item_dcode", "condition", "grade", "size", "specs"];

function fetchSpecHeaderSuggestions(field) {
  return (search = "") => specService.getHeaderValues(field, { search }).then((res) => (Array.isArray(res?.data) ? res.data : []));
}

const fetchConditionSuggestions = fetchSpecHeaderSuggestions("condition");
const fetchGradeSuggestions = fetchSpecHeaderSuggestions("grade");
const fetchSizeSuggestions = fetchSpecHeaderSuggestions("size");
const fetchConditionColorSuggestions = fetchSpecHeaderSuggestions("condition_color");
const fetchGradeColorSuggestions = fetchSpecHeaderSuggestions("grade_color");

const SPEC_TYPE_OPTIONS = [
  { value: "min", label: "Minimum" },
  { value: "max", label: "Maximum" },
  { value: "range", label: "Range" },
  { value: "dropdown", label: "Dropdown" },
];

/** Line "Type" dropdown — add more entries here as needed. */
const TYPE_OPTIONS = [
  { value: "RM", label: "RM" },
];

const cellInput = (hasError, readOnly) =>
  `${hasError ? ERR_INPUT : OK_INPUT} text-[11px] h-7 rounded-md px-1.5 ${readOnly ? "bg-slate-50" : ""}`;

let lineKeySeq = 0;
const nextLineKey = (prefix = "line") => {
  lineKeySeq += 1;
  return `${prefix}-${Date.now()}-${lineKeySeq}-${Math.random().toString(36).slice(2, 7)}`;
};

const withAutoSno = (lines) =>
  (lines || []).map((line, i) => ({ ...line, sno: i + 1 }));

const emptyLine = () => ({
  _key: nextLineKey("new"),
  spec_id: null,
  sno: 1,
  type: TYPE_OPTIONS[0]?.value || "RM",
  spec_name: "",
  remarks: "",
  print_val: "",
  inspection_method: "",
  spec_type: "min",
  min_value: "",
  max_value: "",
  correct_option: "",
  incorrect_option: "",
  document_required: false,
});

function numToInput(v) {
  if (v === "" || v == null) return "";
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : "";
}

function splitOptions(text) {
  return String(text || "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

function normalizeOptions(text) {
  return splitOptions(text).join(", ");
}

function parseNonNegative(raw, label) {
  const text = raw == null ? "" : String(raw).trim();
  if (!text) return { error: `Enter a valid ${label}.` };
  const n = Number(text);
  if (!Number.isFinite(n)) return { error: `Enter a valid ${label}.` };
  if (n < 0) return { error: `The ${label} cannot be below 0.` };
  return { value: n };
}

function hydrateLine(spec, index = 0) {
  const spec_type = String(spec?.spec_type || "min").toLowerCase();
  const rawType = String(spec?.type ?? "").trim();
  const type = TYPE_OPTIONS.some((o) => o.value === rawType)
    ? rawType
    : (TYPE_OPTIONS[0]?.value || "RM");
  const base = {
    _key: spec?.spec_id != null ? `spec-${spec.spec_id}` : nextLineKey(`idx${index}`),
    spec_id: spec?.spec_id ?? null,
    sno: index + 1,
    type,
    spec_name: spec?.spec_name ?? "",
    remarks: spec?.remarks ?? "",
    print_val: spec?.print_val ?? "",
    inspection_method: spec?.inspection_method
      ? String(spec.inspection_method).trim()
      : "",
    spec_type: SPEC_TYPE_OPTIONS.some((o) => o.value === spec_type) ? spec_type : "min",
    min_value: "",
    max_value: "",
    correct_option: "",
    incorrect_option: "",
    document_required: Boolean(spec?.document_required),
  };

  if (base.spec_type === "dropdown") {
    base.correct_option = normalizeOptions(spec?.correct_option);
    base.incorrect_option = normalizeOptions(spec?.incorrect_option);
    return base;
  }

  if (base.spec_type === "range") {
    base.min_value = numToInput(spec?.min_value);
    base.max_value = numToInput(spec?.max_value);
    return base;
  }

  if (base.spec_type === "max") {
    base.max_value = numToInput(spec?.max_value);
    return base;
  }

  base.min_value = numToInput(spec?.min_value);
  return base;
}

function validateLine(line, index) {
  const prefix = `Line ${index + 1}`;
  if (!TYPE_OPTIONS.some((o) => o.value === line.type)) {
    return `${prefix}: Type is required.`;
  }
  if (!String(line.spec_name || "").trim()) return `${prefix}: Spec name is required.`;
  if (!String(line.print_val || "").trim()) return `${prefix}: Print is required.`;
  if (!String(line.inspection_method || "").trim()) {
    return `${prefix}: Inspection method is required.`;
  }
  if (!line.spec_type) return `${prefix}: Spec type is required.`;

  if (line.spec_type === "min") {
    const parsed = parseNonNegative(line.min_value, "min value");
    if (parsed.error) return `${prefix}: ${parsed.error}`;
  } else if (line.spec_type === "max") {
    const parsed = parseNonNegative(line.max_value, "max value");
    if (parsed.error) return `${prefix}: ${parsed.error}`;
  } else if (line.spec_type === "range") {
    const minParsed = parseNonNegative(line.min_value, "range minimum");
    if (minParsed.error) return `${prefix}: ${minParsed.error}`;
    const maxParsed = parseNonNegative(line.max_value, "range maximum");
    if (maxParsed.error) return `${prefix}: ${maxParsed.error}`;
    if (minParsed.value > maxParsed.value) {
      return `${prefix}: The range minimum cannot exceed the maximum.`;
    }
  } else if (line.spec_type === "dropdown") {
    const correct = splitOptions(line.correct_option);
    const incorrect = splitOptions(line.incorrect_option);
    if (!correct.length) {
      return `${prefix}: Add at least one correct dropdown option.`;
    }
    if (!incorrect.length) {
      return `${prefix}: Add at least one incorrect dropdown option.`;
    }
    const correctSet = new Set(correct);
    const incorrectSet = new Set(incorrect);
    if (correctSet.size !== correct.length) {
      return `${prefix}: Correct options must be unique.`;
    }
    if (incorrectSet.size !== incorrect.length) {
      return `${prefix}: Incorrect options must be unique.`;
    }
    const overlap = correct.find((c) => incorrectSet.has(c));
    if (overlap) {
      return `${prefix}: "${overlap}" cannot be both correct and incorrect.`;
    }
  }
  return null;
}

/** Red asterisk for required column headings (Remarks is optional). */
function ReqStar() {
  return <span className="text-rose-500"> *</span>;
}

function DocumentRequiredCell({ line, lineIdx, readOnly, onChange }) {
  const required = Boolean(line.document_required);
  if (readOnly) {
    return (
      <span
        className={`inline-flex items-center justify-center h-7 px-1.5 rounded-md text-[9px] font-black uppercase tracking-wide border ${
          required
            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
            : "bg-slate-50 text-slate-500 border-slate-200"
        }`}
      >
        {required ? "Yes" : "No"}
      </span>
    );
  }

  return (
    <select
      value={required ? "true" : "false"}
      onChange={(e) => onChange(lineIdx, e.target.value === "true")}
      className={`${OK_INPUT} text-[10px] h-7 rounded-md px-1 w-full font-bold`}
      title="If Yes, QC must upload a document for this spec"
    >
      <option value="false">No</option>
      <option value="true">Yes</option>
    </select>
  );
}

/** Same two cells for every type — keeps the table aligned. */
function ValueCells({ line, lineIdx, readOnly, hasError, onUpdateLine }) {
  const inputCls = cellInput(hasError, readOnly);
  const type = line.spec_type;

  if (type === "dropdown") {
    return (
      <>
        <td className="px-2 py-1.5">
          <input
            type="text"
            value={line.correct_option}
            disabled={readOnly}
            onChange={(e) => onUpdateLine(lineIdx, { correct_option: e.target.value.toUpperCase() })}
            placeholder="CORRECT VALUES (COMMA-SEPARATED)"
            className={`${inputCls} w-full uppercase`}
            title="Correct dropdown options (stored in CAPS). Separate multiple with commas."
          />
        </td>
        <td className="px-2 py-1.5">
          <input
            type="text"
            value={line.incorrect_option}
            disabled={readOnly}
            onChange={(e) => onUpdateLine(lineIdx, { incorrect_option: e.target.value.toUpperCase() })}
            placeholder="WRONG VALUES (COMMA-SEPARATED)"
            className={`${inputCls} w-full uppercase`}
            title="Incorrect dropdown options (stored in CAPS). Separate multiple with commas."
          />
        </td>
      </>
    );
  }

  const showMin = type === "min" || type === "range";
  const showMax = type === "max" || type === "range";

  return (
    <>
      <td className="px-2 py-1.5">
        {showMin ? (
          <input
            type="number"
            step="any"
            min="0"
            value={line.min_value}
            disabled={readOnly}
            onChange={(e) => onUpdateLine(lineIdx, { min_value: e.target.value })}
            placeholder="Min"
            className={`${inputCls} w-full`}
          />
        ) : (
          <span className="inline-flex items-center h-7 px-1.5 text-[10px] text-slate-300">—</span>
        )}
      </td>
      <td className="px-2 py-1.5">
        {showMax ? (
          <input
            type="number"
            step="any"
            min="0"
            value={line.max_value}
            disabled={readOnly}
            onChange={(e) => onUpdateLine(lineIdx, { max_value: e.target.value })}
            placeholder="Max"
            className={`${inputCls} w-full`}
          />
        ) : (
          <span className="inline-flex items-center h-7 px-1.5 text-[10px] text-slate-300">—</span>
        )}
      </td>
    </>
  );
}

export default function SpecModal({ open, onClose, onSuccess, editData, mode = "add" }) {
  const canAccess = useCanAccess();
  const user = useSelector(selectUser);
  const canTypeHeaders = canTypeSpecValues(user);
  const canApprove = canAccess(MODULE, "authorize").allowed;
  const isEdit = mode === "edit";
  const isApprove = mode === "approve";
  const isView = mode === "view";
  const isClone = mode === "clone";
  const isCreateFlow = mode === "add" || isClone;
  const readOnly = isView;
  const sopPermissionType = isApprove ? "authorize" : isEdit ? "edit" : isView ? "view" : "add";
  const showApproval = canApprove && (isCreateFlow || isApprove);

  const [loading, setLoading] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [itemDcode, setItemDcode] = useState("");
  const [condition, setCondition] = useState("");
  const [grade, setGrade] = useState("");
  const [size, setSize] = useState("");
  const [conditionColor, setConditionColor] = useState("");
  const [gradeColor, setGradeColor] = useState("");
  const [lines, setLines] = useState(() => withAutoSno([emptyLine()]));
  const [approved, setApproved] = useState(false);
  const [wasApproved, setWasApproved] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState("pending");
  const [cloneSourceLabel, setCloneSourceLabel] = useState("");
  const [errors, setErrors] = useState({});
  const sopAckRef = useRef(null);
  const formRef = useRef(null);
  const linesEndRef = useRef(null);
  const savingRef = useRef(false);

  const itemKey = editData?.item_dcode ?? null;

  const clearHeaderMeta = () => {
    setCondition("");
    setGrade("");
    setSize("");
    setConditionColor("");
    setGradeColor("");
  };

  const loadDetail = useCallback(async (item_dcode, { asClone = false } = {}) => {
    setLoadingDetail(true);
    try {
      const res = await specService.getByItem(item_dcode);
      const data = res?.data;
      if (!data?.specs?.length) {
        toast.error("No specifications were found for this item.");
        return;
      }
      const hydrated = withAutoSno(data.specs.map((s, i) => {
        const line = hydrateLine(s, i);
        if (asClone) {
          return {
            ...line,
            _key: nextLineKey("clone"),
            spec_id: null,
          };
        }
        return line;
      }));

      if (asClone) {
        setItemDcode("");
        setCloneSourceLabel(data.item_code || String(data.item_dcode));
        setApproved(false);
        setWasApproved(false);
        setApprovalStatus("pending");
      } else {
        setItemDcode(String(data.item_dcode));
        setCloneSourceLabel("");
        setApproved(isApprove ? true : Boolean(data.approved));
        setWasApproved(Boolean(data.approved));
        setApprovalStatus(data.approval_status || (data.approved ? "authorized" : "pending"));
      }
      setCondition(data.condition != null ? String(data.condition) : "");
      setGrade(data.grade != null ? String(data.grade) : "");
      setSize(data.size != null ? String(data.size) : "");
      setConditionColor(data.condition_color != null ? String(data.condition_color) : "");
      setGradeColor(data.grade_color != null ? String(data.grade_color) : "");
      setLines(hydrated);
    } catch (err) {
      toast.error(err?.message || "Could not load the specifications. Please try again.");
    } finally {
      setLoadingDetail(false);
    }
  }, [isApprove]);

  useEffect(() => {
    let timeoutId;
    if (open) {
      setErrors({});
      if (itemKey && (isEdit || isApprove || isView || isClone)) {
        if (isClone) {
          setItemDcode("");
          clearHeaderMeta();
          setLines(withAutoSno([emptyLine()]));
          setApproved(false);
          setWasApproved(false);
          setApprovalStatus("pending");
          setCloneSourceLabel(editData?.item_code || String(itemKey));
          loadDetail(itemKey, { asClone: true });
        } else {
          setItemDcode(String(itemKey));
          setCondition(editData?.condition != null ? String(editData.condition) : "");
          setGrade(editData?.grade != null ? String(editData.grade) : "");
          setSize(editData?.size != null ? String(editData.size) : "");
          setConditionColor(editData?.condition_color != null ? String(editData.condition_color) : "");
          setGradeColor(editData?.grade_color != null ? String(editData.grade_color) : "");
          setLines(withAutoSno([emptyLine()]));
          setApproved(isApprove ? true : Boolean(editData?.approved));
          setWasApproved(Boolean(editData?.approved));
          setApprovalStatus(editData?.approval_status || (editData?.approved ? "authorized" : "pending"));
          setCloneSourceLabel("");
          loadDetail(itemKey, { asClone: false });
        }
      } else {
        setItemDcode("");
        clearHeaderMeta();
        setLines(withAutoSno([emptyLine()]));
        setApproved(false);
        setWasApproved(false);
        setApprovalStatus("pending");
        setCloneSourceLabel("");
        setLoadingDetail(false);
      }
    } else {
      timeoutId = setTimeout(() => {
        setItemDcode("");
        clearHeaderMeta();
        setLines(withAutoSno([emptyLine()]));
        setApproved(false);
        setWasApproved(false);
        setApprovalStatus("pending");
        setCloneSourceLabel("");
        setErrors({});
        setLoadingDetail(false);
      }, 300);
    }
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed from editData once per open/item
  }, [open, itemKey, isEdit, isApprove, isView, isClone, loadDetail]);

  const updateLine = (idx, patch) => {
    setLines((prev) => withAutoSno(prev.map((line, i) => {
      if (i !== idx) return line;
      const next = { ...line, ...patch };
      if (patch.spec_type != null && patch.spec_type !== line.spec_type) {
        next.min_value = "";
        next.max_value = "";
        next.correct_option = "";
        next.incorrect_option = "";
      }
      return next;
    })));
    setErrors((prev) => {
      if (!prev.specs && !prev[`line_${idx}`]) return prev;
      const next = { ...prev };
      delete next.specs;
      delete next[`line_${idx}`];
      return next;
    });
  };

  const addLine = () => {
    setLines((prev) => withAutoSno([...prev, emptyLine()]));
    requestAnimationFrame(() => {
      linesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  };

  const removeLine = (idx) => {
    setLines((prev) => (prev.length <= 1 ? prev : withAutoSno(prev.filter((_, i) => i !== idx))));
  };

  const validate = () => {
    const newErrors = {};
    if (!itemDcode) newErrors.item_dcode = "Select an RM item.";
    else if (isClone && Number(itemDcode) === Number(editData?.item_dcode)) {
      newErrors.item_dcode = "Choose an RM item different from the clone source.";
    }
    if (!String(condition || "").trim()) newErrors.condition = "Condition is required.";
    if (!String(grade || "").trim()) newErrors.grade = "Grade is required.";
    if (!String(size || "").trim()) newErrors.size = "Size is required.";
    if (!lines.length) newErrors.specs = "Add at least one specification.";

    for (let i = 0; i < lines.length; i++) {
      const msg = validateLine(lines[i], i);
      if (msg) {
        newErrors[`line_${i}`] = msg;
        if (!newErrors.specs) newErrors.specs = msg;
      }
    }
    return newErrors;
  };

  const handleSave = async (statusOverride = null) => {
    if (isView) {
      onClose();
      return;
    }
    if (savingRef.current || loading || loadingDetail) return;

    const newErrors = validate();
    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      const firstMsg =
        newErrors.item_dcode ||
        newErrors.condition ||
        newErrors.grade ||
        newErrors.size ||
        Object.keys(newErrors)
          .filter((k) => k.startsWith("line_"))
          .map((k) => newErrors[k])[0] ||
        newErrors.specs ||
        "Please fill all required fields before saving.";
      toast.error(firstMsg);
      const firstLineErr = Object.keys(newErrors).find((k) => k.startsWith("line_"));
      focusFirstError(
        newErrors,
        firstLineErr ? [firstLineErr, ...FIELD_ORDER] : FIELD_ORDER,
        (key) => formRef.current?.querySelector(`[data-field="${key}"]`)
      );
      return;
    }

    if (!sopAckRef.current?.assertAcknowledged()) return;
    if ((isEdit || isApprove) && !editData?.item_dcode) {
      toast.error("The item is missing. Close and reopen the row.");
      return;
    }
    if (isClone && !editData?.item_dcode) {
      toast.error("The source item is missing. Close and try cloning again.");
      return;
    }

    savingRef.current = true;
    setLoading(true);
    try {
      const specsPayload = withAutoSno(lines).map((line, idx) => {
        const isDropdown = line.spec_type === "dropdown";
        const isMin = line.spec_type === "min";
        const isMax = line.spec_type === "max";
        const row = {
          sno: idx + 1,
          type: String(line.type || "").trim() || TYPE_OPTIONS[0]?.value || "RM",
          spec_name: String(line.spec_name || "").trim(),
          remarks: String(line.remarks || "").trim() || null,
          print_val: String(line.print_val || "").trim() || null,
          inspection_method: String(line.inspection_method || "").trim() || null,
          spec_type: line.spec_type,
          min_value: isMax || isDropdown ? 0 : Number(String(line.min_value).trim()),
          max_value: isMin || isDropdown ? 0 : Number(String(line.max_value).trim()),
          correct_option: isDropdown ? normalizeOptions(line.correct_option) || null : null,
          incorrect_option: isDropdown ? normalizeOptions(line.incorrect_option) || null : null,
          document_required: Boolean(line.document_required),
        };
        if ((isEdit || isApprove) && line.spec_id) row.spec_id = line.spec_id;
        return row;
      });

      const itemId = Number(itemDcode || (!isClone && editData?.item_dcode));
      const sourceItemId = Number(editData?.item_dcode) || itemId;
      const headerMeta = {
        condition: String(condition || "").trim().toUpperCase(),
        grade: String(grade || "").trim().toUpperCase(),
        size: String(size || "").trim().toUpperCase(),
        condition_color: String(conditionColor || "").trim().toUpperCase() || null,
        grade_color: String(gradeColor || "").trim().toUpperCase() || null,
      };
      let response;

      if (isApprove) {
        const finalApproved =
          statusOverride !== null && statusOverride !== undefined
            ? Boolean(statusOverride)
            : canApprove
              ? Boolean(approved)
              : false;
        response = await specService.update(itemId, {
          source_item_dcode: sourceItemId,
          ...headerMeta,
          specs: specsPayload,
          approved: finalApproved,
        });
      } else if (isEdit) {
        response = await specService.update(itemId, {
          source_item_dcode: sourceItemId,
          ...headerMeta,
          specs: specsPayload,
          approved: false,
        });
      } else {
        response = await specService.create({
          item_dcode: itemId,
          ...headerMeta,
          specs: specsPayload,
          approved: canApprove ? Boolean(approved) : false,
        });
      }

      notify(response, isClone ? "RM specification cloned successfully." : "Saved successfully.");
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err?.message || "Could not save the RM specification. Please try again.");
    } finally {
      savingRef.current = false;
      setLoading(false);
    }
  };

  const helperPerms = { permission_module: MODULE, permission_action: "view" };

  const title = isView
    ? "View RM Spec"
    : isApprove
      ? "Approve RM Spec"
      : isEdit
        ? "Edit RM Spec"
        : isClone
          ? "Clone RM Spec"
          : "New RM Spec";

  const footerContent = (
    <RmStoreDrawerFooter
      onClose={onClose}
      loading={loading}
      disabled={loadingDetail}
      readOnly={isView}
      isApprove={isApprove}
      onSave={handleSave}
    />
  );

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      onSubmit={isView ? undefined : () => handleSave(isApprove ? true : undefined)}
      title={title}
      description={
        isView
          ? "Review all specification lines for this RM item"
          : isApprove
            ? "Authorize all specification lines for this RM item"
            : isClone
              ? "Pick a new RM item and adjust the copied specification lines"
              : "Add every specification line for this RM item below"
      }
      footer={footerContent}
      maxWidth="max-w-7xl"
      bodyScrollable
    >
      <div ref={formRef} className="space-y-3 pb-6">
        {isClone && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-indigo-50 border border-indigo-200">
            <Copy size={16} className="text-indigo-600 mt-0.5 shrink-0" />
            <p className="text-[11px] text-indigo-800 font-medium">
              Cloning from <span className="font-bold uppercase">{cloneSourceLabel || "selected item"}</span>.
              Select a <span className="font-bold">new RM item</span>, adjust the lines if needed, then save. The approval workflow stays the same.
            </p>
          </div>
        )}

        {isEdit && (wasApproved || approvalStatus !== "pending") && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200">
            <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-700 font-medium">
              Saving changes will reset <span className="font-bold uppercase">all {lines.length} line{lines.length === 1 ? "" : "s"}</span> to{" "}
              <span className="font-bold uppercase">Pending</span>. Use Approve to authorize them together again.
            </p>
          </div>
        )}

        {isView && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
            <Eye size={16} className="text-slate-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-slate-600 font-medium">
              Read-only view. Use Edit to change the lines, or Approve to update and authorize them together.
            </p>
          </div>
        )}

        {isApprove && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
            <Shield size={16} className="text-emerald-600 mt-0.5 shrink-0" />
            <p className="text-[11px] text-emerald-800 font-medium">
              Status: <span className="font-bold uppercase">{approvalStatus}</span>.
              You can edit the lines here, then set the approval status and save.
              Authorization applies to{" "}
              <span className="font-bold">all lines together</span>.
            </p>
          </div>
        )}

        <div data-field="item_dcode">
          <SearchableSelect label="RM Item (Raw Material)" value={itemDcode}
            onChange={(id) => {
              setItemDcode(id);
              setErrors((p) => {
                if (!p.item_dcode) return p;
                const n = { ...p };
                delete n.item_dcode;
                return n;
              });
            }}
            fetchService={(params) =>
              productionErpHelpers.getRmItemsViews({ ...params, ...helperPerms })
            }
            getByIdService={(id) => productionErpHelpers.getRmItemViewById(id, helperPerms)}
            dataKey="id" labelKey="item_code" selectedLabelKey="itemdesc" subLabelKey="itemdesc" showDuplicateSubLabel preserveApiOrder error={errors.item_dcode} required disabled={isView}
          />
        </div>

        <div className="space-y-4">
          <div className={`grid grid-cols-1 gap-4 ${canTypeHeaders ? "sm:grid-cols-5" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
            <SpecColoredHeaderField
              label="Condition"
              required
              value={condition}
              onChange={setCondition}
              colorValue={conditionColor}
              onColorChange={setConditionColor}
              error={errors.condition || ""}
              readOnly={readOnly}
              active={open}
              dataField="condition"
              fetchSuggestions={fetchConditionSuggestions}
              canType={canTypeHeaders}
              withColor
              placeholder="e.g. HHB"
              onClearError={() => {
                if (errors.condition) {
                  setErrors((p) => {
                    const n = { ...p };
                    delete n.condition;
                    return n;
                  });
                }
              }}
            />
            {canTypeHeaders ? (
              <SpecPlainHeaderField
                label="Condition Color"
                value={conditionColor}
                onChange={setConditionColor}
                error={errors.condition_color || ""}
                readOnly={readOnly}
                active={open}
                dataField="condition_color"
                fetchSuggestions={fetchConditionColorSuggestions}
                canType={canTypeHeaders}
                colorField
                placeholder="Type or pick color..."
                onClearError={() => {
                  if (errors.condition_color) {
                    setErrors((p) => {
                      const n = { ...p };
                      delete n.condition_color;
                      return n;
                    });
                  }
                }}
              />
            ) : null}
          
            <SpecColoredHeaderField
              label="Grade"
              required
              value={grade}
              onChange={setGrade}
              colorValue={gradeColor}
              onColorChange={setGradeColor}
              error={errors.grade || ""}
              readOnly={readOnly}
              active={open}
              dataField="grade"
              fetchSuggestions={fetchGradeSuggestions}
              canType={canTypeHeaders}
              withColor
              placeholder="e.g. MIX GRADE"
              onClearError={() => {
                if (errors.grade) {
                  setErrors((p) => {
                    const n = { ...p };
                    delete n.grade;
                    return n;
                  });
                }
              }}
            />
            {canTypeHeaders ? (
              <SpecPlainHeaderField
                label="Grade Color"
                value={gradeColor}
                onChange={setGradeColor}
                error={errors.grade_color || ""}
                readOnly={readOnly}
                active={open}
                dataField="grade_color"
                fetchSuggestions={fetchGradeColorSuggestions}
                canType={canTypeHeaders}
                colorField
                placeholder="Type or pick color..."
                onClearError={() => {
                  if (errors.grade_color) {
                    setErrors((p) => {
                      const n = { ...p };
                      delete n.grade_color;
                      return n;
                    });
                  }
                }}
              />
            ) : null}
            <SpecSizeField
              value={size}
              onChange={setSize}
              error={errors.size || ""}
              readOnly={readOnly}
              active={open}
              fetchSuggestions={fetchSizeSuggestions}
              onClearError={() => {
                if (errors.size) {
                  setErrors((p) => {
                    const n = { ...p };
                    delete n.size;
                    return n;
                  });
                }
              }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm" data-field="specs">
          <div className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Package size={14} className="text-indigo-600" />
              <h3 className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                Spec Breakdown
              </h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded-md border border-indigo-200 bg-indigo-50 text-[10px] font-bold text-indigo-600">
                {loadingDetail ? "…" : lines.length} line{lines.length === 1 ? "" : "s"}
              </span>
            </div>
            {!readOnly && (
              <button
                type="button"
                onClick={addLine}
                disabled={loadingDetail}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-md disabled:opacity-50"
              >
                <Plus size={12} /> Add Row
              </button>
            )}
          </div>

          {errors.specs && !Object.keys(errors).some((k) => k.startsWith("line_")) && (
            <p className="px-3 py-1.5 text-[9px] text-rose-500 font-bold border-b border-rose-100 bg-rose-50/50">{errors.specs}</p>
          )}

          {loadingDetail ? (
            <div className="flex items-center justify-center gap-2 py-10 text-slate-500 text-sm">
              <Loader2 size={18} className="animate-spin" /> Loading specification rows…
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] border-collapse text-left">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[9px] font-black uppercase tracking-wider text-slate-500">
                    <th className="px-2 py-2 w-12 text-center">Serial No.</th>
                    <th className="px-2 py-2 min-w-[140px]">Spec Name{ReqStar()}</th>
                    <th className="px-2 py-2 w-[90px]">Print{ReqStar()}</th>
                    <th className="px-2 py-2 min-w-[120px]">Inspection Method{ReqStar()}</th>
                    <th className="px-2 py-2 w-[110px]">Spec Type{ReqStar()}</th>
                    <th className="px-2 py-2 min-w-[110px]" title="Min value, or Correct options for Dropdown">
                      Min / Correct{ReqStar()}
                    </th>
                    <th className="px-2 py-2 min-w-[110px]" title="Max value, or Incorrect options for Dropdown">
                      Max / Incorrect{ReqStar()}
                    </th>
                    <th className="px-2 py-2 min-w-[120px]">Remarks</th>
                    <th className="px-2 py-2 w-[80px]" title="If Yes, QC must upload a document">Doc</th>
                    {!readOnly && <th className="px-2 py-2 w-10" />}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => {
                    const lineErr = errors[`line_${idx}`];
                    const inputCls = cellInput(!!lineErr, readOnly);
                    return (
                      <Fragment key={line._key}>
                        <tr
                          data-field={`line_${idx}`}
                          className={`border-b border-slate-100 align-middle ${lineErr ? "bg-rose-50/40" : "bg-white hover:bg-slate-50/60"}`}
                        >
                          <td className="px-2 py-1.5 text-center">
                            <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-1.5 rounded-md bg-slate-100 border border-slate-200 text-[11px] font-black text-slate-700 tabular-nums">
                              {idx + 1}
                            </span>
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="text"
                              value={line.spec_name}
                              disabled={readOnly}
                              onChange={(e) => updateLine(idx, { spec_name: e.target.value })}
                              placeholder="e.g. Thickness"
                              className={`${inputCls} w-full`}
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="text"
                              value={line.print_val}
                              disabled={readOnly}
                              onChange={(e) => updateLine(idx, { print_val: e.target.value })}
                              placeholder="Print"
                              className={`${inputCls} w-full`}
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="text"
                              value={line.inspection_method}
                              disabled={readOnly}
                              onChange={(e) =>
                                updateLine(idx, { inspection_method: e.target.value })
                              }
                              placeholder="e.g. Visual / Physical"
                              className={`${inputCls} w-full`}
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <select
                              value={line.spec_type}
                              disabled={readOnly}
                              onChange={(e) => updateLine(idx, { spec_type: e.target.value })}
                              className={`${inputCls} w-full`}
                            >
                              {SPEC_TYPE_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                          </td>
                          <ValueCells
                            line={line}
                            lineIdx={idx}
                            readOnly={readOnly}
                            hasError={!!lineErr}
                            onUpdateLine={updateLine}
                          />
                          <td className="px-2 py-1.5">
                            <input
                              type="text"
                              value={line.remarks}
                              disabled={readOnly}
                              onChange={(e) => updateLine(idx, { remarks: e.target.value })}
                              placeholder="Optional (not required)"
                              className={`${OK_INPUT} text-[11px] h-7 rounded-md px-1.5 w-full ${readOnly ? "bg-slate-50" : ""}`}
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <DocumentRequiredCell
                              line={line}
                              lineIdx={idx}
                              readOnly={readOnly}
                              onChange={(i, value) => updateLine(i, { document_required: value })}
                            />
                          </td>
                          {!readOnly && (
                            <td className="px-1 py-1.5">
                              {lines.length > 1 ? (
                                <button
                                  type="button"
                                  onClick={() => removeLine(idx)}
                                  className="p-1.5 text-rose-400 hover:bg-rose-50 rounded-md"
                                  title="Remove row"
                                >
                                  <Trash2 size={13} />
                                </button>
                              ) : null}
                            </td>
                          )}
                        </tr>
                        {lineErr ? (
                          <tr className="bg-rose-50/50">
                            <td colSpan={readOnly ? 9 : 10} className="px-3 py-1 text-[9px] text-rose-600 font-bold">
                              {lineErr}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
              <div ref={linesEndRef} />
            </div>
          )}
        </div>

        {showApproval ? (
          <div className={`p-3 rounded-xl border transition-all flex items-center justify-between ${approved ? "bg-emerald-600 border-emerald-700 shadow-sm" : "bg-slate-50 border-slate-200"}`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${approved ? "bg-white/20 text-white" : "bg-slate-200 text-slate-500"}`}>
                <Shield size={16} />
              </div>
              <div>
                <p className={`text-xs font-bold ${approved ? "text-white" : "text-slate-700"}`}>Approval Status</p>
                <p className={`text-[9px] uppercase font-bold tracking-tight ${approved ? "text-emerald-100" : "text-slate-400"}`}>
                  {approved ? "Final & Locked" : "Draft Mode"}
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} className="sr-only peer" />
              <div className="w-10 h-5.5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-emerald-400" />
            </label>
          </div>
        ) : isView || isEdit ? (
          <div className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
            approvalStatus === "authorized" || wasApproved
              ? "bg-emerald-600 border-emerald-700 shadow-sm"
              : "bg-slate-50 border-slate-200"
          }`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${
                approvalStatus === "authorized" || wasApproved
                  ? "bg-white/20 text-white"
                  : "bg-slate-200 text-slate-500"
              }`}>
                <Shield size={16} />
              </div>
              <div>
                <p className={`text-xs font-bold ${
                  approvalStatus === "authorized" || wasApproved ? "text-white" : "text-slate-700"
                }`}>
                  Approval Status
                </p>
                <p className={`text-[9px] uppercase font-bold tracking-tight ${
                  approvalStatus === "authorized" || wasApproved ? "text-emerald-100" : "text-slate-400"
                }`}>
                  {approvalStatus === "authorized" || wasApproved
                    ? "Final & Locked"
                    : approvalStatus === "partial"
                      ? "Partially Authorized"
                      : isEdit
                        ? "Draft Mode · saving resets to Pending"
                        : "Draft Mode"}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-slate-50 rounded-lg border border-dashed border-slate-200 flex items-center gap-2">
            <AlertCircle size={16} className="text-slate-400" />
            <p className="text-[10px] text-slate-500 italic">This entry will require authorization before becoming active.</p>
          </div>
        )}

        {!isView && (
          <ModuleSopAcknowledgment
            ref={sopAckRef}
            key={`${open}-${sopPermissionType}`}
            moduleSlug={MODULE}
            permissionType={sopPermissionType}
            isOpen={open}
          />
        )}
      </div>
    </Drawer>
  );
}
