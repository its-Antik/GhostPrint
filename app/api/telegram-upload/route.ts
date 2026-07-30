import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

// App Router route segment config — allow up to 60s for large file uploads
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB — Telegram Bot API limit

// POST — upload a file to Telegram channel via Bot API, return viewable URL
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!BOT_TOKEN || !CHANNEL_ID) {
      return NextResponse.json(
        { error: "Telegram bot not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID in .env.local" },
        { status: 500 }
      );
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (parseErr: any) {
      console.error("Failed to parse form data:", parseErr);
      return NextResponse.json(
        { error: "Failed to parse upload. The file may be too large or the request was corrupted." },
        { status: 413 }
      );
    }

    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file size before attempting upload
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 50MB.` },
        { status: 413 }
      );
    }

    // Read file into buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Telegram via Bot API sendDocument with a 2-minute timeout
    const telegramForm = new FormData();
    telegramForm.append("chat_id", CHANNEL_ID);
    telegramForm.append("document", new Blob([buffer], { type: file.type }), file.name);
    telegramForm.append("caption", `📦 Pagen Upload: ${file.name}`);

    const controller = new AbortController();
    const uploadTimeout = setTimeout(() => controller.abort(), 120_000); // 2 min timeout

    let sendRes: Response;
    try {
      sendRes = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`,
        { method: "POST", body: telegramForm, signal: controller.signal }
      );
    } catch (fetchErr: any) {
      clearTimeout(uploadTimeout);
      const isTimeout = fetchErr.name === "AbortError";
      console.error("Telegram sendDocument fetch error:", fetchErr);
      return NextResponse.json(
        { error: isTimeout
            ? "Upload timed out. The file may be too large or your connection is slow. Please try again."
            : `Failed to reach Telegram servers: ${fetchErr.message}` },
        { status: isTimeout ? 504 : 502 }
      );
    } finally {
      clearTimeout(uploadTimeout);
    }

    const sendData = await sendRes.json();

    if (!sendData.ok) {
      console.error("Telegram sendDocument failed:", sendData);
      return NextResponse.json(
        { error: sendData.description || "Telegram upload failed" },
        { status: 500 }
      );
    }

    // Extract file_id from the sent document
    const fileId = sendData.result.document.file_id;
    const messageId = sendData.result.message_id;

    // Get the direct file download URL from Telegram (non-critical, don't fail the upload)
    let directUrl = null;
    try {
      const getFileRes = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`,
        { signal: AbortSignal.timeout(10_000) } // 10s timeout — this is optional
      );
      const getFileData = await getFileRes.json();

      if (getFileData.ok && getFileData.result.file_path) {
        // This is a direct download link (works for files < 20MB via Bot API)
        directUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${getFileData.result.file_path}`;
      }
    } catch {
      // getFile failed — non-critical, proxy URL still works
      console.warn("getFile lookup failed for", fileId, "— proxy URL will be used");
    }

    // Build the public channel link (for reference)
    const channelHandle = CHANNEL_ID.replace("@", "");
    const channelLink = `https://t.me/${channelHandle}/${messageId}`;

    // Prefer serving through our own proxy to avoid exposing bot token in URL
    // The /api/telegram-file?file_id=xxx route will fetch and stream the file
    const proxyUrl = `/api/telegram-file?file_id=${fileId}&name=${encodeURIComponent(file.name)}`;

    return NextResponse.json({
      url: proxyUrl,          // Use our proxy for in-app viewing
      file_id: fileId,        // Store for re-fetching later
      channel_link: channelLink, // Telegram channel link for reference
      name: file.name,
    });
  } catch (err: any) {
    console.error("Telegram upload error:", err);
    return NextResponse.json({ error: err.message || "Upload failed" }, { status: 500 });
  }
}
