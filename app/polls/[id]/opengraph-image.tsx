import { ImageResponse } from "next/og";
import { getPoll } from "@/lib/board/data";

/**
 * The preview a poll gets when its link is pasted into the family chat.
 *
 * This is not decoration. The link is how the feature reaches anyone, and a bare URL in a message
 * thread is materially less likely to be tapped than one that says what it is asking about.
 *
 * Rendered *unauthenticated*, because the crawler that fetches it has no session — which is also
 * why `/polls` is deliberately absent from the matcher in `proxy.ts`. So it shows only the title
 * and how many dates are on offer: enough to be worth tapping, and nothing about who replied.
 */
export const alt = "A poll";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: { id: string } }) {
  const poll = await getPoll(params.id);
  const title = poll?.title ?? "A poll";
  const count = poll?.options.length ?? 0;

  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#faf8f5",
        padding: "72px",
      }}
    >
      <div style={{ display: "flex", fontSize: 30, color: "#8a8175" }}>
        ARBINI FAMILY
      </div>
      <div style={{ display: "flex", fontSize: 84, color: "#1c1917" }}>
        {title}
      </div>
      <div style={{ display: "flex", fontSize: 34, color: "#8a8175" }}>
        {count === 0
          ? "Tap to answer"
          : `${count} date${count === 1 ? "" : "s"} · tap to say which work`}
      </div>
    </div>,
    size,
  );
}
