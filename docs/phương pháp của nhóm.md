Phương pháp của nhóm

1\. Ý tưởng chung

Từ những nhận xét ở phần trước, nhóm không để LLM tự xử lý toàn bộ dữ liệu, cũng không chỉ dựa vào thống kê. Thay vào đó, công việc được chia cho ba thành phần, mỗi thành phần làm phần việc phù hợp với nó:

Công cụ (viết bằng code): tính toán trên toàn bộ dữ liệu giám sát, trả về một bản tóm tắt ngắn (vài chục dòng).  
LLM: đọc các bản tóm tắt này và suy luận dựa trên hiểu biết về hệ thống, ví dụ "1/4 số request bị lỗi, vậy có thể 1 trong 4 máy cùng tầng gặp sự cố".  
Workflow (viết bằng code): quy định thứ tự các bước điều tra, và kiểm tra kết luận của LLM trước khi chuyển sang bước tiếp theo.  
Cách chia này giúp tránh hai điểm yếu đã nêu ở phần trước: LLM không phải tự tính toán trên con số, và không tự quyết định nên xem dữ liệu nào.

2\. Workflow điều tra

Workflow gồm 5 bước, dựa trên trình tự mà kỹ sư vận hành thường làm: xem triệu chứng trước, lần theo đường đi của request để khoanh vùng, sau đó mới xem tài nguyên và log của thành phần nghi ngờ.

Đọc câu hỏi → Xác định triệu chứng → Khoanh vùng → Xác định loại lỗi → Kiểm chứng → Kết luận

Nếu bước kiểm chứng bác bỏ giả thuyết, workflow quay lại bước khoanh vùng, tối đa 2 lần.

Bảng 3\. Các bước của workflow

Bước	Câu hỏi cần trả lời	Dữ liệu / công cụ	Kết quả  
1\. Đọc câu hỏi	Khung giờ nào, có mấy lỗi, cần trả lời những gì?	Câu hỏi	Khung giờ, số lỗi, các trường cần trả lời  
2\. Xác định triệu chứng	Sự cố bắt đầu và kết thúc lúc nào, ảnh hưởng ra sao?	Metric nghiệp vụ (số request, tỉ lệ thành công, thời gian phản hồi), số dòng log	Khoảng thời gian xảy ra sự cố  
3\. Khoanh vùng	Thành phần nào là điểm chung của các đoạn bị nghẽn?	Đồ thị phụ thuộc dịch vụ (công cụ 2\)	Thành phần nghi ngờ  
4\. Xác định loại lỗi	Thành phần đó quá tải hay không nhận được request? Lỗi thuộc loại nào?	Phát hiện bất thường trên metric (công cụ 1), log	Lý do lỗi và bằng chứng  
5\. Kiểm chứng	Dấu hiệu này có phải hiện tượng thường ngày không? Lỗi bắt đầu chính xác lúc nào?	So sánh với các khoảng thời gian bình thường; dữ liệu chi tiết theo 10 giây	Kết luận cuối cùng hoặc quay lại bước 3  
Ở mỗi bước, LLM chỉ được dùng các công cụ của bước đó, và chỉ nhận dữ liệu đã được tổng hợp.

3\. Hai công cụ chính

3.1. Công cụ 1: phát hiện bất thường

Công cụ này xác định thành phần nào đang có dấu hiệu khác thường, khác theo chiều nào, và từ lúc nào. Cách làm dựa trên thống kê:

Lấy khoảng 1 giờ trước sự cố làm mức bình thường của từng chỉ số.  
Đo độ lệch của từng điểm so với mức bình thường. Dùng trung vị và khoảng tứ phân vị (IQR) thay cho trung bình và độ lệch chuẩn, để ít bị ảnh hưởng bởi các giá trị đột biến.  
Ghi lại chiều tăng hay giảm. Ví dụ, lỗi mạng thường làm lưu lượng giảm chứ không làm CPU tăng.  
Gộp kết quả theo từng thành phần: một thành phần có nhiều chỉ số cùng bất thường một lúc thì đáng nghi hơn một chỉ số nhảy đơn lẻ.  
Áp dụng thêm cho số dòng log theo từng phút, vì có những thành phần không xuất hiện trong trace.  
Thử nghiệm ban đầu với z-score cho thấy công cụ này tìm ứng viên khá tốt: đáp án đúng nằm trong 3 ứng viên đầu ở khoảng 64% số lỗi. Tuy nhiên, ứng viên xếp đầu chỉ đúng khoảng 41%, và công cụ này yếu với lỗi mạng. Vì vậy cần thêm công cụ thứ hai để chọn đúng.

3.2. Công cụ 2: đồ thị phụ thuộc dịch vụ và truy ngược nguyên nhân

Công cụ này phân biệt thành phần là nguyên nhân gốc với các thành phần chỉ bị ảnh hưởng theo.

Dựng đồ thị: từ dữ liệu trace, xác định thành phần nào gọi thành phần nào, ví dụ cổng vào → các máy ứng dụng → tầng phía sau.  
Đo trên từng cạnh: theo từng phút, đo số lời gọi và độ chênh lệch giữa thời gian chờ ở bên gọi với thời gian xử lý ở bên nhận. Độ chênh lệch tăng cho thấy chậm trên đường mạng giữa hai thành phần.  
Truy ngược: bắt đầu từ chỗ có triệu chứng, đi theo các cạnh bất thường, dừng ở thành phần bất thường nằm xa nhất trong chuỗi gọi. Thêm vào đó, so sánh các thành phần cùng tầng: nếu chỉ một trong bốn máy ứng dụng bất thường thì lỗi nằm ở máy đó, còn nếu cả bốn đều bất thường thì nghi ngờ tầng phía sau.  
Ví dụ trong một ca lỗi mạng: lời gọi từ cổng vào tới một máy ứng dụng chậm thêm khoảng 10 giây, trong khi lời gọi tới ba máy còn lại vẫn bình thường. Nhờ đó xác định được máy bị lỗi, dù CPU của máy này không hề tăng.

Hạn chế: một số thành phần (web server, cơ sở dữ liệu, cache) không xuất hiện trong trace, nên cần bổ sung thông tin từ log hoặc từ cấu trúc hệ thống đã biết.

4\. Kiểm tra kết luận bằng code

Trước khi chuyển bước hoặc đưa ra đáp án cuối, workflow kiểm tra một số điều kiện:

Thời điểm lỗi phải nằm trong khoảng thời gian của câu hỏi.  
Số lỗi tìm được phải khớp với số lỗi mà câu hỏi nêu.  
Thành phần được chọn phải có bằng chứng riêng của nó, không phải dấu hiệu mà mọi thành phần cùng có.  
Lý do lỗi phải có chỉ số tương ứng trên thành phần đó.  
Mỗi kết luận phải trích được từ kết quả của công cụ.  
Tín hiệu dùng làm bằng chứng không phải hiện tượng thường xuyên xảy ra ở các thời điểm bình thường.  
Nếu không đạt, kết luận được trả lại cho LLM kèm lý do để làm lại.

5\. Cách đánh giá

Dữ liệu: 40 câu hỏi (44 lỗi) của hệ thống Bank trong OpenRCA. Thêm 2 ngày khác