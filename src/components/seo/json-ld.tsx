import { headers } from "next/headers";

/** A plain JSON-LD object (https://schema.org). */
export type StructuredData = Record<string, unknown>;

/**
 * Structured data for search engines. `<` is escaped so text written by users (titles, bios) cannot
 * close the script element; the nonce keeps strict CSP setups quiet about the inline block.
 */
export async function JsonLd({ data }: { data: StructuredData }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
