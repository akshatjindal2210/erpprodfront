const EmptyState = ({
  message = "No records found",
  subMessage = "No records are available for the current selection.",
  icon: Icon,
  isTable,
  colSpan
}) => {
  const content = (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-20 h-20 rounded-[2rem] bg-slate-50 flex items-center justify-center mb-5 border border-slate-100/50 shadow-sm">
        <Icon size={38} className="text-slate-300" strokeWidth={1.5} />
      </div>
      <div className="max-w-xs space-y-2">
        <h3 className="text-base font-semibold text-slate-700 leading-tight">{message}</h3>
        <p className="text-sm text-slate-400 leading-relaxed">{subMessage}</p>
      </div>
    </div>
  );

  return isTable ? (
    <tr><td colSpan={colSpan} className="p-0 border-none">{content}</td></tr>
  ) : content;
};

export default EmptyState