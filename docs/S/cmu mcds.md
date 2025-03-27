---
sidebar_position: 2
---
# CMU MCDS

## 项目介绍
cmu 是计算机top 4，而且mcds是scs学院下面的旗舰项目，认可度一直很高。scs学院开设的cs课程和方向非常多非常全（ml，并行计算，分布式系统，ml sys， 编译器， os, 嵌入式系统...），如果在cmu找不到想学的课程那去别的地方也很难找到了。想做科研转phd，不同方向的教授也很多很全，不存在找不到匹配方向教授的问题

mcds 有三个track(分别是 system track、analytics track和hci track)，申请时候会让你填选哪个track，不过无所谓，进去了之后也可以互相转。

如果是本科学ds/数学的可以选analytics track，如果想转码的话可以进去转到system track。不过根据民间dp，这个项目没有那么偏好system背景出身的人（eg: 如果bg是ml或者ds方向的，可能更匹配，录取概率更大）。

申请时候需要交一个video essay，同时需要在cmu lti的系统里对在scs系统申请的所有项目进行排序（有点类似高考报名的第一志愿和第二志愿）


## 录取偏好和dp
24 fall来看很看重陆本出身，清北华5+一些别的cs比较强的学校。2023 年系里收到 1099份申请，录取了140个，来了77个。详情可以参考：https://www.cs.cmu.edu/academics/masters/programs-comparison

非英语native speaker 也需要交语言成绩（eg: 中国大陆出生的学生即便读了美本也需要交托福成绩），GRE is required

dp:
1. uiuc ce本科 gpa 3.75 
2. 浙大uiuc cs本科gpa 3.9+ 
3. 中9 cs本科 gpa 3.9+toefl 103, gpa top3%, 一篇领域顶会产出 
4. 南科大DS本科， gpa 3.8+, toefl 107, 两段🇺🇸暑研+ ucb 交流
5. emory 数学系本科，gpa3.97，多段金融实习
6. 台大ee本科，gpa4.2/4.3，微软一年半全职
7. 澳科大cs本科,gpa3.83
8. 印度同学vit本科，gpa9.41，n段ra经历
9. umich 本科,gpa3.99，有国内小厂实习

## 找工情况和dp

有open ai research engineer, 顶级量化， databricks，
snowflake等

1. 清华本科,tianshou 作者，github 3k+ star，上岸open ai
2. 印度同学本科，微软印度两年八个月全职工作经历，上岸tt 
3. 交大umich本科，上岸微软ds intern
4. 北邮cs本科，上岸沃尔玛ds intern
5. ucsd cs 本科，之前有小厂实习，上岸Qualcomm 
6. 澳科大cs本科，有小厂实习，上岸apple
7. 

* 25 summer Intern：身边统计学SDE全员上岸，MLE了解不多但认识的几个DP也都上岸了，DS/DA存在没上岸的。
* 学校支持：Career Fair公司较多，Databricks Snowflake等独角兽独爱CMU学生，且这两年NV和Apple疯狂在Career Events捞MLE和偏System的Developer，比如修完Operating System就很容易被Apple捞。我认识几个MSIN的同学在这个年景无实习靠着System Project上岸了NV和Apple。许多公司给修Database和CloudComputing的学生开设专门的投递通道，也有很多同学因此被做数据库的中小厂捞了的。
* 学校劣势：首先，MCDS并没有感觉相比其他非SCS项目有优势。其次，少数公司仍坚持Quota制使CMU学生较难上岸这些公司。最后，个人认为对于非System方向的SDE（个人粗暴理解为非Verilog/C/C++/Rust选手，很不幸正是在下），CMU在找工方面的Title优势和Quota劣势相抵（毕竟Databricks给我面试了），如果是MLE/System SDE则CMU会带来很大的Title优势。
* 特别注意：MCDS找工状况好并非因为项目本身好坏，而是因为项目录取学生偏好有工作经历和research成果。当前市场虽有机会，但除了meta Amazon还采取从各校统招考算法，databricks snowflake从极少数target school统招考算法，其余大中小厂基本上已经转向组招，可谓是校招社招化。因此能否上岸取决于是否具备有竞争力的垂直经历。换言之，现在各厂已经不仅筛选候选人技术栈，还筛选候选人业务经历。譬如一个候选人在国内的经历是Fintech行业写Java，ta在美国收到十个面试里有5个会是Fintech行业写Java的岗。
## Other Useful Links
[MCDS人均必读之n+e's blog](https://trinkle23897.github.io/posts/cmu-1st-year)





## 课程评价
* Chain-of-Thought出来之后，各校的Course Projects全都变成了可难可水（除了Cloud Computing）。因此，CMU以往因workload大而妨碍找工的事已成过往云烟。我反而觉得这些以往动辄16h/week的课才能让学生在AI时代仍必然能学到东西。因此着重介绍课程内容及个人认为是否实用，不讨论workload。
* 选课方面3学期和4学期完全是两个感觉，4学期基本上不管是哪个track都能把想修的都修了（甚至能两个Track都修了），3学期则必修课占比过大，加之有CC且秋季得找工，很难把想上的都上了。
### 必修课
* FCDS：很不错的从LeetCode(Design In-memory File System)到数分到ML到云全都cover一遍的课，well-structured。对我这种没DS/ML基础的很补。
* 10601：机器学习基础课，传统ML算法大全，考试难度见仁见智，数理基础好会轻松，听说是ML领域八股必备。
* MCDS Seminar：workload不大，见仁见智。
* 05839：学完对数据的各种view有了更好的感知。作业无编码难度仅调用各种tools，实际workload < 2h/week。
* 15619：著名的Cloud Computing，总体评价是好课，技术栈全，学完后对工业界的各种cloud-related中间件就有概念了，对System Design也是好处多多。只要秋季找到了实习就推荐上CC而非用ACC替换。但对于有硬核实习经历（不在少数）的同学来说，在Course Project里写Course Stuff强行塞进来的业务逻辑的体验实在有点无语（我上班都写这么多业务逻辑了，上学不就想学点技术嘛，结果还让我写业务逻辑？？？？？）。瑕不掩瑜，总之是好课。
* Capstone Planner：见仁见智，虽然大家对此吐槽颇多，但对我个人来说，在即将实习的这个学期，频繁开会扯皮沟通应付required docs，也是一个很好的过渡。对于在美国有工作经验的同学真就纯属浪费时间。
* 注：24级基本不让用ACC替代CC了。
### 选修课
* 4学期的话基本SCS学院课程任选，3学期则基本只能在System和Analytics里选一个方向修。



# 花费情况
cmu 是私校，学费从来就不便宜过。无论是ini、ece、还是scs，mcds的三学期Tuition

 fee(学费，未包括任何附加费用包括租房等)是84550$。

![](/img/mcdsfee.png) 
