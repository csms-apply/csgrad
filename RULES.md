# csgrad MSCS 选校定位规则手册（RULES.md）

> 本手册沉淀 chunyu 在 `test-data-replied.md` 上累计的 ~35 条批注，作为团队 future reference、agent 批量回复 fewshot、以及 `classifier.js` 规则的人类可读说明。维护人：chunyu。

---

## 1. 简介 + 核心概念

csgrad 是面向中国大陆 / 海外华人本科生的美国 MSCS / MSECE 选校定位服务，输出三档清单（冲刺 / 主申 / 保底），并附带项目难度提醒与背景补强建议。`src/lib/positioning/classifier.js` 负责打分，`docs/{SSS,SS,S,A+,A,A-,B+,B,B-,C}/` 是项目本身的价值评级。

**两套 tier 不要混用：**

- **人 tier**（申请者画像 tier）：综合 ugType + GPA + 科研 + 实习 + 三维后给申请者一个档位，决定他能冲哪一档项目。
- **学校 tier**（项目本身评级）：项目在就业 / 科研 / 转码友好度上的价值，存在 `docs/{SSS..C}/` 目录下。

**跨档逻辑（人 tier 与学校 tier 之间）：**

- **冲刺（reach）**：比申请者人 tier 高 1-2 档的项目。
- **主申（match）**：同档或高 1 档的项目。
- **保底（safety）**：低 1-2 档的项目（且不在 `high-bar-no-safety` 列表里）。

例如人 tier 为 A 的同学：reach = SS / S，match = S / A+，safety = A- / B+。

---

## 2. ugType 分类细则

| ugType | base | 典型院校 | 备注 |
|---|---|---|---|
| cn-tsinghua-pku | 65 | 清华、北大 | 唯一可进 SSS 的陆本来源 |
| us-top | 64 | UCSD、UMich、UCLA、UIUC、USC、NYU、Emory、Wisc、Cornell、Columbia 等 Top 30 美本 | 美本身份在录取中独立加成 |
| cn-hua5 | 60 | 复旦、上交、浙大、中科大、哈工大 | 老牌 C9 |
| cn-sustech-shtech | 61 | 上科大、南科大 | 独立分档（chunyu 提议），略高于华五 |
| overseas-top | 58 | 牛津、剑桥、帝国、ETH、UofT、港三所（HKU/HKUST/CUHK）、TUM、EPFL | |
| us-mid | 52 | T30-100 美本 | |
| cn-985 | 46 | 其他 985（华科、北航、北理、东南、武大、中山等） | |
| overseas | 44 | IIT、HKU 以外的港校（CityU/PolyU）、NTU、NUS 等海外非顶尖 | |
| cn-211 | 38 | 211 但非 985 | |
| cn-双非 | 26 | 双非本科 | 中外合办可按英本部分单独评估时上调 |

> 说明：classifier 内部还保留 `cn-985-top`（base=62）作为旧版顶尖 985 名单（清北+华5）的兼容枚举，新数据不再使用，仅供 SSS-eligible 列表向后兼容。

**归类判断原则**：以学位授予方为准。中外合办（XJTLU、宁诺、上海 NYU、UIC）若拿到对方本部学位（如 Nottingham UK），按 overseas-top / overseas 评估更准；只拿合办校学位则按 cn-双非 + 软背景加成评估。

---

## 3. 软硬背景打分细则

> 与 `classifier.js` 一一对应，但用人类可读语言描述。最终 score = ugType base + 以下各项累加。

**GPA（4.0 制，3.0 / 100 制需先换算）：**

- ≥3.95 → +20
- ≥3.9 → +17
- ≥3.85 → +14
- ≥3.8 → +10
- ≥3.7 → +6
- ≥3.5 → +1
- ≥3.3 → -4
- ≥3.0 → -10
- <3.0 → -16

**科研（research）：**

- 顶会一作（CVPR / NeurIPS / ICML / ICLR / SIGCOMM / SOSP 等）→ +14
- 顶会合作（非一作） → +8
- 国内 paper / workshop → +3
- none → 0

**实习（internship）：**

