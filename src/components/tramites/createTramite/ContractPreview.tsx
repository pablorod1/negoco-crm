import { ContractDB } from "@/lib/core/types";

interface ContractPreviewProps {
  contract: ContractDB;
}

export default function ContractPreview({ contract }: ContractPreviewProps) {
  return (
    <div className="relative w-fit h-auto group">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        xmlnsXlink="http://www.w3.org/1999/xlink"
        viewBox="0 0 224 288"
        width="224"
        height="288"
        className="bg-transparent"
      >
        <defs>
          <filter id="dropShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
            <feOffset dx="0" dy="3" result="offsetblur" />
            <feFlood floodColor="#000000" floodOpacity="0.2" />
            <feComposite in2="offsetblur" operator="in" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <linearGradient
            id="contract-gradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#F9F9F9" />
            <stop offset="100%" stopColor="#FFFFFF" />
          </linearGradient>
          <pattern
            id="watermark-pattern"
            patternUnits="userSpaceOnUse"
            width="100"
            height="100"
            patternTransform="rotate(45)"
          >
            <text
              x="50"
              y="50"
              fill="var(--primary-color-100)"
              fontSize="12"
              textAnchor="middle"
            >
              {contract.new_company}
            </text>
          </pattern>
        </defs>

        <rect
          x="8"
          y="8"
          width="208"
          height="272"
          fill="url(#contract-gradient)"
          filter="url(#dropShadow)"
        />

        <rect
          x="8"
          y="8"
          width="208"
          height="272"
          fill="url(#watermark-pattern)"
        />

        <text
          x="16"
          y="28"
          fontFamily="Inter, sans-serif"
          fontSize="14"
          fontWeight="bold"
          fill="#333333"
        >
          {contract.CUPS}
        </text>

        <text
          x="16"
          y="42"
          fontFamily="Inter, sans-serif"
          fontSize="10"
          fill="#666666"
        >
          {contract.type}
        </text>

        <text
          x="16"
          y="56"
          fontFamily="Inter, sans-serif"
          fontSize="10"
          fill="#666666"
        >
          {contract.plan}
        </text>

        <text
          x="16"
          y="72"
          fontFamily="Inter, sans-serif"
          fontSize="12"
          fill="#666666"
        >
          {contract.address}
        </text>
        <text
          x="16"
          y="86"
          fontFamily="Inter, sans-serif"
          fontSize="12"
          fill="#666666"
        >
          {contract.city}, {contract.province} {contract.postal_code}
        </text>

        <rect x="16" y="96" width="172" height="12" fill="#F0F0F0" rx="3" />
        <rect x="16" y="112" width="180" height="12" fill="#F0F0F0" rx="3" />

        <rect x="16" y="128" width="192" height="80" fill="#F0F0F0" rx="3" />

        <line
          x1="16"
          y1="224"
          x2="208"
          y2="224"
          stroke="#CFCFCF"
          strokeWidth="1"
        />

        <rect x="16" y="240" width="88" height="32" fill="#F0F0F0" rx="3" />
        <rect x="120" y="240" width="88" height="32" fill="#F0F0F0" rx="3" />
      </svg>
    </div>
  );
}
