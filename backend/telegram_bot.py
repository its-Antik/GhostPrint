import os
from fastapi import FastAPI, HTTPException, UploadFile, File
from pydantic import BaseModel
from telegram import Bot
from telegram.constants import ParseMode
import asyncio
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Make sure to set these in your environment variables
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "YOUR_DEFAULT_TEST_TOKEN")
CHANNEL_ID = os.getenv("TELEGRAM_CHANNEL_ID", "@your_test_channel")

# Initialize Bot conditionally if you're actually running this
bot = Bot(token=BOT_TOKEN) if BOT_TOKEN != "YOUR_DEFAULT_TEST_TOKEN" else None

class OrderData(BaseModel):
    file_url: str
    location: str
    delivery_time: str
    earnings: float
    order_id: str

@app.post("/broadcast_order")
async def broadcast_order(order: OrderData):
    if not bot:
        return {"status": "mock", "message": "Bot token not configured. Mock broadcast successful!"}

    try:
        # Construct the HTML message
        message = (
            f"🚨 <b>NEW ORDER</b> 🚨\n\n"
            f"📄 <b>File:</b> <a href='{order.file_url}'>View Document</a>\n"
            f"📍 <b>Drop-off:</b> {order.location}\n"
            f"⏰ <b>Deliver By:</b> {order.delivery_time}\n"
            f"💰 <b>Earnings:</b> ₹{order.earnings}\n\n"
            f"⚡ <i>Fastest runner claims it first!</i>"
        )
        
        # We need an inline keyboard to deep-link to Pagen
        reply_markup = {
            "inline_keyboard": [
                [
                    {
                        "text": "Claim on Pagen 🚀",
                        "url": f"https://pagen.app/runner/claim/{order.order_id}"
                    }
                ]
            ]
        }

        # Send the message
        await bot.send_message(
            chat_id=CHANNEL_ID,
            text=message,
            parse_mode=ParseMode.HTML,
            reply_markup=reply_markup,
            disable_web_page_preview=True
        )
        
        return {"status": "success", "message": "Broadcast sent successfully!"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/upload_to_telegram")
async def upload_to_telegram(file: UploadFile = File(...)):
    if not bot:
        # Return a mock link if bot is not configured
        return {"url": f"https://t.me/mock_channel/123", "name": file.filename}

    try:
        # Read file content
        content = await file.read()
        
        # Send document to the channel
        sent_msg = await bot.send_document(
            chat_id=CHANNEL_ID,
            document=content,
            filename=file.filename,
            caption=f"📦 New Print Upload: {file.filename}"
        )
        
        # Construct the telegram message link
        # Works best if CHANNEL_ID is a public handle like @mychannel
        channel_handle = str(CHANNEL_ID).replace("@", "")
        msg_link = f"https://t.me/{channel_handle}/{sent_msg.message_id}"
        
        return {"url": msg_link, "name": file.filename}
    
    except Exception as e:
        print(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
