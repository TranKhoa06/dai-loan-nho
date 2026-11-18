# Âm thanh và trợ giảng Taiwan Talk

## Dùng ngay khi chưa có khóa API

Web có sáu tình huống hội thoại biên soạn sẵn: làm quen, trà sữa, tàu điện, mua sắm, ăn ở quán và hẹn cuối tuần. Đây là **luyện hội thoại có hướng dẫn**, không phải AI sinh câu trả lời. Không cần tài khoản AI để học bài, làm game, nghe bằng giọng của thiết bị hoặc dùng phần luyện có hướng dẫn.

AI hỏi đáp tự do có thể chạy ngay trên thiết bị bằng WebLLM khi trình duyệt/GPU tương thích, hoặc qua máy chủ AI riêng. GitHub Pages phục vụ tệp tĩnh nên không thể cất khóa dịch vụ ở đó. Dự án hỗ trợ ba cách:

| Cách | Cần gì? | Khóa OpenAI? |
| --- | --- | --- |
| AI trên thiết bị, tùy chọn | WebGPU, GPU tương thích, chủ động tải model lần đầu | Không |
| Cloudflare Workers AI, mặc định | Tài khoản Cloudflare và triển khai Worker với binding `AI` | Không |
| OpenAI | Tài khoản dịch vụ API và khóa cất trong secret của Worker | Có |

