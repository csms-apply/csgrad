// Enum values for applicant + DP form fields. Mirrors the Seatable schema
// so historical data renders consistently in the new form.

export const UG_CATEGORIES = [
  '中外合办校（XJTLU等）', '陆本中外合办院系（JI/ZJUI等）',
  '清北', '华五', '国科/上科/南科', '10043', '985', '211',
  '双非', '陆本', '美本', '加本', '英本', '澳本', '港本', '坡本', '欧陆本', '海本',
];

export const UG_MAJORS = [
  'CS', 'SE', 'AI', 'DS', 'ECE', 'EE',
  '自动化/Robotics', 'Info System', 'Info Security',
  'CS交叉学科（bme等）', '其他电类学科（精仪等）',
  'Math/Stat', '其他理工科', '其他学科',
];

export const CS_COURSES = [
  '高等数学/微积分/数学分析', '离散数学', '线性代数', '概率论',
  '程序设计', '数据结构', '操作系统', '计算机网络',
  '体系结构/计算机组成', '软件工程', '数据库', '计算机科学导论',
];

export const GPA_SCALES = ['100', '4.0', '4.3', '5.0', '英制100', '德制1.0', '7', '其他'];
export const GPA_RANKS = ['1%', '3%', '5%', '10%', '15%', '20%', '30%', '40%', '50%', '50%+'];

export const REC_TAGS = [
  '科研推', '实习推', '全职工作推', '课程推', 'TA推', '暑研推',
  '黑推（提及缺点，或者量表评分给的太低，在30%甚至更低的推荐信）',
  '平推（模板推，或整体积极，但和学生没有过多交集，学生的工作比较trivial，无法言之有物地表扬）',
  '强推（和学生非常熟悉，言之有物地赞扬学生的工作；量表评分很高，评价为"该年最好"及以上）',
  '普通推（admission officer大概率不认识该推荐人）',
  '小牛推（小领域内较为知名的学者推荐，相同小领域的PhD学生和教授很可能认识该推荐人）',
  '大牛推（大领域内较为知名的学者推荐，相同大领域的PhD学生和教授很可能认识该推荐人）',
];

export const REC_TAGS_WITH_NONE = ['无', ...REC_TAGS];

export const RESULTS = ['Admit', 'Reject', 'Waitlist', '默拒', 'Withdraw'];
export const SEMESTERS = ['Fall', 'Spring', 'Winter', 'Summer'];
