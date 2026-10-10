import { LegalPage, legalMetadata } from "@/components/legal/legal-page";
import { routes } from "@/lib/routes";

// Bump when the text in messages/uz.json (Legal.terms) changes.
const UPDATED_AT = "2026-10-10";

export function generateMetadata() {
  return legalMetadata("terms", routes.terms);
}

export default function TermsPage() {
  return <LegalPage document="terms" path={routes.terms} updatedAt={UPDATED_AT} showContact />;
}