Workers AI vẫn có hạn mức và có thể phát sinh phí theo tài khoản; xem [mức sử dụng và giá hiện hành của Cloudflare](https://developers.cloudflare.com/workers-ai/platform/pricing/). Dự án chưa được kết nối sẵn với tài khoản trả phí nào.

## AI trên thiết bị: không cần khóa API hay tài khoản

Đây là model ngôn ngữ thật chạy bằng GPU của trình duyệt, không phải kịch bản hội thoại. Chọn **AI trên thiết bị** trong phần hội thoại, đọc yêu cầu dung lượng, rồi bấm nút tải model. Chỉ mở web hoặc chọn chế độ chưa tự tải model. Sau khi trạng thái báo sẵn sàng, bạn có thể hỏi bằng tiếng Việt hoặc luyện hội thoại tiếng Hoa.

Dự án dùng `Qwen3-0.6B-q4f16_1-MLC` với WebLLM `0.2.89`. [Kho model chính thức của MLC](https://huggingface.co/mlc-ai/Qwen3-0.6B-q4f16_1-MLC/tree/main) hiển thị khoảng **352 MB** cho model; còn thêm thư viện JavaScript, chương trình GPU và bộ nhớ đệm. [Cấu hình model của WebLLM](https://github.com/mlc-ai/web-llm/blob/main/src/config.ts) ước tính khoảng **1.403 MB bộ nhớ GPU** cho biến thể này. Đây là ước tính, không bảo đảm mọi GPU có lượng bộ nhớ đó đều chạy được.

Yêu cầu: HTTPS/localhost, trình duyệt có WebGPU, tăng tốc phần cứng và GPU tương thích; lần đầu cần mạng ổn định. Web kiểm tra sự hiện diện của WebGPU trước, sau đó kiểm tra GPU và model khi bạn chọn tải. Nếu không hỗ trợ, bạn vẫn dùng được hội thoại có hướng dẫn hoặc máy chủ AI bên ngoài. Đừng dùng dữ liệu di động để tải nếu không muốn tiêu tốn vài trăm MB.

Thanh tiến trình có các bước kiểm tra GPU, tải thư viện, tải/khởi tạo model và sẵn sàng. Có thể dừng yêu cầu hoặc giải phóng model khỏi GPU. Tùy giai đoạn, trình duyệt có thể vẫn hoàn tất một phần tải đang chạy; thao tác giải phóng không xóa các tệp model đã lưu trong bộ nhớ đệm. Có thể xóa dữ liệu của site trong cài đặt trình duyệt để xóa bộ nhớ đệm; thao tác này cũng có thể xóa tiến độ học lưu trên cùng site, nên xuất tiến độ trước.

Model nhỏ nhằm giảm dung lượng và yêu cầu thiết bị; có thể trả lời kém tự nhiên bằng tiếng Việt, nhầm Pinyin hoặc ngữ pháp. Nội dung AI **không có trạng thái đã kiểm chứng**. Đối chiếu với sách, phần ngữ pháp và nguồn đã dẫn. Chế độ này chỉ xử lý văn bản, gồm văn bản từ micro nếu bạn chủ động dùng nhận dạng giọng nói; không chấm phát âm hay thanh điệu từ âm thanh gốc.

Suy luận diễn ra trên thiết bị; chế độ này không gửi tin nhắn đến proxy AI. Các tệp thư viện/model được tải từ jsDelivr, GitHub và Hugging Face. Tệp model có thể được trình duyệt lưu đệm, nhưng web không cam kết mở lại hoàn toàn ngoại tuyến vì thư viện và tài nguyên khác vẫn có thể cần mạng.

API module: `supportedLocalAI()` chỉ kiểm tra khả năng có sẵn, không tải hay xin GPU; `loadLocalAI({onProgress,signal})` là bước chủ động tải; `askLocalAI({messages,scenario,signal,onProgress})` yêu cầu model đã tải; `unloadLocalAI()` giải phóng GPU. Mỗi báo cáo tiến trình có `{stage,progress,text}`. Đầu vào chỉ nhận vai trò `user`/`assistant`, giữ phần hội thoại gần nhất trong ngân sách ngữ cảnh; model có giới hạn 384 token cho mỗi câu trả lời. Hủy một phiên tải đang dùng chung sẽ hủy phiên tải đó cho mọi người gọi trong tab.

Kiểm thử không cần GPU hoặc tải model:

```powershell
node --test worker/local-ai.test.mjs
```

Các kiểm thử dùng engine giả lập để kiểm tra không tự tải, lỗi tương thích, tải dùng chung, tiến trình, giới hạn ngữ cảnh, hủy và giải phóng. Chúng không xác nhận chất lượng trả lời hay hiệu năng GPU thực tế. Cần kiểm tra trên trình duyệt có GPU sau khi chủ động tải model.

Nguồn API: [WebLLM Basic Usage](https://webllm.mlc.ai/docs/user/basic_usage.html), [WebLLM API Reference](https://webllm.mlc.ai/docs/user/api_reference.html), [mã engine chính thức](https://github.com/mlc-ai/web-llm/blob/main/src/engine.ts) và [cách ứng dụng WebLLM xử lý Qwen](https://github.com/mlc-ai/web-llm-chat/blob/main/app/client/webllm.ts). Đã kiểm tra ngày 18/11/2026: package `0.2.89` và bản ESM trên jsDelivr trả HTTP 200. Tương thích model lấy từ `prebuiltAppConfig` đi kèm đúng phiên bản thư viện; không trộn chương trình GPU từ phiên bản khác.

## Cách mặc định: Workers AI, không cần khóa OpenAI

1. Đăng nhập tài khoản Cloudflare của bạn. Trên máy có Node.js, chạy từ thư mục dự án:

   ```powershell
   npx wrangler login
   ```

2. Mở `worker/wrangler.toml`, thay `ALLOWED_ORIGIN` bằng **origin** của web. Ví dụ web ở `https://tenban.github.io/taiwan-talk/` thì dùng `https://tenban.github.io`, không có `/taiwan-talk/` hay dấu `/` cuối. Nếu dùng tên miền riêng, điền origin tên miền riêng. Cấu hình chỉ cho phép một origin.

3. Giữ `AI_PROVIDER = "cloudflare"`, binding `[ai]` tên `AI`, và các binding giới hạn yêu cầu. Nếu tài khoản đã dùng namespace giới hạn `1731801` hoặc `1731802`, đổi sang số riêng chưa dùng. Model mặc định là `@cf/qwen/qwen3.8-27b`; có thể thay bằng model tương thích trong danh mục Cloudflare và điều chỉnh tham số ở `index.mjs` nếu model khác yêu cầu định dạng khác.

4. Với bản dùng riêng, đặt mã truy cập bằng giao diện nhập secret của Wrangler:

   ```powershell
   npx wrangler secret put TUTOR_ACCESS_TOKEN --config worker/wrangler.toml
   ```

   Nhập một mã ngẫu nhiên dài từ trình quản lý mật khẩu. Đây là mã bảo vệ máy chủ của bạn, **không phải khóa dịch vụ AI**. Không đặt mã này trong mã nguồn công khai. Bạn có thể bỏ secret này nếu chủ động mở AI cho khách truy cập; khi đó máy chủ không yêu cầu mã truy cập.

5. Triển khai:

   ```powershell
   npx wrangler deploy --config worker/wrangler.toml
   ```

6. Sao chép URL Worker Wrangler trả về. Trong **Cài đặt AI** trên web, điền URL, ví dụ `https://taiwan-talk-tutor.tenban.workers.dev`, cùng mã truy cập nếu đã đặt. Web tự dùng đường dẫn `/chat`. Mã truy cập chỉ giữ trong bộ nhớ của tab, cần nhập lại sau khi tải trang; không lưu vào localStorage.

Máy chủ giới hạn mặc định khoảng 12 yêu cầu/phút theo IP và 120 yêu cầu/phút toàn site. Giới hạn của Cloudflare tính theo địa điểm mạng, không phải trần chi phí toàn cầu. CORS chỉ giới hạn truy cập từ trình duyệt, không thay thế xác thực: người biết địa chỉ vẫn có thể tự tạo header `Origin`. Nếu mở AI công khai, cần quản lý hạn mức ở tài khoản nhà cung cấp; ứng dụng nhiều người dùng nên bổ sung xác thực riêng. Người dùng chung IP có thể dùng chung hạn mức.

## Tùy chọn: dùng OpenAI

Chỉ thực hiện khi có tài khoản API riêng. Trong `[vars]` của `worker/wrangler.toml`, đặt `AI_PROVIDER = "openai"` và thêm `OPENAI_MODEL = "gpt-4.1-mini"` hoặc model Responses tương thích mà tài khoản có quyền dùng. Binding `AI` không được dùng ở chế độ này và có thể bỏ. Đặt khóa qua secret:

```powershell
npx wrangler secret put OPENAI_API_KEY --config worker/wrangler.toml
npx wrangler deploy --config worker/wrangler.toml
```

Không nhập khóa OpenAI vào web, không ghi vào `wrangler.toml`, không commit vào GitHub. Worker dùng `POST https://api.openai.com/v1/responses`, yêu cầu `store: false`, giữ hướng dẫn trợ giảng ở phía máy chủ và chỉ nhận vai trò `user`/`assistant` từ trình duyệt. Model có thể sai; câu trả lời động không mang trạng thái kiểm chứng như nội dung giáo trình đã dẫn nguồn.

## Âm thanh và micro

Giọng đọc trong web dùng `SpeechSynthesis` của trình duyệt, không phải bản thu người thật. Web ưu tiên giọng `zh-TW` hoặc `zh-Hant-TW`. Nếu thiết bị chỉ có giọng Hoa phổ thông khác, web cho biết đang dùng giọng thay thế. Nếu không có giọng Hoa phổ thông, web báo cụ thể thay vì đọc bằng giọng ngôn ngữ khác.

Trên Windows, mở **Settings → Time & language → Language & region**, thêm **Chinese (Traditional, Taiwan)** và các thành phần giọng nói có sẵn cho máy. Tên mục và giọng khả dụng phụ thuộc phiên bản hệ điều hành. Sau khi cài, mở lại trình duyệt và kiểm tra danh sách giọng trong Cài đặt web. Trên điện thoại, kiểm tra ngôn ngữ/giọng đọc trong cài đặt hệ thống. Nếu không nghe, kiểm tra âm lượng, đầu ra loa/tai nghe, kết nối mạng nếu giọng của hệ thống cần mạng và bấm lại nút nghe.

Web chia đoạn dài, hỗ trợ nghe chậm, dừng và phát lại; thông báo lỗi khi dịch vụ không phản hồi. Chất lượng và khả năng hỗ trợ giọng của hệ điều hành vẫn phụ thuộc thiết bị thực tế.

Micro dùng `SpeechRecognition`/`webkitSpeechRecognition`, yêu cầu HTTPS hoặc localhost, quyền micro và trình duyệt hỗ trợ. Một số trình duyệt gửi âm thanh đến dịch vụ nhận dạng của nhà cung cấp và cần mạng. Chỉ bấm micro khi đồng ý với cách xử lý đó. Web chỉ dùng bản chép lời; kết quả đối chiếu văn bản **không phải chấm điểm phát âm hay thanh điệu**. Bạn luôn có thể gõ câu trả lời khi micro không được hỗ trợ.

## Kiểm thử máy chủ

```powershell
node --test worker/worker.test.mjs
```

Các kiểm thử dùng dịch vụ giả lập, không gửi nội dung hay tốn phí API. Chúng kiểm tra CORS, token, giới hạn đầu vào, ngăn vai trò `system` từ client, hạn mức, tách khóa khỏi lỗi trả về và định dạng hai nhà cung cấp. Việc gọi AI thật và chất lượng giọng trên từng thiết bị cần được kiểm tra sau khi triển khai/cài giọng; không thể suy ra từ kiểm thử giả lập.

Worker hết thời gian đợi sau 28 giây, trình duyệt sau 35 giây. OpenAI fetch được hủy khi hết giờ; với binding Workers AI, dừng chờ không bảo đảm hủy xử lý đã bắt đầu ở nhà cung cấp.

## Tài liệu kỹ thuật đã đối chiếu

Đối chiếu ngày 18/11/2026. Các nguồn dưới đây xác nhận cơ chế API; không phải chứng nhận chất lượng nội dung AI.

- [MDN: SpeechSynthesis](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis) — giọng đọc có sẵn, hàng đợi đọc, dừng và sự kiện thay đổi danh sách giọng.
- [MDN: SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition) — hỗ trợ khác nhau giữa trình duyệt và khả năng nhận dạng qua dịch vụ mạng.
- [Cloudflare: Workers AI bindings](https://developers.cloudflare.com/workers-ai/configuration/bindings/) — gọi model qua `env.AI` mà không gửi khóa nhà cung cấp cho trình duyệt.
- [Cloudflare: model Qwen3.8 27B](https://developers.cloudflare.com/workers-ai/models/qwen3.8-27b/) — ID model, messages, định dạng kết quả và giới hạn sinh đầu ra.
- [Cloudflare: Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) — binding giới hạn yêu cầu và phạm vi đếm theo địa điểm mạng.
- [Cloudflare: Secrets](https://developers.cloudflare.com/workers/configuration/secrets/) — cất khóa trong secret của Worker.
- [OpenAI: Create a response](https://developers.openai.com/api/reference/resources/responses/methods/create) — Responses API và cấu trúc input/output.
- [OpenAI: GPT-4.1 mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini) — model cấu hình mặc định của chế độ OpenAI.
