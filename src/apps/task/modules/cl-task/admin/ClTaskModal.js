import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import Drawer from "@/ui/primitives/Drawer";
import { clTaskService } from "@/apps/task/lib/services/clTaskApi";
import { userService } from "@/apps/task/lib/services/userApi";
import { departmentService } from "@/apps/settings/lib/services/departmentService";
import { designationService } from "@/apps/settings/lib/services/designationService";
import { mapTaskUserToOption } from "@/apps/task/lib/helpers/utilHelper";
import { getTaskDefaultVerifierId } from "@/apps/task/lib/utils/taskSpecialPermissions";
import { parseFormSchema, validateFormSchemaFields } from "@/apps/task/lib/helpers/clTaskFormHelper";
import SearchableSelect from "../../../lib/ui/common/SearchableSelect";
import RichTextEditor from "../../../lib/ui/common/RichTextEditor";
import ClTaskFormBuilder from "../shared/ClTaskFormBuilder";
import ClTaskScheduleSection from "../shared/ClTaskScheduleSection";
import ClTaskAttachmentsField, { parseAttachments } from "../shared/ClTaskAttachmentBlock";
import ClAssigneeSection from "../shared/ClAssigneeSection";
import { ASSIGNMENT_TYPE, resolveAssigneeUsers, personAssignmentFields } from "../shared/clTaskAssignee";
import { ClFormLabel, ClFormError, ClFormToggle, ClWizardFooter, ClWizardSteps, inputBase, inputError } from "../shared/clTaskFormUi";

const WIZARD_STEPS = [
  {
    id: "basics",
    label: "Task",
    hint: "Title, description, SOP, attachments, and schedule.",
  },
  {
    id: "assign",
    label: "Assign",
    hint: "Who does the work and who verifies it.",
  },
  {
    id: "review",
    label: "Form",
    hint: "Create the form people will fill — then save the task.",
  },
];

/** Assign step index (Task=0, Assign=1, Form=2) */
const ASSIGN_STEP_INDEX = 1;

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
  /** Mutually exclusive: DEPT_DESIG | PERSON */
  assignment_type: ASSIGNMENT_TYPE.PERSON,
  department_id: "",
  designation_id: "",
  /** Multi-select designations (DEPT_DESIG mode); designation_id kept for edit compatibility */
  designation_ids: [],
  person_id: "",
  /** Multi-select persons (PERSON mode on create/clone) */
  assigned_user_ids: [],
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
  const personId = item.person_id ? String(item.person_id) : "";
  const designationId = item.designation_id ? String(item.designation_id) : "";
  let assigneeIds = [];
  try {
    const raw = item.assignee_person_ids;
    if (Array.isArray(raw)) assigneeIds = raw.map(String);
    else if (typeof raw === "string" && raw.trim()) {
      const p = JSON.parse(raw);
      if (Array.isArray(p)) assigneeIds = p.map(String);
    }
  } catch {
    assigneeIds = [];
  }

  const isDeptScope = !personId && !assigneeIds.length && !!item.department_id;

  const verifierId = item.verification_user_id ? String(item.verification_user_id) : "";
  const resolvedPersonIds = assigneeIds.length
    ? assigneeIds
    : personId
      ? [personId]
      : [];
  const resolvedPersonId = resolvedPersonIds[0] || "";
  // Single assignee cannot be their own verifier (legacy rows may still have this)
  const safeVerifierId =
    resolvedPersonId && verifierId && verifierId === resolvedPersonId && resolvedPersonIds.length <= 1
      ? ""
      : verifierId;

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
    verification_user_id: safeVerifierId,
    assignment_type: isDeptScope ? ASSIGNMENT_TYPE.DEPT_DESIG : ASSIGNMENT_TYPE.PERSON,
    department_id: item.department_id ? String(item.department_id) : "",
    designation_id: designationId,
    designation_ids: designationId ? [designationId] : [],
    person_id: resolvedPersonId,
    assigned_user_ids: resolvedPersonIds,
    form_fields: schema,
  };
}

