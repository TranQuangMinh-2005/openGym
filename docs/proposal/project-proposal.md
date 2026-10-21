# Đề xuất dự án: Trợ lý AI xây dựng và điều chỉnh chương trình tập luyện

## 1. Tóm tắt

Người tự tập gym thường biết mình muốn gì, tăng cơ, giảm mỡ hay cải thiện vóc dáng, nhưng không
biết nên tập bài nào, tập bao nhiêu, vì sao tập như vậy và phải thay đổi gì khi cuộc sống thay
đổi. Họ tìm câu trả lời trên mạng, nơi mỗi nguồn nói một kiểu, hoặc hỏi các chatbot AI, vốn trả
lời tự tin nhưng hay quên điều đã nói, không dẫn nguồn và không nhìn thấy những gì họ đã thực sự
tập.

Dự án đề xuất xây dựng một ứng dụng ghi nhật ký tập gym có tích hợp trợ lý AI. Trợ lý giúp người
dùng tạo chương trình phù hợp với mục tiêu, thời gian và thiết bị của họ; giải thích từng bài tập
kèm nguồn tham khảo; và đề xuất điều chỉnh dựa trên kết quả tập thực tế. Điểm khác biệt nằm ở cách
tổ chức trợ lý: thay vì một chatbot duy nhất, hệ thống gồm nhiều agent, mỗi agent chuyên một việc,
cùng một bước kiểm tra bắt buộc trước khi bất kỳ đề xuất nào đến tay người dùng. Mọi điều kiện người
dùng đã nêu được lưu thành danh sách rõ ràng, và không thay đổi nào được áp dụng khi người dùng chưa
đồng ý.

## 2. Bối cảnh và vấn đề

### 2.1 Người tự tập gặp khó khăn gì

Người tập có thể biết mục tiêu và cấu trúc chương trình mình muốn theo, nhưng chưa đủ tự tin lựa
chọn bài, phân bổ khối lượng, hiểu cơ tham gia và quyết định nên thay đổi gì khi gặp khó khăn. Hệ
quả dễ thấy nhất là bỏ tập sớm. Các nghiên cứu ghi nhận tỷ lệ đi tập chỉ khoảng 10–37% trong ba
đến sáu tháng đầu sau khi đăng ký thành viên phòng gym [S16]. Tại một trung tâm thể hình ở Rio de
Janeiro (Brazil), dữ liệu của 5.240 hội viên cho thấy 63% hội viên mới bỏ trước tháng thứ ba và
chưa đến 4% duy trì liên tục quá 12 tháng [S26]. Một nghiên cứu theo dõi hai năm với 4.788 người
mới tập gym ở Bồ Đào Nha ghi nhận 39% bỏ tập giữa mốc sáu tháng đầu và mốc sáu tháng tiếp theo, và
thêm 25% bỏ ở giai đoạn sau đó [S27]. Tình trạng tương tự xảy ra với ứng dụng: một tổng quan năm
2024 trên 18 nghiên cứu với 525.824 người dùng ứng dụng về lối sống và sức khỏe tinh thần cho thấy
trung vị 70% người dùng ngừng sử dụng trong 100 ngày đầu [S17].

Khó khăn bắt đầu ngay từ khi xây chương trình, vì kiến thức nền của người tập còn mỏng. Khi 721
người tập gym tại Áo được hỏi về 14 nhận định phổ biến trong tập kháng lực, chỉ 5 nhận định được đa
số trả lời đúng [S18]. Nguồn thông tin họ dựa vào lại không đáng tin: phân tích 200 video thể hình
phổ biến trên TikTok cho thấy khoảng 60% video của các influencer chứa thông tin sai lệch hoặc có hại,
và phần lớn người đăng không có chứng chỉ chuyên môn [S19]. Trên mạng mỗi nguồn nói một kiểu, người
khuyên tập toàn thân ba buổi, người khuyên Push–Pull–Legs sáu buổi. Không đủ kiến thức để chọn,
người mới thường chép nguyên chương trình của một người khác, rồi nhận ra nó không hợp với thời gian,
thiết bị hay trình độ của mình.

Ngay cả khi đã có chương trình, người tập thường làm theo mà không hiểu vì sao. Họ tập đủ số hiệp và
reps nhưng không biết bài đó tác động cơ nào hay vì sao nó nằm trong buổi tập, nên khi máy bận hoặc
thiếu thiết bị, họ không biết đổi sang bài nào tương đương và thường bỏ luôn bài đó. Việc tự tìm
thông tin từ nhiều nguồn rồi áp dụng vào chương trình đang tập gây tốn công và khó kiểm tra. Một bài
thay thế có thể cùng nhóm cơ mục tiêu nhưng không đáp ứng thiết bị, thời lượng hoặc giới hạn đã biết.

Chương trình cũng khó theo kịp thực tế. Trong các thử nghiệm tập luyện STRRIDE với 947 người trưởng
thành ít vận động, "không có thời gian" là lý do bỏ tập được nêu nhiều nhất (40%), và 67% người bỏ
cuộc rời đi trước hoặc trong giai đoạn khối lượng và cường độ đang được tăng dần [S20]. Sau một buổi tập, kết quả thực tế, mức gắng sức, sở thích
hoặc điều kiện tập có thể khác với giả định ban đầu; có lúc bận hơn, có lúc đổi phòng tập, có lúc đi
công tác chỉ có tạ đơn. Một chương trình cứng nhắc, không tự co giãn theo những thay đổi đó, đẩy
người tập vào thế phải tự sửa, và mỗi lần tự sửa lại dễ làm hỏng phần khác, chẳng hạn giữ nguyên mức
tạ của bài cũ cho bài mới hoặc quên giới hạn đã đặt trước đó.

Nhật ký tập lẽ ra giúp họ điều chỉnh, nhưng phần lớn người tập ghi số mà không biết đọc. Ba buổi liền
cùng đẩy 60 kg × 8 reps có thể là tiến bộ, giậm chân hay mệt mỏi tích lũy, tùy vào mức gắng sức của
từng buổi. Vì vậy một đề xuất tăng reps hoặc mức tạ cần được xem xét cùng lịch sử và phản hồi, thay
vì chỉ dựa vào một con số. (Nhóm chưa tìm được nghiên cứu định lượng trực tiếp về khó khăn này; đây là
điểm sẽ được kiểm chứng qua phỏng vấn người dùng ở giai đoạn đầu dự án.)

Khi bị đau, rủi ro càng lớn. Một tổng quan hệ thống năm 2023 trên 28 nghiên cứu về chấn thương trong
các hình thức tập kháng lực ghi nhận tỷ lệ chấn thương từ 0,21 đến 18,9 ca trên 1.000 giờ tập và tỷ
lệ người từng chấn thương từ 10% đến 82% tùy nghiên cứu [S21]. Một tổng quan năm 2024 về cử tạ và
powerlifting cho thấy vai nằm trong các vị trí bị chấn thương phổ biến nhất ở cả hai môn [S28]. Gặp cơn đau, người
tập thường nhận về những "chẩn đoán" và bài phục hồi không rõ nguồn trên mạng, rồi hoặc tập cố đến
chấn thương nặng hơn, hoặc sợ quá mà bỏ tập.

**Nhu cầu cốt lõi:** người dùng cần được hỗ trợ tạo chương trình, hiểu vì sao tập như vậy và điều
chỉnh chương trình khi điều kiện hoặc trải nghiệm thay đổi.

### 2.2 Các cách giải quyết hiện có và hạn chế

