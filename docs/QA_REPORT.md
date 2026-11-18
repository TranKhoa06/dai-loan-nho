# Báo cáo kiểm tra Đài Loan nhỏ

Ngày kiểm tra: 18/11/2026 (giờ Việt Nam).

## Kết quả kiểm tra tự động

`npm test` trên Node.js 24.15.0: **65/65 kiểm thử đạt**, không có lỗi hoặc kiểm thử bị bỏ qua.

- Dữ liệu đủ 15 bài đồng hành với sách, 119 mục từ vựng, 78 điểm ngữ pháp, thứ tự bài, trang sách/PDF, trường chữ Hán/Pinyin/tiếng Việt, đáp án và liên kết nguồn.
- Liên kết ngữ pháp đúng bài, cú pháp JavaScript và đường dẫn tài nguyên tương đối để chạy dưới tiền tố repository GitHub Pages.
- Nhập tiến độ loại khóa gây thay đổi prototype, trường kỹ năng lạ và dữ liệu bí mật; xử lý trường hợp bộ nhớ trình duyệt không khả dụng.
- Server xem thử phục vụ HTML/module đúng kiểu nội dung và chặn đường dẫn vượt thư mục, tệp ẩn, dấu gạch chéo Windows và phương thức ghi.
- Audio ưu tiên giọng zh-TW, xử lý giọng tải muộn, dừng, chia đoạn và lỗi; micro nhận dạng zh-TW và bỏ kết quả cũ sau khi hủy.
- Hội thoại có hướng dẫn, kết thúc tình huống, chống phản hồi AI cũ chen vào phiên mới và hiển thị nội dung model bằng văn bản đã escape.
- AI trên thiết bị chỉ tải khi người dùng chủ động; kiểm tra khả năng GPU, tiến trình, hủy tải/hủy sinh câu, giới hạn đầu vào, giải phóng bộ nhớ và báo lỗi. Các trường hợp này dùng engine mô phỏng, không tải model thật.
- Worker kiểm tra Origin, token tùy chọn, giới hạn yêu cầu, kiểu dữ liệu/vai trò, xử lý lỗi và đường đi Cloudflare/OpenAI bằng mô phỏng dịch vụ.

## Kiểm tra giao diện và giới hạn xác minh

Đã quan sát giao diện localhost ở trang chính và bài học cùng khu vực trạng thái âm thanh. Chưa xác minh đầy đủ trên điện thoại hoặc nhiều kích thước màn hình; các lần thử thay viewport không tạo đủ bằng chứng để khẳng định kiểm tra responsive đã hoàn tất.

Lần tiếp tục kiểm tra qua native Chrome đã dừng vì công cụ không xác định được URL của tab. Không thực hiện thêm thao tác trên tab chưa xác định và không dùng một công cụ điều khiển trình duyệt khác để bỏ qua giới hạn này.

Chưa xác minh bằng việc nghe trực tiếp toàn bộ audio, thu micro thật hoặc sinh câu với model WebGPU thật. Khả năng hoạt động và chất lượng giọng phụ thuộc thiết bị/trình duyệt. Chưa kết nối tài khoản Cloudflare/OpenAI thật cho backend tùy chọn. Nội dung tĩnh đã được đối chiếu tài liệu có dẫn nguồn, chưa có giáo viên thẩm định độc lập; nội dung AI động cần người học đối chiếu lại.

## Build và triển khai

Repository: [TranKhoa06/dai-loan-nho](https://github.com/TranKhoa06/dai-loan-nho). GitHub Pages đã được cấu hình dùng workflow và HTTPS. Theo dõi [lượt triển khai](https://github.com/TranKhoa06/dai-loan-nho/actions/workflows/deploy.yml); trạng thái xuất bản sẽ được ghi lại sau khi workflow đầu tiên hoàn tất.

Bản build chỉ bao gồm tài nguyên tĩnh và hướng dẫn công khai. Không đưa PDF sách, thư mục tạm, thông tin đăng nhập, mã Worker hoặc cấu hình secret vào `dist/`.
