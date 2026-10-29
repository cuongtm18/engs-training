# Phản xạ tiếng Anh

PWA luyện phản xạ dịch **Việt → Anh** qua tình huống hằng ngày. App đưa câu tiếng Việt, bạn gõ tiếng Anh, app chấm và gợi ý cách nói tự nhiên hơn.

- Nuxt 3 (SPA) + `@vite-pwa/nuxt`, deploy lên **Cloudflare Pages**
- Mỗi chủ đề có 2 chế độ: **📖 Học** (xem câu Việt + đáp án + cách nói khác, nghe phát âm, ẩn tiếng Anh để tự kiểm tra, tự thêm câu và AI dịch) và **✍️ Luyện tập** (nhìn câu Việt, gõ câu Anh)
- Chấm 2 bước: (1) đúng cấu trúc và đủ ý chưa, (2) nếu đúng cấu trúc mới chấm **% độ tự nhiên**. Không bắt phải giống đáp án mẫu: AI chấp nhận mọi cách dịch đúng nghĩa; nếu khớp câu mẫu thì chấm ngay, không tốn lượt AI
- 181 câu mẫu trong `data/sentences.json`, câu bạn tự thêm lưu trên máy (chủ đề "Câu của tôi" hoặc bất kỳ chủ đề nào)
- `/api/check` (chấm) và `/api/translate` (dịch danh sách câu tự thêm): **Gemini** (free, tự chọn model dùng được) → dự phòng **Cloudflare Workers AI**; nếu không có AI thì app ước lượng offline
- Ôn tập ngắt quãng kiểu Leitner, streak; tiến độ lưu trên máy (localStorage), có xuất/nhập JSON

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

Biến tùy chọn: `GEMINI_MODEL` (mặc định server tự chọn model dùng được với key của bạn), `WORKERS_AI_MODEL` (mặc định model tự chọn trong danh sách còn hoạt động).

## Thêm câu mới

- Trong app: vào **📖 Học** của một chủ đề → **＋ Thêm nhiều câu**, dán danh sách (mỗi dòng một câu, tiếng Anh hoặc tiếng Việt, hoặc chọn file `.txt`), bấm dịch, kiểm tra lại rồi lưu. Dòng tiếng Anh được dịch sang tiếng Việt và ngược lại.
- Trong code: thêm vào `data/sentences.json`:

```json
{ "id": "cafe-21", "t": "cafe", "vi": "…", "en": "…", "alt": ["…"], "note": "…" }
```

`t` là id chủ đề trong `utils/topics.ts`, `alt` là các cách nói khác cũng được tính đúng.

## Deploy thủ công từ máy

Cần đăng nhập Cloudflare một lần (`npx wrangler@4 login`), rồi:

```bash
pnpm run deploy:cf   # hoặc: npm run deploy:cf
```

Lệnh này build production rồi đẩy thư mục `dist` lên project `engs-training`. (Không đặt tên script là `deploy` vì `pnpm deploy` là lệnh có sẵn của pnpm.)
