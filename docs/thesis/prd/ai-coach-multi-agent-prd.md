# PRD trợ lý AI xây dựng và điều chỉnh chương trình tập luyện

## 1. Tổng quan và định hướng

Trợ lý hỗ trợ người tập gym phát triển hình thể, với trọng tâm tập kháng lực hướng đến hypertrophy. Người dùng có thể ưu tiên phát triển cơ bắp, hỗ trợ giảm mỡ và duy trì cơ, hoặc cải thiện thành phần cơ thể. Hệ thống kết nối ba chức năng: tạo chương trình, giải thích kiến thức liên quan và xem xét điều chỉnh sau mỗi buổi tập.

“Phù hợp” được hiểu là đáp ứng các điều kiện đã cung cấp, tuân thủ các quy tắc chuyên môn đã chọn và được đánh giá trong phạm vi xác định. Hệ thống không mặc định biết đầy đủ tình trạng cơ thể qua vài thông tin hoặc qua hội thoại.

Để làm được điều đó, trợ lý được tổ chức thành nhiều agent, mỗi agent đảm nhận một việc: ghi nhớ các điều kiện người dùng đã nêu, giải thích kiến thức dựa trên tài liệu có nguồn, thiết kế chương trình, đọc nhật ký tập và kiểm tra mọi đề xuất trước khi đưa cho người dùng. Không đề xuất nào được áp dụng nếu chưa qua bước kiểm tra và chưa được người dùng chấp nhận.

## 2. Vấn đề thực tế cần giải quyết

Người tập có thể biết mục tiêu và cấu trúc chương trình mình muốn theo, nhưng chưa đủ tự tin lựa chọn bài, phân bổ khối lượng, hiểu cơ tham gia và quyết định nên thay đổi gì khi gặp khó khăn. Khó khăn bắt đầu ngay từ khi xây chương trình: trên mạng mỗi nguồn nói một kiểu, người khuyên tập toàn thân ba buổi, người khuyên Push–Pull–Legs sáu buổi. Không đủ kiến thức để chọn, người mới thường chép nguyên chương trình của người khác, rồi nhận ra nó không hợp với thời gian, thiết bị hay trình độ của mình và bỏ dở sau vài tuần.

Ngay cả khi đã có chương trình, người tập thường làm theo mà không hiểu vì sao. Họ tập đủ số hiệp và reps nhưng không biết bài đó tác động cơ nào hay vì sao nó nằm trong buổi tập, nên khi máy bận hoặc thiếu thiết bị, họ không biết đổi sang bài nào tương đương. Việc tự tìm thông tin từ nhiều nguồn rồi áp dụng vào chương trình đang tập gây tốn công và khó kiểm tra. Một bài thay thế có thể cùng nhóm cơ mục tiêu nhưng không đáp ứng thiết bị, thời lượng hoặc giới hạn đã biết.

Chương trình cũng khó theo kịp thực tế. Sau một buổi tập, kết quả thực tế, mức gắng sức, sở thích hoặc điều kiện tập có thể khác với giả định ban đầu; lúc bận hơn, lúc đổi phòng tập, lúc chỉ có tạ đơn. Mỗi lần tự sửa, người tập dễ làm hỏng phần khác, chẳng hạn giữ nguyên mức tạ của bài cũ cho bài mới hoặc quên giới hạn đã đặt trước đó. Nhật ký tập lẽ ra giúp họ điều chỉnh, nhưng ba buổi liền cùng 60 kg × 8 reps có thể là tiến bộ, giậm chân hay mệt mỏi tùy mức gắng sức. Vì vậy một đề xuất tăng reps hoặc mức tạ cũng cần được xem xét cùng lịch sử và phản hồi, thay vì chỉ dựa vào một con số. Khi bị đau, người tập lại càng lúng túng, thường nhận về những "chẩn đoán" và bài phục hồi không rõ nguồn trên mạng.

Hỏi một chatbot AI thông thường chỉ giải quyết được một phần. Chatbot có thể quên điều đã nói qua nhiều lượt (lượt đầu được dặn không có barbell, vài lượt sau lại gợi ý barbell squat), trả lời tự tin mà không dẫn nguồn, không nhìn thấy nhật ký tập thật và đưa chương trình dưới dạng văn bản mà người dùng phải tự chép lại.

