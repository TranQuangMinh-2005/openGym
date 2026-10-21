# Các section của một PRD

Tổng hợp từ các mẫu PRD phổ biến (Pendo, Product-Led Alliance, SafetyCulture, Techsy) và các mẫu
PRD cho sản phẩm AI (uvik.net, IdeaPlan, skill `ai-feature-prd`). Các mẫu không hoàn toàn giống
nhau; danh sách dưới đây là phần chung.

## Section cốt lõi (mọi PRD)

| # | Section | Trả lời câu hỏi |
|---|---|---|
| 1 | Thông tin tài liệu | Ai viết, phiên bản, trạng thái, ngày |
| 2 | Tóm tắt | Sản phẩm/tính năng là gì, trong 3–5 câu |
| 3 | Vấn đề và bối cảnh | Vì sao cần làm, hiện tại đang có gì |
| 4 | Mục tiêu và chỉ số thành công | Làm xong thì đo bằng gì |
| 5 | Không phải mục tiêu (non-goals) | Cố ý không làm gì |
| 6 | Người dùng | Ai dùng, nhu cầu gì |
| 7 | Phạm vi | Trong và ngoài phạm vi |
| 8 | User stories / hành trình | Người dùng làm gì, theo trình tự nào |
| 9 | Yêu cầu chức năng | Hệ thống phải làm gì, kèm tiêu chí chấp nhận đo được |
| 10 | Yêu cầu phi chức năng | Hiệu năng, riêng tư, độ tin cậy, khả năng sử dụng |
| 11 | Ràng buộc kỹ thuật và phụ thuộc | Giới hạn công nghệ, hệ thống liên quan |
| 12 | Tiến độ và mốc | Khi nào xong cái gì |
| 13 | Rủi ro | Cái gì có thể hỏng, cách giảm thiểu |
| 14 | Câu hỏi mở | Chưa chốt điều gì |
| 15 | Tham chiếu | Nguồn, tài liệu liên quan |

## Section thêm cho sản phẩm AI / LLM

| Section | Nội dung |
|---|---|
| Hướng tiếp cận model | Chọn model nào, kiến trúc (một lượt, RAG, đa agent) |
| Guardrails | Điều hệ thống **không bao giờ** được làm; kiểm tra đầu vào, đầu ra, truy xuất, hành động |
| Fallback và lỗi | Khi model sai hoặc không trả lời được thì làm gì; khi nào chuyển cho người |
| Đánh giá (eval) | Bộ test (golden set), độ đo, ngưỡng đạt, người phụ trách |
| Chi phí và độ trễ | Ngân sách token, số lần gọi, thời gian phản hồi |
| Dữ liệu và riêng tư | Dữ liệu nào gửi cho model, ranh giới riêng tư |

## Ghi chú

- PRD một trang là cùng khung này, bỏ các section không cần.
- Non-goals và tiêu chí chấp nhận đo được là hai phần hay bị thiếu nhất.
- Với đề tài môn học, có thể thêm **câu hỏi nghiên cứu** vào section Mục tiêu.