- ≥4 段 → +6
- ≥2 段 → +4
- ≥1 段 → +2
- 大厂（FAANG / 字节 / 腾讯 / 阿里 / 美团等）额外 → +3

**强推（recommender）：**

- ≥3 → +5
- ≥2 → +3
- ≥1 → +1
- unknown / 无 → 0

**三维（语言 + GRE）：**

- 托福 ≥110 → +2；≥100 → +1；<90 → -2
- GRE ≥328 → +2；≥320 → +1；<310 → -1
- **GRE < 320 → warning，非必要不建议提交**（在 admission 上算反向信号）

**专业扣分（非 CS 科班）：**

- EE / Math / Physics → -2
- 其他工科（机械、土木、自动化等） → -5
- 其他（商科、文科） → -8
- 若已修 4 门以上 CS 核心课（DS&A / OS / DB / 网络 / 编译 等），扣分减半

---

## 4. Hard Caps（score 无法突破的天花板）

无论分数有多高，触发以下任一规则即被压档：

1. **无顶会一作** → cap 到 SS（SSS 必须有顶会一作 + 顶校）
2. **不在 SSS-eligible 列表**（仅清北 / 美本 Top 30 / 旧 cn-985-top 名单）→ cap 到 SS
3. **GPA 4.0 制 < 3.85 且 research = none** → cap 到 S
4. **ugType = cn-双非 + 无大厂实习 + 无科研** → cap 到 A-
5. **ugType = cn-211 + 无科研 + 无大厂** → cap 到 A
6. **GPA < 3.3 + 无 research + 无大厂** → cap 到 B+
7. **没填 GPA** → cap 到 B（信息不足按保守处理）
8. **陆本 + 托福 < 100 或雅思 < 7** → 整体降一档（海本不触发，因为他们用英语教学）

---

## 5. 项目难度标签（school-lists.json 的 tag 体系）

不同项目对申请者背景有特殊偏好，标签控制 worker 输出逻辑：

- **`phd-only`**：MIT EECS、Princeton MSECS、MIT CSE。只有 `careerGoal=us-phd` 时才推荐，否则不推。
- **`domestic-feeder-only`**：UMich MSCS。基本只录美本 + SJTU + UMich 本校，其他陆本不推。
- **`high-bar-no-safety`**：GT MSCS、UT Austin MSCS、UCLA MSCS、UT ECE SES、UPenn MCIT、Harvard CSE、UPenn CIS、CMU MCDS、Yale MSCS 2year、UMD MSCS。这些项目录取波动大，不能作为 safety 出现在保底栏。
- **`non-cs-only`**：UPenn MCIT、NEU CS ALIGN。仅限非 CS 背景申请者推（CS 科班同学申不到）。
- **`transition-friendly`**：NEU 系列（Seattle / SV / Boston）、SCU MSCSE、JHU MSECS、UIUC MSIM、UPenn MCIT 等。转码同学专用。

### 学校级 GPA 下线

部分项目对 GPA 有隐性下线，触发后建议作为冲刺而非主申：

- **UPenn CIS**：陆本约 3.9+ / 美本约 3.85+
- **Harvard CSE**：陆本 GPA 突出（3.9+）才考虑；普通 GPA 强禁推

#### 学校 GPA 阈值表

| 学校 | gpaFloor 陆本 | gpaFloor 美本 | 备注 |
|------|--------------|--------------|------|
| UPenn CIS | 3.9 | 3.85 | + 禁推转码同学 |
| CMU MCDS | 3.8 | 3.7 | A+ 档同学视作冲刺 |
| UCLA MSCS | 3.8 | - | |
| Harvard CSE | 3.9 | - | 陆本 GPA 不突出强禁推 |

### 学校间 bar 排序（barIndex，校准自 OpenCS）

参考 OpenCS（https://opencs.app/grade/）对学校项目的横向 bar 评级，作为 classifier 间项目难度的统一刻度。