**Nhu cầu cốt lõi:** Người dùng cần được hỗ trợ tạo chương trình, hiểu vì sao tập như vậy và điều chỉnh chương trình khi điều kiện hoặc trải nghiệm thay đổi.

## 3. Người dùng và giá trị mong đợi

Người mới hoặc người đã tập nhưng chưa vững kiến thức xây chương trình; người tự tập không có huấn luyện viên hỗ trợ thường xuyên. Giá trị mong đợi là giảm công sức tự tổng hợp kiến thức, hiểu rõ bài tập và có cơ sở để xem xét những thay đổi phù hợp.

Đề xuất phạm vi ban đầu: người trưởng thành tự tập gym. Người có đau hoặc hạn chế vận động chỉ được hỗ trợ trong giới hạn đã biết; việc xác định nguyên nhân và phục hồi chấn thương không thuộc chức năng của MVP.

## 4. Mục tiêu và phạm vi sản phẩm

### 4.1 Mục tiêu người dùng

Người dùng có thể lựa chọn mục tiêu phát triển cơ bắp; hỗ trợ giảm mỡ và duy trì cơ; hoặc kết hợp phát triển cơ với giảm mỡ.

Hệ thống hỗ trợ xây dựng và điều chỉnh chương trình tập theo mục tiêu đã chọn. Với mục tiêu giảm mỡ, hệ thống chỉ hỗ trợ phần tập kháng lực để duy trì cơ và đọc xu hướng cân nặng người dùng tự ghi, không đặt mức calo hay chế độ ăn. Kết quả thay đổi cơ thể còn phụ thuộc vào dinh dưỡng, sinh hoạt và mức độ thực hiện của người dùng.

### 4.2 Phạm vi MVP

| Trong phạm vi | Ngoài phạm vi ban đầu |
|---|---|
| Hồ sơ nhu cầu, điều kiện tập và bài hoặc động tác cần tránh. | Chẩn đoán, điều trị hoặc tự xác định bài phục hồi từ triệu chứng. |
| Tạo chương trình có cấu trúc theo chuỗi buổi và khả năng tập. | Huấn luyện thành tích cho môn thể thao khác; lập kế hoạch thi đấu. |
| Giải thích cách thực hiện, cơ tham gia chính và phụ, lý do chọn bài; dẫn nguồn. | Phân tích tư thế bằng camera, đo mức kích hoạt cơ hoặc tự đánh giá hình thể qua ảnh. |
| Ghi nhật ký tập và dùng lịch sử đã ghi để hỗ trợ điều chỉnh. | Thiết bị đeo, cảm biến sinh học, theo dõi thời gian thực. |
| Đổi bài, cập nhật thông số, hỏi lại khi thiếu dữ liệu và lưu phiên bản kế hoạch. | Thực đơn, kê mức năng lượng cá nhân và chương trình cardio chi tiết, trừ khi được bổ sung sau. |

### 4.3 Cách tổ chức buổi tập

Chương trình gồm một chuỗi buổi tập theo mục tiêu và điều kiện của người dùng. Mỗi buổi có danh sách bài, nhóm cơ tác động, số hiệp, reps mục tiêu và thời gian nghỉ. Push–Pull–Legs (PPL) là một kiểu chương trình có thể sử dụng; cấu trúc cụ thể được lựa chọn theo hồ sơ người dùng.

Người dùng cho biết số buổi dự kiến có thể tập và tự bố trí ngày thực hiện, không phải chọn cố định thứ trong tuần. Sau mỗi buổi, người dùng ghi kết quả từng hiệp; hệ thống lưu ngày tập thực tế và tiến độ hoàn thành. Chuỗi buổi được giữ lại khi người dùng nghỉ, tập muộn hoặc sang tuần mới.

Khi điều kiện thay đổi, người dùng có thể yêu cầu sửa chương trình qua chatbox, chẳng hạn rút ngắn buổi tập hoặc giảm số buổi dự kiến. Hệ thống đề xuất thay đổi đối với những buổi chưa thực hiện, giải thích lý do và chỉ áp dụng khi người dùng chấp nhận. Nhật ký các buổi đã tập được giữ lại.

