\---  
marp: true  
theme: default  
paginate: true  
math: katex  
\---

\# Phần 1\. Hệ thống hoạt động như thế nào

Tìm nguyên nhân gốc (RCA) trong hệ thống nhiều service  
từ **\*\*metric, trace, log\*\***: BARO \+ MicroRank \+ LLM

Dữ liệu minh họa: OpenRCA – hệ thống ngân hàng (Bank)

\---

\#\# Bài toán

\- Mỗi sự cố: một **\*\*cửa sổ 30 phút\*\*** có 1–2 lỗi  
\- Cần trả lời: **\*\*thời điểm\*\*** (sai số ≤ 60 giây), **\*\*máy\*\*** (1 trong 14), **\*\*lý do\*\*** (1 trong 8\)

\| 14 máy \| 8 lý do \|  
\|---\|---\|  
\| apache01/02, IG01/02, Tomcat01–04, MG01/02, Mysql01/02, Redis01/02 \| high CPU, high memory, network latency, network packet loss, disk I/O read, disk space, JVM CPU load, JVM OOM \|

\---

\#\# Hệ thống Bank

apache → IG (gateway) → Tomcat (app, JVM) → MG (middleware) → docker services  
Mysql, Redis là kho dữ liệu

\- Mỗi tầng có 2–4 bản sao: một bản lỗi thì tầng trên chuyển sang bản còn lại  
\- Vì vậy lỗi hay bị che, **\*\*người dùng thường không thấy gì\*\***  
\- apache, Mysql, Redis **\*\*không có trong trace\*\***

\---

\#\# Dữ liệu đầu vào (1/2): metric

