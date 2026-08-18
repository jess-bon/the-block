"use client";

import { useState } from "react";
import { VehiclePhoto } from "./VehiclePhoto";

export function Gallery({ images, alt }: { images: string[]; alt: string }) {
  const [active, setActive] = useState(0);

  return (
    <div>
      <div className="relative aspect-[3/2] max-h-[62vh] overflow-hidden rounded-xl border border-hairline bg-raised">
        <VehiclePhoto
          src={images[active]}
          alt={`${alt} — photo ${active + 1} of ${images.length}`}
          label={alt}
          priority
        />
        <span className="tnum absolute bottom-3 right-3 rounded bg-canvas/75 px-2 py-1 text-[12px] text-ink-muted">
          {active + 1} / {images.length}
        </span>
      </div>

      {images.length > 1 && (
        <div className="mt-2.5 flex gap-2 overflow-x-auto pb-1">
          {images.map((image, index) => (
            <button
              key={image}
              type="button"
              onClick={() => setActive(index)}
              aria-label={`View photo ${index + 1}`}
              aria-current={index === active}
              className={`relative h-16 w-24 flex-none overflow-hidden rounded-lg border transition-colors ${
                index === active
                  ? "border-accent"
                  : "border-hairline opacity-60 hover:border-hairline-strong hover:opacity-100"
              }`}
            >
              <VehiclePhoto src={image} alt="" label={alt} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