| Nhóm dữ liệu | Nội dung cần có | Nguồn dữ liệu |
|---|---|---|
| Hồ sơ ban đầu | Mục tiêu ưu tiên; kinh nghiệm; khả năng tập; thời lượng; thiết bị; sở thích; bài hoặc động tác cần tránh và nguồn của giới hạn đó. | Người dùng |
| Chương trình hiện tại | Mã phiên bản; thứ tự buổi; bài tập; số hiệp; khoảng reps; mức tạ nếu có căn cứ; thời gian nghỉ; nhóm cơ mục tiêu; thời lượng ước tính. | Hệ thống đã tạo và lưu từ trước |
| Kết quả buổi tập | Thời điểm, mã buổi và bài; từng hiệp đã thực hiện; reps, mức tạ và đơn vị; trạng thái hoàn thành; lý do bỏ hoặc thay bài. | Người dùng ghi hoặc nhắn sau khi tập |
| Phản hồi mới | Mức gắng sức; cảm nhận khó hoặc dễ; dấu hiệu đau; sở thích; thiết bị, thời lượng hoặc mục tiêu vừa thay đổi. | Người dùng ghi hoặc nhắn sau khi tập |
| Kiến thức tham chiếu | Danh mục bài và biến thể; cơ tham gia chính/phụ; thiết bị; hướng dẫn; nguồn chuyên môn, ngày cập nhật và quy tắc sử dụng. | Nhóm phát triển chuẩn bị từ tài liệu |

## 5. Đầu vào và đầu ra

| Đầu vào | Đầu ra |
|---|---|
| Hồ sơ và các điều kiện còn hiệu lực; chương trình hiện tại; nhật ký các buổi đã tập; phản hồi hoặc yêu cầu mới qua chatbox; kiến thức tham chiếu đã biên tập (xem bảng ở mục 4.3). | Hệ thống tạo chương trình gồm các buổi và bài tập với thông số cần thiết; giải đáp câu hỏi về bài tập; hoặc đề xuất điều chỉnh chương trình, nêu rõ lý do và phần sẽ thay đổi để người dùng xem trước khi chấp nhận. Nếu thiếu thông tin quan trọng, hệ thống hỏi thêm. |

## 6. Hành trình sử dụng chính

(1) Nhập mục tiêu và điều kiện tập -> (2) Tạo chương trình -> (3) Tập và ghi kết quả -> (4) Hỏi đáp hoặc yêu cầu điều chỉnh -> (5) Trao đổi và cập nhật.

Giải thích:

(1) Người dùng chọn mục tiêu, cung cấp kinh nghiệm, số buổi dự kiến, thời lượng, thiết bị và sở thích. Hệ thống hỏi bổ sung nếu thiếu thông tin cần thiết để tạo chương trình.

(2) Hệ thống tạo chuỗi buổi tập và hiển thị trong bảng, gồm tên bài, số hiệp, reps mục tiêu và thời gian nghỉ. Người dùng có thể xem cách thực hiện, nhóm cơ chính/phụ và hỏi lý do lựa chọn bài.

(3) Người dùng tự bố trí ngày tập, thực hiện buổi trong chương trình và ghi mức tạ, reps thực tế từng hiệp cùng phản hồi ngắn. Hệ thống lưu kết quả theo từng buổi, bài tập và hiệp để theo dõi tiến trình.

(4) Người dùng hỏi qua chatbox hoặc yêu cầu thay đổi khi thời gian, thiết bị, nhu cầu hay trải nghiệm tập thay đổi. Hệ thống sử dụng chương trình hiện tại, nhật ký và tài liệu tham chiếu để trả lời hoặc đề xuất điều chỉnh; hỏi thêm khi chưa đủ thông tin.

(5) Hệ thống hiển thị nội dung đề xuất thay đổi và lý do. Người dùng có thể chấp nhận, yêu cầu sửa thêm hoặc giữ nguyên chương trình. Khi được chấp nhận, hệ thống cập nhật những buổi chưa thực hiện, giữ lại nhật ký cũ và hiển thị chương trình để người dùng tiếp tục tập.

## 7. Chức năng và quy tắc xử lý

### 7.1 Các chức năng chính:

