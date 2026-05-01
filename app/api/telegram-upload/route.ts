import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;

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

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Read file into buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Telegram via Bot API sendDocument
    const telegramForm = new FormData();
    telegramForm.append("chat_id", CHANNEL_ID);
    telegramForm.append("document", new Blob([buffer], { type: file.type }), file.name);
    telegramForm.append("caption", `📦 GhostPrint Upload: ${file.name}`);

    const sendRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`,
      { method: "POST", body: telegramForm }
    );

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

    // Get the direct file download URL from Telegram
    const getFileRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`
    );
    const getFileData = await getFileRes.json();

    let directUrl = null;
    if (getFileData.ok && getFileData.result.file_path) {
      // This is a direct download link (works for files < 20MB via Bot API)
      directUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${getFileData.result.file_path}`;
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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