| OpenCS Tier | barIndex | 学校举例 |
|------------|----------|----------|
| SSS | 95 | Stanford MSCS, MIT EECS, Princeton MSECS |
| SS | 87 | CMU MSCS / MSML / MLT, UT MSCS, UPenn CIS, Yale 2yr, Harvard CSE |
| S | 80 | CMU MCDS, UCLA MSCS, UIUC MSCS, UMich MSCS, Wisc CS PMP |
| A+ | 75 | Duke MSCS, GT MSCS, NWU MSCS, UBC MSCS |
| A | 70 | UCSD CS75, Columbia MSCS, UT ECE SES |
| A- | 65 | Brown SCMCS, JHU MSECS, Rice MCS, UChicago MPCS |
| B+ | 60 | NYU Tandon, USC CS37 |

**关键 bar 关系**：
- MCDS (80) ≈ UPenn CIS (87) > Duke MSCS (75) > Columbia MSCS (70)
- UCLA (80) / UT ECE SES (70) > Columbia (70)
- Stanford MSEE 跟 MSCS 同 tier，但硬件背景优先 MSEE

### 转码同学禁推清单

非 CS 背景（`isCsBackground=false`）同学**不推荐**以下项目：

- **UPenn CIS** — 卡 CS 先修课 + 隐性 GPA 高线
- **Cornell CS MEng** — 要求扎实 CS 基础
- **GT MSCS** — 卡 GRE + CS 课程数
- **CMU MSCS** — bar 太高

转码同学应优先推：UPenn MCIT、JHU MSECS、NEU CS ALIGN/IS/SES、SCU MSCSE、UIUC MSIM。

### Brown SCMCS 语言下线

- 托福 < 105 → 不推
- 雅思 < 8 → 不推

原因：Brown 招生重视语言成绩，bar 严格。

### Stanford MSEE 硬件背景优先

当 `targetTrack ∈ {ece-hw, ee-signal}` + 顶会论文背景 → **优先推 Stanford MSEE 而不是 MSCS**。MSEE 对硬件 bg 更 match，admission 也相对友好（MSCS 主要看 CS pub）。

### CMU MSCV 必须 CV 顶会

仅推荐给有 CVPR / ICCV / ECCV / NeurIPS / ICLR 等 CV 顶会论文的同学。其他人即便 CMU SCS 想冲也优先 MSML / MIIS / MCDS 而不是 MSCV（MSCV 是 research-track，无 pub 录取概率极低）。

### A+/A 档保底校建议

A+ / A 档同学的安全保底学校（按 background 区分）：

**美本同学**：
- UIUC MCS（对美本相对友好，bar 适中）

**陆本同学**：
- UW EE PMP / MSECE（西雅图 + microsoft target）
- UChicago MPCS（综排高 + fintech target）
- Columbia EE / CE（藤校副线，bar 友好）

---

## 6. 转码同学专项处理

`isCsBackground=false` 时 worker 走单独逻辑：

- **必加 warning**：建议申请前补齐 **DS&A、操作系统、数据库、计算机网络** 4 门核心课，可通过 **UCSD Extension / ASU 在线 / 美国 CC（社区学院）** 修课拿成绩单。这一步缺失会让大部分 MSCS 项目卡先修课。
- **补课路径**（按价格 / 难度递增）：
  1. 美国 CC（社区学院）课程
  2. UCSD Extension 在线课（性价比最高）
  3. ASU 在线课（learner status，无需正式申请）
- **选校单独 list**：worker 返回 `codingTransitionRecommended` 字段，里面是 NEU / SCU / UPenn MCIT / NEU ALIGN 等 transition-friendly 项目。
- **EE→CS 转码精细化**：EE 科班可走「CS-flavored ECE」路径，避开 SOP 解释成本：GT ECE（CS track）、CMU ECE、UMich ECE。

---

## 7. 低 GPA 补救路径

- GPA 4.0 制 < 3.3 → classifier 触发 `low-gpa-extension` warning。
- 建议路径：**UCSD Extension / ASU 在线**选 2-3 门 CS 核心课，争取 A 等级，再申请时把这部分 transcript 一起提交，把综合 GPA 拉到 3.3+。
- 这条路径同样适用于转码同学补课，可以两个目标合一。

---

## 8. 海外院校特殊处理