| Chức năng | Yêu cầu |
|---|---|
| Quản lý hồ sơ | Cho phép người dùng xem và cập nhật mục tiêu, điều kiện và sở thích tập luyện. |
| Tạo chương trình | Xây dựng chương trình dựa trên hồ sơ và tài liệu đã chọn; đáp ứng thiết bị, thời lượng, số buổi dự kiến và nhóm cơ muốn ưu tiên. |
| Hướng dẫn và hỏi đáp | Cung cấp cách thực hiện, nhóm cơ chính/phụ và giải thích lựa chọn bài. Câu trả lời sử dụng đúng bài hoặc biến thể đang được hỏi, có nguồn hỗ trợ cho nội dung chuyên môn. |
| Quản lý nhật ký | Lưu và cho phép sửa kết quả từng hiệp, phản hồi và RIR tùy chọn. Phân biệt thông số dự kiến với kết quả thực tế; ghi rõ đơn vị mức tạ. |
| Điều chỉnh chương trình | Sử dụng yêu cầu mới, nhật ký và tài liệu để đề xuất thay bài hoặc sửa thông số. Khi thay bài, xem lại các thông số liên quan thay vì sao chép nguyên mức tạ. |
| Kiểm tra và lưu thay đổi | Kiểm tra chương trình sau điều chỉnh có đáp ứng các điều kiện hiện hành; lưu lịch sử cập nhật và lý do để người dùng xem lại. |

### 7.2 Quy tắc xử lý

1. Giữ đúng yêu cầu còn hiệu lực: thông tin mới thay thế thông tin cũ trong phạm vi người dùng yêu cầu. Nếu phải sửa thêm phần liên quan, hệ thống giải thích lý do.
2. Làm rõ thông tin thiếu hoặc mâu thuẫn: hỏi bổ sung trước khi đưa ra quyết định phụ thuộc vào thông tin đó. Không tự ghi dữ liệu suy đoán thành dữ liệu đã được người dùng xác nhận.
3. Điều chỉnh có căn cứ: không mặc định tăng mức tạ hoặc reps sau mỗi buổi hay mỗi tuần. Kết quả xem xét có thể là giữ nguyên chương trình; dữ liệu bỏ trống không được coi là kết quả bằng 0.
4. Giải thích đúng giới hạn thông tin: thời lượng buổi tập là ước tính. Trợ lý không tự chẩn đoán đau hoặc chấn thương, không khẳng định một bài thay thế phù hợp chỉ dựa vào nhóm cơ tác động.
5. Xử lý khi người dùng báo đau theo quy tắc cố định, không để mô hình tự quyết: với đau nhói, tê, sưng hoặc đau kéo dài, hệ thống đề nghị dừng bài đó, không tự đề xuất bài thay thế cho cùng vùng và khuyên gặp chuyên gia; với mỏi hoặc đau cơ thông thường, hệ thống có thể đề xuất giảm tải và nói rõ đây không phải chẩn đoán; khi chưa rõ, hệ thống hỏi lại trước.

## 8. Yêu cầu phi chức năng

- Dễ sử dụng: dùng tiếng Việt rõ ràng, giải thích thuật ngữ khi xuất hiện; người dùng xem được chương trình và nhật ký mà không phải đọc lại toàn bộ hội thoại.
- Truy vết và riêng tư: lưu nguồn kiến thức, phiên bản quy tắc, lịch sử cập nhật; chỉ thu thập thông tin cần thiết; tách dữ liệu từng người và cho phép xem, sửa hoặc xóa dữ liệu của mình.
- Độ tin cậy: dữ liệu đầu ra phải đúng cấu trúc. Khi công cụ, dữ liệu hoặc mô hình không đáp ứng được, hệ thống thông báo rõ; không báo đã lưu hay cập nhật nếu thao tác thất bại.
- Hiệu năng: đo thời gian phản hồi trung vị và p95, số lần gọi mô hình và chi phí mỗi tác vụ. Chốt ngưỡng sau thử nghiệm sơ bộ; không đặt con số chưa có cơ sở.

## 9. Cách đánh giá thành công

Hệ thống được đánh giá trên ba nhóm tác vụ: tạo chương trình, trả lời câu hỏi và điều chỉnh chương trình. Các tiêu chí được xây dựng từ yêu cầu người dùng và tài liệu tham chiếu đã lựa chọn.

### 9.1. Nội dung và độ đo:

