export default function StatCard({ title, value, hint, icon }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3">
      {icon && <div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 grid place-items-center text-lg">{icon}</div>}
      <div className="min-w-0">
        <div className="text-xs text-gray-500 dark:text-gray-400">{title}</div>
        <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100 leading-tight truncate">{value}</div>
        {hint && <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{hint}</div>}
      </div>
    </div>
  );
}
