import {
  BookOpenIcon,
  FileTextIcon,
  GlobeIcon,
  GraduationCapIcon,
  type LucideIcon,
  PlayCircleIcon,
  ShapesIcon,
  TvIcon,
  WrenchIcon,
} from "lucide-react";

import type { Database } from "@/types/database";

export type ResourceType = Database["public"]["Enums"]["resource_type"];

/** One icon per resource type, used on cards, the resource page and the form. */
export const RESOURCE_TYPE_ICONS: Record<ResourceType, LucideIcon> = {
  course: GraduationCapIcon,
  video: PlayCircleIcon,
  channel: TvIcon,
  book: BookOpenIcon,
  website: GlobeIcon,
  tool: WrenchIcon,
  article: FileTextIcon,
  other: ShapesIcon,
};

/** Average of the ratings that count, or null when there are none. */
export function averageRating(sum: number, count: number): number | null {
  return count > 0 ? sum / count : null;
}
