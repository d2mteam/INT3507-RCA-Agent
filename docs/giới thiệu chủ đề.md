# Xác định nguyên nhân gốc sự cố trong hệ thống nhiều service từ dữ liệu giám sát

## Giới thiệu đề tài và các khó khăn hiện tại

# 1\. Giới thiệu đề tài

## 1.1. Bối cảnh và vấn đề

Các hệ thống phần mềm hiện nay thường gồm nhiều service gọi lẫn nhau. Khi xảy ra sự cố, người vận hành phải tìm ra nguyên nhân gốc từ dữ liệu giám sát (metric, trace, log) rồi mới sửa được. Cụ thể, họ cần biết ba điều: thành phần nào gây lỗi, lỗi bắt đầu lúc nào, và vì sao lỗi xảy ra.

Cái khó là lúc sự cố xảy ra, nhiều thành phần cùng có dấu hiệu bất thường. Một số là hệ quả lan ra từ nguyên nhân gốc, một số khác là nhiễu đã có từ trước đó. Bài toán là xác định đúng nguyên nhân gốc giữa các hệ quả và nhiễu này, kèm theo bằng chứng để người vận hành tin tưởng mà quyết định sửa.

## 1.2. Dữ liệu sử dụng

Đề tài sử dụng bộ dữ liệu OpenRCA (ICLR 2025), với các đặc điểm chính:

* **Quy mô:** 335 ca lỗi, thuộc 3 hệ thống là Telecom, Bank và Market.  
* **Dung lượng:** 68,5 GB dữ liệu giám sát gồm metric, trace và log.  
* **Cấu trúc mỗi ca:** một câu hỏi về một khoảng thời gian 30 phút và một đáp án đúng.

# 2\. Khó khăn hiện tại

## 2.1. Dữ liệu quá lớn để đưa hết cho LLM

Lượng dữ liệu giám sát vượt xa sức chứa của các mô hình ngôn ngữ lớn. Lấy ví dụ ca Bank ngày 4/3/2021, khoảng 14:30–15:00: riêng phần trace đã có 589.067 span, tương đương khoảng 26,7 triệu token. Con số này gấp khoảng 200 lần cửa sổ ngữ cảnh 128 nghìn token của các mô hình được dùng trong bài báo OpenRCA. Vì vậy, không thể đưa toàn bộ dữ liệu vào mô hình để nó tự tìm nguyên nhân.

## 2.2. Lọc theo quy tắc cố định không đủ

Các cách tiếp cận hiện có vẫn cho kết quả thấp, như được tổng hợp ở bảng dưới đây.

**Bảng 1\. Kết quả tốt nhất của các cách tiếp cận hiện có trên OpenRCA**

| Cách làm | Kết quả tốt nhất |
| :---- | :---- |
| Lọc mạnh: mỗi phút giữ 1 giá trị, chỉ giữ 53/1.263 loại metric, còn khoảng 100 nghìn token | 3,88% (Claude 3.5) |
| Lọc "hoàn hảo": cho sẵn đúng các metric liên quan, điều không thể làm được ngoài thực tế | 5,37% (Claude 3.5); 7,16% (Gemini 1.5 Pro) |
| Agent tự viết code để truy vấn (RCA-agent) | 11,34% |
| Ca phải tìm đúng cả thành phần, thời điểm và lý do | 0% |

*Nguồn: số liệu công bố trong OpenRCA (ICLR 2025).*

Có thể thấy, ngay cả khi được lọc "hoàn hảo" (điều không khả thi trong thực tế), kết quả cũng chỉ đạt 5,37–7,16%. Cách tốt nhất hiện nay là để agent tự viết code truy vấn dữ liệu, nhưng cũng mới đạt 11,34%. Với các ca đòi hỏi tìm đúng đồng thời cả thành phần, thời điểm và lý do, tỷ lệ đúng là 0%.

## 2.3. Các kiểu sai cụ thể

Qua việc đếm lại từ kết quả từng ca mà OpenRCA công bố, có thể thấy các kiểu sai điển hình sau:

* **Sai về thời điểm:** 28,6% thời điểm agent đưa ra nằm ngoài khoảng xảy ra sự cố, tức là agent chọn nhầm bất thường đã có từ trước. Trong khi đó, đáp án đúng nằm trong khoảng sự cố ở 329/330 trường hợp.  
* **Sai về loại lỗi:** 76,1% ca lỗi mạng bị agent trả lời thành lỗi CPU, RAM hoặc đĩa, tức là những bất thường dễ thấy hơn.  
* **Code của agent chạy lỗi:** khi xảy ra tình huống này, kết quả giảm 16–18% với Claude và GPT, và giảm 68% với Gemini.

## 2.4. Nguyên nhân chung

Dữ liệu giám sát chủ yếu là con số và mã định danh, loại dữ liệu mà LLM xử lý kém. Vì không thể xem hết dữ liệu, agent buộc phải chọn xem gì, và chính việc chọn này là chỗ đang sai: agent dễ bị thu hút bởi các bất thường dễ thấy nhưng không phải nguyên nhân gốc, như nhiễu có từ trước hay lỗi CPU, RAM, đĩa.

# 3\. Tóm tắt

Bài toán xác định nguyên nhân gốc trên OpenRCA khó vì hai lý do. Thứ nhất, dữ liệu lớn hơn nhiều lần sức chứa của LLM. Thứ hai, các cách lọc dữ liệu hiện có (quy tắc cố định hoặc để agent tự viết code truy vấn) vẫn chưa giúp chọn đúng dữ liệu cần xem, dẫn đến nhầm thời điểm, nhầm loại lỗi và kết quả thấp. Do đó, vấn đề cốt lõi cần giải quyết là làm sao chọn đúng phần dữ liệu cần xem để phân biệt nguyên nhân gốc với hệ quả và nhiễu, đồng thời đưa ra bằng chứng đủ tin cậy cho người vận hành.