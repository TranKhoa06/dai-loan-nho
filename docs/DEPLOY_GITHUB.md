# Xuất bản Đài Loan nhỏ trên GitHub Pages

Website chạy hoàn toàn dưới dạng tĩnh. Backend AI là tùy chọn và được triển khai riêng; không đưa khóa API vào web.

Repository của bản này: [TranKhoa06/dai-loan-nho](https://github.com/TranKhoa06/dai-loan-nho). Pages đã được đặt ở chế độ GitHub Actions, địa chỉ được cấp là [trankhoa06.github.io/dai-loan-nho](https://trankhoa06.github.io/dai-loan-nho/). Xem [workflow triển khai](https://github.com/TranKhoa06/dai-loan-nho/actions/workflows/deploy.yml) để xác nhận bản xuất bản. Những bước tạo repo dưới đây dành cho người sao chép hoặc triển khai một bản riêng; không cần tạo lại repository hiện có.

## Điều kiện

- Tài khoản GitHub và repository do bạn quản lý.
- Với GitHub Free, dùng repository public để có GitHub Pages miễn phí. Không đưa sách PDF có bản quyền, khóa API hay thông tin riêng vào repository public.
- Node.js 22+ để kiểm tra trên máy. Workflow dùng Node.js 24.

## Tạo và đẩy repository

Tạo repository mới trên GitHub, ví dụ `taiwan-talk`, không chọn thêm README nếu bạn định đẩy dự án đã có. Sau đó mở terminal ở thư mục **taiwan-talk**, thay `TEN_TAI_KHOAN` bằng tài khoản thật:

```sh
git init -b main
git add .
git commit -m "Build Taiwan Mandarin learning website"
git remote add origin https://github.com/TEN_TAI_KHOAN/taiwan-talk.git
git push -u origin main
```

Git Credential Manager có thể yêu cầu đăng nhập bằng trình duyệt. Không dán mật khẩu hay access token vào chat. Nếu dự án đã có Git hoặc remote thì kiểm tra `git status` và `git remote -v` trước khi thực hiện, không tạo lại hoặc ghi đè remote hiện có.

## Bật Pages và xác nhận triển khai

1. Trong repository trên GitHub, mở **Settings → Pages**.
2. Ở **Build and deployment → Source**, chọn **GitHub Actions**.
3. Mở **Actions → Test and deploy GitHub Pages**. Chọn **Run workflow** nếu lần push đầu diễn ra trước khi bật Pages.
4. Chờ cả `build` và `deploy` thành công. Mở URL thực tế trong mục deployment `github-pages` hoặc trang **Settings → Pages**.

URL của project thông thường có dạng `https://TEN_TAI_KHOAN.github.io/taiwan-talk/`. Đây chỉ là mẫu; chỉ coi website đã xuất bản khi deployment báo thành công và URL thực tế mở được.

Sau mỗi lần sửa, chạy `npm test` và `npm run build` rồi commit/push. Pull request chỉ chạy kiểm tra và build, không tự triển khai lên production.

## Khi không lên trang

- **Actions không chạy:** kiểm tra workflow đã nằm trong `.github/workflows/deploy.yml` ở gốc repository và đang dùng nhánh `main`.
- **Configure Pages báo chưa tìm thấy site:** chọn Source là GitHub Actions ở Settings → Pages và chạy lại workflow.
- **Tài nguyên 404:** đẩy toàn bộ dự án làm gốc repo; không chỉ đẩy `index.html`. Workflow xuất bản `dist/` sau build. Không đổi đường dẫn tài nguyên thành `/src/...` vì project Pages có tiền tố tên repo.
- **Microphone không dùng được:** dùng địa chỉ HTTPS, cấp quyền cho trình duyệt và kiểm tra trình duyệt có hỗ trợ nhận diện giọng nói hay không.
- **AI chưa hoạt động:** đây là dịch vụ riêng, không được tạo chỉ bằng việc bật GitHub Pages. Làm theo [AI_SETUP.md](AI_SETUP.md).

Tài liệu chính thức được đối chiếu khi cấu hình workflow: [Configuring a publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site), [Deploying your website automatically](https://docs.github.com/en/get-started/start-your-journey/deploying-your-website-automatically), [Using custom workflows with GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
