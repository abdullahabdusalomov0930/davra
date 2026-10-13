import { StarIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";

import { averageRating } from "@/components/resources/resource-meta";
import type { ResourceCardData } from "@/server/services/resources";

import { CurvedArrow } from "./doodles";
import { motion } from "./motion";

/** Where each note sits, its colour and its tilt; the tape strip lands at a different spot on each. */
const NOTES = [
  { place: "top-0 left-[4%] w-[68%]", colour: "bg-postit-yellow", tilt: "-rotate-3", tape: "left-[36%] rotate-[4deg]" },
  {
    place: "top-[37%] right-0 w-[62%]",
    colour: "bg-postit-pink",
    tilt: "rotate-[4deg]",
    tape: "left-[30%] -rotate-[5deg]",
  },
  {
    place: "bottom-0 left-[12%] w-[60%]",
    colour: "bg-postit-blue",
    tilt: "-rotate-1",
    tape: "left-[40%] rotate-[3deg]",
  },
] as const;

/**
 * The hero's picture: real cards from the feed as post-it notes taped to the page, with a pen arrow
 * pointing at them. Decorative (the same cards are in the feed below). The notes are paper, so they keep
 * ink on pastel in dark mode too.
 */
export async function HeroVisual({ resources }: { resources: readonly ResourceCardData[] }) {
  const [tType, tPrice, format] = await Promise.all([
    getTranslations("ResourceType"),
    getTranslations("ResourcePrice"),
    getFormatter(),
  ]);
  const rating = (resource: ResourceCardData) => {
    const average = averageRating(resource.ratings_sum, resource.ratings_count);
    return average === null ? null : format.number(average, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  };

  return (
    <div aria-hidden className="relative min-h-[27rem] w-full select-none sm:min-h-[31rem]">
      {resources.slice(0, NOTES.length).map((resource, index) => {
        const note = NOTES[index];
        const score = rating(resource);
        return (
          <div key={resource.id} className={`absolute ${note.place}`}>
            <div className="animate-float" style={motion({ delay: index * 1100 })}>
              <div
                className={`relative animate-rise px-5 pt-8 pb-5 text-ink shadow-[0_16px_24px_-14px_rgb(0_0_0/0.4)] sm:px-6 ${note.colour} ${note.tilt}`}
                style={motion({ delay: 150 + index * 120 })}
              >
                <span className={`tape ${note.tape}`} />
                <p className="font-hand text-[0.95rem] text-pen">
                  {tType(resource.type)} · {tPrice(resource.price)}
                </p>
                <p className="mt-1.5 line-clamp-2 font-heading text-lg leading-snug font-bold sm:text-xl">
                  {resource.title}
                </p>
                <p className="mt-3 flex min-w-0 items-center gap-1.5 text-sm">
                  <span className="truncate">{resource.domain}</span>
                  {score && (
                    <span className="flex shrink-0 items-center gap-1 font-semibold">
                      · <StarIcon className="size-3.5 fill-ink" />
                      {score}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        );
      })}
      <CurvedArrow className="absolute top-[24%] -left-6 hidden h-20 w-28 text-primary sm:block md:-left-10" />
    </div>
  );
}