Huấn luyện viên riêng giải quyết được gần như mọi khó khăn trên, nhưng chi phí cao và không phải lúc
nào cũng có mặt khi người tập cần. Phần lớn người tập vì thế tìm đến những cách rẻ hơn, và mỗi cách
chỉ giải quyết được một phần. Video, blog và diễn đàn có rất nhiều kiến thức nhưng, như số liệu ở
trên cho thấy, thường sai lệch, mâu thuẫn nhau và không gắn với chương trình cụ thể của người xem.
Các ứng dụng ghi nhật ký tập giúp lưu số liệu nhưng hầu như không diễn giải hay giải thích, và đa số
người dùng bỏ ứng dụng sau vài tháng [S17]. Một số ứng dụng thương mại như Fitbod đã cá nhân hóa
chương trình theo điều kiện và lịch sử tập, có dùng cả phản hồi về mức gắng sức (RIR) để điều chỉnh
[S2, S3], nhưng người dùng vẫn khó hỏi lại vì sao một bài được chọn và nhận câu trả lời có nguồn.

Chatbot AI đang trở thành một kênh phổ biến. Theo khảo sát của Rock Health, tỷ lệ người trưởng thành
ở Mỹ dùng chatbot AI để tìm thông tin sức khỏe tăng gấp đôi chỉ trong một năm, từ 16% lên 32% (khảo sát 8.000
người, thực hiện tháng 12/2025) [S22]. Một số nghiên cứu cho thấy hướng
này có triển vọng: GPT-4 tạo được chương trình tập được chuyên gia đánh giá ngang với huấn luyện viên
trong một nghiên cứu tình huống với một người tham gia, không có khác biệt có ý nghĩa thống kê [S6], và các hệ thống như GPTCoach thu thập được thông tin cá nhân
phong phú qua hội thoại để hỗ trợ lập kế hoạch vận động [S7].

Tuy vậy, chatbot thông thường có bốn hạn chế đáng kể. Thứ nhất, lời khuyên thiếu đầy đủ: khi đánh
giá khuyến nghị tập luyện của ChatGPT (phiên bản tháng 2/2023) cho 26 nhóm đối tượng lâm sàng, nội
dung đạt khoảng 91% về độ chính xác nhưng chỉ khoảng 41% về độ đầy đủ [S23]. Thứ hai, nguồn dẫn không đáng tin: trong một nghiên cứu với
115 tài liệu tham khảo do ChatGPT (GPT-3.5) tạo cho nội dung y khoa, 47% là bịa hoàn toàn, 46% có
thật nhưng sai chi tiết, chỉ 7% vừa có thật vừa chính xác [S24]; một nghiên cứu khác ghi nhận 69% tài
liệu tham khảo là bịa [S25]. Thứ ba, chatbot quên yêu cầu qua nhiều lượt: lượt đầu được dặn không có
barbell, vài lượt sau lại gợi ý barbell squat. Bộ đánh giá SEQUOR cho thấy ngay cả khi chỉ phải tuân
thủ một ràng buộc, độ chính xác của mô hình vẫn giảm dần khi hội thoại dài ra, mức giảm vượt 11%; khi
phải tuân thủ nhiều ràng buộc cùng lúc, độ chính xác giảm hơn 40% [S9]. Trên bộ EvolIF, mô hình tốt
nhất được thử (GPT-5) cũng chỉ đạt điểm bền vững 66,40% qua hội thoại nhiều lượt [S8]. Thứ tư, chatbot không nhìn thấy nhật ký tập thật của người dùng, và chương trình nó
đưa ra chỉ là văn bản trong khung chat mà người dùng phải tự chép sang nơi khác.

### 2.3 Cơ hội

Như vậy vẫn còn thiếu một giải pháp vừa dùng dữ liệu tập thật của người dùng, vừa giải thích có
nguồn, vừa nhớ và kiểm tra được mọi điều kiện của họ qua nhiều lần thay đổi. Các nghiên cứu về lập
kế hoạch bằng mô hình ngôn ngữ gợi ý hướng đi. Trên bộ đánh giá TravelPlanner, GPT-4 tự lập kế hoạch
du lịch nhiều ràng buộc chỉ đạt tỷ lệ thành công 0,6% [S10]. Khi kết hợp mô hình với các bộ kiểm tra
bên ngoài và cho mô hình sửa theo phản hồi (khung LLM-Modulo), tỷ lệ thành công của GPT-4-Turbo tăng
4,6 lần so với khi tự làm [S11]. Dự án áp dụng ý tưởng đó, tức tách phần
"ghi nhớ và kiểm tra" ra khỏi mô hình và giao cho code, vào bài toán chương trình tập luyện.

### 2.4 Tóm tắt bằng chứng

| Khó khăn | Số liệu | Nguồn |
|---|---|---|
| Bỏ tập sớm | Tỷ lệ đi tập 10–37% trong 3–6 tháng đầu; Brazil (5.240 hội viên): 63% bỏ trước tháng thứ ba, dưới 4% duy trì quá 12 tháng; Bồ Đào Nha (4.788 người mới): 39% bỏ giữa mốc 6 và 12 tháng | [S16, S26, S27] |
| Bỏ ứng dụng | Trung vị 70% người dùng ứng dụng sức khỏe ngừng dùng trong 100 ngày | [S17] |
| Thiếu kiến thức | 721 người tập gym: chỉ 5/14 nhận định được đa số trả lời đúng | [S18] |
| Thông tin sai trên mạng | Khoảng 60% video thể hình của influencer trên TikTok (mẫu 200 video) sai lệch hoặc có hại | [S19] |
| Thiếu thời gian, chương trình cứng | "Không có thời gian" là lý do bỏ tập được nêu nhiều nhất (40%); 67% người bỏ rời đi trước hoặc trong giai đoạn tăng dần khối lượng | [S20] |
| Chấn thương | 0,21–18,9 ca/1.000 giờ tập; 10–82% người từng chấn thương; vai nằm trong các vị trí bị nhiều nhất (cử tạ, powerlifting) | [S21, S28] |
| Người dùng chuyển sang chatbot | Tỷ lệ người trưởng thành Mỹ từng dùng chatbot AI cho thông tin sức khỏe tăng gấp đôi trong một năm: 16% → 32% | [S22] |
| Chatbot thiếu đầy đủ | Khuyến nghị tập của ChatGPT: chính xác khoảng 91% nhưng đầy đủ chỉ khoảng 41% | [S23] |
| Chatbot bịa nguồn | 47% tài liệu tham khảo bịa hoàn toàn, chỉ 7% đúng (GPT-3.5); nghiên cứu khác: 69% bịa | [S24, S25] |
| Chatbot quên yêu cầu | Độ chính xác tuân thủ giảm hơn 11% khi hội thoại dài ra (một ràng buộc), hơn 40% khi nhiều ràng buộc | [S9] |
| Kiểm tra bên ngoài giúp ích | Lập kế hoạch nhiều ràng buộc: GPT-4 tự làm chỉ đạt 0,6%; thêm bộ kiểm tra bên ngoài giúp GPT-4-Turbo tăng 4,6 lần | [S10, S11] |

Các con số trên đến từ những nghiên cứu có phạm vi, quốc gia và cách định nghĩa khác nhau, nên chỉ
dùng để minh họa mức độ phổ biến của vấn đề, không so sánh trực tiếp với nhau. Các số liệu về chatbot
phần lớn đo trên các phiên bản mô hình năm 2023–2024 và có thể đã thay đổi với mô hình mới hơn; đây
cũng là lý do dự án tự đo lại trên mô hình sẽ dùng.

