interface IllustrationProps {
  className?: string;
}

function BlobBackground() {
  return (
    <g>
      <ellipse cx="170" cy="130" rx="115" ry="98" fill="#ecfdf5" />
      <ellipse cx="118" cy="66" rx="72" ry="58" fill="#d1fae5" opacity="0.7" />
      <ellipse cx="252" cy="196" rx="58" ry="48" fill="#d1fae5" opacity="0.5" />
    </g>
  );
}

export function PlumbingIllustration({ className }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 320 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Servicio de plomería"
    >
      <BlobBackground />

      {/* Tubería vertical */}
      <rect x="140" y="24" width="26" height="102" rx="12" fill="#ffffff" stroke="#6ee7b7" strokeWidth="4" />
      {/* Codo hacia la derecha */}
      <rect x="166" y="112" width="88" height="26" rx="12" fill="#ffffff" stroke="#6ee7b7" strokeWidth="4" />
      {/* Caño que desciende */}
      <rect x="230" y="112" width="26" height="52" rx="11" fill="#ffffff" stroke="#6ee7b7" strokeWidth="4" />

      {/* Válvula superior */}
      <rect x="136" y="18" width="34" height="9" rx="4.5" fill="#a7f3d0" />
      <polygon points="153,4 170,14 153,18 136,14" fill="#059669" />

      {/* Uniones marcadas */}
      <rect x="140" y="30" width="26" height="5" rx="2.5" fill="#a7f3d0" />
      <rect x="172" y="118" width="5" height="14" rx="2.5" fill="#6ee7b7" />

      {/* Gotas de agua */}
      <path d="M243 170 c3 8 5 12 5 17 a5 5 0 1 1 -10 0 c0 -5 2 -9 5 -17 z" fill="#10b981" opacity="0.9" />
      <path d="M243 182 c3.5 9 6 13 6 19 a6 6 0 1 1 -12 0 c0 -6 2.5 -10 6 -19 z" fill="#34d399" opacity="0.9" />
      <path d="M243 200 c3 8 5 12 5 17 a5 5 0 1 1 -10 0 c0 -5 2 -9 5 -17 z" fill="#059669" opacity="0.8" />

      {/* Salpicadura */}
      <ellipse cx="243" cy="227" rx="18" ry="5" fill="#a7f3d0" opacity="0.8" />
      <circle cx="226" cy="222" r="2.5" fill="#6ee7b7" />
      <circle cx="261" cy="220" r="2" fill="#34d399" />

      {/* Llave inglesa */}
      <g transform="translate(96 168) rotate(-32)">
        <rect x="-6" y="2" width="12" height="52" rx="6" fill="#ffffff" stroke="#10b981" strokeWidth="3" />
        <path d="M-17 0 A17 17 0 0 1 17 0 L12 14 L-12 14 Z" fill="#ffffff" stroke="#10b981" strokeWidth="3" />
        <path d="M-9 0 A9 9 0 0 1 9 0 L7 10 L-7 10 Z" fill="#a7f3d0" />
      </g>
    </svg>
  );
}

