import { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import Drawer from "@/core/components/ui/Drawer";
import { clTaskService } from "@/features/apps/task/services/clTaskApi";
import { userService } from "@/features/apps/task/services/userApi";
import { departmentService } from "@/features/admin/services/departmentService";
import { designationService } from "@/features/admin/services/designationService";
import { mapTaskUserToOption } from "@/features/apps/task/helpers/utilHelper";
import { getTaskDefaultVerifierId } from "@/features/apps/task/utils/taskSpecialPermissions";
import { parseFormSchema, validateFormSchemaFields } from "@/features/apps/task/helpers/clTaskFormHelper";
import SearchableSelect from "../../common/SearchableSelect";
import RichTextEditor from "../../common/RichTextEditor";
import ClTaskFormBuilder from "../shared/ClTaskFormBuilder";
import ClTaskScheduleSection from "../shared/ClTaskScheduleSection";
import ClTaskAttachmentsField, { parseAttachments } from "../shared/ClTaskAttachmentBlock";
import { ClFormLabel, ClFormError, ClFormToggle, ClDrawerFooter, inputBase, inputError } from "../shared/clTaskFormUi";

const EMPTY = {
  title: "",
  description: "",
  sop_description: "",
  sop_required: false,
  task_type: "open",
  recurrence_type: "daily",
  recurrence_weekdays: [],
  recurrence_month_dates: [],
  recurrence_year_dates: [],
  end_date: "",
  due_time: "11:00",
  day_offset: 0,
  weightage: 1,
  verification_required: true,
  verification_user_id: "",
  department_id: "",
  designation_id: "",
  person_id: "",
  form_fields: [],
};

function parseArr(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

function masterToForm(item) {
  if (!item) return EMPTY;
  const schema = parseFormSchema(item.form_schema);
  return {
    ...EMPTY,
    title: item.title || "",
    description: item.description || "",
    sop_description: item.sop_description || "",
    sop_required: item.sop_required === true,
    task_type: item.task_type || "open",
    recurrence_type: item.recurrence_type || "daily",
    recurrence_weekdays: parseArr(item.recurrence_weekdays),
    recurrence_month_dates: parseArr(item.recurrence_month_dates),
    recurrence_year_dates: parseArr(item.recurrence_year_dates),
    due_time: item.due_time || "11:00",
    day_offset: Number.isFinite(Number(item.day_offset)) ? Number(item.day_offset) : 0,
    weightage: item.weightage ?? item.wastage ?? 1,
    verification_required: item.verification_required !== false,
    verification_user_id: item.verification_user_id ? String(item.verification_user_id) : "",
    department_id: item.department_id ? String(item.department_id) : "",
    designation_id: item.designation_id ? String(item.designation_id) : "",
    person_id: item.person_id ? String(item.person_id) : "",
    form_fields: schema,
  };
}

/** Clone: copy everything except person — user must pick a new assignee. */
function masterToCloneForm(item) {
  return {
    ...masterToForm(item),
    person_id: "",
  };
}

function appendJson(fd, key, value) {
  if (value == null) return;
  fd.append(key, typeof value === "string" ? value : JSON.stringify(value));
}

export default function ClTaskModal({ open, onClose, onSuccess, editItem = null, cloneItem = null }) {
  const isEdit = !!editItem?.cl_task_id;
  const isClone = !isEdit && !!cloneItem?.cl_task_id;
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  /** Mixed list: existing meta objects + new File instances */
  const [attachments, setAttachments] = useState([]);

  useEffect(() => {
    if (!open) return;
    if (isEdit) {
      setForm(masterToForm(editItem));
      setAttachments(parseAttachments(editItem.attachment));
    } else if (isClone) {
      setForm(masterToCloneForm(cloneItem));
      setAttachments(parseAttachments(cloneItem.attachment));
    } else {
      setForm(EMPTY);
      setAttachments([]);
    }
    setErrors({});
    setLoading(true);
    Promise.all([
      userService.getViews(),
      departmentService.getViews(),
      designationService.getViews(),
    ])
      .then(([userRes, deptRes, desRes]) => {
        setUsers((userRes.data?.data || []).map(mapTaskUserToOption));
        setDepartments((deptRes.data || []).map((d) => ({ id: d.id, name: d.name })));
        setDesignations((desRes.data || []).map((d) => ({ id: d.id, name: d.name })));
      })
      .catch(() => toast.error("Failed to load form data"))
      .finally(() => setLoading(false));
  }, [open, editItem, cloneItem, isEdit, isClone]);

  const filteredPersons = users.filter((u) => {
    if (form.department_id && Number(u.department?.id ?? u.department_id) !== Number(form.department_id)) return false;
    if (form.designation_id && Number(u.designation?.id ?? u.designation_id) !== Number(form.designation_id)) return false;
    return true;
  });

  /** Assignee cannot verify their own CL task. */
  const verificationPersonOptions = users.filter(
    (u) => !form.person_id || Number(u.id) !== Number(form.person_id),
  );

  const set = (key, val) => {
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  const applyPersonDefaultVerifier = (personId) => {
    const person = users.find((u) => Number(u.id) === Number(personId));
    const verifierId = getTaskDefaultVerifierId(person);
    // Default verifier must not be the same person being assigned
    const safeVerifierId = verifierId && Number(verifierId) !== Number(personId) ? verifierId : null;
    const deptId = person?.department?.id ?? person?.department_id;
    const desigId = person?.designation?.id ?? person?.designation_id;
    setForm((f) => {
      const next = {
        ...f,
        person_id: personId,
        // Selecting a person auto-fills their department & designation
        department_id: deptId != null && deptId !== "" ? String(deptId) : f.department_id,
        designation_id: desigId != null && desigId !== "" ? String(desigId) : f.designation_id,
      };
      if (safeVerifierId) {
        next.verification_required = true;
        next.verification_user_id = String(safeVerifierId);
      } else if (Number(f.verification_user_id) === Number(personId)) {
        next.verification_user_id = "";
      }
      return next;
    });
    setErrors((e) => ({ ...e, person_id: "", verification_user_id: "", department_id: "", designation_id: "" }));
  };

  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title = "Title is required";
    if (!form.person_id) e.person_id = "Person is required";

    const isFrequent = form.task_type === "frequently";
    if (isFrequent) {
      if (!form.due_time) e.due_time = "Fill-before time is required";
      if (!form.recurrence_type) e.recurrence_type = "Select frequency";
      if (form.recurrence_type === "weekly" && !form.recurrence_weekdays?.length) {
        e.recurring = "Select at least one day";
      }
      if (form.recurrence_type === "monthly" && !form.recurrence_month_dates?.length) {
        e.recurring = "Select at least one date";
      }
      if (form.recurrence_type === "yearly" && !form.recurrence_year_dates?.length) {
        e.recurring = "Select at least one date";
      }
    }

    const w = Number(form.weightage);
    if (!w || w < 1 || w > 10) e.weightage = "Weightage must be between 1 and 10";
    if (form.sop_required) {
      const plainSop = String(form.sop_description || "").replace(/<[^>]+>/g, "").trim();
      if (!plainSop) e.sop_description = "SOP content is required when acknowledgment is required";
    }
    if (form.verification_required && !form.verification_user_id) {
      e.verification_user_id = "Select person";
    } else if (
      form.verification_required &&
      form.verification_user_id &&
      form.person_id &&
      Number(form.verification_user_id) === Number(form.person_id)
    ) {
      e.verification_user_id = "Assignee cannot be the verification person";
    }
    const schemaErr = validateFormSchemaFields(form.form_fields);
    if (schemaErr) e.form_fields = schemaErr;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const buildFormData = () => {
    const isFrequent = form.task_type === "frequently";
    const fd = new FormData();
    fd.append("title", form.title.trim());
    fd.append("description", form.description || "");
    fd.append("sop_description", form.sop_description || "");
    fd.append("sop_required", String(!!form.sop_required));
    fd.append("task_type", form.task_type);
    fd.append("weightage", String(Number(form.weightage)));
    fd.append("verification_required", String(!!form.verification_required));
    fd.append("scoring_enabled", String(!!form.verification_required));
    if (form.verification_required && form.verification_user_id) {
      fd.append("verification_user_id", String(form.verification_user_id));
    }
    if (form.department_id) fd.append("department_id", String(form.department_id));
    if (form.designation_id) fd.append("designation_id", String(form.designation_id));
    if (form.person_id) fd.append("person_id", String(form.person_id));
    if (isFrequent) {
      fd.append("recurrence_type", form.recurrence_type);
      fd.append("due_time", form.due_time || "11:00");
      fd.append("day_offset", String(Number(form.day_offset) || 0));
      appendJson(fd, "recurrence_weekdays", form.recurrence_weekdays || []);
      appendJson(fd, "recurrence_month_dates", form.recurrence_month_dates || []);
      appendJson(fd, "recurrence_year_dates", form.recurrence_year_dates || []);
    } else {
      fd.append("day_offset", "0");
    }
    appendJson(fd, "form_schema", form.form_fields || []);

    const kept = attachments.filter((a) => !(a instanceof File) && a?.file_path);
    const newest = attachments.filter((a) => a instanceof File);
    appendJson(fd, "existing_attachments", kept);
    newest.forEach((f) => fd.append("attachments", f));
    return fd;
  };

  const handleSave = useCallback(async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const fd = buildFormData();
      if (isEdit) {
        await clTaskService.update(editItem.cl_task_id, fd);
        toast.success("CL Task updated — pending assigned tasks now show the latest form");
      } else {
        await clTaskService.create(fd);
        toast.success(isClone ? "CL Task created from clone" : "CL Task created and activated");
      }
      onSuccess?.();
      onClose?.();
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          `Failed to ${isEdit ? "update" : isClone ? "clone" : "create"} CL Task`,
      );
    } finally {
      setSaving(false);
    }
  }, [form, onClose, onSuccess, isEdit, isClone, editItem, cloneItem, attachments]);

  const fieldCls = (key) => (errors[key] ? inputError : inputBase);

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      onSubmit={handleSave}
      closeOnOutside={false}
      title={isEdit ? "Edit CL Task" : isClone ? "Clone CL Task" : "Create CL Task"}
      description={
        isEdit
          ? "Changes apply to future cycles only — already assigned day tasks stay as-is"
          : isClone
            ? "Row data copied — change person / details, then create as a new CL Task Master"
            : "Title · description & SOP · schedule · assign · attachments · form fields"
      }
      headerVariant="form"
      maxWidth="max-w-7xl"
      footer={
        <ClDrawerFooter
          onCancel={onClose}
          onSave={handleSave}
          saving={saving || loading}
          saveLabel={isEdit ? "Save Changes" : isClone ? "Clone Task" : "Create Task"}
        />
      }
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
          <Loader2 size={24} className="animate-spin text-indigo-500" />
          <p className="text-xs">Loading…</p>
        </div>
      ) : (
        <form
          className="pb-2 min-w-0 max-w-full overflow-x-hidden"
          onSubmit={(e) => { e.preventDefault(); handleSave(); }}
        >
          <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-3">
            <div>
              <ClFormLabel required>Title</ClFormLabel>
              <input
                className={fieldCls("title")}
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="Task title"
              />
              <ClFormError msg={errors.title} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div>
                <ClFormLabel>Description</ClFormLabel>
                <RichTextEditor
                  compact
                  resizable
                  value={form.description}
                  onChange={(html) => set("description", html)}
                  placeholder="What needs to be done…"
                />
              </div>
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <ClFormLabel required={form.sop_required}>SOP</ClFormLabel>
                  <ClFormToggle
                    compact
                    label={form.sop_required ? "Required" : "Not Required"}
                    description="When required, assignee must acknowledge the SOP before submit"
                    checked={!!form.sop_required}
                    onChange={(v) => set("sop_required", v)}
                  />
                </div>
                <RichTextEditor
                  compact
                  resizable
                  value={form.sop_description}
                  onChange={(html) => set("sop_description", html)}
                  placeholder="Step-by-step SOP…"
                />
                <ClFormError msg={errors.sop_description} />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <ClTaskAttachmentsField
                value={attachments}
                onChange={setAttachments}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Schedule</p>
                <ClTaskScheduleSection
                  form={form}
                  errors={errors}
                  onChange={(patch) => {
                    setForm((f) => ({ ...f, ...patch }));
                    setErrors((e) => {
                      const next = { ...e };
                      Object.keys(patch).forEach((k) => {
                        next[k] = "";
                      });
                      if ("task_type" in patch) next.recurring = "";
                      return next;
                    });
                  }}
                />
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Assign & verification</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <ClFormLabel>Department</ClFormLabel>
                    <SearchableSelect
                      options={departments}
                      value={form.department_id}
                      onChange={(id) => { set("department_id", id); set("person_id", ""); }}
                      placeholder="Department"
                      heightClass="h-[34px]"
                    />
                  </div>
                  <div>
                    <ClFormLabel>Designation</ClFormLabel>
                    <SearchableSelect
                      options={designations}
                      value={form.designation_id}
                      onChange={(id) => { set("designation_id", id); set("person_id", ""); }}
                      placeholder="Designation"
                      heightClass="h-[34px]"
                    />
                  </div>
                </div>
                <div>
                  <ClFormLabel required>Person</ClFormLabel>
                  <SearchableSelect
                    options={filteredPersons}
                    value={form.person_id}
                    onChange={applyPersonDefaultVerifier}
                    placeholder={isClone ? "Select new person (required)" : "Select person"}
                    heightClass="h-[34px]"
                  />
                  {isClone ? (
                    <p className="text-[10px] text-indigo-600 mt-1 font-medium">
                      Clone clears the old assignee — pick the new person here.
                    </p>
                  ) : null}
                  <ClFormError msg={errors.person_id} />
                </div>
                <div className="pt-1 space-y-1.5">
                  <ClFormToggle
                    compact
                    label="Verification required"
                    checked={form.verification_required}
                    onChange={(v) => {
                      set("verification_required", v);
                      if (!v) set("verification_user_id", "");
                    }}
                  />
                  {form.verification_required && (
                    <div>
                      <ClFormLabel required>Verification person</ClFormLabel>
                      <SearchableSelect
                        options={verificationPersonOptions}
                        value={form.verification_user_id}
                        onChange={(id) => set("verification_user_id", id)}
                        placeholder="Select person"
                        heightClass="h-[34px]"
                      />
                      <ClFormError msg={errors.verification_user_id} />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <ClTaskFormBuilder
                fields={form.form_fields}
                onChange={(fields) => set("form_fields", fields)}
              />
              <ClFormError msg={errors.form_fields} />
            </div>
          </div>
        </form>
      )}
    </Drawer>
  );
}
