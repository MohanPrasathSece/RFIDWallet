export default function Button({ variant = 'primary', className = '', ...props }) {
  const base = 'inline-flex items-center justify-center rounded px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
  const variants = {
    primary: 'bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500',
    outline: 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50 focus:ring-emerald-500',
    subtle: 'bg-emerald-50 text-emerald-800 border border-emerald-100 hover:bg-emerald-100',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
  };
  const cn = `${base} ${variants[variant] || variants.primary} ${className}`;
  return <button className={cn} {...props} />;
}
