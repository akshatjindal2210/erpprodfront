"use client";

import { CalendarDays, Hash } from "lucide-react";
import {
  holidayService,
  CrudPage,
  CrudTableRow,
  AddEditModal,
  DeleteModal,
  FilterButtons,
  FilterPanel,
  BulkActionBar,
  formatDateTime,
} from "@/features/apps/task/common";
import HolidayBulkUpload from "@/features/apps/task/components/holidays/BulkUpload";

const COLUMNS = [
  { label: "#",          key: "id"         },
  { label: "Name",       key: "name"       },
  { label: "Date",       key: "date"       },
  { label: "Created At", key: "created_at" },
];

// "2026-03-20" → "20 Mar 2026" (no timezone issue)
const formatDate = (val) => {
  if (!val) return "—";
  const parts = String(val).split("T")[0].split("-");
  if (parts.length !== 3) return val;
  const [year, month, day] = parts;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${parseInt(day)} ${months[parseInt(month) - 1]} ${year}`;
};

const CONFIG = {
  title:          "Holiday Management",
  breadcrumb:     "Holidays",
  accentColor:    "orange",
  entity:         "holidays",
  idKey:          "id",
  defaultSortKey: "date",
  defaultSortDir: "asc",
  service:        holidayService,
  columns:        COLUMNS,

  extractItems: (res) => res?.data?.data ?? [],
  extractTotal: (res) => res?.data?.total ?? 0,

  exportColumns:  [{ label: "Name", key: "name" }, { label: "Date", key: "date" }],
  exportFilename: "holidays.csv",

  stats: [
    {
      label: "Total Holidays", icon: CalendarDays,
      iconBg: "bg-orange-50", iconText: "text-orange-600", borderColor: "border-orange-100",
      getValue: (_items, total) => total,
    },
    {
      label: "This Month", icon: Hash,
      iconBg: "bg-amber-50", iconText: "text-amber-600", borderColor: "border-amber-100",
      getValue: (items) => items.filter((i) => {
        if (!i.date) return false;
        const [year, month] = i.date.split("-").map(Number);
        const n = new Date();
        return month - 1 === n.getMonth() && year === n.getFullYear();
      }).length,
    },
  ],
};

export default function HolidaysPage() {
  return (
    <CrudPage
      config={CONFIG}

      renderModal={(props) => (
        <AddEditModal {...props}
          service={holidayService} entityLabel="Holiday"
          icon={CalendarDays}
          iconBg="bg-orange-50" iconBorder="border-orange-200" iconText="text-orange-600"
          focusColor="orange" buttonColor="orange"
          extraFields={[{
            key: "date", label: "Date", type: "date", required: true,
            transform: (val) => val ? String(val).split("T")[0] : "",
          }]}
        />
      )}

      renderDeleteModal={(props) => (
        <DeleteModal {...props} service={holidayService} entityLabel="Holiday" />
      )}

      renderRow={(props) => (
        <CrudTableRow {...props}
          columns={COLUMNS}
          entity="holidays"
          icon={CalendarDays}
          iconBg="bg-orange-50" iconBorder="border-orange-200" iconText="text-orange-600"
          accentColor="orange"
          formatters={{
            date:       (v) => formatDate(v),
            created_at: (v) => formatDateTime(v),
          }}
        />
      )}

      renderFilterButtons={(p) => <FilterButtons {...p} accentColor="orange" />}
      renderFilterPanel={(p)   => (
        <FilterPanel {...p}
          accentColor="orange"
          dateLabel="Holiday Date"
          sortOptions={[
            { value: "asc",  label: "Oldest First" },
            { value: "desc", label: "Newest First" },
          ]}
          defaultSortDir="asc"
        />
      )}
      renderBulkBar={(p)   => <BulkActionBar {...p} accentColor="orange" />}
      renderBulkUpload={({ refresh }) => (
        <HolidayBulkUpload onSuccess={refresh} />
      )}
    />
  );
}