| Nội dung đánh giá | Cách kiểm tra | Độ đo |
|---|---|---|
| Tạo chương trình | Chương trình đầy đủ thông tin, đáp ứng điều kiện người dùng và các nguyên tắc lập chương trình đã xác định từ tài liệu. | Số tình huống đạt toàn bộ tiêu chí bắt buộc / tổng tình huống tạo chương trình khả thi. |
| Trả lời đúng kiến thức | Đối chiếu các nhận định quan trọng với đáp án hoặc tài liệu đã rà soát. | Số nhận định đúng / tổng nhận định được đánh giá. |
| Sử dụng nguồn đúng | Kiểm tra nguồn được dẫn có thực sự hỗ trợ nhận định tương ứng hay không. | Số nhận định được nguồn trích dẫn hỗ trợ / tổng nhận định cần dẫn nguồn. |
| Điều chỉnh đúng yêu cầu | Chương trình mới đáp ứng yêu cầu thay đổi, giữ các điều kiện còn hiệu lực và giải thích được những phần cần sửa thêm. | Số tình huống điều chỉnh đạt yêu cầu / tổng tình huống điều chỉnh khả thi. |

Đầu ra lỗi hoặc không hoàn thành tác vụ trong một tình huống khả thi được tính là chưa đạt. Ngoài tỷ lệ tổng, ghi nhận từng loại lỗi để xác định phần cần cải thiện.

### 9.2. Dữ liệu và tình huống thử nghiệm

Bộ thử nghiệm gồm hồ sơ người dùng, câu hỏi kiến thức và các yêu cầu điều chỉnh. Mỗi tình huống xác định trước thông tin đầu vào, điều kiện cần đáp ứng và tài liệu đối chiếu.

| Nhóm tình huống | Ví dụ | Nội dung cần kiểm tra |
|---|---|---|
| Tạo chương trình | Người mới, thời gian hạn chế, chỉ có một số thiết bị. | Chương trình phù hợp với hồ sơ và đầy đủ thông tin cần thiết. |
| Hỏi đáp | Hỏi nhóm cơ chính/phụ, cách thực hiện hoặc lý do chọn bài. | Trả lời đúng bài, đúng kiến thức và có nguồn hỗ trợ. |
| Điều chỉnh | Đổi bài do thiếu thiết bị, giảm thời lượng hoặc thay đổi nhóm cơ ưu tiên. | Sửa đúng yêu cầu và giữ những điều kiện còn hiệu lực. |
| Sử dụng nhật ký | Cùng mức tạ và reps nhưng kết quả các hiệp, RIR hoặc phản hồi khác nhau. | Đọc đúng dữ liệu và đưa ra đề xuất có căn cứ. |
| Thiếu thông tin hoặc mâu thuẫn | Chưa nêu thiết bị hoặc đưa ra các yêu cầu không thể đồng thời đáp ứng. | Hỏi bổ sung hoặc giải thích đúng xung đột. |
| Thay đổi qua nhiều lượt | Người dùng lần lượt đổi thời lượng, thiết bị và bài tập. | Theo dõi đúng chương trình hiện tại và các yêu cầu còn hiệu lực. |

Không yêu cầu mọi hệ thống tạo cùng một chương trình duy nhất. Các phương án khác nhau được chấp nhận nếu đáp ứng tiêu chí đã xác định. Nhóm tình huống thiếu thông tin hoặc mâu thuẫn được chấm và báo cáo riêng.

### 9.3. Phương án so sánh

So sánh hệ thống đa agent đề xuất với cách sử dụng cùng LLM bằng prompt trực tiếp trong một lần gọi, cung cấp cùng hồ sơ, tài liệu cần thiết và lịch sử liên quan. Mục đích là kiểm tra cách tổ chức xử lý thành nhiều agent có cải thiện chất lượng đầu ra hay không, và phải trả thêm bao nhiêu chi phí về số lần gọi mô hình và thời gian phản hồi.

Hệ thống đề xuất gồm các thành phần ghi nhớ điều kiện, truy xuất tài liệu, đọc nhật ký và kiểm tra đề xuất. Mỗi thành phần được thử nghiệm bằng cách lần lượt bỏ ra khỏi hệ thống để xác định đóng góp của nó. Khi báo cáo, ghi rõ cấu hình và tài nguyên sử dụng của từng phương án.

### 9.4. Quy trình thực nghiệm