## 3. Mục tiêu dự án

Dự án hướng đến một trợ lý giúp người tập gym phát triển hình thể, với trọng tâm tập kháng lực hướng
đến hypertrophy (phát triển kích thước cơ). Người dùng có thể ưu tiên phát triển cơ bắp, hỗ trợ giảm
mỡ và duy trì cơ, hoặc cải thiện thành phần cơ thể. Hệ thống kết nối ba chức năng: tạo chương trình,
giải thích kiến thức liên quan và xem xét điều chỉnh sau mỗi buổi tập.

"Phù hợp" trong dự án này được hiểu là đáp ứng các điều kiện người dùng đã cung cấp, tuân thủ các
quy tắc chuyên môn đã chọn và được đánh giá trong phạm vi xác định. Hệ thống không mặc định biết đầy
đủ tình trạng cơ thể người dùng qua vài thông tin hay qua hội thoại.

Cụ thể, dự án đặt ra năm mục tiêu:

1. **Tạo chương trình phù hợp:** chương trình đáp ứng mọi điều kiện bắt buộc của người dùng (thiết
   bị, thời lượng, số buổi, bài cần tránh) và các nguyên tắc lập chương trình lấy từ tài liệu.
2. **Giúp người tập hiểu:** người dùng hỏi được vì sao một bài có trong chương trình, bài đó tác
   động cơ nào và làm thế nào, và nhận câu trả lời đúng, gắn với chương trình của họ, có nguồn.
3. **Giữ đúng yêu cầu qua nhiều lần thay đổi:** sau nhiều lượt chỉnh sửa, chương trình vẫn tôn
   trọng mọi điều kiện còn hiệu lực.
4. **An toàn:** mọi tình huống người dùng báo đau đều được xử lý theo quy tắc cố định, không chẩn
   đoán.
5. **Chi phí hợp lý:** số lần gọi mô hình và thời gian phản hồi ở mức chấp nhận được cho một ứng
   dụng thực tế.

## 4. Người dùng và giá trị mong đợi

Người dùng mục tiêu là người mới hoặc người đã tập nhưng chưa vững kiến thức xây chương trình, tự tập
và không có huấn luyện viên hỗ trợ thường xuyên. Phạm vi ban đầu là người trưởng thành tự tập gym.
Người có đau hoặc hạn chế vận động chỉ được hỗ trợ trong giới hạn họ đã nêu; việc xác định nguyên
nhân và phục hồi chấn thương không thuộc chức năng của sản phẩm.

Giá trị mong đợi là người dùng giảm được công sức tự tổng hợp kiến thức, hiểu rõ bài tập mình đang
làm, và có cơ sở để xem xét những thay đổi phù hợp thay vì đoán mò. Với mục tiêu tăng cơ, giảm mỡ
hay kết hợp cả hai, hệ thống hỗ trợ xây dựng và điều chỉnh chương trình tập theo mục tiêu đã chọn.
Với mục tiêu giảm mỡ, hệ thống chỉ hỗ trợ phần tập kháng lực để duy trì cơ và đọc xu hướng cân nặng
người dùng tự ghi, không đặt mức calo hay chế độ ăn. Kết quả thay đổi cơ thể còn phụ thuộc vào dinh
dưỡng, sinh hoạt và mức độ thực hiện của người dùng [S4], nên sản phẩm không cam kết kết quả.

Để dễ hình dung, có thể nghĩ đến ba người dùng điển hình:

- **Minh, 20 tuổi, sinh viên mới tập:** muốn tăng cơ, tập được ba buổi mỗi tuần, mỗi buổi 60 phút
  ở phòng gym trường. Minh cần một chương trình rõ ràng và muốn hiểu vì sao phải tập những bài đó.
- **Lan, 28 tuổi, nhân viên văn phòng:** đã tập một năm, muốn giảm mỡ nhưng giữ cơ. Lịch làm việc
  thay đổi liên tục, có tuần chỉ tập được hai buổi 40 phút. Lan cần chương trình co giãn theo lịch
  mà không phải tự sửa từ đầu.
- **Hùng, 35 tuổi, thường đi công tác:** tập ở nhiều nơi với thiết bị khác nhau, từng đau vai khi
  đẩy tạ qua đầu. Hùng cần đổi bài nhanh theo thiết bị hiện có và được nhắc tránh những động tác
  từng gây đau.

## 5. Giải pháp đề xuất

### 5.1 Ý tưởng chính

Sản phẩm là một ứng dụng web ghi nhật ký tập gym, có trợ lý AI nằm ngay bên trong. Vì trợ lý ở cùng
chỗ với nhật ký, nó luôn nhìn thấy dữ liệu tập thật của người dùng, và mọi đề xuất được áp dụng
thẳng vào chương trình mà người dùng không phải chép tay.

Thay vì để một mô hình AI làm tất cả trong một lần trả lời, trợ lý được chia thành nhiều agent, mỗi
agent chuyên một việc, giống như một nhóm nhỏ trong đó mỗi người có vai trò riêng: một người ghi chép
yêu cầu của khách, một người tra cứu tài liệu, một người thiết kế chương trình, một người đọc số
liệu, và một người kiểm tra lại mọi thứ trước khi giao cho khách. Nguyên tắc xuyên suốt là: **mô hình
AI lo phần ngôn ngữ và phán đoán, còn những gì tính toán hoặc kiểm tra được thì để code làm**, vì
code không quên và không bịa.

### 5.2 Các agent và vai trò

| Agent | Làm gì | Giải quyết hạn chế nào của chatbot thông thường |
|---|---|---|
| Điều phối (Router) | Đọc tin nhắn và xác định người dùng muốn gì: tạo chương trình, hỏi kiến thức, điều chỉnh hay xem lại kết quả tập | Trả lời lệch ý người dùng |
| Ghi nhớ điều kiện | Rút ra điều kiện mới từ tin nhắn (ví dụ "không có barbell", "tối đa 45 phút"), cập nhật danh sách điều kiện, hỏi lại khi thiếu hoặc mâu thuẫn | Quên điều đã nói qua nhiều lượt |
| Giải thích kiến thức | Tra cứu kho tài liệu đã biên tập và thư viện bài tập, trả lời kèm trích dẫn | Bịa kiến thức, không dẫn nguồn |
| Thiết kế chương trình | Tạo chương trình mới hoặc danh sách thay đổi dựa trên hồ sơ, điều kiện và lịch sử | |
| Đọc nhật ký | Diễn giải các chỉ số do code tính từ nhật ký (1RM ước tính, mức gắng sức, xu hướng) | Đọc sai số liệu, tăng tạ máy móc |
| Kiểm tra | Kiểm tra đề xuất có đúng cấu trúc, có vi phạm điều kiện nào không, trích dẫn có thật sự hỗ trợ nhận định không, có cần áp dụng quy tắc an toàn không | Đề xuất trông hợp lý nhưng sai yêu cầu |

Luồng xử lý một tin nhắn như sau:

```
Tin nhắn người dùng
      │
      ▼
 Điều phối ──► Ghi nhớ điều kiện ──► (thiếu hoặc mâu thuẫn → hỏi lại người dùng)
                     │
      ┌──────────────┼───────────────┐
      ▼              ▼               ▼
 Giải thích     Thiết kế         Đọc nhật ký
 kiến thức      chương trình
      │              │               │
      └──────────────┼───────────────┘
                     ▼
                  Kiểm tra ──► (lỗi → trả lại agent đã tạo ra, tối đa 2 lần)
                     │
                     ▼
     Đề xuất hoặc câu trả lời → người dùng chấp nhận → áp dụng và lưu phiên bản
```

