export default function Card({ className = '', children }) {
  return (
    <div className={`bg-white rounded border border-emerald-100 shadow-sm ${className}`}>
      {children}
    </div>
  );
}
