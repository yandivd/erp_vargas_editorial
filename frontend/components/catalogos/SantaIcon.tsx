export default function SantaIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      <path d="M12 28c0-11 8-19 20-19s20 8 20 19" fill="#dc2626" />
      <path
        d="M12 28h40"
        stroke="#f8fafc"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <circle
        cx="52"
        cy="12"
        r="6"
        fill="#f8fafc"
        stroke="#fbbf24"
        strokeWidth="1.5"
      />
      <circle cx="32" cy="40" r="15" fill="#fecaca" />
      <path
        d="M19 39c0 12 6 19 13 19s13-7 13-19c-4 4-8 6-13 6s-9-2-13-6Z"
        fill="#f8fafc"
      />
      <circle cx="26" cy="38" r="2" fill="#0f172a" />
      <circle cx="38" cy="38" r="2" fill="#0f172a" />
      <path
        d="M29 45c2 2 4 2 6 0"
        stroke="#0f172a"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="32" cy="41" r="3" fill="#f87171" />
    </svg>
  );
}
