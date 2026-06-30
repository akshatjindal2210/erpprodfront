import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { AlertCircle } from "lucide-react";

const WidgetRenderer = ({ widget }) => {
  const data = widget.previewData || widget.data || [];
  const error = widget.error || widget.previewError || null;

  const { type, title, style = {} } = widget;
  const isHeading = type === "heading";
  const alignClass =
    style.contentAlign === "left"
      ? "items-start text-left"
      : style.contentAlign === "right"
        ? "items-end text-right"
        : "items-center text-center";
  const emptyPosClass =
    style.emptyTextPosition === "top"
      ? "justify-start pt-4"
      : style.emptyTextPosition === "bottom"
        ? "justify-end pb-4"
        : "justify-center";

  const renderContent = () => {
    if (type === "heading") {
      return (
        <div className="flex h-full items-center px-2.5 border-b border-slate-200">
          <h2 className="text-base font-extrabold tracking-tight text-slate-800" style={{ color: style.color || "#0f172a" }}>
            {title || widget.description || "Dashboard Heading"}
          </h2>
        </div>
      );
    }

    if (type === "section") {
      const sectionChildren = Array.isArray(widget.sectionChildren) ? widget.sectionChildren : [];
      return (
        <div className="flex h-full flex-col px-3 py-2">
          <div className="w-full mb-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              {title || "Section"}
            </p>
            {widget.description ? (
              <p className="text-[10px] text-slate-400 mt-1">{widget.description}</p>
            ) : null}
          </div>
          {sectionChildren.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 flex-1 min-h-0 overflow-auto custom-scrollbar pr-1">
              {sectionChildren.map((child) => {
                const childData = child.previewData || child.data || [];
                const val = childData[0] ? Object.values(childData[0])[0] : "-";
                return (
                  <div key={`section-child-${child.id}`} className="border border-slate-200 rounded-md p-2 bg-white">
                    <p className="text-[9px] uppercase tracking-widest text-slate-400 font-bold truncate">
                      {child.title || "Widget"}
                    </p>
                    <p className="text-sm font-bold text-blue-600 mt-1 truncate">
                      {typeof val === "number" ? val.toLocaleString() : val}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 grid place-items-center text-[10px] text-slate-400 uppercase tracking-widest font-semibold border border-dashed border-slate-200 rounded-md">
              Assign widgets to this section
            </div>
          )}
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-4 text-center gap-2">
          <AlertCircle className="text-rose-500" size={24} />
          <span className="text-xs font-bold text-rose-600 uppercase tracking-tight">Query Error</span>
          <p className="text-[10px] text-slate-500 line-clamp-3">{error}</p>
        </div>
      );
    }

    if (!widget.query) {
      return (
        <div className={`flex h-full ${alignClass} ${emptyPosClass} text-slate-400 text-[10px] uppercase tracking-widest font-semibold`}>
          {widget.emptyText || "Click edit and add query"}
        </div>
      );
    }

    if (data.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-slate-400 text-[10px] uppercase tracking-widest font-bold">
          No Data Found
        </div>
      );
    }

    const keys = Object.keys(data[0] || {});
    const xKey = keys[0];
    const yKey = keys[1] || keys[0];

    if (type === "bar") {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey={xKey} fontSize={9} tickLine={false} axisLine={false} tick={{ fill: '#64748b' }} />
            <YAxis fontSize={9} tickLine={false} axisLine={false} tick={{ fill: '#64748b' }} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              itemStyle={{ fontSize: '10px', fontWeight: 'bold', color: '#1e293b' }}
              labelStyle={{ color: '#64748b', fontSize: '9px', marginBottom: '4px' }}
            />
            <Bar dataKey={yKey} fill={style.color || "#3b82f6"} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (type === "line") {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey={xKey} fontSize={9} tickLine={false} axisLine={false} tick={{ fill: '#64748b' }} />
            <YAxis fontSize={9} tickLine={false} axisLine={false} tick={{ fill: '#64748b' }} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              itemStyle={{ fontSize: '10px', fontWeight: 'bold', color: '#1e293b' }}
              labelStyle={{ color: '#64748b', fontSize: '9px', marginBottom: '4px' }}
            />
            <Line type="monotone" dataKey={yKey} stroke={style.color || "#3b82f6"} strokeWidth={2} dot={{ r: 3, fill: style.color || "#3b82f6" }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      );
    }

    if (type === "pie") {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px" }}
              itemStyle={{ fontSize: "10px", fontWeight: "bold", color: "#1e293b" }}
            />
            <Pie data={data} dataKey={yKey} nameKey={xKey} outerRadius={70} label>
              {data.map((entry, index) => (
                <Cell
                  // eslint-disable-next-line react/no-array-index-key
                  key={`slice-${index}`}
                  fill={index % 2 === 0 ? style.color || "#3b82f6" : "#93c5fd"}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      );
    }

    if (type === "table") {
      return (
        <div className="overflow-auto h-full custom-scrollbar">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                {keys.map((col) => (
                  <th key={col} className="px-3 py-2 text-left text-[9px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  {keys.map((col) => (
                    <td key={col} className="px-3 py-1.5 whitespace-nowrap text-[10px] text-slate-600 font-medium">
                      {row[col]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (type === "kpi") {
      const val = data[0] ? Object.values(data[0])[0] : 0;
      const label = title || widget.description || "";
      const isTop = (style.kpiLabelPosition || "bottom") === "top";
      return (
        <div className={`flex flex-col justify-center h-full ${alignClass}`}>
          {label && isTop && <div className="text-slate-400 text-[9px] font-bold uppercase tracking-[0.2em] mb-1">{label}</div>}
          <div className="text-3xl font-black tracking-tighter" style={{ color: style.color }}>
            {typeof val === 'number' ? val.toLocaleString() : val}
          </div>
          {label && !isTop && <div className="text-slate-400 text-[9px] font-bold uppercase tracking-[0.2em] mt-1">{label}</div>}
        </div>
      );
    }

    return <div className="flex items-center justify-center h-full text-slate-400 text-[10px] font-bold uppercase">Unknown Widget</div>;
  };

  return (
    <div
      className={`h-full flex flex-col overflow-hidden transition-all ${isHeading ? "bg-transparent border-0 shadow-none" : "bg-white border border-slate-200 shadow-sm hover:shadow-md"}`}
      style={{
        backgroundColor: isHeading ? "transparent" : style.bg,
        borderRadius: style.borderRadius ? `${style.borderRadius}px` : "6px",
      }}
    >
      {title && type !== 'kpi' && type !== "heading" && type !== "section" && (
        <div className="px-4 py-2 border-b border-slate-100 font-bold text-[10px] uppercase tracking-widest text-slate-500 flex justify-between items-center bg-slate-50/50">
          <span style={{ fontSize: style.fontSize ? `${style.fontSize}px` : "10px" }}>{title}</span>
        </div>
      )}
      <div className="flex-1 p-3 overflow-hidden">{renderContent()}</div>
    </div>
  );
};

export default WidgetRenderer;
