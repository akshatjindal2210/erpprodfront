import { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import Drawer from "@/core/components/ui/Drawer";
import { clTaskService } from "@/features/apps/task/services/clTaskApi";
import { userService } from "@/features/apps/task/services/userApi";
import { departmentService } from "@/features/admin/services/departmentService";
import { designationService } from "@/features/admin/services/designationService";
import { mapTaskUserToOption } from "@/features/apps/task/helpers/utilHelper";
import SearchableSelect from "../../common/SearchableSelect";
import RichTextEditor from "../../common/RichTextEditor";
import ClTaskFormBuilder from "../shared/ClTaskFormBuilder";
import ClTaskScheduleSection from "../shared/ClTaskScheduleSection";
import { validateFormSchemaFields } from "@/features/apps/task/helpers/clTaskFormHelper";
import { ClFormSection, ClFormLabel, ClFormError, ClFormToggle, ClDrawerFooter, inputBase, inputError } from "../shared/clTaskFormUi";

const EMPTY = {
  title: "",
  description: "",
  sop_description: "",
  task_type: "open",
  recurrence_type: "daily",
  recurrence_weekdays: [],
  recurrence_month_dates: [],
  recurrence_year_dates: [],
  end_date: "",
  wastage: 1,
  verification_required: true,
  verification_user_id: "",
  department_id: "",
  designation_id: "",
  person_id: "",
  end_date_time: "",
  form_fields: [],
};

export default function ClTaskModal({ open, onClose, onSuccess }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY);
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
  }, [open]);

  const filteredPersons = users.filter((u) => {
    if (form.department_id && Number(u.department?.id) !== Number(form.department_id)) return false;
    if (form.designation_id && Number(u.designation?.id) !== Number(form.designation_id)) return false;
    return true;
  });

  const set = (key, val) => {
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title = "Title is required";

    const isFrequent = form.task_type === "frequently";
    if (isFrequent) {
      if (!form.end_date) e.end_date = "End date is required";
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
    } else if (!form.end_date_time) {
      e.end_date_time = "End date & time is required";
    }

    const w = Number(form.wastage);
    if (!w || w < 1 || w > 10) e.wastage = "Wattage must be between 1 and 10";
    if (form.verification_required && !form.verification_user_id) {
      e.verification_user_id = "Select person";
    }
    for (const field of form.form_fields) {
      if (!field.label?.trim() && field.type !== "section") {
        e.form_fields = "All fields need a label";
        break;
      }
    }
    const schemaErr = validateFormSchemaFields(form.form_fields);
    if (schemaErr) e.form_fields = schemaErr;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = useCallback(async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await clTaskService.create({
        title: form.title.trim(),
        description: form.description || null,
        sop_description: form.sop_description || null,
        task_type: form.task_type,
        recurrence_type: form.task_type === "frequently" ? form.recurrence_type : null,
        recurrence_weekdays: form.task_type === "frequently" ? form.recurrence_weekdays : [],
        recurrence_month_dates: form.task_type === "frequently" ? form.recurrence_month_dates : [],
        recurrence_year_dates: form.task_type === "frequently" ? form.recurrence_year_dates : [],
        wastage: Number(form.wastage),
        verification_required: form.verification_required,
        scoring_enabled: form.verification_required,
        verification_user_id: form.verification_required ? form.verification_user_id : null,
        department_id: form.department_id || null,
        designation_id: form.designation_id || null,
        person_id: form.person_id || null,
        end_date_time: form.task_type === "frequently"
          ? (form.end_date ? `${form.end_date}T23:59` : form.end_date_time)
          : form.end_date_time,
        form_schema: form.form_fields,
      });
      toast.success("CL Task created successfully");
      onSuccess?.();
      onClose?.();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create CL Task");
    } finally {
      setSaving(false);
    }
  }, [form, onClose, onSuccess]);

  const fieldCls = (key) => (errors[key] ? inputError : inputBase);

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      onSubmit={handleSave}
      closeOnOutside={false}
      title="Create CL Task"
      description="Task details, custom form fields & assignment"
      headerVariant="form"
      maxWidth="max-w-4xl"
      footer={
        <ClDrawerFooter
          onCancel={onClose}
          onSave={handleSave}
          saving={saving || loading}
          saveLabel="Create Task"
        />
      }
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
          <Loader2 size={28} className="animate-spin text-indigo-500" />
          <p className="text-sm">Loading form…</p>
        </div>
      ) : (
        <form
          className="space-y-4 pb-6 min-w-0 max-w-full overflow-x-hidden"
          onSubmit={(e) => { e.preventDefault(); handleSave(); }}
        >
          <ClFormSection title="Task Details">
            <div>
              <ClFormLabel required>Title</ClFormLabel>
              <input className={fieldCls("title")} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Task title" />
              <ClFormError msg={errors.title} />
            </div>
            <div>
              <ClFormLabel>Description</ClFormLabel>
              <RichTextEditor
                value={form.description}
                onChange={(html) => set("description", html)}
                placeholder="What needs to be done? Use formatting, lists, links…"
              />
            </div>
          </ClFormSection>

          <ClFormSection title="SOP">
            <ClFormLabel>Standard Operating Procedure</ClFormLabel>
            <RichTextEditor
              value={form.sop_description}
              onChange={(html) => set("sop_description", html)}
              placeholder="Step-by-step SOP for the person completing this task…"
            />
          </ClFormSection>

          <ClFormSection title="Custom Form">
            <ClTaskFormBuilder fields={form.form_fields} onChange={(fields) => set("form_fields", fields)} />
            <ClFormError msg={errors.form_fields} />
          </ClFormSection>

          <ClTaskScheduleSection
            form={form}
            errors={errors}
            onChange={(patch) => {
              Object.entries(patch).forEach(([k, v]) => set(k, v));
            }}
          />

          <ClFormSection title="Verification & Scoring">
            <ClFormToggle
              label="Verification Required"
              description="Selected person verifies and gives score 1–10 on approve"
              checked={form.verification_required}
              onChange={(v) => {
                set("verification_required", v);
                if (!v) set("verification_user_id", "");
              }}
            />
            {form.verification_required && (
              <div>
                <ClFormLabel required>Person</ClFormLabel>
                <SearchableSelect
                  options={users}
                  value={form.verification_user_id}
                  onChange={(id) => set("verification_user_id", id)}
                  placeholder="Select person"
                />
                <ClFormError msg={errors.verification_user_id} />
              </div>
            )}
          </ClFormSection>

          <ClFormSection title="Assign To">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <ClFormLabel>Department</ClFormLabel>
                <SearchableSelect options={departments} value={form.department_id} onChange={(id) => { set("department_id", id); set("person_id", ""); }} placeholder="Department" />
              </div>
              <div>
                <ClFormLabel>Designation</ClFormLabel>
                <SearchableSelect options={designations} value={form.designation_id} onChange={(id) => { set("designation_id", id); set("person_id", ""); }} placeholder="Designation" />
              </div>
            </div>
            <div>
              <ClFormLabel>Person</ClFormLabel>
              <SearchableSelect options={filteredPersons} value={form.person_id} onChange={(id) => set("person_id", id)} placeholder="Select person" />
            </div>
            {form.task_type !== "frequently" && (
              <div>
                <ClFormLabel required>End Date & Time</ClFormLabel>
                <input type="datetime-local" className={fieldCls("end_date_time")} value={form.end_date_time} onChange={(e) => set("end_date_time", e.target.value)} />
                <ClFormError msg={errors.end_date_time} />
              </div>
            )}
          </ClFormSection>
        </form>
      )}
    </Drawer>
  );
}
