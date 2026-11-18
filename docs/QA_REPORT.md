# Báo cáo kiểm tra Đài Loan nhỏ

Ngày kiểm tra: 18/11/2026 (giờ Việt Nam).

## Kết quả kiểm tra tự động

Trên Node.js 24.15.0, **95/95 kiểm thử đạt** khi chạy `npm test`.

- Đối chiếu cả 175 chữ trong phần viết và từ vựng với tệp nét được đóng gói. Kiểm tra thứ tự nét, thử lại sau lỗi tải, ghi tiến độ, tương thích bản sao lưu cũ và hủy thao tác khi đổi bài.
- Kiểm tra hoàn tác, lưu ảnh, vẽ bằng một con trỏ và giữ nét khi đổi kích thước của ô viết tự do.

- Dữ liệu đủ 15 bài đồng hành với sách, 119 mục từ vựng, 78 điểm ngữ pháp, thứ tự bài, trang sách/PDF, trường chữ Hán/Pinyin/tiếng Việt, đáp án và liên kết nguồn.
- Liên kết ngữ pháp đúng bài, cú pháp JavaScript và đường dẫn tài nguyên tương đối để chạy dưới tiền tố repository GitHub Pages.
- Nhập tiến độ loại khóa gây thay đổi prototype, trường kỹ năng lạ và dữ liệu bí mật; xử lý trường hợp bộ nhớ trình duyệt không khả dụng.
- Server xem thử phục vụ HTML/module đúng kiểu nội dung và chặn đường dẫn vượt thư mục, tệp ẩn, dấu gạch chéo Windows và phương thức ghi.
- Audio ưu tiên giọng zh-TW, xử lý giọng tải muộn, dừng, chia đoạn và lỗi; micro nhận dạng zh-TW và bỏ kết quả cũ sau khi hủy.
- Hội thoại có hướng dẫn, kết thúc tình huống, chống phản hồi AI cũ chen vào phiên mới và hiển thị nội dung model bằng văn bản đã escape.
- AI trên thiết bị chỉ tải khi người dùng chủ động; kiểm tra khả năng GPU, tiến trình, hủy tải/hủy sinh câu, giới hạn đầu vào, giải phóng bộ nhớ và báo lỗi. Các trường hợp này dùng engine mô phỏng, không tải model thật.
- Worker kiểm tra Origin, token tùy chọn, giới hạn yêu cầu, kiểu dữ liệu/vai trò, xử lý lỗi và đường đi Cloudflare/OpenAI bằng mô phỏng dịch vụ.

## Kiểm tra giao diện và giới hạn xác minh

Trong phần luyện viết, đã dùng chuột viết chữ 人 của bài 2 trên trình duyệt. Nét ngang sai bị yêu cầu thử lại. Viết đủ hai nét theo mẫu cho kết quả 2/2 nét, 1 lần thử lại và 0 gợi ý. Tiến độ 1/3 chữ của bài được giữ sau khi tải lại. Đã kiểm tra nút xem riêng từng nét và đối chiếu cách trình bày ở màn hình rộng và hẹp.

Trong lần cập nhật luyện viết này, đã đối chiếu bàn viết ở desktop rộng 1265 pixel và màn hình hẹp 375 CSS pixel. Ở màn hình hẹp, chiều rộng tài liệu khớp chiều rộng cuộn và bốn nút chế độ đều còn hiển thị. Đây là kiểm tra các kích thước nêu trên, chưa phải kiểm thử trên mọi thiết bị thực tế.

Ở lần xuất bản ban đầu, đã quan sát trang chính/bài học/trạng thái âm thanh trên localhost. Lần kiểm tra qua native Chrome khi đó dừng vì công cụ không xác định được URL; giới hạn cũ này không được dùng làm bằng chứng cho kiểm tra giao diện luyện viết mới.

Chưa xác minh bằng việc nghe trực tiếp toàn bộ audio, thu micro thật hoặc sinh câu với model WebGPU thật. Khả năng hoạt động và chất lượng giọng phụ thuộc thiết bị/trình duyệt. Chưa kết nối tài khoản Cloudflare/OpenAI thật cho backend tùy chọn. Nội dung tĩnh đã được đối chiếu tài liệu có dẫn nguồn, chưa có giáo viên thẩm định độc lập; nội dung AI động cần người học đối chiếu lại.

## Build và triển khai

Website: [trankhoa06.github.io/dai-loan-nho](https://trankhoa06.github.io/dai-loan-nho/). Repository: [TranKhoa06/dai-loan-nho](https://github.com/TranKhoa06/dai-loan-nho).

Lượt xuất bản chức năng đầu tiên [44270494302](https://github.com/TranKhoa06/dai-loan-nho/actions/runs/44270494302) hoàn tất **success**, từ commit mã nguồn `dafa8b1a6e14f3b354de53fe37f305bab4e248c0`. GitHub Pages dùng workflow và HTTPS.

Đã kiểm tra HTTP trên địa chỉ công khai: trang chính, 6 module JavaScript, 2 stylesheet, hình Taipei SVG, favicon và 3 tài liệu hướng dẫn đều trả **200** với kiểu nội dung phù hợp. HTML chứa đường dẫn theme/module đúng và app đã có câu chào cuối cùng. Đường dẫn `worker/index.mjs` trả **404**, xác nhận backend không nằm trong artifact tĩnh. Địa chỉ thư viện WebLLM 0.2.89 trả **200** khi kiểm tra HEAD; việc này chưa xác minh suy luận GPU thật.

Bản build chỉ bao gồm tài nguyên tĩnh và hướng dẫn công khai. Không đưa PDF sách, thư mục tạm, thông tin đăng nhập, mã Worker hoặc cấu hình secret vào `dist/`.
