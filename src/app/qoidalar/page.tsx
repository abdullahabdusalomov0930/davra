import { LegalPage, legalMetadata } from "@/components/legal/legal-page";
import { routes } from "@/lib/routes";

// Bump when the text in messages/uz.json (Legal.rules) changes.
const UPDATED_AT = "2026-10-10";

export function generateMetadata() {
  return legalMetadata("rules", routes.rules);
}

export default function RulesPage() {
  return <LegalPage document="rules" path={routes.rules} updatedAt={UPDATED_AT} />;
}