- **海外学位（美本 / 2+2 / overseas / overseas-top）→ 自动 waive 托福**（不仅 UBC/UofT；admission 委员会认可英语授课）
- **海外本同学**（ugType ∈ {overseas, overseas-top, us-top, us-mid}）：建议**不推「补实习」，改推「补科研 + 教授 RA + workshop paper」**（实习对海外本性价比低，科研更影响 PhD pipeline / 顶项目）
- **UBC、UofT、麦吉尔**：英语授课，传统上托福 waive；仍建议考一次留底。
- **TUM、ETH**：systems / formal methods 组教授在美国系统圈有 reputation，套磁有 advantage（尤其申 PhD bridge 项目时）。
- **中外合办**（XJTLU、宁诺、上海 NYU、UIC、温州肯恩）：默认按英本学位评估；拿到对方本部学位时按英本 / 美本部分评估，仅合办学位时按 cn-双非 + 英语优势处理。
- **港三所**（HKU / HKUST / CUHK）：与新加坡 NUS / NTU 同档，但美国 admission 对它们认可度略低于英本 G5。

---

## 9. 个性化建议层（基于 profile 字段）

worker 根据画像额外注入定制提醒：

- **美本同学**：可考虑 defer spring 入学拿 CPT 名额（Cornell CS MEng、UCLA MEng、Duke MSCS 等都有 spring 入口）。
- **已有大厂实习**：可冲一档 reach。
- **已有顶会一作**：可冲两档 reach（不受 SSS-eligible 名单束缚的唯一情形）。
- **美国读博目标**（`careerGoal=us-phd`）：推 `phdRecommended` 清单——CMU MSML / MSR / MIIS、Yale 2yr MSCS、Harvard CSE、Brown SCMCS、UCSB MSCS 等以科研衔接为主的项目。
- **CMU 任何项目**：必加提醒「非美国身份要考语言成绩；过期 2 年内的托福也接受，可省一次考试」。
- **女生 + 申 ECE / 系统方向**：可提示 GHC 奖学金路径。

### 全职工作经历推荐

- **有 ≥1 年全职工作经验**（`profile.hasFullTime=true`）→ 在推荐里**优先一年制项目**：
  - UCB EECS MEng（必修 capstone）
  - Wisc CS PMP（实质要求全职经验）
  - Cornell CS MEng（一年制）
  - UCLA MEng（一年制 + 可 coop）
- 一年制项目对有职场经验的同学最优，能尽快回到职场。

---

## 10. 8 个个体修订案例（fewshot）

下列 case 来自 `test-data-replied.md`，展示 chunyu 对 agent 第一版输出的人工修订逻辑。批量 agent 在跑回复时应模仿这套判断。

### Case #6 南大 NeurIPS：SS → S
- **画像**：南大 CS，GPA 3.87，NeurIPS 一作**在投未 accept**，2 段大厂实习。
- **agent 第一版**：SS
- **chunyu 修订**：S
- **理由**：顶会必须 **accept** 才能算顶会一作；在投状态有不确定性，不能直接 +14。降到 S 更稳妥，等录用后再升档。

### Case #9 SJTU + UMich Math：SS → S
- **画像**：SJTU ECE 本 + UMich Math 双学位，GPA 3.92，1 段大厂实习，无 paper。
- **agent 第一版**：SS（按 UMich 数学 us-top 算）
- **chunyu 修订**：S
- **理由**：虽然有美本身份，但陆本 ECE 主修拉低背景，纯 math 双学位不直接转化为 CS 竞争力。SS 必须有顶会，否则压档到 S。

### Case #10 SJTU 机械 + UMich CS：SS → S
- **画像**：SJTU 机械 + UMich CS 双学位，GPA 3.88，2 段实习。
- **agent 第一版**：SS（按 UMich CS us-top 算）
- **chunyu 修订**：S
- **理由**：软背景（无 paper、无大厂、无强推）不够硬核，仅靠双学位不足以撑 SS。降到 S。

### Case #13 南科大 EE：保持 A
- **画像**：南科大 EE，GPA 3.7，1 段实习，托福 92。
- **agent 第一版**：A
- **chunyu 修订**：保持 A
- **理由**：南科大已按 cn-sustech-shtech base=61 评估；托福 <100 触发陆本降档规则，已经被吸收到 A，无需再降。