### 5.3 Danh sách điều kiện

Đây là thành phần quan trọng nhất của giải pháp. Mỗi điều kiện người dùng đặt ra được lưu thành một
mục riêng, gồm loại điều kiện (thiết bị không có, thời lượng tối đa, số buổi, bài hoặc động tác cần
tránh, nhóm cơ ưu tiên, sở thích), mức độ (bắt buộc hay ưu tiên), nguồn (người dùng nói ở đâu, khi
nào) và trạng thái (còn hiệu lực, đã bị thay thế hay đã bị rút lại). Điều kiện do hệ thống tự suy ra
từ hội thoại chỉ ở trạng thái chờ, cho đến khi người dùng xác nhận.

Danh sách này hiển thị trong một bảng riêng để người dùng xem và sửa bất cứ lúc nào, không phải đọc
lại hội thoại. Mọi đề xuất đều được kiểm tra với danh sách này bằng code trước khi đến tay người
dùng. Điều kiện bắt buộc không bao giờ bị vi phạm; nếu không thể đáp ứng, hệ thống giải thích thay
vì đề xuất. Điều kiện ưu tiên có thể được đánh đổi, nhưng sự đánh đổi phải được nói rõ.

### 5.4 Kho kiến thức

Nhóm biên tập một kho kiến thức khoảng 150–300 đoạn từ các nguồn chuyên môn đáng tin cậy về tập kháng
lực, ví dụ các khuyến nghị chính thức của các hiệp hội y học thể thao và các phân tích tổng hợp về
khối lượng và tần suất tập cho hypertrophy [S12, S13]. Mỗi đoạn ghi rõ nguồn, mục, ngày và điều kiện
sử dụng. Bên cạnh đó là thư viện bài tập, mỗi bài có cơ chính, cơ phụ, thiết bị và hướng dẫn thực
hiện. Khi trả lời, agent giải thích chỉ được dùng nội dung từ kho này và phải trích dẫn; bước kiểm
tra sẽ xác nhận trích dẫn có thật sự hỗ trợ nhận định hay không.

### 5.5 Điểm khác biệt

So với chatbot AI thông thường, sản phẩm nhìn thấy nhật ký tập thật, nhớ điều kiện bằng một danh sách
có cấu trúc thay vì phụ thuộc vào trí nhớ của mô hình, dẫn nguồn cho mọi nhận định chuyên môn, áp dụng
đề xuất thẳng vào chương trình, và xử lý cơn đau theo quy tắc cố định. So với các ứng dụng ghi nhật ký
hay tạo bài tự động, sản phẩm cho người dùng hỏi lại, hiểu lý do và cùng điều chỉnh chương trình qua
hội thoại.

## 6. Phạm vi sản phẩm

### 6.1 Trong và ngoài phạm vi

| Trong phạm vi | Ngoài phạm vi ban đầu |
|---|---|
| Hồ sơ nhu cầu, điều kiện tập và bài hoặc động tác cần tránh | Chẩn đoán, điều trị hoặc tự xác định bài phục hồi từ triệu chứng |
| Tạo chương trình có cấu trúc theo chuỗi buổi và khả năng tập | Huấn luyện thành tích cho môn thể thao khác; lập kế hoạch thi đấu |
| Giải thích cách thực hiện, cơ tham gia chính và phụ, lý do chọn bài; dẫn nguồn | Phân tích tư thế bằng camera, đo mức kích hoạt cơ hoặc đánh giá hình thể qua ảnh |
| Ghi nhật ký tập và dùng lịch sử đã ghi để hỗ trợ điều chỉnh | Thiết bị đeo, cảm biến sinh học, theo dõi thời gian thực |
| Đổi bài, cập nhật thông số, hỏi lại khi thiếu dữ liệu và lưu phiên bản kế hoạch | Thực đơn, mức năng lượng cá nhân và chương trình cardio chi tiết |

### 6.2 Cách tổ chức buổi tập

Chương trình gồm một chuỗi buổi tập theo mục tiêu và điều kiện của người dùng. Mỗi buổi có danh sách
bài, nhóm cơ tác động, số hiệp, reps mục tiêu và thời gian nghỉ. Push–Pull–Legs là một kiểu chương
trình có thể dùng; cấu trúc cụ thể được chọn theo hồ sơ người dùng.

Người dùng cho biết số buổi dự kiến có thể tập và tự bố trí ngày thực hiện, không phải chọn cố định
thứ trong tuần. Sau mỗi buổi, người dùng ghi kết quả từng hiệp; hệ thống lưu ngày tập thực tế và tiến
độ hoàn thành. Chuỗi buổi được giữ nguyên khi người dùng nghỉ, tập muộn hoặc sang tuần mới.

Khi điều kiện thay đổi, người dùng có thể yêu cầu sửa chương trình qua chatbox, chẳng hạn rút ngắn
buổi tập hoặc giảm số buổi dự kiến. Hệ thống đề xuất thay đổi đối với những buổi chưa thực hiện, giải
thích lý do và chỉ áp dụng khi người dùng chấp nhận. Nhật ký các buổi đã tập được giữ lại.

### 6.3 Dữ liệu sử dụng

| Nhóm dữ liệu | Nội dung | Nguồn |
|---|---|---|
| Hồ sơ ban đầu | Mục tiêu ưu tiên, kinh nghiệm, khả năng tập, thời lượng, thiết bị, sở thích, bài hoặc động tác cần tránh và nguồn của giới hạn đó | Người dùng |
| Danh sách điều kiện | Các điều kiện còn hiệu lực, mức độ, nguồn, trạng thái | Hệ thống rút ra, người dùng xác nhận |
| Chương trình hiện tại | Mã phiên bản, thứ tự buổi, bài tập, số hiệp, khoảng reps, mức tạ nếu có căn cứ, thời gian nghỉ, nhóm cơ mục tiêu, thời lượng ước tính | Hệ thống đã tạo và lưu |
| Kết quả buổi tập | Thời điểm, mã buổi và bài, từng hiệp đã thực hiện, reps, mức tạ và đơn vị, trạng thái hoàn thành, lý do bỏ hoặc thay bài | Người dùng ghi |
| Phản hồi mới | Mức gắng sức, cảm nhận khó hay dễ, dấu hiệu đau, sở thích, thiết bị, thời lượng hoặc mục tiêu vừa thay đổi | Người dùng ghi hoặc nhắn sau khi tập |
| Kiến thức tham chiếu | Danh mục bài và biến thể, cơ tham gia chính và phụ, thiết bị, hướng dẫn, nguồn chuyên môn, ngày cập nhật và quy tắc sử dụng | Nhóm dự án biên tập |

Từ các dữ liệu này, hệ thống tạo ra một trong năm loại đầu ra: một chương trình gồm các buổi và bài
tập với đầy đủ thông số; một câu trả lời cho câu hỏi về bài tập kèm trích dẫn; một đề xuất điều chỉnh
nêu rõ lý do và phần sẽ thay đổi để người dùng xem trước khi chấp nhận; một câu hỏi làm rõ khi thiếu
thông tin quan trọng; hoặc một cảnh báo an toàn khi người dùng báo đau.

## 7. Trải nghiệm người dùng

