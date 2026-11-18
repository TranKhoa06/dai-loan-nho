# Đài Loan nhỏ · Học tiếng Hoa Đài Loan

[Mã nguồn GitHub](https://github.com/TranKhoa06/dai-loan-nho) · [Địa chỉ GitHub Pages](https://trankhoa06.github.io/dai-loan-nho/) · [Trạng thái triển khai](https://github.com/TranKhoa06/dai-loan-nho/actions/workflows/deploy.yml)

Website đã được triển khai thành công trên GitHub Pages. Xem [báo cáo kiểm tra](docs/QA_REPORT.md) để biết phạm vi xác minh và các giới hạn của thiết bị.

Web học 國語 bằng tiếng Việt, dùng chữ phồn thể, Pinyin và Chú âm. Giao diện chia kỹ năng nghe, nói, đọc, viết, ngữ pháp và trò chơi ôn tập. Học liệu và tiến độ lưu trên thiết bị; phần học cốt lõi không cần tài khoản hay khóa API.

Ứng dụng bổ trợ **當代中文課程 1 · A Course in Contemporary Chinese 1**, theo 15 chủ đề bài của quyển 1. Web không phân phối lại PDF sách. Nội dung giải thích, ví dụ và bài luyện được biên soạn riêng; danh sách nguồn đối chiếu có trong ứng dụng và [CONTENT_SOURCES.md](docs/CONTENT_SOURCES.md). Phạm vi là các kỹ năng của quyển 1; đây không phải toàn bộ giáo trình tới trình độ thành thạo hoặc chứng nhận TOCFL.

## Chạy trên máy

Cần Node.js 22 trở lên; không cần cài thư viện npm.

```sh
npm start
```

Mở địa chỉ do terminal in ra, mặc định `http://127.0.0.1:4173`. Không mở trực tiếp `index.html` bằng `file://` vì trình duyệt hạn chế JavaScript module, microphone và bộ nhớ theo nguồn trang.

```sh
npm test
npm run build
npm run preview
```

Build tạo thư mục `dist/` chỉ chứa website tĩnh; không đưa mã Worker hoặc tệp cấu hình bí mật vào bản xuất bản. Dừng server bằng `Ctrl+C`.

## Xuất bản GitHub Pages

Đẩy toàn bộ thư mục dự án này thành gốc của một repository, nhánh `main`. Trong **Settings → Pages → Source**, chọn **GitHub Actions**. Workflow có sẵn sẽ kiểm tra, build và triển khai sau mỗi lần push. Xem [hướng dẫn chi tiết](docs/DEPLOY_GITHUB.md).

GitHub Pages cung cấp HTTPS cho microphone. Các liên kết tài nguyên dùng đường dẫn tương đối để chạy được cả tên miền riêng và đường dẫn `ten-tai-khoan.github.io/ten-repo/`.

## Âm thanh và luyện nói

Phát âm dùng giọng đọc tổng hợp của trình duyệt/hệ điều hành, ưu tiên giọng `zh-TW`. Danh sách giọng phụ thuộc thiết bị; lần đầu dùng có thể cần tải gói tiếng Trung trong cài đặt hệ điều hành hoặc kết nối mạng. Ứng dụng báo rõ khi thiếu giọng phù hợp. Bản này không đi kèm bản ghi âm người bản ngữ.

Nhận diện tiếng nói tùy trình duyệt và quyền microphone; một số trình duyệt dùng dịch vụ nhận diện trực tuyến. Kết quả chép lời giúp luyện nói, không phải điểm đánh giá thanh điệu hoặc chứng nhận phát âm. Luôn có cách nhập câu bằng bàn phím khi thiết bị không hỗ trợ microphone.

## Gia sư và AI

Chế độ hội thoại theo kịch bản dùng được ngay, không cần API; giao diện ghi rõ đây là luyện tập có hướng dẫn. AI hỏi đáp tự do có hai cách: chủ động tải model chạy trên thiết bị có WebGPU, hoặc kết nối backend AI thật. Chưa tải được model và chưa kết nối dịch vụ thì ứng dụng không giả lập câu trả lời AI.

**AI trên thiết bị không cần khóa API hoặc tài khoản AI.** Model lần đầu tải khoảng 352 MB, cộng thư viện và bộ nhớ đệm; cần GPU/trình duyệt tương thích và khoảng 1,5 GB bộ nhớ GPU khả dụng. Không tự tải khi mở web. Model nhỏ có thể sai tiếng Việt, Pinyin hoặc ngữ pháp; dùng sách và sổ tay đã dẫn nguồn để đối chiếu. Nếu thiết bị không hỗ trợ, vẫn luyện hội thoại có hướng dẫn hoặc dùng backend riêng.

[AI_SETUP.md](docs/AI_SETUP.md) hướng dẫn AI trên thiết bị và backend tùy chọn Cloudflare Worker. Backend mặc định dùng **Workers AI qua tài khoản Cloudflare, không cần khóa OpenAI**; vẫn cần đăng nhập và triển khai Worker của bạn. Có thêm tùy chọn dùng OpenAI. Khóa nhà cung cấp, nếu dùng, chỉ lưu trong secret của Worker; không ghi vào repository, JavaScript của web, localStorage hoặc ảnh chụp màn hình. GitHub Pages không chạy backend và không giữ được bí mật trong mã trình duyệt. Việc gửi câu hỏi tới dịch vụ AI có thể phát sinh phí theo tài khoản của bạn.

## Dữ liệu học tập

Tiến độ lưu cục bộ trong trình duyệt và có thể mất khi xóa dữ liệu trang hoặc đổi thiết bị. Dùng tính năng xuất/nhập bản sao ở trang **Tiến độ học** nếu cần chuyển máy. Chỉ nhập tệp bạn tin cậy. Không có hệ thống đồng bộ tài khoản trong phiên bản này.

## Cấu trúc

- `index.html`, `styles.css`, `src/`, `public/`: giao diện, nội dung và tài nguyên học tập.
- `worker/`: backend AI tùy chọn, triển khai riêng.
- `scripts/`: server xem thử và công cụ đóng gói tĩnh.
- `tests/`: kiểm tra dữ liệu, liên kết nguồn và các ranh giới kỹ thuật.
- `.github/workflows/deploy.yml`: kiểm tra và xuất bản Pages.

Để bổ sung bài học, chỉnh `src/curriculum.js`, giữ đúng cấu trúc dữ liệu và thêm nguồn đối chiếu, rồi chạy lại `npm test`.
