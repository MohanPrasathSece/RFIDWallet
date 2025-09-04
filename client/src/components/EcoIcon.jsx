export default function EcoIcon({ className = '' }) {
  // Inline leaf icon (Lucide-like) to avoid extra dependency
  return (
    <div className={`relative ${className}`}>
      <div className="relative bg-gradient-primary rounded-full p-2 shadow-soft">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 text-white"
        >
          <path d="M11 3a8.5 8.5 0 0 0-8 8.5C3 17 6 21 11 21s8-4 8-9.5c0-3.5-2-6.5-8-8.5Z" />
          <path d="M2 16c7-3 10-6 13-13" />
        </svg>
      </div>
    </div>
  );
}