Hành trình chính gồm năm bước: nhập mục tiêu và điều kiện tập, tạo chương trình, tập và ghi kết quả,
hỏi đáp hoặc yêu cầu điều chỉnh, rồi trao đổi và cập nhật.

Ở bước đầu, người dùng chọn mục tiêu và cung cấp kinh nghiệm, số buổi dự kiến, thời lượng, thiết bị
và sở thích; hệ thống hỏi bổ sung nếu thiếu thông tin cần thiết. Các câu trả lời trở thành những mục
đầu tiên trong danh sách điều kiện. Tiếp theo, hệ thống tạo chuỗi buổi tập và hiển thị trong bảng,
gồm tên bài, số hiệp, reps mục tiêu và thời gian nghỉ. Người dùng có thể xem cách thực hiện, nhóm cơ
chính và phụ, và bấm "Vì sao có bài này?" để hỏi lý do lựa chọn bài.

Khi đi tập, người dùng tự bố trí ngày, thực hiện buổi trong chương trình và ghi mức tạ, reps thực tế
từng hiệp cùng phản hồi ngắn; hệ thống lưu kết quả theo từng buổi, bài và hiệp để theo dõi tiến
trình. Khi thời gian, thiết bị, nhu cầu hay trải nghiệm tập thay đổi, người dùng hỏi hoặc yêu cầu
thay đổi qua chatbox, hoặc sửa trực tiếp danh sách điều kiện. Hệ thống dùng chương trình hiện tại,
nhật ký và tài liệu tham chiếu để trả lời hoặc đề xuất điều chỉnh, và hỏi thêm khi chưa đủ thông
tin. Cuối cùng, hệ thống hiển thị đề xuất thay đổi, lý do và các điều kiện đã được kiểm tra. Người
dùng có thể chấp nhận, yêu cầu sửa thêm hoặc giữ nguyên chương trình. Khi được chấp nhận, hệ thống
cập nhật những buổi chưa thực hiện, lưu thành phiên bản mới, giữ lại nhật ký cũ và hiển thị chương
trình để người dùng tiếp tục tập.

Ví dụ một cuộc trao đổi điển hình với Hùng: ở lượt đầu Hùng nói phòng gym khách sạn không có
barbell; trợ lý thêm điều kiện "không có barbell" ở trạng thái chờ và hỏi Hùng xác nhận. Hai lượt
sau Hùng muốn rút buổi tập xuống 45 phút; trợ lý đề xuất bỏ bớt một bài phụ ở mỗi buổi và giải thích
vì sao chọn bỏ bài đó. Thêm một lượt nữa Hùng nhờ đổi bài leg press; trợ lý đề xuất một bài thay thế
dùng tạ đơn, vừa thời gian, không dùng barbell, và không phải động tác đẩy qua đầu mà Hùng từng ghi
là gây đau vai. Trước khi đến tay Hùng, đề xuất đã được bước kiểm tra đối chiếu với cả ba điều kiện.

## 8. Tính năng chính

| Tính năng | Mô tả |
|---|---|
| Quản lý hồ sơ | Người dùng xem và cập nhật mục tiêu, điều kiện và sở thích tập luyện |
| Danh sách điều kiện | Xem, sửa, xác nhận hoặc xóa các điều kiện đang áp dụng; điều kiện do hệ thống suy ra chờ xác nhận mới có hiệu lực |
| Tạo chương trình | Xây dựng chương trình dựa trên hồ sơ và tài liệu đã chọn; đáp ứng thiết bị, thời lượng, số buổi dự kiến và nhóm cơ muốn ưu tiên |
| Hướng dẫn và hỏi đáp | Cung cấp cách thực hiện, nhóm cơ chính và phụ, giải thích lựa chọn bài; dùng đúng bài hoặc biến thể đang được hỏi; có nguồn cho nội dung chuyên môn |
| "Vì sao có bài này?" | Nút trên từng bài trong chương trình và trong lúc tập, giải thích bài đó trong ngữ cảnh chương trình và điều kiện của người dùng |
| Quản lý nhật ký | Lưu và cho phép sửa kết quả từng hiệp, phản hồi và RIR tùy chọn; phân biệt thông số dự kiến với kết quả thực tế; ghi rõ đơn vị mức tạ |
| Thư viện bài tập | Tra cứu bài theo nhóm cơ, thiết bị, loại bài; mỗi bài có cơ chính, cơ phụ và hướng dẫn |
| Điều chỉnh chương trình | Dùng yêu cầu mới, nhật ký và tài liệu để đề xuất thay bài hoặc sửa thông số; khi thay bài, xem lại các thông số liên quan thay vì sao chép nguyên mức tạ |
| Kiểm tra và lưu thay đổi | Kiểm tra chương trình sau điều chỉnh có đáp ứng các điều kiện hiện hành; lưu lịch sử phiên bản và lý do để người dùng xem lại và quay về phiên bản bất kỳ |

## 9. Quy tắc xử lý

Trợ lý tuân theo năm quy tắc, được áp dụng bằng code ở bước kiểm tra chứ không chỉ nhắc trong lời
dặn mô hình.

1. **Giữ đúng yêu cầu còn hiệu lực:** thông tin mới chỉ thay thế thông tin cũ trong phạm vi người
   dùng yêu cầu. Ví dụ, đổi "45 phút" thành "60 phút vào thứ Bảy" chỉ thay đổi các buổi thứ Bảy.
   Nếu phải sửa thêm phần liên quan, hệ thống giải thích lý do.
2. **Làm rõ thông tin thiếu hoặc mâu thuẫn:** hỏi bổ sung trước khi đưa ra quyết định phụ thuộc vào
   thông tin đó. Không tự ghi dữ liệu suy đoán thành dữ liệu đã được người dùng xác nhận.
3. **Điều chỉnh có căn cứ:** không mặc định tăng mức tạ hoặc reps sau mỗi buổi hay mỗi tuần; kết quả
   xem xét có thể là giữ nguyên chương trình. Dữ liệu bỏ trống không được coi là kết quả bằng 0. Các
   con số như 1RM ước tính hay xu hướng mức gắng sức do code tính, mô hình chỉ diễn giải.
4. **Giải thích đúng giới hạn thông tin:** thời lượng buổi tập là ước tính. Trợ lý không tự chẩn đoán
   đau hoặc chấn thương, và không khẳng định một bài thay thế phù hợp chỉ dựa vào nhóm cơ tác động.
5. **Xử lý khi người dùng báo đau theo quy tắc cố định:** với đau nhói, tê, sưng, đau kéo dài hoặc
   đau sau va chạm, hệ thống đề nghị dừng bài đó, không tự đề xuất bài thay thế cho cùng vùng và
   khuyên gặp chuyên gia [S5]. Với mỏi hoặc đau cơ thông thường sau buổi tập, hệ thống có thể đề xuất
   giảm tải và nói rõ đây không phải chẩn đoán. Khi chưa rõ, hệ thống hỏi lại trước.

## 10. Công nghệ và triển khai

Sản phẩm là một ứng dụng web gồm phần giao diện (ghi nhật ký, xem chương trình, chatbox, danh sách
điều kiện, thư viện bài tập) và phần máy chủ (lưu dữ liệu từng người dùng, chạy các agent, gọi mô
hình AI). Ứng dụng được đóng gói bằng Docker để chạy được trên máy cá nhân hoặc máy chủ.

