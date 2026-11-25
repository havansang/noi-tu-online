# Nối Từ Online

Tiện ích Chrome dành cho **Đấu Xếp Hạng → Nối Từ 1 vs 1** trên Noitu.fun. Nhấp biểu tượng để tự tìm trận và gửi từ khi đến lượt. Khi ván kết thúc và trang trở về sảnh, tiện ích tự tìm trận tiếp theo. Nhấp lại hoặc chọn **Dừng** trong ô trạng thái để tắt.

## Cài trên Chrome

1. Mở `chrome://extensions` và bật **Chế độ dành cho nhà phát triển**.
2. Chọn **Tải tiện ích đã giải nén** và chọn thư mục `C:\SangHV\Noi_Tu\extension`. Nếu đã tải bản cũ từ cùng thư mục, bấm **Tải lại** trên thẻ tiện ích rồi tải lại tab game.
3. Ghim **Nối Từ Online**, mở [Đấu Xếp Hạng](https://www.noitu.fun/rank) và nhấp biểu tượng tiện ích.

## Khi đang chơi

- Tiện ích dùng ô nhập và nút gửi có sẵn trong trận. Ô trạng thái ở góc dưới hiển thị từ vừa gửi hoặc lý do cần bạn tiếp tục bằng tay.
- Ngay dưới trạng thái là các từ có thể nối tiếp sau cụm tiện ích đang chọn, dựa trên bộ từ điển và lịch sử ván. **Xem thêm** mở các từ còn lại khi danh sách dài.
- Tiện ích ưu tiên nước đi khiến đối phương hết từ nối. Khi đối phương còn đáp án, tiện ích thử từng phản hồi và tính số cách mình có thể nối tiếp. Tiện ích tránh nước đi cho đối phương cơ hội chặn mình ngay, rồi ưu tiên nước để lại nhiều cách đáp trả hơn trong trường hợp khó nhất. Từ đã dùng được loại ở mỗi bước.
- Mỗi lượt có tối đa 3 lần gửi. Khi trang báo đáp án sai và còn lượt nhập, tiện ích thử từ khác. Nếu bạn đã nhập sai trước khi bật, tiện ích dùng số lượt còn lại trên trang.
- Khi Noitu.fun báo cụm tiện ích vừa gửi không tồn tại hoặc không hợp lệ, cụm đó được lưu cục bộ trong Chrome và bỏ qua ở những ván sau, kể cả sau khi tải lại tab. Cụm đã dùng trong ván và đáp án dự phòng `a` không được thêm vào danh sách này.
- Tiện ích đợi khoảng 2 giây khi đến lượt và trước mỗi lần thử từ khác. Khi hết ứng viên, tiện ích nhập `a` vào phần trả lời và chờ trang xác nhận trước khi dùng lượt còn lại. Sau khi trang kết thúc ván và về sảnh, tiện ích tìm trận mới.
- Chat và thông báo không làm gián đoạn tự chơi. Khi hàng chờ hết thời gian, tiện ích tự tìm trận lại khi nút **Nối Từ 1 vs 1** xuất hiện.
- Trạng thái bật được giữ khi tải lại cùng tab Noitu.fun trong phiên Chrome hiện tại. Để tắt, nhấp biểu tượng hoặc chọn **Dừng**. Nếu Noitu.fun báo chặn thao tác, tiện ích vẫn bật và chờ bạn xử lý.
- Khi trang yêu cầu CAPTCHA, kể cả khung reCAPTCHA ở sảnh xếp hạng, tiện ích chờ bạn xác minh trực tiếp rồi tự tiếp tục. Vòng quyết định ghép chữ cần thao tác bằng tay.
- Noitu.fun cấm bot và công cụ tự động trong điều khoản. Trang có thể phát hiện thao tác tự động và từ chối đáp án. [Điều khoản sử dụng](https://www.noitu.fun/dieu-khoan-su-dung)

## Từ điển

Tiện ích có 50.130 cụm hai tiếng đã gộp trùng. Tệp gốc VNTK chứa đầy đủ mục từ và định nghĩa của bản tải về. Tệp gốc Viet74K chứa danh sách từ và cụm từ. Cả hai nằm trong `dictionary-source/`. Từ điển đi kèm có thể khác danh sách đáp án của Noitu.fun. [Nguồn dữ liệu và giấy phép](extension/data/SOURCES.md)

Để tạo lại hai danh sách đã lọc từ các tệp gốc, chạy `node scripts/build-dictionary.mjs` từ thư mục dự án.
