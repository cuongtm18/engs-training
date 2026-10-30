# Phản xạ tiếng Anh

PWA luyện phản xạ dịch **Việt → Anh** qua tình huống hằng ngày. App đưa câu tiếng Việt, bạn gõ tiếng Anh, app chấm và gợi ý cách nói tự nhiên hơn.

- Nuxt 3 (SPA) + `@vite-pwa/nuxt`, deploy lên **Cloudflare Pages**
- Giao diện bằng tiếng Anh theo kiểu app native (thanh tab dưới, bottom sheet, vuốt để xóa); phần đánh giá và nhận xét sau mỗi câu luyện bằng tiếng Việt; câu đề bài luyện tập là tiếng Việt
- Thêm, sửa (tên, emoji, màu) và xóa chủ đề: nút **＋** hoặc **Edit** ở màn hình Topics, hoặc nhấn giữ một chủ đề. Chủ đề có sẵn khi xóa chỉ bị ẩn và khôi phục được trong Settings. Chủ đề tự tạo có, mỗi chủ đề trống có nút **✨ AI script** để AI viết sẵn một kịch bản câu (có thể mô tả tình huống), xem lại rồi lưu
- **Chat practice** (💬): luyện theo kiểu hội thoại, các câu hiện lần lượt **đúng thứ tự trong list**. Bên **trái** là câu tiếng Việt, bên **phải** là câu tiếng Anh bạn gõ và **ngay bên dưới** là hai dòng gọn: **Sửa câu của bạn** (chỉ sửa tối thiểu đúng câu bạn viết, từ đã sửa được gạch chân) và **Câu gợi ý** (cách nói tự nhiên, có nút nghe), kèm một thẻ điểm nhỏ. Không có lời cổ vũ hay phân tích dài. Sau đó câu tiếng Việt kế tiếp tự hiện; có "Show answer" và nhớ vị trí để tiếp tục lần sau. Chế độ thẻ ngẫu nhiên vẫn còn dưới tên **Quick practice**
- Mỗi chủ đề có 2 chế độ: **📖 Học** (xem câu Việt + đáp án + cách nói khác, nghe phát âm, ẩn tiếng Anh để tự kiểm tra, tự thêm câu và AI dịch) và **✍️ Luyện tập** (nhìn câu Việt, gõ câu Anh)
- Chấm 2 bước: (1) đúng cấu trúc và đủ ý chưa, (2) nếu đúng cấu trúc mới chấm **% độ tự nhiên**. Không bắt phải giống đáp án mẫu: AI chấp nhận mọi cách dịch đúng nghĩa; nếu khớp câu mẫu thì chấm ngay, không tốn lượt AI
- 181 câu mẫu trong `data/sentences.json`, câu bạn tự thêm lưu trên máy (chủ đề "Câu của tôi" hoặc bất kỳ chủ đề nào)
- `/api/check` (chấm), `/api/translate` (dịch danh sách câu tự thêm) và `/api/generate` (AI viết kịch bản cho chủ đề): **Gemini** (free, tự chọn model dùng được) → dự phòng **Cloudflare Workers AI**; nếu không có AI thì app ước lượng offline
- Hoàn tác (Undo) cho mọi thao tác xóa/sửa: toast hiện ở phía trên màn hình với nút Undo và nút đóng, tự tắt sau 7-10 giây (chạm giữ để dừng đếm), nút Undo chỉ bấm được sau ~0,35 giây để tránh bấm nhầm. Xóa chữ trong ô nhập (kể cả giữ phím xóa trên bàn phím) cũng được hoàn tác, gom thành một lần nhờ debounce. Ctrl/Cmd+Z ngoài ô nhập = hoàn tác thao tác gần nhất
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

Cách khuyên dùng là **để Cloudflare tự build từ GitHub** (push lên `main` là tự deploy). Chỉ dùng deploy tay khi cần:

```bash
npx wrangler@4 login      # một lần
pnpm run deploy:cf        # hoặc: npm run deploy:cf
```

Script `scripts/deploy.mjs` xóa `dist` cũ, build production (vào thư mục riêng `.nuxt-build`, không đụng tới `.nuxt` của `nuxt dev`), **kiểm tra bản build không lẫn file dev** (`@vite/client`, đường dẫn `E:/...`) rồi mới upload. Nếu phát hiện file dev thì dừng và không upload gì. (Không đặt tên script là `deploy` vì `pnpm deploy` là lệnh có sẵn của pnpm.)

Nếu trang production bị trắng và console báo 404 cho `/_nuxt/@vite/client`, nghĩa là một bản build dev đã bị upload. Cách sửa: vào Cloudflare → Deployments, chọn bản Git mới nhất → **Rollback to this deployment**, hoặc push một commit mới lên `main`.
