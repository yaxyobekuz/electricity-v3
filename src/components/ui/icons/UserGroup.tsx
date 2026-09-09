import type { SVGProps } from "react";

/**
 * Figma'dagi "lucide/user-group" glifi. Lucide'ning joriy versiyasida bu nom
 * yo'q, shuning uchun vektor Figma eksportidan aynan ko'chirilgan.
 */
export function UserGroup({
  width = 24,
  height = 24,
  strokeWidth = 1.5,
  ...rest
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      <path d="M17 21V20C17 19.4696 16.7893 18.9609 16.4142 18.5858C16.0391 18.2107 15.5304 18 15 18H9C8.46957 18 7.96086 18.2107 7.58579 18.5858C7.21071 18.9609 7 19.4696 7 20V21M19 10H20C20.5304 10 21.0391 10.2107 21.4142 10.5858C21.7893 10.9609 22 11.4696 22 12V13M5 10H4C3.46957 10 2.96086 10.2107 2.58579 10.5858C2.21071 10.9609 2 11.4696 2 12V13M15 11C15 12.6569 13.6569 14 12 14C10.3431 14 9 12.6569 9 11C9 9.34315 10.3431 8 12 8C13.6569 8 15 9.34315 15 11ZM20 4C20 5.10457 19.1046 6 18 6C16.8954 6 16 5.10457 16 4C16 2.89543 16.8954 2 18 2C19.1046 2 20 2.89543 20 4ZM8 4C8 5.10457 7.10457 6 6 6C4.89543 6 4 5.10457 4 4C4 2.89543 4.89543 2 6 2C7.10457 2 8 2.89543 8 4Z" />
    </svg>
  );
}
