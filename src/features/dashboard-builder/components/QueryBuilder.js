import React from "react";

const OPERATORS = [
  { label: "Equals", value: "=" },
  { label: "Not Equals", value: "!=" },
  { label: "Greater Than", value: ">" },
  { label: "Less Than", value: "<" },
  { label: "Contains", value: "like" },
  { label: "In", value: "in" },
  { label: "Is Null", value: "is_null" },
];

const QueryBuilder = ({ filter, columns, onChange }) => {
  const addFilter = () => {
    const newFilter = { ...filter, "": { op: "=", value: "" } };
    onChange(newFilter);
  };

  const removeFilter = (col) => {
    const newFilter = { ...filter };
    delete newFilter[col];
    onChange(newFilter);
  };

  const updateFilter = (oldCol, newCol, op, value) => {
    const newFilter = { ...filter };
    if (oldCol !== newCol) {
      delete newFilter[oldCol];
    }
    newFilter[newCol] = { op, value };
    onChange(newFilter);
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label className="block text-xs font-medium text-gray-700 uppercase">Filters</label>
        <button onClick={addFilter} className="text-blue-600 text-xs font-bold hover:underline">
          + Add Filter
        </button>
      </div>
      {Object.entries(filter).map(([col, cond], index) => (
        <div key={index} className="flex flex-col gap-1 p-2 border rounded bg-gray-50 relative group">
          <button
            onClick={() => removeFilter(col)}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
          >
            ×
          </button>
          <select
            className="w-full border rounded px-1 py-0.5 text-xs"
            value={col}
            onChange={(e) => updateFilter(col, e.target.value, cond.op, cond.value)}
          >
            <option value="">Select Column</option>
            {columns.map((c) => (
              <option key={c.column_name} value={c.column_name}>
                {c.column_name}
              </option>
            ))}
          </select>
          <div className="flex gap-1">
            <select
              className="flex-1 border rounded px-1 py-0.5 text-xs"
              value={cond.op}
              onChange={(e) => updateFilter(col, col, e.target.value, cond.value)}
            >
              {OPERATORS.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>
            {cond.op !== "is_null" && cond.op !== "is_not_null" && (
              <input
                type="text"
                className="flex-1 border rounded px-1 py-0.5 text-xs"
                placeholder="Value"
                value={cond.value}
                onChange={(e) => updateFilter(col, col, cond.op, e.target.value)}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default QueryBuilder;
