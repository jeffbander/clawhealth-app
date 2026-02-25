export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

const ELEVEN_API = "https://api.elevenlabs.io/v1/text-to-speech";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const text = searchParams.get("text") || "";
  const voiceId = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM"; // default: Rachel
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "ElevenLabs API key missing" }, { status: 500 });
  }

  if (!text.trim()) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }

  try {
    const resp = await fetch(`${ELEVEN_API}/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.4, similarity_boost: 0.8 },
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return NextResponse.json({ error: "ElevenLabs TTS failed", details: errText }, { status: 502 });
    }

    const audioBuffer = await resp.arrayBuffer();
    return new NextResponse(Buffer.from(audioBuffer), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "TTS error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
