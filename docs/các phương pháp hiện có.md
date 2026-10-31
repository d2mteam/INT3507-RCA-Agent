\*\*Các phương pháp hiện có\*\*

\*\*1. Quy trình xử lý sự cố\*\*

Trong thực tế, việc xử lý sự cố thường đi theo các bước: phát hiện sự cố (thường qua cảnh báo), khoanh vùng phần hệ thống bị ảnh hưởng, tìm nguyên nhân gốc, xử lý, và rút kinh nghiệm sau sự cố. Các cách làm hiện nay khác nhau chủ yếu ở bước tìm nguyên nhân gốc. Phần dưới đây trình bày hai cách tiếp cận chính: kỹ sư tự điều tra, và sử dụng mô hình ngôn ngữ lớn.

\*\*2. Kỹ sư tự điều tra\*\*

Hệ thống giám sát (ví dụ Prometheus và Grafana cho metric, ELK hoặc Loki cho log) gửi cảnh báo khi một chỉ số vượt ngưỡng. Kỹ sư sau đó xem dashboard, đọc log và trace để lần ra nguyên nhân, thường theo một trình tự quen thuộc: xem triệu chứng của service, lần theo đường đi của request, rồi kiểm tra tài nguyên và log của thành phần nghi ngờ.

\*Ưu điểm:\*  
\- Có hiểu biết về hệ thống, nên phân biệt được nguyên nhân gốc với hệ quả lan ra.  
\- Điều tra theo trình tự hợp lý, biết kiểm tra lại giả thuyết trước khi kết luận.  
\- Kết luận có bằng chứng cụ thể, dễ giải thích cho người khác.

\*Nhược điểm:\*  
\- Tốn thời gian, nhất là khi nhiều cảnh báo xuất hiện cùng lúc.  
\- Phụ thuộc nhiều vào kinh nghiệm của người trực.  
\- Không thể tự xem hết lượng dữ liệu rất lớn, nên dễ bỏ sót dấu hiệu.

\*\*3. Sử dụng mô hình ngôn ngữ lớn (LLM)\*\*

Gần đây, nhiều nơi bắt đầu thử dùng LLM để hỗ trợ tìm nguyên nhân gốc. Một số công ty lớn (ví dụ Meta, Microsoft) đã công bố hệ thống nội bộ theo hướng này. Các nghiên cứu như OpenRCA thì thử để agent LLM tự viết code truy vấn dữ liệu.

\*Ưu điểm:\*  
\- Có khả năng suy luận và giải thích kết quả bằng ngôn ngữ tự nhiên, gần giống con người.  
\- Có sẵn kiến thức chung về hệ thống phần mềm và các loại lỗi phổ biến.  
\- Làm việc nhanh, không phụ thuộc vào người trực.

\*Nhược điểm:\*  
\- \*\*Không đưa hết dữ liệu vào được:\*\* dữ liệu giám sát lớn hơn rất nhiều lần sức chứa của mô hình.  
\- \*\*Xử lý dữ liệu số và tính toán kém:\*\* dữ liệu giám sát chủ yếu là con số và mã định danh. LLM khó tự so sánh, thống kê hay phát hiện bất thường chính xác trên loại dữ liệu này.  
\- \*\*Dễ bị nhiễu dẫn hướng:\*\* LLM dễ bị thu hút bởi những bất thường rõ ràng nhưng không liên quan, như nhiễu đã có từ trước hay lỗi CPU, RAM, đĩa, thay vì nguyên nhân gốc thực sự.  
\- \*\*Phụ thuộc nặng vào chất lượng mô hình:\*\* kết quả thay đổi nhiều giữa các mô hình. Khi code do agent viết chạy lỗi, kết quả của mô hình yếu hơn giảm mạnh hơn hẳn.  
\- \*\*Khó kiểm chứng:\*\* khi để agent tự quyết định xem dữ liệu nào, kết luận có thể không có bằng chứng rõ ràng.

\*\*4. Nhận xét\*\*

Hai cách tiếp cận có điểm mạnh bổ sung cho nhau. Kỹ sư có trình tự điều tra hợp lý và biết kiểm chứng, nhưng chậm và không xem hết được dữ liệu. LLM nhanh và suy luận được, nhưng xử lý con số kém, dễ bị nhiễu và phụ thuộc vào mô hình.

Vì vậy, đề tài hướng tới việc kết hợp:  
\- Dùng công cụ để tính toán và tổng hợp dữ liệu, thay cho phần LLM làm kém.  
\- Giữ trình tự điều tra giống cách kỹ sư làm.  
\- Để LLM suy luận trên dữ liệu đã được tổng hợp.  
\- Có bước kiểm tra lại kết luận.

Mục tiêu là giảm ảnh hưởng của nhiễu và bớt phụ thuộc vào việc mô hình mạnh hay yếu.