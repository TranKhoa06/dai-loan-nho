# Nguồn và dữ liệu cho luyện viết

Ngày tham khảo và đóng gói: 18/11/2026.

## Trang tham khảo

- [Hanzi Writer – tài liệu chính thức](https://hanziwriter.org/docs.html): hoạt ảnh cả chữ/từng nét, gợi ý nét và bài tập viết theo đúng thứ tự; API phản hồi nét đúng, sai và hoàn thành. Dùng trực tiếp thư viện mã nguồn mở để thực hiện tính năng, không mô phỏng điểm nét bằng ảnh.
- [Kho Hanzi Writer](https://github.com/chanind/hanzi-writer): hỗ trợ chữ phồn thể và giản thể, thư viện theo MIT.
- [Kho Hanzi Writer Data](https://github.com/chanind/hanzi-writer-data): SVG từng nét và đường trung tâm dùng để so khớp thao tác viết. Dữ liệu bắt nguồn từ Make Me A Hanzi và phông Arphic, theo Arphic Public License.
- [Bộ Giáo dục Đài Loan – 國字標準字體筆順學習網](https://stroke-order.learningweb.moe.edu.tw/): nguồn tra cứu chữ chuẩn và thứ tự nét dành cho người học tại Đài Loan.

## Các tệp đóng gói

- `assets/vendor/hanzi-writer.esm.js`: thư viện 3.7.3, tải từ npm; giữ thông báo MIT và bổ sung vòng đời `destroy()` để dọn dẹp khi chuyển trang. Chi tiết tại `assets/vendor/PATCHES.md`, thông tin nguồn tại `PROVENANCE.json`.
- `assets/hanzi-data/<chữ>.json`: bản nguyên trạng của dữ liệu `hanzi-writer-data@2.0.1`.
- `assets/hanzi-data/manifest.json`: 175 chữ Hán khác nhau xuất hiện trong trường từ vựng và tập viết của 15 bài đang có; có tổng nét và SHA-256 từng tệp. Không lấy toàn bộ 9.000+ chữ trong gói.
- `assets/hanzi-data/ARPHICPL.TXT` và `README.upstream.md`: giấy phép và ghi nguồn của dữ liệu, giữ nguyên từ gói gốc.
- `assets/vendor/LICENSE.MIT.txt` và `COPYING.upstream.md`: thông báo bản quyền/giấy phép thư viện.

Tất cả 175/175 chữ cần dùng đều có dữ liệu; không có chữ bị thiếu. Tổng JSON nét chữ khoảng 484 kB, thư viện khoảng 83 kB. Tệp nào được chọn mới được tải từ chính website; không cần CDN hoặc máy chủ nhận dạng chữ để luyện nét. Việc tải/hiển thị nét vẫn cần trang và tài nguyên tương ứng truy cập được; đây không phải cam kết toàn web hoạt động offline.

## Phạm vi kiểm tra và giới hạn

Đã kiểm tra từng tệp có mảng đường SVG không rỗng; số đường SVG bằng số đường trung tâm; mỗi đường trung tâm có ít nhất hai điểm tọa độ hợp lệ; đường SVG chỉ chứa lệnh vẽ và số. Gói tải về được đối chiếu mã toàn vẹn SHA-512 của npm, dữ liệu từng chữ không bị sửa.

Tập dữ liệu có chữ phồn thể nhưng không phải bộ dữ liệu do Bộ Giáo dục Đài Loan cấp hoặc thẩm định. Kiểu chữ và thứ tự một số nét có thể khác biến thể trong sách hoặc chuẩn MOE; người học cần đối chiếu nguồn MOE khi có khác biệt. Không gọi kết quả tự động là đánh giá thư pháp hoặc chứng nhận viết đúng chuẩn Đài Loan. Kết quả bài viết là so khớp nét với mẫu dữ liệu đã nêu.