Mô hình sử dụng là GPT-4o mini qua OpenAI API, vì chi phí thấp và hỗ trợ trả kết quả theo cấu trúc
JSON cố định, giúp các agent trao đổi dữ liệu với nhau ổn định. Các agent được viết bằng code thông
thường, gọi mô hình khi cần, không phụ thuộc vào framework agent bên ngoài, để dễ kiểm soát và dễ
tái hiện kết quả. Truy xuất kho kiến thức dùng thuật toán tìm kiếm theo từ khóa BM25 kết hợp tra
cứu theo các trường của bài tập; chỉ chuyển sang tìm kiếm theo ngữ nghĩa (embedding) nếu đo được BM25
không đủ tốt.

Mỗi tác vụ được giới hạn tối đa sáu lần gọi mô hình và hai vòng sửa lỗi, để chi phí và thời gian
phản hồi không vượt kiểm soát. Hai con số này sẽ được điều chỉnh sau thử nghiệm sơ bộ.

## 11. Yêu cầu chất lượng

Về khả năng sử dụng, trợ lý dùng ngôn ngữ rõ ràng và giải thích thuật ngữ (RIR, hypertrophy,
superset…) khi xuất hiện lần đầu; người dùng xem được chương trình, nhật ký và điều kiện mà không
phải đọc lại toàn bộ hội thoại. Về truy vết và riêng tư, hệ thống lưu nguồn kiến thức, phiên bản quy
tắc và lịch sử cập nhật; chỉ thu thập thông tin cần thiết; tách dữ liệu từng người và cho phép xem,
sửa hoặc xóa dữ liệu của mình. Trước khi dùng trợ lý, người dùng được thông báo rõ dữ liệu nào sẽ
được gửi cho nhà cung cấp mô hình.

Về độ tin cậy, dữ liệu đầu ra luôn đúng cấu trúc. Khi công cụ, dữ liệu hoặc mô hình không đáp ứng
được, hệ thống thông báo rõ, giữ nguyên chương trình, và không bao giờ báo đã lưu hay đã cập nhật nếu
thao tác thất bại. Về hiệu năng, nhóm đo thời gian phản hồi trung vị và p95, số lần gọi mô hình và
chi phí mỗi tác vụ; ngưỡng chấp nhận được chốt sau thử nghiệm sơ bộ, không đặt con số khi chưa có cơ
sở.

## 12. Đánh giá thành công

### 12.1 Cách đánh giá

Hệ thống được đánh giá trên ba nhóm tác vụ chính: tạo chương trình, trả lời câu hỏi và điều chỉnh
chương trình, cộng thêm các tình huống thiếu thông tin và tình huống báo đau. Để biết cách tổ chức
nhiều agent có thực sự đáng làm hay không, hệ thống được so sánh với cách dùng cùng mô hình bằng một
prompt trực tiếp trong một lần gọi, được cung cấp cùng hồ sơ, tài liệu và lịch sử. Ngoài ra, từng
thành phần (danh sách điều kiện, kho kiến thức, bước kiểm tra, agent đọc nhật ký) được lần lượt bỏ ra
khỏi hệ thống để xem mỗi thành phần đóng góp bao nhiêu.

| Nội dung đánh giá | Cách kiểm tra | Độ đo |
|---|---|---|
| Tạo chương trình | Chương trình đầy đủ thông tin, đáp ứng điều kiện người dùng và các nguyên tắc lập chương trình từ tài liệu; kiểm tra tự động bằng code | Số tình huống đạt toàn bộ tiêu chí bắt buộc / tổng tình huống khả thi |
| Trả lời đúng kiến thức | Đối chiếu các nhận định quan trọng với đáp án hoặc tài liệu đã rà soát | Số nhận định đúng / tổng nhận định được đánh giá |
| Sử dụng nguồn đúng | Kiểm tra nguồn được dẫn có thực sự hỗ trợ nhận định tương ứng | Số nhận định được nguồn hỗ trợ / tổng nhận định cần dẫn nguồn |
| Điều chỉnh đúng yêu cầu | Chương trình mới đáp ứng yêu cầu thay đổi, giữ các điều kiện còn hiệu lực, giải thích được phần sửa thêm; kiểm tra tự động bằng code | Số tình huống đạt / tổng tình huống điều chỉnh khả thi |
| An toàn | Tình huống báo đau được xử lý đúng quy tắc 5 | Số tình huống đúng / tổng tình huống (yêu cầu 100%) |
| Chi phí | Hệ thống tự ghi lại khi chạy | Số lần gọi mô hình, token, thời gian phản hồi trung vị và p95 |

Đầu ra lỗi hoặc không hoàn thành tác vụ trong một tình huống khả thi được tính là chưa đạt. Ngoài tỷ
lệ tổng, nhóm ghi nhận từng loại lỗi để biết phần nào cần cải thiện. Phần kiến thức và trích dẫn được
chấm bằng một mô hình AI khác, mạnh hơn mô hình đang được đánh giá, vì mô hình chấm có xu hướng thiên
vị câu trả lời của chính nó [S15]; sau đó thành viên nhóm chấm lại khoảng 20% để kiểm tra độ tin cậy
của việc chấm tự động.

### 12.2 Bộ tình huống thử nghiệm

Bộ thử nghiệm gồm hồ sơ người dùng, câu hỏi kiến thức và các yêu cầu điều chỉnh. Mỗi tình huống xác
định trước thông tin đầu vào, điều kiện cần đáp ứng và tài liệu đối chiếu. Nhóm chuẩn bị khoảng 40
tình huống để phát triển và 100 tình huống riêng để đánh giá chính thức; bộ đánh giá do một thành
viên khác soạn và được giữ kín trong lúc phát triển.

| Nhóm tình huống | Ví dụ | Nội dung cần kiểm tra |
|---|---|---|
| Tạo chương trình | Người mới, thời gian hạn chế, chỉ có một số thiết bị | Chương trình phù hợp với hồ sơ và đầy đủ thông tin |
| Hỏi đáp | Hỏi nhóm cơ chính và phụ, cách thực hiện hoặc lý do chọn bài | Trả lời đúng bài, đúng kiến thức và có nguồn hỗ trợ |
| Điều chỉnh | Đổi bài do thiếu thiết bị, giảm thời lượng hoặc đổi nhóm cơ ưu tiên | Sửa đúng yêu cầu và giữ những điều kiện còn hiệu lực |
| Dùng nhật ký | Cùng mức tạ và reps nhưng mức gắng sức hoặc phản hồi khác nhau | Đọc đúng dữ liệu và đưa ra đề xuất có căn cứ |
| Thiếu thông tin hoặc mâu thuẫn | Chưa nêu thiết bị, hoặc yêu cầu không thể đồng thời đáp ứng | Hỏi bổ sung hoặc giải thích đúng xung đột |
| Thay đổi qua nhiều lượt | Lần lượt đổi thời lượng, thiết bị và bài tập qua 3–5 lượt | Theo dõi đúng chương trình hiện tại và các điều kiện còn hiệu lực |
| Báo đau | Đau nhói khi đẩy tạ qua đầu; mỏi cơ ngày hôm sau | Áp dụng đúng quy tắc an toàn |

Không yêu cầu mọi hệ thống tạo ra cùng một chương trình duy nhất; các phương án khác nhau đều được chấp
nhận nếu đáp ứng tiêu chí đã xác định. Nhóm tình huống thiếu thông tin hoặc mâu thuẫn được chấm và báo
cáo riêng.

### 12.3 Quy trình

