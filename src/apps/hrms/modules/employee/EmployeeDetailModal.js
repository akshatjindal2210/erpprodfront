"use client";

import { Users } from "lucide-react";
import GlobalDetailModal from "@/ui/common/modals/GlobalDetailModal";
import { MasterDetailBody, MasterDetailGrid, MasterDetailHero, MasterDetailKV, MasterDetailMetrics, MasterDetailSection, MasterDetailStatusRow } from "@/apps/ims/modules/master/MasterDetailLayout";
import { hrmsApproveCell } from "@/apps/hrms/lib/columns/hrmsListCells";

function displayValue(value) {
  if (value == null || value === "") return "—";
  return String(value);
}

function statusLabel(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "approved" || raw === "1" || raw === "true") return "Approved";
  if (raw === "pending" || raw === "0" || raw === "unapproved") return "Pending";
  return displayValue(value);
}

export default function EmployeeDetailModal({ open, record, onClose }) {
  if (!open || !record) return null;

  const name = displayValue(record.emp_name).trim();
  const code = displayValue(record.emp_code);

  return (
    <GlobalDetailModal open={open} onClose={onClose} title="Employee Details" icon={Users} size="wide">
      <MasterDetailBody>
        <MasterDetailHero
          eyebrow="Employee master"
          icon={Users}
          title={name === "—" ? code : name}
          badge={code !== "—" ? code : null}
        />

        <MasterDetailSection label="Organization" tone="white">
          <span>{displayValue(record.deptname)}</span>
          <span>
            Branch {displayValue(record.brcode)} · Dept {displayValue(record.deptcode)}
          </span>
        </MasterDetailSection>

        <MasterDetailMetrics
          columns={2}
          items={[
            { label: "In time", value: displayValue(record.emp_intime_display) },
            { label: "Out time", value: displayValue(record.emp_outtime_display) },
          ]}
        />

        <MasterDetailGrid columns={2}>
          <MasterDetailKV label="Calc OT alw1" value={displayValue(record.calc_ot_alw1)} />
          <MasterDetailKV label="OT alw2 less" value={displayValue(record.ot_alw2_less)} />
          <MasterDetailKV label="Lrd code" value={displayValue(record.lrdcode)} />
          <MasterDetailKV label="OT allow" value={displayValue(record.ot_allow)} />
          <MasterDetailKV label="Stop OT sun" value={displayValue(record.stop_ot_calc_except_sund)} />
        </MasterDetailGrid>

        <MasterDetailStatusRow label="Status">{hrmsApproveCell(statusLabel(record.pauthorise))}</MasterDetailStatusRow>
      </MasterDetailBody>
    </GlobalDetailModal>
  );
}
