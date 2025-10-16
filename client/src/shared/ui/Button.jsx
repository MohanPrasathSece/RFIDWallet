export default function Button({ variant = 'primary', className = '', ...props }) {
  const base = 'inline-flex items-center justify-center rounded px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800';
  const variants = {
    primary: 'bg-emerald-600 dark:bg-emerald-700 text-white hover:bg-emerald-700 dark:hover:bg-emerald-600 focus:ring-emerald-500',
    outline: 'bg-white dark:bg-gray-800 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 focus:ring-emerald-500',
    subtle: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/30',
    danger: 'bg-red-600 dark:bg-red-700 text-white hover:bg-red-700 dark:hover:bg-red-600 focus:ring-red-500',
  };
  const cn = `${base} ${variants[variant] || variants.primary} ${className}`;
  return <button className={cn} {...props} />;
}