Quy trình gồm bốn bước. Đầu tiên, nhóm chuẩn bị bộ tình huống, xác định điều kiện bắt buộc, nguồn đối
chiếu và những phản hồi được chấp nhận. Tiếp theo là thử nghiệm sơ bộ trên bộ phát triển để phát hiện
lỗi, hoàn thiện cách chấm và chốt ngưỡng đạt. Sau đó, đánh giá chính thức trên bộ riêng, giữ nguyên
cấu hình của từng phương án suốt đợt và chạy lặp ba lần để xem kết quả có ổn định không. Cuối cùng,
nhóm tổng hợp độ đo, so sánh, phân loại lỗi và trình bày ví dụ đạt và chưa đạt.

Nếu còn thời gian, nhóm thử nghiệm thêm với 6–10 người tập thật: mỗi người dùng ứng dụng khoảng 20–30
phút rồi trả lời năm câu hỏi về chính chương trình của mình, để xem tính năng giải thích có giúp người
dùng hiểu chương trình hơn không.

Kết quả thử nghiệm cho biết hệ thống đáp ứng các tiêu chí đã xác định đến đâu. Hiệu quả tăng cơ hoặc
giảm mỡ thực tế nằm ngoài phạm vi dự án; việc đó cần một nghiên cứu theo dõi người tập dài hạn riêng.

## 13. Kế hoạch thực hiện

### 13.1 Phân công

Nhóm gồm ba thành viên với ba mảng việc. Thành viên thứ nhất phụ trách phần máy chủ và các agent:
điều phối, ghi nhớ điều kiện, đọc nhật ký, bước kiểm tra và quy tắc an toàn. Thành viên thứ hai phụ
trách kho kiến thức, agent giải thích và phần giao diện, gồm danh sách điều kiện và nút "Vì sao có
bài này?". Thành viên thứ ba phụ trách bộ thử nghiệm, công cụ chạy đánh giá tự động, chấm điểm và phân
tích kết quả; vai trò này bắt đầu ngay từ tuần đầu để có mốc so sánh trước khi xây hệ thống.

### 13.2 Tiến độ (dự kiến 10 tuần)

| Tuần | Công việc | Kết quả cần có |
|---|---|---|
| 1–2 | Chốt thiết kế và định dạng dữ liệu; dựng ứng dụng nền (nhật ký, thư viện bài tập); công cụ chạy đánh giá; 40 tình huống phát triển; chạy phương án một lần gọi để có mốc so sánh; bắt đầu thu thập tài liệu | Thiết kế được duyệt, có điểm của phương án so sánh |
| 3–5 | Danh sách điều kiện, agent ghi nhớ, điều phối, bước kiểm tra (TV1); kho kiến thức, truy xuất, agent giải thích (TV2); 100 tình huống đánh giá, cách chấm (TV3) | Từng agent chạy riêng được |
| 6–7 | Agent đọc nhật ký, quy tắc an toàn, ghép toàn bộ luồng (TV1); giao diện danh sách điều kiện và nút giải thích (TV2); chạy thử và sửa lỗi (TV3) | Demo hoàn chỉnh, khóa cấu hình cuối tuần 7 |
| 8 | Đánh giá chính thức, chạy các phương án bỏ từng thành phần | Bảng kết quả |
| 9 | Phân tích lỗi; thử nghiệm với người dùng thật (nếu kịp) | Báo cáo phân tích |
| 10 | Hoàn thiện ứng dụng, viết báo cáo, slide, video demo | Sản phẩm cuối |

Nếu đến tuần 5 bị chậm tiến độ, nhóm cắt bớt theo thứ tự: thử nghiệm với người dùng thật, agent đọc
nhật ký, nút "Vì sao có bài này?". Danh sách điều kiện, bước kiểm tra và công cụ đánh giá luôn được
giữ, vì đó là phần cốt lõi của dự án.

## 14. Tài nguyên và chi phí

Tài nguyên chính là API của mô hình AI. Ước tính thô cho toàn bộ đợt đánh giá: 100 tình huống, nhân
khoảng 6 phương án (hệ thống đầy đủ, phương án một lần gọi và 4 phương án bỏ bớt thành phần), mỗi
phương án chạy 3 lần, mỗi lần chạy khoảng 6 lần gọi mô hình với khoảng 10.000 token mỗi lần, tổng cộng
khoảng 100 triệu token. Với giá GPT-4o mini mà nhóm biết (cần kiểm tra lại bảng giá hiện hành), chi
phí ở mức vài chục đô la Mỹ; mô hình chấm điểm mạnh hơn sẽ tốn thêm và cần được tính riêng. Ngoài ra
nhóm cần máy tính cá nhân để phát triển và chạy Docker; không cần máy chủ GPU.

## 15. Rủi ro và cách xử lý

Rủi ro lớn nhất về tiến độ là việc biên tập kho kiến thức tốn nhiều thời gian hơn dự kiến, vì mỗi đoạn
phải được đọc, tóm tắt đúng và ghi rõ nguồn. Nhóm sẽ bắt đầu thu thập tài liệu từ tuần đầu và giới hạn
khoảng 150 đoạn cho phiên bản đầu tiên. Rủi ro thứ hai là hệ thống nhiều agent có thể không tốt hơn
phương án một lần gọi bao nhiêu, trong khi tốn nhiều chi phí hơn; khi đó nhóm vẫn báo cáo đầy đủ, kèm
phân tích từng thành phần để chỉ ra phần nào đáng giữ và phần nào không.

Về chất lượng đánh giá, mô hình chấm điểm có thể thiên vị, nên nhóm dùng một mô hình khác với mô hình
được đánh giá và chấm lại bằng người khoảng 20% kết quả. Bộ tình huống đánh giá chính thức do một thành
viên khác soạn và giữ kín để tránh vô tình "học thuộc đề". Về mặt kỹ thuật, mô hình đôi khi trả kết quả
sai cấu trúc hoặc từ chối trả lời; hệ thống dùng định dạng JSON cố định và một vòng sửa lỗi, và trường
hợp vẫn thất bại được tính là chưa đạt chứ không bị bỏ qua. Cuối cùng, để tránh sa đà vào làm đẹp giao
diện, phần giao diện mới chỉ gồm danh sách điều kiện và nút giải thích cho đến khi đánh giá xong.

## 16. An toàn, riêng tư và giới hạn

Sản phẩm không phải công cụ y tế. Trợ lý không chẩn đoán, không gọi tên chấn thương, không kê bài phục
hồi, và luôn khuyên gặp chuyên gia khi có dấu hiệu đau nguy hiểm. Mọi thay đổi chương trình đều cần
người dùng đồng ý và có thể hoàn tác. Dữ liệu tập của từng người được tách riêng; người dùng biết trước
dữ liệu nào được gửi cho nhà cung cấp mô hình, và có thể xem, sửa, xóa dữ liệu của mình. Với thử
nghiệm người dùng thật (nếu có), người tham gia được giải thích mục đích, đồng ý tham gia, và dữ liệu
được ẩn danh.

Dự án cũng có những giới hạn cần nói rõ. Kho kiến thức nhỏ và do nhóm tự biên tập, nên không bao quát
mọi câu hỏi. Kết quả đánh giá dựa trên bộ tình huống do nhóm xây dựng, không phải trên người dùng thật
quy mô lớn. Và như đã nói, dự án không đo được hiệu quả tăng cơ hay giảm mỡ thực tế.

## 17. Kết quả bàn giao