1. Chuẩn bị dữ liệu và tiêu chí chấm: xây dựng bộ tình huống, xác định các điều kiện bắt buộc, nguồn đối chiếu và những phản hồi được chấp nhận.
2. Thử nghiệm sơ bộ: chạy trên tập phát triển để phát hiện lỗi, hoàn thiện cách chấm và xác định quy mô, ngưỡng đạt cho vòng đánh giá cuối.
3. Đánh giá chính thức: sử dụng tập kiểm tra riêng, giữ ổn định cấu hình từng phương án trong suốt đợt đánh giá. Chạy lặp để quan sát mức ổn định của kết quả.
4. Tổng hợp và phân tích: tính các độ đo, so sánh kết quả, phân loại lỗi và trình bày ví dụ đạt/chưa đạt. Nếu có nhiều người chấm, thống nhất tiêu chí và kiểm tra mức đồng thuận trên một phần dữ liệu chung.

Kết quả thực nghiệm cho biết hệ thống đáp ứng các tiêu chí đã xác định đến đâu. Hiệu quả tăng cơ hoặc giảm mỡ thực tế cần được đánh giá bằng nghiên cứu theo dõi người tập riêng.

## 10. Các hệ thống và nghiên cứu liên quan

Đề tài tham khảo các nghiên cứu và ứng dụng có chức năng lập chương trình tập cá nhân, hỏi đáp và điều chỉnh theo phản hồi.

| Hệ thống/nghiên cứu | Nội dung liên quan | Điều tham khảo cho đề tài |
|---|---|---|
| PlanFitting [S1] | Tạo và tinh chỉnh kế hoạch tập qua hội thoại, có lưu trạng thái chương trình. | Cách tổ chức hội thoại để thu thập yêu cầu và cập nhật chương trình qua nhiều lượt. |
| Fitbod [S2] | Cá nhân hóa chương trình theo điều kiện và lịch sử tập; sử dụng phản hồi như RIR để hỗ trợ điều chỉnh. | Cách kết hợp hồ sơ, nhật ký và mức gắng sức trong trải nghiệm sử dụng. |

## 11. Công việc tiếp theo

- Khóa mục tiêu, nhóm người dùng, hình thức sản phẩm và mức ghi nhật ký.
- Thiết kế chi tiết các agent và cách chúng phối hợp; xác định dữ liệu trao đổi giữa các agent.
- Rà soát danh mục bài, nguồn kiến thức và quy tắc kiểm tra; chốt giới hạn y khoa.
- Tạo bộ tình huống pilot; kiểm tra baseline trước khi mở rộng tính năng.

## 12. Tài liệu tham chiếu và căn cứ biên tập

[S1] Shin, Hsieh và Kim. PlanFitting. CUI 2025. arXiv 2309.12555v2.
Tham chiếu bài toán lập kế hoạch qua hội thoại, lưu trạng thái và cách đánh giá. Các mục liên quan trong PDF: 4.2–4.3; 5.2; 6.3; 7.5. Bộ đánh giá của bài không được coi là benchmark chuẩn cho MVP này.

[S2] Fitbod Help Center. How Fitbod Creates Your Workout.
Đối chiếu các tính năng cá nhân hóa theo điều kiện và lịch sử. Đây là mô tả của nhà cung cấp, chưa phải kết quả kiểm thử độc lập.

[S3] Fitbod Help Center. Reps in Reserve.
Đối chiếu việc sử dụng phản hồi mức gắng sức để điều chỉnh đề xuất; không dùng mô tả sản phẩm làm nguồn duy nhất để quy định tải tập.

[S4] Longland và cộng sự. Thử nghiệm về khối nạc và khối mỡ. AJCN 2016.
Thử nghiệm có can thiệp kết hợp dinh dưỡng và tập luyện. Kết quả về khối nạc không đồng nhất với đo riêng mô cơ; không suy rộng thành cam kết tăng cơ/giảm mỡ cho mọi người.

[S5] AAOS OrthoInfo. Rotator Cuff and Shoulder Conditioning Program.
Căn cứ về việc cần đánh giá và hướng dẫn phù hợp khi tập liên quan đến đau vai. Không sử dụng tài liệu này để tự chẩn đoán hoặc tự động kê chương trình phục hồi cho người dùng.
