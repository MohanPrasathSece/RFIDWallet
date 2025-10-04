export default function StatCard({ title, value, hint, icon }) {
  return (
    <div className="bg-white rounded border border-emerald-100 shadow-sm p-4 flex items-center gap-3">
      {icon && <div className="h-10 w-10 rounded-full bg-emerald-50 text-emerald-700 grid place-items-center text-lg">{icon}</div>}
      <div className="min-w-0">
        <div className="text-xs text-gray-500">{title}</div>
        <div className="text-2xl font-semibold text-gray-900 leading-tight truncate">{value}</div>
        {hint && <div className="text-[11px] text-gray-500 mt-0.5">{hint}</div>}
      </div>
    </div>
  );
}
