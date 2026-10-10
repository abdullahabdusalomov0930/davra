import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import type { Database } from "@/types/database";

type Enums = Database["public"]["Enums"];

type ResourceTagsProps = {
  language: Enums["resource_language"];
  price: Enums["resource_price"];
  level: Enums["resource_level"];
};

/** Language, price and level as small outline tags. */
export function ResourceTags({ language, price, level }: ResourceTagsProps) {
  const tLanguage = useTranslations("ResourceLanguage");
  const tPrice = useTranslations("ResourcePrice");
  const tLevel = useTranslations("ResourceLevel");

  return (
    <>
      <Badge variant="outline">{tLanguage(language)}</Badge>
      <Badge variant="outline">{tPrice(price)}</Badge>
      <Badge variant="outline">{tLevel(level)}</Badge>
    </>
  );
}