\| File \| Cột \| Ý nghĩa \|  
\|---\|---\|---\|  
\| \`metric\_container\` \| timestamp, cmdb\_id, kpi\_name, value \| Số đo của **\*\*từng máy\*\***: CPU, đĩa, mạng, RAM, JVM... \|  
\| \`metric\_app\` \| timestamp, rr, sr, cnt, mrt, tc \| Chỉ số nghiệp vụ **\*\*theo service\*\***: tỉ lệ thành công, số request, thời gian phản hồi \|

\- Khoảng 1,2 triệu dòng mỗi ngày; mỗi máy 60–100 loại metric (**\*\*\~800 chuỗi\*\*** mỗi cửa sổ)  
\- Lấy mẫu 60–120 giây, gom lại theo phút

\---

\#\# Dữ liệu đầu vào (2/2): trace và log

**\*\*Trace\*\*** \`trace\_span\`: timestamp, cmdb\_id, parent\_id, span\_id, trace\_id, duration (ms)  
\- 12–25 triệu span mỗi ngày  
\- span\_id bắt đầu bằng \`369-\` là **\*\*cuộc gọi đi\*\*** (client), còn lại là phía nhận (server)  
\- Chỉ có IG, Tomcat, MG, docker

**\*\*Log\*\*** \`log\_service\`: timestamp, cmdb\_id, log\_name, value  
\- 8 máy có log; **\*\*99% là access log\*\*** (mỗi request một dòng, hầu hết mã 200\)  
\- Log GC, slow query, catalina rất ít  
\- IG, MG, Redis không có log

\---

\#\# Pipeline

\`\`\`mermaid  
flowchart TD  
   A\["Nhận case: câu hỏi, khoảng thời gian, số lỗi"\] \--\> B\["Triệu chứng nghiệp vụ\<br/\>(metric\_app → 1 câu)"\]  
   B \--\> C\["Tool 1 – BARO\<br/\>BOCPD tìm điểm thay đổi \+ RobustScorer xếp hạng metric"\]  
   B \--\> D\["Tool 2 – Graph\<br/\>MicroRank trên trace \+ so phần traffic giữa các replica"\]  
   C \--\> E\["Chọn tối đa 8 component\<br/\>(top BARO \+ top MicroRank \+ máy mất traffic)"\]  
   D \--\> E  
   C \-. "điểm BARO của từng component" .-\> E2  
   E \--\> E2\["Gom bằng chứng theo nhóm metric\<br/\>(CPU, JVM, RAM, đĩa, mạng…)"\]  
   E2 \--\> F\["LLM chọn component, reason, onset, giải thích"\]  
   F \--\> G\["Code kiểm tra: trong cửa sổ, bằng chứng khớp reason,\<br/\>lệch ≤ 5 phút, không trùng component"\]  
   G \--\> H{"Đạt?"}  
   H \-- Đạt \--\> J\["Lưu report \+ đáp án"\]  
   H \-- "Chưa đạt, còn lượt (tối đa 2 lần sửa)" \--\> I\["Gửi lỗi kiểm tra cho LLM"\]  
   I \--\> F  
   H \-- "Chưa đạt, hết lượt" \--\> U\["Đáp án chưa kiểm chứng\<br/\>(đề xuất: chuyển cho người xem)"\]  
   U \--\> J  
\`\`\`

*\> Code làm các bước cố định; LLM chỉ* **\*\*đọc bằng chứng đã được tóm tắt\*\*** *rồi chọn*

\---

\#\# Vai trò từng thành phần

\| Thành phần \| Làm gì \| Mạnh với \|  
\|---\|---\|---\|  
\| Triệu chứng \| So tỉ lệ thành công, thời gian phản hồi với giờ trước \| Biết **\*\*người dùng có bị ảnh hưởng không\*\*** \|  
\| BARO \| Tìm thời điểm đổi \+ xếp hạng metric bất thường \| Lỗi **\*\*tài nguyên\*\*** (CPU, đĩa, RAM) \|  
\| MicroRank \| Xếp hạng máy qua các trace chậm \| Lỗi **\*\*mạng\*\*** trên máy có trace \|  
\| So traffic replica \| Máy nào mất phần traffic so với máy anh em \| Máy **\*\*không có trace\*\*** (apache) \|  
\| LLM \| Đọc bằng chứng, lọc nhiễu, chọn đáp án \| Suy luận, phân loại lý do \|  
\| Code kiểm chứng \| Đáp án có bằng chứng khớp không \| Chặn đáp án thiếu căn cứ \|

\---

\#\# BARO (1/2): ý tưởng

1\. **\*\*BOCPD\*\*** (phát hiện điểm thay đổi kiểu Bayes, đa biến) chạy trên bảng *\*phút × chuỗi\**, tìm phút \$\\hat t\_A\$ mà hệ thống bắt đầu đổi  
2\. **\*\*RobustScorer\*\*** chấm từng chuỗi metric: giai đoạn sau \$\\hat t\_A\$ lệch bao nhiêu so với giai đoạn trước

\$\$a\_t \= *\\frac*{\|x\_t \- *\\text*{median}\|}{*\\text*{IQR}} \\qquad \\rho \= *\\max\_*{t \\ge \\hat t\_A} a\_t\$\$

\- median và IQR (khoảng giữa phân vị 25% và 75%) lấy từ **\*\*giai đoạn trước\*\*** \$\\hat t\_A\$  
\- Dùng median/IQR thay mean/std vì **\*\*ít bị điểm lạ kéo lệch\*\***, chịu được việc chọn \$\\hat t\_A\$ chưa chính xác  
\- Xếp các chuỗi theo \$\\rho\$ giảm dần: đầu bảng là nghi phạm

\---

\#\# BARO (2/2): dữ liệu vào và đầu ra

**\*\*Vào:\*\*** bảng 90 phút × \~1.670 cột, mỗi cột \`\<máy\>\|\<kpi\>\` (+ \`\<service\>\_latency\`, \`\<service\>\_error\`)  
\- Bỏ cột hằng số, điền ô trống bằng giá trị phút trước  
\- BOCPD chạy trên latency và tỉ lệ lỗi

**\*\*Ra (đưa cho LLM):\*\*** mỗi máy giữ 1 metric mạnh nhất

\`\`\`  
Mysql02: LOCALDISK-sda\_DSKRead 0.40 \-\> 2308.00 (robust score 824, from 13:22)  
MG02:    TCP FIN-WAIT           0.00 \-\> 6.00    (robust score 6,   from 13:11)  
\`\`\`

\---

\#\# Multi-source BARO: thêm log và trace

Ý tưởng (RCAEval): biến log và trace thành **\*\*chuỗi thời gian\*\***, thêm cột vào cùng bảng

\| Cột thêm \| Cách tính (mỗi phút) \|  
\|---\|---\|  
\| \`\<máy\>\\\|log\_\<tên log\>\_lines\` \| Số dòng log \|  
\| \`\<máy\>\\\|trace\_spans\` \| Số span \|  
\| \`\<máy\>\\\|trace\_latency\_ms\` \| Độ trễ span trung bình \|

\- Thêm \~25 cột; công thức chấm **\*\*giữ nguyên\*\***  
\- Điểm cắt vẫn lấy từ BOCPD trên bảng gốc

\---

\#\# MicroRank (1/2): ý tưởng

**\*\*Thao tác\*\*** \= máy \+ phía (\`Tomcat04:call\` hoặc \`Tomcat04:serve\`), vì trace Bank không có tên API

1\. **\*\*Mức bình thường\*\*** của mỗi thao tác \= mean \+ std ở giờ trước  
2\. Một trace là **\*\*bất thường\*\*** nếu

\$\$d\_{trace} \> *\\sum\_*{op \\in trace} \\big(*\\mu\_*{op} \+ *\\sigma\_*{op}\\big) \+ 50\\ *\\text*{ms}\$\$

3\. **\*\*PageRank cá nhân hóa\*\*** (\$d=0.85\$, 25 vòng) trên đồ thị thao tác–trace, chạy riêng cho nhóm bất thường và nhóm bình thường  
4\. Điểm phổ **\*\*DStar2\*\*** cho mỗi thao tác:

\$\$*\\text*{score}(op) \= *\\frac*{e\_f^2}{e\_p \+ n\_f}\$\$

\$e\_f\$: trọng số trace bất thường đi qua \$op\$ · \$e\_p\$: trace bình thường đi qua · \$n\_f\$: trace bất thường không đi qua

\---

\#\# MicroRank (2/2): dữ liệu vào và đầu ra

**\*\*Vào\*\*** (ví dụ một cửa sổ): 802.228 span → **\*\*40.827 trace\*\***

\`\`\`  
gw01...1645 \| 2777 ms \| \[dockerA1:serve, MG02:call, MG02:serve, Tomcat04:serve, IG01:call, ...\]  
\`\`\`

\- Thêm tập cạnh gọi cha → con để dựng đồ thị; điểm của máy \= điểm cao nhất trong các thao tác của nó

**\*\*Ra:\*\*** \`IG02: 1.00, Tomcat01: 0.98, IG01: 0.76, MG02: 0.21 ...\`

**\*\*Bổ sung của nhóm\*\*** (cho máy không có trace): so phần traffic giữa các replica

\$\$share\_i(t) \= *\\frac*{n\_i(t)}{\\sum\_j n\_j(t)}\$\$

Cảnh báo nếu \$share\_i(t) \< 0.5 \\cdot share\_i^{*\\text*{bình thường}}\$ trong ≥ 2 phút. Với apache, \$n\$ \= số dòng access log mỗi phút.

\---

\#\# LLM dùng kết quả của tool để suy luận

**\*\*Đầu vào (\~60 dòng, do code dựng sẵn):\*\*** danh sách máy và lý do hợp lệ · triệu chứng · kết quả BARO · kết quả Graph · bằng chứng từng ứng viên · **\*\*các quy tắc backend\*\***

Ví dụ quy tắc:  
\- CPU của OS tăng mà JVM CPU không đổi → \`high CPU usage\`  
\- Máy mất traffic, máy anh em nhận thêm, CPU/RAM/đĩa không đổi → **\*\*lỗi mạng ở máy mất\*\***  
\- Đột biến 1 điểm, hoặc đã bất thường từ trước → không phải nguyên nhân

**\*\*Đầu ra:\*\*** JSON ép theo schema \`{component, reason, onset\_minute, why}\`

**\*\*Kiểm chứng (code):\*\*** phút nằm trong cửa sổ · bằng chứng khớp loại lỗi · bằng chứng bắt đầu cách phút chọn ≤ 5 phút · không trùng máy  
→ sai thì gửi lỗi cho LLM, **\*\*tối đa 2 lần sửa\*\***

\---

\#\# Ca LLM xử lý tốt 1: MG02 mất gói (13:10)

**\*\*Đề:\*\*** hỏi máy và lý do · **\*\*không có ảnh hưởng nghiệp vụ\*\*** (failover che lỗi)

\| Tool \| Thấy gì \|  
\|---\|---\|  
\| BARO \| Đứng đầu là **\*\*nhiễu\*\***: đĩa Mysql02 (824 điểm), một core của apache01 (412 điểm). MG02 chỉ có FIN-WAIT 0→6 \|  
\| Graph \| MicroRank xếp IG02 đầu. **\*\*Nhưng:\*\*** *\*MG02 chỉ còn 0% phần traffic từ 13:10, MG01 nhận thay\** \|

**\*\*LLM:\*\*** bỏ qua hạng đầu của BARO và MicroRank, theo câu tóm tắt của tool graph cùng quy tắc → **\*\*MG02, network packet loss, 13:10\*\*** ✔

**\*\*Ưu:\*\*** câu tóm tắt rõ \+ quy tắc → LLM lọc được nhiễu và không nhầm máy khỏe (MG01) là nguyên nhân  
**\*\*Nhược:\*\*** phụ thuộc vào một tín hiệu duy nhất (mất traffic)

\---

\#\# Ca LLM xử lý tốt 2: Tomcat02 OOM (16:23)

**\*\*Đề:\*\*** chỉ hỏi **\*\*thời điểm\*\*** · phản hồi lên tới 9 giây

\- MicroRank xếp **\*\*MG02 hạng 1\*\*** (độ trễ lan từ Tomcat02 sang)  
\- LLM lần 1 chọn **\*\*MG02\*\***, lấy nhầm số liệu của MG01 làm bằng chứng  
\- **\*\*Code kiểm chứng bắt được:\*\*** MG02 không có bằng chứng cho lý do đó  
\- LLM lần 2: **\*\*Tomcat02, 16:24\*\*** ✔ (đáp án 16:23, trong ±60 giây)

**\*\*Ưu:\*\*** vòng kiểm chứng sửa được lỗi gán nhầm bằng chứng  
**\*\*Nhược:\*\*** lý do chọn là *\*CPU\** hoặc *\*memory\**, còn nguyên nhân thật là **\*\*OOM\*\***, vì pipeline chưa thấy log GC (1 → 56 dòng/phút). Ca này đúng vì đề chỉ hỏi thời điểm.

\---

\#\# Ca LLM chưa xử lý tốt 1: apache01 mất gói (20:25)

**\*\*Đề:\*\*** hỏi cả 3 trường · apache **\*\*không có trace\*\***

\| Tool \| Thấy gì \|  
\|---\|---\|  
\| BARO \| **\*\*FIN-WAIT 0→59 bị loại\*\*** (cột hằng số trước đó). Đầu bảng là nhiễu: Mysql02, core nhảy, **\*\*đĩa MG02 0→152 chỉ 1 phút\*\*** \|  
\| Graph \| ✔ *\*apache01 chỉ còn 5% phần traffic từ 20:25; apache02 nhận thay\** \|

**\*\*LLM:\*\*** chọn **\*\*MG02, disk I/O, 20:13\*\*** ✘, bị con số 152 của nhiễu thu hút. Bước kiểm chứng vẫn cho qua vì chưa kiểm tra độ dài của bằng chứng.

**\*\*Nhược:\*\*** tool graph **\*\*đã tìm đúng\*\***, nhưng bằng chứng nhiễu lấn át · BARO làm mất tín hiệu quan trọng nhất · kiểm chứng còn lỏng

\---

\#\# Ca LLM chưa xử lý tốt 2: Tomcat01 network latency (11:20)

**\*\*Đề:\*\*** hỏi máy và lý do · tỉ lệ thành công còn \~75% (1 trong 4 Tomcat không phản hồi)

\- Access log Tomcat01 về 0, 60 kết nối FIN-WAIT, packet giảm từ \~1.050 xuống \~100  
\- **\*\*MicroRank xếp IG02, IG01 đầu\*\*** (Tomcat01 gần như 0): thiên về máy nằm trên nhiều đường đi, dễ kéo LLM sang nhầm máy  
\- Khi LLM tìm đúng Tomcat01, nó chọn *\*packet loss\** trong khi đáp án là **\*\*latency\*\*** ✘

**\*\*Nhược:\*\*** khi độ trễ rất lớn, latency và loss cho **\*\*cùng một biểu hiện\*\*** (traffic sập, FIN-WAIT). Cần thời gian từng cạnh gọi (timeout 15,4 giây từ IG tới Tomcat01) nhưng pipeline chưa dùng.

\---

\#\# Ưu và nhược

\| Ưu \| Nhược \|  
\|---\|---\|  
\| Code cố định → **\*\*tái lập, kiểm chứng được\*\***, nhanh \| Bằng chứng gom sẵn, **\*\*không đi lấy thêm\*\*** theo giả thuyết \|  
\| LLM chỉ đọc bản tóm tắt, có quy tắc backend → **\*\*lọc nhiễu, giải thích được\*\*** \| BARO: metric hệ điều hành rất nhiễu, mất cột "phẳng rồi bật lên" \|  
\| Hai tool bù nhau (tài nguyên và mạng) \| MicroRank: mù với apache/Mysql/Redis, thiên về IG/MG \|  
\| Tool so traffic xử lý được máy không có trace \| Chưa phân biệt latency và loss; chưa dùng log GC \|  
\| Vòng kiểm chứng bắt đáp án thiếu căn cứ \| Kiểm chứng còn lỏng; hết lượt vẫn nộp đáp án chưa kiểm chứng \|

**\*\*Hướng phát triển:\*\*** truy xuất bằng chứng theo giả thuyết · so với cùng giờ ngày khác · phân tích từng cạnh gọi · chuyển cho người xem khi không chắc

