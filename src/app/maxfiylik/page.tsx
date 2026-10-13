import { LegalPage, legalMetadata } from "@/components/legal/legal-page";
import { routes } from "@/lib/routes";

// Bump when the text in messages/uz.json (Legal.privacy) changes.
const UPDATED_AT = "2026-10-13";

export function generateMetadata() {
  return legalMetadata("privacy", routes.privacy);
}

export default function PrivacyPage() {
  return <LegalPage document="privacy" path={routes.privacy} updatedAt={UPDATED_AT} showContact />;
}