### Case #14 NC State + 川大双学位：A+ → SS
- **画像**：NC State CS + 川大 CS 双学位，NC State GPA 4.0 + 川大 GPA 3.85，2 段大厂实习。
- **agent 第一版**：A+
- **chunyu 修订**：SS
- **理由**：NC State 拿 4.0 + 川大 3.85，双学位拉满，且 NC State 算 us-mid 但 4.0 在录取里非常突出。两段大厂实习足够顶住 SSS-eligible 之外的 cap。升到 SS。

### Case #28 西电 + VT EIT：A- → A+
- **画像**：西电 EE 本 + Virginia Tech EIT（Engineering in IT）硕士，GPA 3.6 / 3.9。
- **agent 第一版**：A-（按西电 cn-211 评估）
- **chunyu 修订**：A+
- **理由**：已有美硕在读，应按美本 / 美硕身份评估而非陆本 cn-211。VT EIT 算 us-mid，GPA 3.9 加成显著。升到 A+。

### Case #29 温州肯恩：A- → A
- **画像**：温州肯恩 CS（中外合办），GPA 3.7，2 段实习（含 1 段大厂），无 paper。
- **agent 第一版**：A-（agent 加了"补实习"建议）
- **chunyu 修订**：A，改成"补科研"
- **理由**：已经有 2 段实习包含大厂，实习栏 saturated，不需要再补；缺的是科研。中外合办按英本部分评估，可上调到 A。

### Case #35 上科大 / 南科大：A- → A+
- **画像**：上科大 CS，GPA 3.85，1 段大厂实习，1 篇国内 paper。
- **agent 第一版**：A-（agent 把上科大归到 cn-211 / cn-双非）
- **chunyu 修订**：A+
- **理由**：上科大 / 南科大应独立分档（cn-sustech-shtech base=60），与华五同档。GPA 3.85 + 大厂 + paper，直接 A+。

### v2 → v3 新增规则案例补充

汇总本轮 chunyu 新增的 18 条批注落地到规则后的核心调整，便于 worker 与 classifier 对齐。

| 学校 / 触发条件 | 规则 |
|---|---|
| Harvard CSE | 仅冲刺；陆本 GPA <3.9 强禁推 |
| UPenn CIS | 不作保底；陆本 GPA <3.9 / 美本 <3.85 改冲刺 |
| UT ECE SES、CMU MCDS、Yale 2yr、UMD MSCS | 不作保底，至少主申 |
| GRE < 320 | 非必要不交（反向信号） |
| 海外学位（含 us-top / overseas-top / 2+2） | 自动 waive 托福 |
| 海外本 ugType | 建议补科研而非实习 |
| profile.hasFullTime=true | 偏好一年制项目（UCB MEng / Wisc PMP / Cornell MEng / UCLA MEng） |

> 上表与第 5 节 `high-bar-no-safety` 列表、第 8 节海外院校特殊处理、第 9 节全职工作经历推荐互为索引，三处任一更新需同步本表。

---

## 11. 回复邮件风格指南（chunyu 口吻）

### 开头与结构
- 开头固定：「你好同学」
- 用 **冲刺 / 主申 / 保底** 三个中文词；**不要**用 reach / match / safety 英文。
- 每所学校一行格式：`- 学校名（30 字以内点评）`
- 点评聚焦项目特色（就业 / 科研 / 转码友好度），不堆砌排名。

### 中间段落
- 先给三档清单，再给 1-2 条背景补强建议。
- 转码 / 低 GPA / 三维不足触发 warning 时，单独起一段写补救路径。
- 不写"你的背景非常优秀"这种空话，直接说哪一项加分 / 哪一项扣分。

### 末尾固定结尾
> 如果需要申请美国硕士 MSCS 辅导，可以加我微信 capsfly。

### 风格禁忌
- 不用感叹号堆砌、不用"绝对""一定"等绝对化措辞。
- 不写"我们团队"这种营销话术，全文以个人顾问口吻。
- 不堆 emoji。

---

> 本手册随 `classifier.js` 规则更新同步维护。修订时直接编辑本文件并附 commit message 说明变更理由。
