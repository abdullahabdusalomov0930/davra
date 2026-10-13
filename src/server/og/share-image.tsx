import "server-only";

import { ImageResponse } from "next/og";

import { getPublicEnv } from "@/lib/env";
import { brandColors, LOGO_COLORS, logoSvg } from "@/lib/brand";
import { APP_NAME } from "@/lib/config";

import { loadShareImageFonts, SHARE_IMAGE_FONT_FAMILY, SHARE_IMAGE_HEADING_FAMILY } from "./fonts";

/** The size Telegram, Facebook, X and LinkedIn all show as a large preview. */
export const SHARE_IMAGE_SIZE = { width: 1200, height: 630 };

type ShareImageProps = {
  /** A small label above the title (the topic). */
  eyebrow?: string;
  title: string;
  /** One or two lines under the title. */
  subtitle?: string;
  /** Short facts in one line: domain, type, language. */
  details?: string[];
  /** e.g. "4,5 (6)"; shown with a star. */
  rating?: string;
};

const logo = `data:image/svg+xml;base64,${Buffer.from(logoSvg({ size: 64 })).toString("base64")}`;

// lucide "star" (ISC licence), filled.
const STAR =
  "M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z";

/** The logo's four colours as a strip along the bottom edge. */
const STRIPE = [LOGO_COLORS.topLeft, LOGO_COLORS.topRight, LOGO_COLORS.bottomRight, LOGO_COLORS.bottomLeft];

/**
 * The picture shown when a Davra link is shared: a page of the squared notebook with the sticker logo,
 * the topic on a post-it and the title in the heading face. Drawn by Satori (a subset of CSS: flexbox
 * only, inline styles), so it does not use the site's components.
 */
function ShareImage({ eyebrow, title, subtitle, details = [], rating }: ShareImageProps) {
  const host = new URL(getPublicEnv().NEXT_PUBLIC_SITE_URL).host;
  const muted = { color: brandColors.muted, fontSize: 28 };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: brandColors.paper,
        backgroundImage: `linear-gradient(${brandColors.grid} 2px, transparent 2px), linear-gradient(90deg, ${brandColors.grid} 2px, transparent 2px)`,
        backgroundSize: "42px 42px",
        fontFamily: SHARE_IMAGE_FONT_FAMILY,
        color: brandColors.ink,
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px 72px 48px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- Satori draws <img>, not next/image */}
          <img src={logo} width={68} height={68} alt="" style={{ transform: "rotate(-6deg)" }} />
          <span style={{ fontFamily: SHARE_IMAGE_HEADING_FAMILY, fontSize: 42, fontWeight: 800, letterSpacing: -1 }}>
            {APP_NAME.toLowerCase()}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {eyebrow && (
            <div style={{ display: "flex" }}>
              <span
                style={{
                  padding: "8px 22px",
                  borderRadius: 12,
                  border: `3px solid ${brandColors.ink}`,
                  background: brandColors.postit,
                  fontSize: 28,
                  fontWeight: 700,
                  transform: "rotate(-2deg)",
                }}
              >
                {eyebrow}
              </span>
            </div>
          )}
          <div
            style={{
              display: "block",
              fontFamily: SHARE_IMAGE_HEADING_FAMILY,
              fontSize: title.length > 50 ? 46 : 58,
              fontWeight: 800,
              lineHeight: 1.18,
              letterSpacing: -1.5,
              lineClamp: 3,
            }}
          >
            {title}
          </div>
          {subtitle && (
            <div style={{ display: "block", ...muted, fontSize: 32, lineHeight: 1.35, lineClamp: 2 }}>{subtitle}</div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 28, ...muted }}>
            {details.map((detail) => (
              <span key={detail}>{detail}</span>
            ))}
            {rating && (
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="30" height="30" viewBox="0 0 24 24">
                  <path d={STAR} fill={LOGO_COLORS.topLeft} />
                </svg>
                <span style={{ color: brandColors.ink, fontWeight: 700 }}>{rating}</span>
              </span>
            )}
          </div>
          <span style={muted}>{host}</span>
        </div>
      </div>
      <div style={{ display: "flex", height: 16 }}>
        {STRIPE.map((colour) => (
          <div key={colour} style={{ flex: 1, background: colour }} />
        ))}
      </div>
    </div>
  );
}

export async function renderShareImage(props: ShareImageProps) {
  return new ImageResponse(<ShareImage {...props} />, { ...SHARE_IMAGE_SIZE, fonts: await loadShareImageFonts() });
}
