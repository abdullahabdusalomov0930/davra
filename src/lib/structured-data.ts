import { routes } from "@/lib/routes";
import { absoluteUrl } from "@/lib/seo";

// schema.org objects for JSON-LD (rendered by components/seo/json-ld.tsx). Labels come in already
// translated; URLs are made absolute here.

type Crumb = { name: string; path: string };

export function breadcrumbList(crumbs: Crumb[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

type LearningResourceInput = {
  slug: string;
  title: string;
  summary: string;
  url: string;
  language: string;
  price: string;
  ratingsSum: number;
  ratingsCount: number;
  publishedAt: string | null;
  updatedAt: string;
  topic: string;
  author: { username: string; displayName: string };
  /** Translated type and level ("Video", "Boshlangʻich"); level is left out for "all levels". */
  typeLabel: string;
  levelLabel?: string;
};

/** A shared resource: the external material, described on its Davra page. */
export function learningResourceData(resource: LearningResourceInput) {
  const page = absoluteUrl(routes.resource(resource.slug));
  return {
    "@type": "LearningResource",
    "@id": `${page}#resource`,
    name: resource.title,
    description: resource.summary,
    url: resource.url,
    mainEntityOfPage: page,
    learningResourceType: resource.typeLabel,
    ...(resource.levelLabel && { educationalLevel: resource.levelLabel }),
    ...(resource.language !== "other" && { inLanguage: resource.language }),
    isAccessibleForFree: resource.price === "free",
    about: { "@type": "Thing", name: resource.topic },
    ...(resource.publishedAt && { datePublished: resource.publishedAt }),
    dateModified: resource.updatedAt,
    // The person who shared and reviewed it on Davra, not the material's creator.
    contributor: {
      "@type": "Person",
      name: resource.author.displayName,
      url: absoluteUrl(routes.profile(resource.author.username)),
    },
    ...(resource.ratingsCount > 0 && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: Math.round((resource.ratingsSum / resource.ratingsCount) * 10) / 10,
        ratingCount: resource.ratingsCount,
        bestRating: 5,
        worstRating: 1,
      },
    }),
  };
}

type ProfileInput = { username: string; displayName: string; bio: string | null; avatarUrl: string | null };

export function profilePageData(profile: ProfileInput) {
  const page = absoluteUrl(routes.profile(profile.username));
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url: page,
    mainEntity: {
      "@type": "Person",
      name: profile.displayName,
      alternateName: `@${profile.username}`,
      url: page,
      ...(profile.bio && { description: profile.bio }),
      ...(profile.avatarUrl && { image: profile.avatarUrl }),
    },
  };
}