Cuối dự án, nhóm bàn giao một ứng dụng web chạy được bằng Docker, gồm ghi nhật ký, thư viện bài tập,
chương trình tập và trợ lý AI nhiều agent; kho kiến thức đã biên tập kèm nguồn; bộ tình huống thử
nghiệm và công cụ chạy đánh giá có thể chạy lại; báo cáo kết quả so sánh, phân tích từng thành phần và
phân loại lỗi; cùng slide và video demo.

## 18. Hướng phát triển

Sau dự án, sản phẩm có thể mở rộng sang giao diện và câu trả lời tiếng Việt kèm bảng thuật ngữ, ứng
dụng di động, mở rộng kho kiến thức sang dinh dưỡng cơ bản và cardio, kết nối thiết bị đeo để có thêm
dữ liệu nhịp tim và giấc ngủ, và thử nghiệm dài hạn với người tập thật để đo hiệu quả thực tế.

## 19. Tài liệu tham khảo

- [S1] Shin, Hsieh và Kim. *PlanFitting*. CUI 2025. arXiv 2309.12555v2. Tham chiếu bài toán lập kế
  hoạch tập qua hội thoại, lưu trạng thái chương trình qua nhiều lượt.
- [S2] Fitbod Help Center. *How Fitbod Creates Your Workout*. Mô tả của nhà cung cấp, chưa phải kết
  quả kiểm thử độc lập.
- [S3] Fitbod Help Center. *Reps in Reserve*. Không dùng làm nguồn duy nhất để quy định tải tập.
- [S4] Longland và cộng sự. Thử nghiệm về khối nạc và khối mỡ. *AJCN* 2016. Không suy rộng thành cam
  kết tăng cơ hay giảm mỡ cho mọi người.
- [S5] AAOS OrthoInfo. *Rotator Cuff and Shoulder Conditioning Program*. Căn cứ về việc cần đánh giá
  phù hợp khi đau vai; không dùng để tự chẩn đoán hay kê chương trình phục hồi.
- [S6] Li et al. *GPT-4 as a virtual fitness coach: a case study assessing its effectiveness in
  providing weight loss and fitness guidance*. *BMC Public Health*, 2025. Một người tham gia, bằng
  chứng còn hạn chế.
  https://pmc.ncbi.nlm.nih.gov/articles/PMC12261634
- [S7] Jörke et al. *GPTCoach: Towards LLM-Based Physical Activity Coaching*. ACM CHI 2025.
  https://arxiv.org/abs/2405.06061
- [S8] Jia et al. *One Battle After Another: Probing LLMs' Limits on Multi-Turn Instruction
  Following with a Benchmark Evolving Framework* (EvolIF). arXiv 2511.03508.
- [S9] Canaverde et al. *SEQUOR: A Multi-Turn Benchmark for Realistic Constraint Following*.
  arXiv 2605.06353, 2026.
- [S10] Xie et al. *TravelPlanner: A Benchmark for Real-World Planning with Language Agents*. ICML
  2024. arXiv 2402.01622.
- [S11] Gundawar et al. *Robust Planning with LLM-Modulo Framework: Case Study in Travel Planning*.
  arXiv 2405.20625.
- [S12] American College of Sports Medicine. Position stand: *Progression Models in Resistance
  Training for Healthy Adults*. *Medicine & Science in Sports & Exercise*, 2009.
  doi:10.1249/MSS.0b013e3181915670
- [S13] Schoenfeld, Ogborn và Krieger. *Dose-response relationship between weekly resistance
  training volume and increases in muscle mass: A systematic review and meta-analysis*. *Journal of
  Sports Sciences*, 2017. doi:10.1080/02640414.2016.1210197
- [S14] Gao et al. *Enabling Large Language Models to Generate Text with Citations* (ALCE). EMNLP
  2023. arXiv 2305.14627. Tham khảo cách đánh giá trích dẫn.
- [S15] Zheng et al. *Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena*. NeurIPS 2023. arXiv
  2306.05685. Tham khảo các thiên vị khi dùng mô hình làm người chấm.
- [S16] Gjestvang, Abrahamsen, Stensrud và Haakstad. *What Makes Individuals Stick to Their
  Exercise Regime? A One-Year Follow-Up Study Among Novice Exercisers in a Fitness Club Setting*.
  *Frontiers in Psychology*, 2021 (con số 10–37% được trích từ Middelkamp et al. 2016 và Sperandei et
  al. 2016).
  https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8194699/
- [S17] Kidman, Curtis, Watson và Maher. *When and Why Adults Abandon Lifestyle Behavior and Mental
  Health Mobile Apps: Scoping Review*. *Journal of Medical Internet Research*, 2024. https://jmir.org/2024/1/e56897/PDF
- [S18] Unger, Mosgan, Wolte, Pettauer và Wilke. *Knowledge of gym goers on myths and truths in
  resistance training*. *Scientific Reports*, 2025. https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11772780/
- [S19] Pryde, Kemps và Prichard. *"You started working out to get a flat stomach and a fat a\*\*":
  A content analysis of fitspiration videos on TikTok*. *Body Image*, 2024.
  https://news.flinders.edu.au/blog/2024/09/16/beware-of-toxic-tiktok-fitspo-videos/
- [S20] Collins et al. *Determinants of Dropout from and Variation in Adherence to an Exercise
  Intervention: The STRRIDE Randomized Trials*. *Translational Journal of the American College of
  Sports Medicine*, 2022. https://pmc.ncbi.nlm.nih.gov/articles/PMC9165469/
- [S21] Serafim, de Oliveira, Maffulli, Migliorini và Okubo. *Which resistance training is safest to
  practice? A systematic review*. *Journal of Orthopaedic Surgery and Research*, 2023 (17/28 nghiên
  cứu được tổng hợp là về CrossFit/HIFT). https://doi.org/10.1186/s13018-023-03781-x
- [S22] Rock Health. *2025 Consumer Adoption of Digital Health Survey* (8.000 người trưởng thành
  Mỹ, tháng 12/2025).
  https://fiercehealthcare.com/ai-and-machine-learning/ai-chatbot-use-health-information-16-2024-rock-health-survey
- [S23] Zaleski, Berkowsky, Craig và Pescatello. *Comprehensiveness, Accuracy, and Readability of
  Exercise Recommendations Provided by an AI-Based Chatbot: Mixed Methods Study*. *JMIR Medical
  Education*, 2024. https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10811574/
- [S24] Bhattacharyya et al. *High Rates of Fabricated and Inaccurate References in
  ChatGPT-Generated Medical Content*. *Cureus*, 2023.
  https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10277170/
- [S25] Gravel et al. *Learning to fake it: limited responses and fabricated references provided by
  ChatGPT for medical questions*. *Mayo Clinic Proceedings: Digital Health*, 2023.
  doi:10.1016/j.mcpdig.2023.05.004
- [S26] Sperandei, Vieira và Reis. *Adherence to physical activity in an unsupervised setting:
  Explanatory variables for high attrition rates among fitness center members*. *Journal of Science
  and Medicine in Sport*, 2016.
- [S27] Rodrigues, Macedo, Teixeira, Cid và Monteiro. *Análise comportamental da prática de exercício
  físico em adultos em contexto de ginásio ao longo de dois anos*. *Cuadernos de Psicología del
  Deporte*, 21(1), 2021. https://revistas.um.es/cpd/article/view/433261
- [S28] Tung, Lantz, Lopes và Berglund. *Injuries in weightlifting and powerlifting: an updated
  systematic review*. *BMJ Open Sport & Exercise Medicine*, 2024. doi:10.1136/bmjsem-2023-001884
