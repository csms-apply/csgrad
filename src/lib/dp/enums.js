// Enum values for applicant + DP form fields. Mirrors the Seatable schema
// so historical data renders consistently in the new form.

// Selectable undergrad-school categories on the submit form.
// Note: '陆本' (generic "Mainland CN, other") was retired here so it can no
// longer be picked; its display label is kept in the page enum map so older
// rows already tagged '陆本' still render correctly.
export const UG_CATEGORIES = [
  '中外合办校（XJTLU等）', '陆本中外合办院系（JI/ZJUI等）',
  '清北', '华五', '国科/上科/南科', '10043', '985', '211',
  '双非', '美本', '加本', '英本', '澳本', '港本', '坡本', '欧陆本', '海本',
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
  '科研推', '实习推', '全职工作推', '课程推', 'TA推',
];

export const REC_TAGS_WITH_NONE = ['无', ...REC_TAGS];

export const RESULTS = ['Admit', 'Reject', 'Waitlist', '默拒', 'Withdraw'];
export const SEMESTERS = ['Fall', 'Spring', 'Winter', 'Summer'];
