"use client";

import { useState } from "react";

export function VehiclePhoto({
  src,
  alt,
  label,
  priority = false,
  className = "",
}: {
  src: string;
  alt: string;
  label: string;
  priority?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <PhotoFallback label={label} className={className} />;
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(true)}
      className={`h-full w-full object-cover ${className}`}
    />
  );
}

function PhotoFallback({ label, className }: { label: string; className?: string }) {
  let hash = 0;
  for (let index = 0; index < label.length; index += 1) {
    hash = (hash * 31 + label.charCodeAt(index)) | 0;
  }
  const hue = Math.abs(hash) % 360;

  return (
    <div
      className={`flex h-full w-full items-center justify-center p-4 ${className}`}
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 30% 14%), hsl(${(hue + 40) % 360} 26% 9%))`,
      }}
    >
      <span className="text-center text-[12px] font-medium leading-snug text-ink-faint">
        {label}
      </span>
    </div>
  );
}