export function ElectricityIllustration({ className }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 320 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Servicio de electricidad"
    >
      <BlobBackground />

      {/* Cable desde el enchufe */}
      <path
        d="M64 208 C 96 200 96 160 120 140 C 150 114 168 96 168 66"
        stroke="#10b981"
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
      />

      {/* Enchufe */}
      <rect x="36" y="186" width="52" height="34" rx="12" fill="#ffffff" stroke="#34d399" strokeWidth="4" />
      <rect x="52" y="176" width="8" height="14" rx="3" fill="#059669" />
      <rect x="72" y="176" width="8" height="14" rx="3" fill="#059669" />
      <circle cx="62" cy="203" r="3" fill="#a7f3d0" />

      {/* Bombilla */}
      <g transform="translate(196 84)">
        {/* Base roscada */}
        <rect x="-14" y="56" width="28" height="22" rx="6" fill="#ffffff" stroke="#059669" strokeWidth="3" />
        <rect x="-19" y="74" width="38" height="11" rx="5" fill="#d1fae5" stroke="#34d399" strokeWidth="2.5" />

        {/* Vidrio */}
        <circle cx="0" cy="18" r="40" fill="#ffffff" stroke="#6ee7b7" strokeWidth="4" />
        {/* Filamento */}
        <path d="M-12 30 q 12 -14 24 0 q -12 8 -24 0 z" fill="#34d399" />
        <path d="M-7 20 q 7 -8 14 0" stroke="#059669" strokeWidth="2" strokeLinecap="round" />

        {/* Destello central */}
        <polygon points="0,-34 7,-14 3,-14 10,12 -5,-6 -1,-6 0,6" fill="#10b981" />
        {/* Destello decorativo */}
        <polygon points="0,-18 4,-6 2,-6 8,10 -3,-2 0,-2 -1,6" fill="#34d399" opacity="0.85" />
      </g>

      {/* Rayos de luz */}
      <path d="M196 22 v-16" stroke="#34d399" strokeWidth="4" strokeLinecap="round" />
      <path d="M238 38 l12 -9" stroke="#34d399" strokeWidth="4" strokeLinecap="round" />
      <path d="M260 74 l14 -3" stroke="#34d399" strokeWidth="4" strokeLinecap="round" />
      <path d="M252 116 l10 10" stroke="#34d399" strokeWidth="4" strokeLinecap="round" />

      {/* Chispas */}
      <circle cx="168" cy="140" r="4" fill="#6ee7b7" />
      <circle cx="150" cy="122" r="3" fill="#34d399" />
      <circle cx="176" cy="114" r="2.5" fill="#10b981" />
      <circle cx="290" cy="60" r="3" fill="#6ee7b7" />
      <circle cx="284" cy="180" r="4" fill="#a7f3d0" />
    </svg>
  );
}

export function MechanicalIllustration({ className }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 320 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Servicio de mecánica"
    >
      <BlobBackground />

      {/* Engranaje */}
      <g transform="translate(92 78)">
        <rect x="-10" y="-44" width="20" height="88" rx="8" fill="#34d399" />
        <rect x="-10" y="-44" width="20" height="88" rx="8" fill="#34d399" transform="rotate(45)" />
        <rect x="-10" y="-44" width="20" height="88" rx="8" fill="#34d399" transform="rotate(90)" />
        <rect x="-10" y="-44" width="20" height="88" rx="8" fill="#34d399" transform="rotate(135)" />
        <circle r="40" fill="#34d399" />
        <circle r="26" fill="#a7f3d0" />
        <circle r="9" fill="#ffffff" />
      </g>

      {/* Llave de tubo */}
      <g transform="translate(150 54) rotate(24)">
        <rect x="-7" y="0" width="14" height="46" rx="7" fill="#ffffff" stroke="#10b981" strokeWidth="3" />
        <path d="M-16 0 A16 16 0 0 1 16 0 Q16 14 8 16 Q0 18 -8 16 Q-16 14 -16 0 Z" fill="#059669" />
      </g>

      {/* Automóvil */}
      <g transform="translate(88 70)">
        {/* Cabina */}
        <rect x="40" y="30" width="92" height="44" rx="14" fill="#d1fae5" />
        <rect x="52" y="40" width="36" height="22" rx="6" fill="#ffffff" />
        <rect x="96" y="40" width="26" height="22" rx="6" fill="#ffffff" />
        <rect x="56" y="60" width="58" height="6" rx="3" fill="#a7f3d0" />

        {/* Carrocería */}
        <path d="M10 74 h140 v16 a12 12 0 0 1 -12 12 h-14 l-12 -14 h-64 l-12 14 h-14 a12 12 0 0 1 -12 -12 z" fill="#ffffff" stroke="#6ee7b7" strokeWidth="4" />

        {/* Faro */}
        <circle cx="152" cy="78" r="6" fill="#10b981" />
        <circle cx="152" cy="78" r="2.5" fill="#ffffff" />
        <rect x="8" y="76" width="12" height="7" rx="3.5" fill="#34d399" />

        {/* Ruedas */}
        <circle cx="46" cy="108" r="18" fill="#064e3b" />
        <circle cx="46" cy="108" r="7" fill="#6ee7b7" />
        <circle cx="120" cy="108" r="18" fill="#064e3b" />
        <circle cx="120" cy="108" r="7" fill="#6ee7b7" />

        {/* Línea de puerta */}
        <path d="M86 74 v-26" stroke="#a7f3d0" strokeWidth="4" strokeLinecap="round" />
      </g>
    </svg>
  );
}