"use client";

import { Tag, Hash } from "lucide-react";
import { categoryService } from "@/features/apps/task/services/categoryApi";

import CrudPage      from "@/features/apps/task/components/common/CrudPage";
import CrudTableRow  from "@/features/apps/task/components/common/CrudTableRow";
import AddEditModal  from "@/features/apps/task/components/common/AddEditModal";
import DeleteModal from "@/features/apps/task/components/common/DeleteModal";
import { FilterButtons, FilterPanel, BulkActionBar } from "@/features/apps/task/components/common/CommonFilters";
import { formatDateTime } from "@/features/apps/task/helpers/utilHelper";

const COLUMNS = [
  { label: "#",          key: "id"         },
  { label: "Name",       key: "name"       },
  { label: "Created At", key: "created_at" },
];

const CONFIG = {
  title:       "Category Management",
  breadcrumb:  "Categories",
  accentColor: "violet",
  entity:      "categories",
  service:     categoryService,
  columns:     COLUMNS,
  exportColumns:  [{ label: "ID", key: "id" }, { label: "Name", key: "name" }, { label: "Created At", key: "created_at" }],
  exportFilename: "categories.csv",
  stats: [
    {
      label: "Total Categories", icon: Tag,
      iconBg: "bg-violet-50", iconText: "text-violet-600", borderColor: "border-violet-100",
      getValue: (_items, total) => total,
    },
    {
      label: "Added This Month", icon: Hash,
      iconBg: "bg-indigo-50", iconText: "text-indigo-600", borderColor: "border-indigo-100",
      getValue: (items) => items.filter((i) => {
        const d = new Date(i.created_at), n = new Date();
        return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
      }).length,
    },
  ],
};

export default function CategoriesPage() {
  return (
    <CrudPage
      config={CONFIG}

      renderModal={(props) => (
        <AddEditModal {...props}
          service={categoryService} entityLabel="Category"
          icon={Tag}
          iconBg="bg-violet-50" iconBorder="border-violet-200" iconText="text-violet-600"
          focusColor="violet" buttonColor="violet"
        />
      )}

      renderDeleteModal={(props) => (
        <DeleteModal {...props} service={categoryService} entityLabel="Category" />
      )}

      renderRow={(props) => (
        <CrudTableRow {...props}
          columns={COLUMNS}
          entity="categories"
          icon={Tag}
          iconBg="bg-violet-50" iconBorder="border-violet-200" iconText="text-violet-600"
          accentColor="violet"
          formatters={{ created_at: (v) => formatDateTime(v) }}
        />
      )}

      renderFilterButtons={(p) => <FilterButtons {...p} accentColor="violet" />}
      renderFilterPanel={(p)   => <FilterPanel   {...p} accentColor="violet" dateLabel="Created" />}
      renderBulkBar={(p)       => <BulkActionBar {...p} accentColor="violet" />}
    />
  );
}
