# Customer ↔ courier delivery chat

Each delivery order has a private chat between its Telegram customer and currently assigned courier. The language comes from each participant's app preference when opening the chat, with the saved Telegram language as fallback. The interface's 17 languages are available as translation targets. Original text and audio remain available alongside translations. Translation is automatic on viewing an incoming message, including attachment captions. A voice message uses transcription → translation → synthesized audio, labelled as an AI voice. Pictures and videos themselves are delivered unchanged.

## User flows

Customer: My orders → Chat with courier. Courier: assigned order → Chat with customer. New-message alerts appear in the private inbox and bot; opening a chat alert opens that order's chat. Before assignment, the customer sees a waiting state. Completed/cancelled/delivered orders are read-only. Only the current customer/courier pair can read or download messages, and a replacement courier cannot access the previous courier's conversation. Staff-created orders without a Telegram customer have no customer chat.

Text supports 2,000 characters. Photos: JPEG/PNG/WebP up to 8 MB. Videos: MP4/WebM/MOV up to 20 MB. Voice recording asks for the microphone only after a tap, stops at 60 seconds, supports preview before explicit sending, and releases the microphone on close/background. Unsupported microphone access leaves text and media available. Media uploads are direct to private storage via a short-lived signed URL, followed by server verification of actual storage size, MIME and file signature. Recipients cannot see incomplete uploads.

## Server and privacy

Apply `supabase/proposals/delivery-chat.sql` and `delivery-chat-storage.sql`; deploy `delivery-chat` with its local imports and `_shared/customer-notifications.ts`. It verifies Telegram HMAC itself (`verify_jwt=false`). Re-deploy the kitchen endpoint with its updated `order-list.ts`, which returns a `chat_available` boolean rather than disclosing customer Telegram IDs.

`OPENAI_API_KEY` must be set in the server environment. Models: `gpt-4.1-mini` (translation), `gpt-4o-mini-transcribe`, `gpt-4o-mini-tts`. The provider receives only the selected message's text/audio; no participant IDs, order IDs, photos or videos. Responses use `store:false`. Secrets stay on the server. A missing key/provider failure leaves the original available with an explicit untranslated state.

Private tables use RLS, no anonymous/authenticated grants and a service-only RPC. Authorization is rechecked for every operation. Unique sender/request keys and transactional notifications prevent duplicate messages or alerts after retries. Original files are not replaced. Translation leases, bounded retries and caching prevent repeated processing; lease-specific generated audio paths prevent a stale worker from overwriting a newer result. Rate limits: 20 messages/minute, 150/day and 100 MB of declared attachments/day; translation attempts are bounded per recipient. The app exposes chat history for 30 days from order creation; this is an access window, not an automatic deletion policy. Signed downloads expire after 15 minutes. Media URLs refresh without resetting active playback.

## Verification

`npm test` includes actual isolated PostgreSQL authorization/lease/idempotency tests, the real Edge entrypoint against that database, provider protocol doubles and JSDOM tests for recording, media uploads, polling, read-only state and XSS-safe display. Do not create real orders, contact actual participants or enable microphone permission on the owner's behalf during verification. Any provider smoke test uses a fixed synthetic phrase and does not create messages or notifications.

Live provider verification on 2026-10-16 returned HTTP 429 `credit_balance_exhausted` for the configured key. Translation/voice synthesis cannot be verified live or offered as working until API credit is restored. Text, original audio and attachments remain independent of provider availability. After restoring credit, reopen the chat to retry processing. No real participant content was used in this check.
