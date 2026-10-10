import "server-only";

import { ImageResponse } from "next/og";

import { getPublicEnv } from "@/lib/env";
import { brandColors, logoSvg } from "@/lib/brand";
import { APP_NAME } from "@/lib/config";

import { loadShareImageFonts, SHARE_IMAGE_FONT_FAMILY } from "./fonts";

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

/**
 * The picture shown when a Davra link is shared. Drawn by Satori (a subset of CSS: flexbox only, inline
 * styles), so it does not use the site's components.
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
        justifyContent: "space-between",
        padding: "64px 72px 56px",
        background: brandColors.background,
        borderBottom: `14px solid ${brandColors.primary}`,
        fontFamily: SHARE_IMAGE_FONT_FAMILY,
        color: brandColors.foreground,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- Satori draws <img>, not next/image */}
        <img src={logo} width={64} height={64} alt="" />
        <span style={{ fontSize: 40, fontWeight: 700 }}>{APP_NAME}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {eyebrow && (
          <div style={{ display: "flex" }}>
            <span
              style={{
                padding: "8px 22px",
                borderRadius: 999,
                background: brandColors.accent,
                color: brandColors.accentForeground,
                fontSize: 28,
                fontWeight: 700,
              }}
            >
              {eyebrow}
            </span>
          </div>
        )}
        <div
          style={{
            display: "block",
            fontSize: title.length > 60 ? 54 : 66,
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: -1,
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
                <path d={STAR} fill="#fbbf24" />
              </svg>
              <span style={{ color: brandColors.foreground, fontWeight: 700 }}>{rating}</span>
            </span>
          )}
        </div>
        <span style={muted}>{host}</span>
      </div>
    </div>
  );
}

export async function renderShareImage(props: ShareImageProps) {
  return new ImageResponse(<ShareImage {...props} />, { ...SHARE_IMAGE_SIZE, fonts: await loadShareImageFonts() });
}
