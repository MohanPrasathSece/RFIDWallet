export default function Card({ className = '', children }) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded border border-emerald-100 dark:border-gray-700 shadow-sm ${className}`}>
      {children}
    </div>
  );
}