/** Clone: copy everything except assignee — user must pick new person(s). */
function masterToCloneForm(item) {
  return {
    ...masterToForm(item),
    assignment_type: ASSIGNMENT_TYPE.PERSON,
    person_id: "",
    assigned_user_ids: [],
    department_id: "",
    designation_id: "",
    designation_ids: [],
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
  const [step, setStep] = useState(0);
  /** Furthest step reached — allows jumping back/forward within visited range */
  const [maxStep, setMaxStep] = useState(0);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  /** Mixed list: existing meta objects + new File instances */
  const [attachments, setAttachments] = useState([]);
  /** Hard lock — prevents double API create if Save is triggered twice before React re-renders */
  const savingLockRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    savingLockRef.current = false;
    setStep(0);
    setMaxStep(0);
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

  /** Selected person id(s) in PERSON mode. */
  const personAssigneeIds = (() => {
    if (form.assignment_type !== ASSIGNMENT_TYPE.PERSON) return [];
    if (form.assigned_user_ids?.length) return form.assigned_user_ids.map(String);
    if (form.person_id) return [String(form.person_id)];
    return [];
  })();

  /**
   * Verification person options:
   * - PERSON (1)  → all users except the assignee (default verifier from profile)
   * - PERSON (2+) → entire user list
   * - DEPT_DESIG  → any non-assignee (external designated verifier)
   */
  const verificationPersonOptions = (() => {
    if (form.assignment_type === ASSIGNMENT_TYPE.PERSON) {
      if (personAssigneeIds.length === 1) {
        const excludeId = personAssigneeIds[0];
        return users.filter((u) => String(u.id) !== excludeId);
      }
      return users;
    }
    const resolved = resolveAssigneeUsers({
      assignmentType: ASSIGNMENT_TYPE.DEPT_DESIG,
      departmentId: form.department_id,
      designationIds: form.designation_ids,
      users,
    });
    const assigneeIdSet = new Set((resolved.users || []).map((u) => String(u.id)));
    return users.filter((u) => !assigneeIdSet.has(String(u.id)));
  })();

  const set = (key, val) => {
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  /** Clear the inactive mode's fields so leftover values never hit the payload. */
  const handleAssignmentTypeChange = (nextType) => {
    setForm((f) => {
      if (nextType === ASSIGNMENT_TYPE.DEPT_DESIG) {
        return {
          ...f,
          assignment_type: ASSIGNMENT_TYPE.DEPT_DESIG,
          person_id: "",
          assigned_user_ids: [],
        };
      }
      return {
        ...f,
        assignment_type: ASSIGNMENT_TYPE.PERSON,
        department_id: "",
        designation_id: "",
        designation_ids: [],
      };
    });
    setErrors((e) => ({
      ...e,
      person_id: "",
      assigned_user_ids: "",
      department_id: "",
      designation_ids: "",
      assignment: "",
    }));
  };

  const handleAssigneeChange = (patch) => {
    setForm((f) => {
      const next = { ...f, ...patch };

      // Single-person pick → auto-fill dept/desig + default verifier from profile
      const singlePersonId =
        patch.person_id != null
          ? patch.person_id
          : Array.isArray(patch.assigned_user_ids) && patch.assigned_user_ids.length === 1
            ? patch.assigned_user_ids[0]
            : null;

      if (singlePersonId && (isEdit || next.assignment_type === ASSIGNMENT_TYPE.PERSON)) {
        const person = users.find((u) => Number(u.id) === Number(singlePersonId));
        if (person) {
          const deptId = person?.department?.id ?? person?.department_id;
          const desigId = person?.designation?.id ?? person?.designation_id;
          next.department_id = deptId != null && deptId !== "" ? String(deptId) : next.department_id;
          next.designation_id = desigId != null && desigId !== "" ? String(desigId) : "";
          next.designation_ids = next.designation_id ? [next.designation_id] : [];

          if (!isEdit && next.assignment_type === ASSIGNMENT_TYPE.PERSON) {
            const verifierId = getTaskDefaultVerifierId(person);
            const safeVerifierId =
              verifierId && Number(verifierId) !== Number(singlePersonId) ? String(verifierId) : "";
            next.verification_required = true;
            // Clear if verifier is the assignee; otherwise apply profile default
            if (
              !next.verification_user_id ||
              Number(next.verification_user_id) === Number(singlePersonId)
            ) {
              next.verification_user_id = safeVerifierId;
            }
          }
        }
      }

      // PERSON: keep verifier valid for current selection
      if (
        next.assignment_type === ASSIGNMENT_TYPE.PERSON &&
        (patch.assigned_user_ids != null || patch.person_id != null)
      ) {
        const assigneeIds = (
          next.assigned_user_ids?.length
            ? next.assigned_user_ids
            : next.person_id
              ? [next.person_id]
              : []
        ).map(String);

        if (assigneeIds.length === 1) {
          // Single assignee cannot verify themselves
          if (
            next.verification_user_id &&
            String(next.verification_user_id) === assigneeIds[0]
          ) {
            next.verification_user_id = "";
          }
        } else if (assigneeIds.length === 0) {
          next.verification_user_id = "";
        }
        // Multi (2+): entire user list — keep current verifier as-is
      } else if (
        next.assignment_type === ASSIGNMENT_TYPE.DEPT_DESIG &&
        next.verification_user_id &&
        assigneeWouldInclude(next, users, next.verification_user_id)
      ) {
        next.verification_user_id = "";
      }

      return next;
    });
    setErrors((e) => {
      const cleared = { ...e };
      Object.keys(patch).forEach((k) => {
        cleared[k] = "";
      });
      cleared.assignment = "";
      return cleared;
    });
  };

  const collectStepErrors = (stepIdx) => {
    const e = {};
    const id = WIZARD_STEPS[stepIdx]?.id;

    if (id === "basics") {
      if (!form.title.trim()) e.title = "Title is required";
      if (form.sop_required) {
        const plainSop = String(form.sop_description || "").replace(/<[^>]+>/g, "").trim();
        if (!plainSop) e.sop_description = "SOP content is required";
      }
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
    }

    if (id === "assign") {
      if (form.assignment_type === ASSIGNMENT_TYPE.DEPT_DESIG) {
        if (!form.department_id) e.department_id = "Department is required";
        const resolved = resolveAssigneeUsers({
          assignmentType: ASSIGNMENT_TYPE.DEPT_DESIG,
          departmentId: form.department_id,
          designationIds: form.designation_ids,
          users,
        });
        if (resolved.error) e.assignment = resolved.error;
      } else {
        if (!form.assigned_user_ids?.length && !form.person_id) {
          e.assigned_user_ids = "Select at least one person";
          e.person_id = "Select at least one person";
        } else {
          const resolved = resolveAssigneeUsers({
            assignmentType: ASSIGNMENT_TYPE.PERSON,
            assignedUserIds: form.assigned_user_ids?.length
              ? form.assigned_user_ids
              : form.person_id
                ? [form.person_id]
                : [],
            users,
          });
          if (resolved.error) e.assignment = resolved.error;
        }
      }
      if (form.verification_required && !form.verification_user_id) {
        e.verification_user_id = "Select person";
      } else if (
        form.verification_required &&
        form.verification_user_id &&
        form.assignment_type === ASSIGNMENT_TYPE.DEPT_DESIG &&
        assigneeWouldInclude(form, users, form.verification_user_id)
      ) {
        e.verification_user_id = "Assignee cannot be the verification person";
      } else if (
        form.verification_required &&
        form.verification_user_id &&
        form.assignment_type === ASSIGNMENT_TYPE.PERSON &&
        personAssigneeIds.length === 1 &&
        personAssigneeIds[0] === String(form.verification_user_id)
      ) {
        e.verification_user_id = "Assignee cannot be the verification person";
      }
    }

    if (id === "review") {
      if (form.form_fields?.length) {
        const schemaErr = validateFormSchemaFields(form.form_fields);
        if (schemaErr) e.form_fields = schemaErr;
      }
    }

    return e;
  };

  const validateStep = (stepIdx) => {
    const e = collectStepErrors(stepIdx);
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validate = () => {
    const e = {
      ...collectStepErrors(0),
      ...collectStepErrors(1),
      ...collectStepErrors(2),
    };
    setErrors(e);
    if (Object.keys(e).length === 0) return true;
    const order = ["basics", "assign", "review"];
    const keysByStep = {
      basics: ["title", "sop_description", "due_time", "recurrence_type", "recurring", "weightage"],
      assign: ["person_id", "assigned_user_ids", "department_id", "assignment", "verification_user_id"],
      review: ["form_fields"],
    };
    for (let i = 0; i < order.length; i++) {
      const keys = keysByStep[order[i]];
      if (keys.some((k) => e[k])) {
        setStep(i);
        break;
      }
    }
    return false;
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    setStep((s) => {
      const next = Math.min(s + 1, WIZARD_STEPS.length - 1);
      setMaxStep((m) => Math.max(m, next));
      return next;
    });
  };

  const goBack = () => {
    setErrors({});
    setStep((s) => Math.max(s - 1, 0));
  };

  /** Shared FormData fields (everything except assignee keys). */
  const buildBaseFormData = () => {
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

  /** Append assignment scope — one master, not one row per person. */
  const appendAssignmentScope = (fd) => {
    if (form.assignment_type === ASSIGNMENT_TYPE.DEPT_DESIG) {
      if (form.department_id) fd.append("department_id", String(form.department_id));
      const desigId = form.designation_ids?.[0] || form.designation_id;
      if (desigId) fd.append("designation_id", String(desigId));
      return fd;
    }

    const ids = [...new Set((form.assigned_user_ids || []).map(String).filter(Boolean))];
    if (ids.length === 0 && form.person_id) ids.push(String(form.person_id));

    if (ids.length === 1) {
      const person = users.find((u) => String(u.id) === ids[0]);
      const fields = person
        ? personAssignmentFields(person, form.department_id)
        : { person_id: ids[0], department_id: form.department_id, designation_id: form.designation_id };
      if (fields.department_id) fd.append("department_id", String(fields.department_id));
      if (fields.designation_id) fd.append("designation_id", String(fields.designation_id));
      fd.append("person_id", String(fields.person_id));
    } else if (ids.length > 1) {
      appendJson(fd, "assignee_person_ids", ids.map(Number));
      if (form.department_id) fd.append("department_id", String(form.department_id));
    }
    return fd;
  };

  const handleSave = useCallback(async () => {
    if (savingLockRef.current) return;
    if (!validate()) return;
    savingLockRef.current = true;
    setSaving(true);
    try {
      if (!isEdit) {
        const resolved = resolveAssigneeUsers({
          assignmentType: form.assignment_type,
          departmentId: form.department_id,
          designationIds: form.designation_ids,
          assignedUserIds: form.assigned_user_ids?.length
            ? form.assigned_user_ids
            : form.person_id
              ? [form.person_id]
              : [],
          users,
        });
        if (resolved.error || !resolved.users.length) {
          toast.error(resolved.error || "No assignees match this selection");
          return;
        }
        if (
          form.assignment_type === ASSIGNMENT_TYPE.DEPT_DESIG &&
          form.verification_required &&
          form.verification_user_id &&
          resolved.users.some((u) => Number(u.id) === Number(form.verification_user_id))
        ) {
          toast.error("Assignee cannot be the verification person");
          return;
        }
        if (
          form.assignment_type === ASSIGNMENT_TYPE.PERSON &&
          form.verification_required &&
          form.verification_user_id &&
          personAssigneeIds.length === 1 &&
          personAssigneeIds[0] === String(form.verification_user_id)
        ) {
          toast.error("Assignee cannot be the verification person");
          return;
        }
      } else {
        // Edit: still ensure current scope resolves to at least one active user
        const resolved = resolveAssigneeUsers({
          assignmentType: form.assignment_type,
          departmentId: form.department_id,
          designationIds: form.designation_ids,
          assignedUserIds: form.assigned_user_ids?.length
            ? form.assigned_user_ids
            : form.person_id
              ? [form.person_id]
              : [],
          users,
        });
        if (resolved.error || !resolved.users.length) {
          toast.error(resolved.error || "No assignees match this selection");
          return;
        }
        if (
          form.assignment_type === ASSIGNMENT_TYPE.DEPT_DESIG &&
          form.verification_required &&
          form.verification_user_id &&
          resolved.users.some((u) => Number(u.id) === Number(form.verification_user_id))
        ) {
          toast.error("Assignee cannot be the verification person");
          return;
        }
        if (
          form.assignment_type === ASSIGNMENT_TYPE.PERSON &&
          form.verification_required &&
          form.verification_user_id &&
          personAssigneeIds.length === 1 &&
          personAssigneeIds[0] === String(form.verification_user_id)
        ) {
          toast.error("Assignee cannot be the verification person");
          return;
        }
      }

      const fd = appendAssignmentScope(buildBaseFormData());
      if (isEdit) {
        await clTaskService.update(editItem.cl_task_id, fd);
        toast.success("CL Task updated — pending assigned tasks now show the latest form");
      } else {
        if (isClone && cloneItem?.cl_task_id) {
          fd.append("cloned_from_id", String(cloneItem.cl_task_id));
        }
        await clTaskService.create(fd);
        toast.success(
          isClone ? "CL Task created from clone" : "CL Task created and activated",
        );
      }
      onSuccess?.();
      onClose?.();
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          `Failed to ${isEdit ? "update" : isClone ? "clone" : "create"} CL Task`,
      );
    } finally {
      savingLockRef.current = false;
      setSaving(false);
    }
  }, [form, onClose, onSuccess, isEdit, isClone, editItem, cloneItem, attachments, users]);

  const fieldCls = (key) => (errors[key] ? inputError : inputBase);
  const isLastStep = step >= WIZARD_STEPS.length - 1;
  const stepId = WIZARD_STEPS[step]?.id;

  const handleWizardSubmit = () => {
    if (isLastStep) handleSave();
    else goNext();
  };

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      onSubmit={handleWizardSubmit}
      closeOnOutside={false}
      title={isEdit ? "Edit CL Task" : isClone ? "Clone CL Task" : "Create CL Task"}
      description={
        isEdit
          ? "Future cycles only — past day tasks stay as-is"
          : isClone
            ? "Copied from clone — review each step, then create"
            : "Continue through steps — create only on the last step"
      }
      headerVariant="form"
      maxWidth="max-w-3xl"
      footer={
        <ClWizardFooter
          onCancel={onClose}
          onBack={goBack}
          onNext={goNext}
          onSave={handleSave}
          saving={saving || loading}
          isFirst={step === 0}
          isLast={isLastStep}
          saveLabel={isEdit ? "Save Changes" : isClone ? "Clone Task" : "Create Task"}
          nextLabel={step === ASSIGN_STEP_INDEX ? "Continue to create" : "Continue"}
        />
      }
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
          <Loader2 size={24} className="animate-spin text-indigo-500" />
          <p className="text-xs">Loading…</p>
        </div>
      ) : (
        <div className="pb-2 min-w-0 max-w-full overflow-x-hidden">
          <ClWizardSteps
            steps={WIZARD_STEPS}
            current={step}
            maxReached={maxStep}
            onStepClick={(idx) => {
              if (idx <= maxStep) {
                setErrors({});
                setStep(idx);
              }
            }}
          />

          {/* Step 1 — Task basics + schedule */}
          {stepId === "basics" && (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <ClFormLabel required>Title</ClFormLabel>
                <input
                  className={fieldCls("title")}
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="e.g. Daily floor checklist"
                  autoFocus
                />
                <ClFormError msg={errors.title} />
              </div>

              <div className="space-y-1.5">
                <ClFormLabel>Description</ClFormLabel>
                <RichTextEditor
                  compact
                  resizable
                  value={form.description}
                  onChange={(html) => set("description", html)}
                  placeholder="What needs to be done…"
                />
              </div>

              <div className="space-y-1.5 rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <ClFormLabel required={form.sop_required}>SOP</ClFormLabel>
                  <ClFormToggle
                    compact
                    label={form.sop_required ? "Required" : "Optional"}
                    description="When required, SOP content must be filled"
                    checked={!!form.sop_required}
                    onChange={(v) => set("sop_required", v)}
                  />
                </div>
                <RichTextEditor
                  compact
                  resizable
                  value={form.sop_description}
                  onChange={(html) => set("sop_description", html)}
                  placeholder={
                    form.sop_required
                      ? "Step-by-step SOP…"
                      : "Step-by-step SOP (optional)…"
                  }
                />
                <ClFormError msg={errors.sop_description} />
              </div>

              <ClTaskAttachmentsField
                value={attachments}
                onChange={setAttachments}
                label="Attachments (optional)"
              />

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
          )}

          {/* Step 2 — Assign */}
          {stepId === "assign" && (
            <div className="space-y-5">
              <ClAssigneeSection
                form={form}
                errors={errors}
                departments={departments}
                designations={designations}
                users={users}
                isEdit={isEdit}
                isClone={isClone}
                onAssignmentTypeChange={handleAssignmentTypeChange}
                onChange={handleAssigneeChange}
              />
              <ClFormError msg={errors.assignment} />

              <div className="space-y-3 rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                <ClFormToggle
                  label="Verification required"
                  description="A verifier reviews the submission before it is marked complete"
                  checked={form.verification_required}
                  onChange={(v) => {
                    set("verification_required", v);
                    if (!v) set("verification_user_id", "");
                  }}
                />
                {form.verification_required && (
                  <SearchableSelect
                    label="Verification person"
                    required
                    options={verificationPersonOptions}
                    value={form.verification_user_id}
                    onChange={(id) => set("verification_user_id", id)}
                    placeholder="Select person"
                    clearable
                    error={errors.verification_user_id}
                  />
                )}
              </div>
            </div>
          )}

          {/* Step 3 — Optional questions + final create */}
          {stepId === "review" && (
            <div className="space-y-2">
              <ClTaskFormBuilder
                fields={form.form_fields}
                onChange={(fields) => set("form_fields", fields)}
              />
              <ClFormError msg={errors.form_fields} />
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}

/** True if verification_user_id is among resolved assignees for the current form mode. */
function assigneeWouldInclude(form, users, verificationUserId) {
  if (!verificationUserId) return false;
  if (form.assignment_type === ASSIGNMENT_TYPE.PERSON || !form.assignment_type) {
    const ids = form.assigned_user_ids?.length
      ? form.assigned_user_ids
      : form.person_id
        ? [form.person_id]
        : [];
    return ids.map(String).includes(String(verificationUserId));
  }
  const resolved = resolveAssigneeUsers({
    assignmentType: ASSIGNMENT_TYPE.DEPT_DESIG,
    departmentId: form.department_id,
    designationIds: form.designation_ids,
    users,
  });
  return (resolved.users || []).some((u) => Number(u.id) === Number(verificationUserId));
}
