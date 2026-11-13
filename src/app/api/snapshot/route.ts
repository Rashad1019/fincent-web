import { NextResponse } from "next/server";

import { OpenRouterError } from "@/lib/agents/openrouter";
import { breakDown } from "@/lib/snapshot";

export const maxDuration = 300;
const BUDGET_MS = 280_000;
// Vercel caps request bodies at about 4.5 MB. The page shrinks images first.
const MAX_IMAGE_BYTES = 4_000_000;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  const started = Date.now();
  const form = await request.formData().catch(() => null);
  const file = form?.get("image");
  if (!(file instanceof File) || !IMAGE_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Upload a JPG, PNG, or WebP screenshot." }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "That image is too large. Try a smaller screenshot." }, { status: 413 });
  }

  // The image goes to the AI model to be read and is not stored.
  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  try {
    return NextResponse.json(await breakDown(`data:${file.type};base64,${base64}`, started + BUDGET_MS));
  } catch (error) {
    if (!(error instanceof OpenRouterError)) throw error;
    console.warn("Snapshot failed:", error.message);
    return NextResponse.json(
      { error: "The network is busy right now. Please try again in a few minutes." },
      { status: 503 },
    );
  }
}
