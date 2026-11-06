import type { HTMLAttributes } from "react";

export default function Skeleton({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded bg-gray-200 ${className}`}
      {...props}
    />
  );
}
