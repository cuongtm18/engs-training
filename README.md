# Phản xạ tiếng Anh

PWA luyện phản xạ dịch **Việt → Anh** qua tình huống hằng ngày. App đưa câu tiếng Việt, bạn gõ tiếng Anh, app chấm và gợi ý cách nói tự nhiên hơn.

- Nuxt 3 (SPA) + `@vite-pwa/nuxt`, deploy lên **Cloudflare Pages**
- 120 câu mẫu trong `data/sentences.json` (6 chủ đề × 3 mức độ), tự thêm câu bằng cách sửa file này
- Chấm 2 tầng: khớp đáp án có sẵn (không tốn AI) → nếu khác mới gọi `/api/check`
- `/api/check`: **Gemini** (free) → dự phòng **Cloudflare Workers AI** (free) → nếu cả hai không có thì app so sánh offline với đáp án mẫu
- Ôn tập ngắt quãng kiểu Leitner, streak, nghe phát âm (Web Speech API); tiến độ lưu trên máy (localStorage), có xuất/nhập JSON

## Chạy local

```bash
npm install
cp .dev.vars.example .env   # điền GEMINI_API_KEY (lấy free ở https://aistudio.google.com/apikey)
npm run dev
```

Không có key thì app vẫn chạy, chỉ là phần chấm câu khác đáp án sẽ so sánh offline.

## Deploy Cloudflare Pages

1. Đẩy repo lên GitHub. Trong Cloudflare: **Workers & Pages → Create → Pages → Connect to Git**.
2. Build command: `npm run build`, output directory: `dist`.
3. **Settings → Variables and Secrets**, thêm secret `GEMINI_API_KEY` (và `ACCESS_CODE` nếu muốn khóa API; nhập cùng mã đó trong ⚙️ Cài đặt của app).
4. **Settings → Bindings**: thêm **Workers AI** với tên `AI` để làm dự phòng (có sẵn trong `wrangler.toml`).
5. Mở `https://<tên-project>.pages.dev` trên điện thoại → "Thêm vào màn hình chính".

Biến tùy chọn: `GEMINI_MODEL` (mặc định `gemini-2.5-flash`), `WORKERS_AI_MODEL` (mặc định `@cf/meta/llama-3.1-8b-instruct`).

## Thêm câu mới

Mỗi phần tử trong `data/sentences.json`:

```json
{ "id": "cafe-21", "t": "cafe", "l": 2, "vi": "…", "en": "…", "alt": ["…"], "note": "…" }
```

`t` là id chủ đề trong `utils/topics.ts`, `l` là mức 1-3, `alt` là các cách nói khác cũng được tính đúng.
