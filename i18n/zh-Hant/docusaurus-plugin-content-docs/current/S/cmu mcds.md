---
sidebar_position: 2
---
# CMU MCDS

## 項目介紹 {#项目介绍}
cmu 是計算機top 4，而且mcds是scs學院下面的旗艦項目，認可度一直很高。scs學院開設的cs課程和方向非常多非常全（ml，並行計算，分佈式系統，ml sys， 編譯器， os, 嵌入式系統...），如果在cmu找不到想學的課程那去別的地方也很難找到了。想做科研轉phd，不同方向的教授也很多很全，不存在找不到匹配方向教授的問題

mcds 有三個track(分別是 system track、analytics track和hci track)，申請時候會讓你填選哪個track，不過無所謂，進去了之後也可以互相轉。

如果是本科學ds/數學的可以選analytics track，如果想轉碼的話可以進去轉到system track。不過根據民間dp，這個項目沒有那麼偏好system背景出身的人（eg: 如果bg是ml或者ds方向的，可能更匹配，錄取概率更大）。

申請時候需要交一個video essay，同時需要在cmu lti的系統裡對在scs系統申請的所有項目進行排序（有點類似高考報名的第一志願和第二志願）


## 錄取偏好和dp {#录取偏好和dp}
24 fall來看很看重陸本出身，清北華5+一些別的cs比較強的學校。2023 年系裡收到 1099份申請，錄取了140個，來了77個。詳情可以參考：https://www.cs.cmu.edu/academics/masters/programs-comparison

非英語native speaker 也需要交語言成績（eg: 中國大陸出生的學生即便讀了美本也需要交託福成績），GRE is required

dp:
1. uiuc ce本科 gpa 3.75 
2. 浙大uiuc cs本科gpa 3.9+ 
3. 中9 cs本科 gpa 3.9+toefl 103, gpa top3%, 一篇領域頂會產出 
4. 南科大DS本科， gpa 3.8+, toefl 107, 兩段🇺🇸暑研+ ucb 交流
5. emory 數學系本科，gpa3.97，多段金融實習
6. 臺大ee本科，gpa4.2/4.3，微軟一年半全職
7. 澳科大cs本科,gpa3.83
8. 印度同學vit本科，gpa9.41，n段ra經歷
9. umich 本科,gpa3.99，有國內小廠實習

## 找工情況和dp {#找工情况和dp}

有open ai research engineer, 頂級量化， databricks，
snowflake等

1. 清華本科,tianshou 作者，github 3k+ star，上岸open ai
2. 印度同學本科，微軟印度兩年八個月全職工作經歷，上岸tt 
3. 交大umich本科，上岸微軟ds intern
4. 北郵cs本科，上岸沃爾瑪ds intern
5. ucsd cs 本科，之前有小廠實習，上岸Qualcomm 
6. 澳科大cs本科，有小廠實習，上岸apple
7. VIT cs本科，2023年碩士畢業，Abacus.AI Research Scientist intern，2024年上岸JPMorgan Chase Senior MLE全職，2025年轉meta Senior MLE全職。
* 25 summer Intern：身邊統計學SDE全員上岸，MLE瞭解不多但認識的幾個DP也都上岸了，DS/DA存在沒上岸的。
* 學校支持：Career Fair公司較多，Databricks Snowflake等獨角獸獨愛CMU學生，且這兩年NV和Apple瘋狂在Career Events撈MLE和偏System的Developer，比如修完Operating System就很容易被Apple撈。我認識幾個MSIN的同學在這個年景無實習靠著System Project上岸了NV和Apple。許多公司給修Database和CloudComputing的學生開設專門的投遞通道，也有很多同學因此被做數據庫的中小廠撈了的。
* 學校劣勢：首先，MCDS並沒有感覺相比其他非SCS項目有優勢。其次，少數公司仍堅持Quota制使CMU學生較難上岸這些公司。最後，個人認為對於非System方向的SDE（個人粗暴理解為非Verilog/C/C++/Rust選手，很不幸正是在下），CMU在找工方面的Title優勢和Quota劣勢相抵（畢竟Databricks給我面試了），如果是MLE/System SDE則CMU會帶來很大的Title優勢。
* 特別注意：MCDS找工狀況好並非因為項目本身好壞，而是因為項目錄取學生偏好有工作經歷和research成果。當前市場雖有機會，但除了meta Amazon還採取從各校統招考算法，databricks snowflake從極少數target school統招考算法，其餘大中小廠基本上已經轉向組招，可謂是校招社招化。因此能否上岸取決於是否具備有競爭力的垂直經歷。換言之，現在各廠已經不僅篩選候選人技術棧，還篩選候選人業務經歷。譬如一個候選人在國內的經歷是Fintech行業寫Java，ta在美國收到十個面試裡有5個會是Fintech行業寫Java的崗。

## Other Useful Links
[MCDS人均必讀之n+e's blog](https://trinkle23897.github.io/posts/cmu-1st-year)





## 課程評價 {#课程评价}
* Chain-of-Thought出來之後，各校的Course Projects全都變成了可難可水（除了Cloud Computing）。因此，CMU以往因workload大而妨礙找工的事已成過往雲煙。我反而覺得這些以往動輒16h/week的課才能讓學生在AI時代仍必然能學到東西。因此著重介紹課程內容及個人認為是否實用，不討論workload。
* 選課方面3學期和4學期完全是兩個感覺，4學期基本上不管是哪個track都能把想修的都修了（甚至能兩個Track都修了），3學期則必修課佔比過大，加之有CC且秋季得找工，很難把想上的都上了。
### 必修課 {#必修课}
* FCDS：很不錯的從LeetCode(Design In-memory File System)到數分到ML到雲全都cover一遍的課，well-structured。對我這種沒DS/ML基礎的很補。
* 10601：機器學習基礎課，傳統ML算法大全，考試難度見仁見智，數理基礎好會輕鬆，聽說是ML領域八股必備。
* MCDS Seminar：workload不大，見仁見智。
* 05839：學完對數據的各種view有了更好的感知。作業無編碼難度僅調用各種tools，實際workload < 2h/week。
* 15619：著名的Cloud Computing，總體評價是好課，技術棧全，學完後對工業界的各種cloud-related中間件就有概念了，對System Design也是好處多多。只要秋季找到了實習就推薦上CC而非用ACC替換。但對於有硬核實習經歷（不在少數）的同學來說，在Course Project裡寫Course Stuff強行塞進來的業務邏輯的體驗實在有點無語（我上班都寫這麼多業務邏輯了，上學不就想學點技術嘛，結果還讓我寫業務邏輯？？？？？）。瑕不掩瑜，總之是好課。
* Capstone Planner：見仁見智，雖然大家對此吐槽頗多，但對我個人來說，在即將實習的這個學期，頻繁開會扯皮溝通應付required docs，也是一個很好的過渡。對於在美國有工作經驗的同學真就純屬浪費時間。
* 注：24級基本不讓用ACC替代CC了。
### 選修課 {#选修课}
* 4學期的話基本SCS學院課程任選，3學期則基本只能在System和Analytics裡選一個方向修。



# 花費情況 {#花费情况}
cmu 是私校，學費從來就不便宜過。無論是ini、ece、還是scs，mcds的三學期Tuition

 fee(學費，未包括任何附加費用包括租房等)是84550$。

![](/img/mcdsfee.png)
