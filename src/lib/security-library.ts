// 内置可监测证券库（ETF + 个股）
// 用户可在持仓管理中添加/删除

export interface SecurityInfo {
  id: string;          // 唯一 ID（如 csi300 / kweichow / 600519）
  code: string;        // 6位代码
  market: 'sh' | 'sz';
  secid: string;       // 东方财富 secid (1.sh / 0.sz)
  name: string;        // 简称
  fullName: string;    // 全称
  type: 'etf' | 'stock';
  category: string;    // 主题分类
  keywords: string[];  // 新闻关键词
}

// 内置 50+ ETF + 20+ 个股
export const SECURITY_LIBRARY: SecurityInfo[] = [
  // ===== 宽基 ETF =====
  { id: 'csi300', code: '510300', market: 'sh', secid: '1.510300', name: '沪深300ETF', fullName: '沪深300ETF华泰柏瑞', type: 'etf', category: '宽基', keywords: ['沪深300', '大盘', '蓝筹', '指数'] },
  { id: 'csi500', code: '510500', market: 'sh', secid: '1.510500', name: '中证500ETF', fullName: '中证500ETF南方', type: 'etf', category: '宽基', keywords: ['中证500', '中盘'] },
  { id: 'csi1000', code: '512100', market: 'sh', secid: '1.512100', name: '中证1000ETF', fullName: '中证1000ETF', type: 'etf', category: '宽基', keywords: ['中证1000', '小盘'] },
  { id: 'sse50', code: '510050', market: 'sh', secid: '1.510050', name: '上证50ETF', fullName: '上证50ETF', type: 'etf', category: '宽基', keywords: ['上证50', '蓝筹'] },
  { id: 'gem', code: '159915', market: 'sz', secid: '0.159915', name: '创业板ETF', fullName: '创业板ETF易方达', type: 'etf', category: '宽基', keywords: ['创业板', '成长'] },
  { id: 'star50', code: '588050', market: 'sh', secid: '1.588050', name: '科创50ETF', fullName: '科创50ETF华夏', type: 'etf', category: '宽基', keywords: ['科创板', '科技'] },

  // ===== 科技/AI =====
  { id: 'ai', code: '159819', market: 'sz', secid: '0.159819', name: '人工智能ETF', fullName: '人工智能ETF易方达', type: 'etf', category: '科技', keywords: ['人工智能', 'AI', '大模型', '算力'] },
  { id: 'chip', code: '159995', market: 'sz', secid: '0.159995', name: '芯片ETF', fullName: '芯片ETF华夏', type: 'etf', category: '科技', keywords: ['芯片', '半导体', '集成电路'] },
  { id: '5g', code: '515050', market: 'sh', secid: '1.515050', name: '5G通信ETF', fullName: '5G通信ETF', type: 'etf', category: '科技', keywords: ['5G', '通信', '基站'] },
  { id: 'cloud', code: '516510', market: 'sh', secid: '1.516510', name: '云计算ETF', fullName: '云计算ETF', type: 'etf', category: '科技', keywords: ['云计算', '云服务', '数据中心'] },
  { id: 'game', code: '516010', market: 'sh', secid: '1.516010', name: '游戏ETF', fullName: '游戏ETF', type: 'etf', category: '科技', keywords: ['游戏', '电竞', '元宇宙'] },
  { id: 'kwte', code: '562990', market: 'sh', secid: '1.562990', name: '科创信息技术ETF', fullName: '科创信息技术ETF', type: 'etf', category: '科技', keywords: ['科创', '信息技术'] },

  // ===== 新能源 =====
  { id: 'battery', code: '159755', market: 'sz', secid: '0.159755', name: '电池ETF', fullName: '电池ETF广发', type: 'etf', category: '新能源', keywords: ['电池', '新能源', '宁德', '锂电'] },
  { id: 'nev', code: '515030', market: 'sh', secid: '1.515030', name: '新能源车ETF', fullName: '新能源车ETF', type: 'etf', category: '新能源', keywords: ['新能源车', '电动车', '比亚迪'] },
  { id: 'pv', code: '515790', market: 'sh', secid: '1.515790', name: '光伏ETF', fullName: '光伏ETF', type: 'etf', category: '新能源', keywords: ['光伏', '太阳能', '隆基'] },
  { id: 'wind', code: '516190', market: 'sh', secid: '1.516190', name: '风电ETF', fullName: '风电ETF', type: 'etf', category: '新能源', keywords: ['风电', '风机', '海上风电'] },
  { id: 'carbon', code: '159790', market: 'sz', secid: '0.159790', name: '碳中和ETF', fullName: '碳中和ETF', type: 'etf', category: '新能源', keywords: ['碳中和', '环保', '绿色'] },

  // ===== 智能制造 =====
  { id: 'robot', code: '159559', market: 'sz', secid: '0.159559', name: '机器人ETF', fullName: '机器人ETF银华', type: 'etf', category: '智能制造', keywords: ['机器人', '人形', '智能制造'] },
  { id: 'military', code: '512660', market: 'sh', secid: '1.512660', name: '军工ETF', fullName: '军工ETF', type: 'etf', category: '智能制造', keywords: ['军工', '国防', '航天'] },
  { id: 'industry', code: '516050', market: 'sh', secid: '1.516050', name: '工业4.0ETF', fullName: '工业4.0ETF', type: 'etf', category: '智能制造', keywords: ['工业4.0', '智能制造', '工业互联网'] },

  // ===== 医药 =====
  { id: 'medicine', code: '512010', market: 'sh', secid: '1.512010', name: '医药ETF', fullName: '医药ETF', type: 'etf', category: '医药', keywords: ['医药', '医疗', '创新药'] },
  { id: 'innovation', code: '515120', market: 'sh', secid: '1.515120', name: '创新药ETF', fullName: '创新药ETF', type: 'etf', category: '医药', keywords: ['创新药', '生物医药', 'CRO'] },
  { id: 'medicalDevice', code: '159883', market: 'sz', secid: '0.159883', name: '医疗器械ETF', fullName: '医疗器械ETF', type: 'etf', category: '医药', keywords: ['医疗器械', '医疗设备'] },

  // ===== 消费 =====
  { id: 'consumption', code: '510150', market: 'sh', secid: '1.510150', name: '消费ETF', fullName: '消费ETF', type: 'etf', category: '消费', keywords: ['消费', '零售', '白酒'] },
  { id: 'food', code: '515170', market: 'sh', secid: '1.515170', name: '食品饮料ETF', fullName: '食品饮料ETF', type: 'etf', category: '消费', keywords: ['食品', '饮料', '白酒', '茅台'] },
  { id: 'liquor', code: '512690', market: 'sh', secid: '1.512690', name: '酒ETF', fullName: '酒ETF', type: 'etf', category: '消费', keywords: ['酒', '白酒', '啤酒'] },

  // ===== 金融 =====
  { id: 'finance', code: '512070', market: 'sh', secid: '1.512070', name: '非银金融ETF', fullName: '非银金融ETF', type: 'etf', category: '金融', keywords: ['证券', '保险', '金融'] },
  { id: 'bank', code: '512800', market: 'sh', secid: '1.512800', name: '银行ETF', fullName: '银行ETF', type: 'etf', category: '金融', keywords: ['银行', '金融'] },
  { id: 'realestate', code: '512200', market: 'sh', secid: '1.512200', name: '房地产ETF', fullName: '房地产ETF', type: 'etf', category: '金融', keywords: ['房地产', '地产'] },

  // ===== 红利/价值 =====
  { id: 'dividend', code: '510880', market: 'sh', secid: '1.510880', name: '红利ETF', fullName: '红利ETF', type: 'etf', category: '红利', keywords: ['红利', '高股息'] },
  { id: 'value', code: '510310', market: 'sh', secid: '1.510310', name: '价值ETF', fullName: '价值ETF', type: 'etf', category: '红利', keywords: ['价值', '低估值'] },

  // ===== 资源/周期 =====
  { id: 'gold', code: '518880', market: 'sh', secid: '1.518880', name: '黄金ETF', fullName: '黄金ETF', type: 'etf', category: '资源', keywords: ['黄金', '贵金属', '避险'] },
  { id: 'coal', code: '515220', market: 'sh', secid: '1.515220', name: '煤炭ETF', fullName: '煤炭ETF', type: 'etf', category: '资源', keywords: ['煤炭', '能源'] },
  { id: 'steel', code: '515210', market: 'sh', secid: '1.515210', name: '钢铁ETF', fullName: '钢铁ETF', type: 'etf', category: '资源', keywords: ['钢铁', '有色'] },
  { id: 'oil', code: '161129', market: 'sz', secid: '0.161129', name: '石油ETF', fullName: '石油ETF', type: 'etf', category: '资源', keywords: ['石油', '原油', '能源'] },

  // ===== 海外/跨境 =====
  { id: 'hk', code: '513180', market: 'sh', secid: '1.513180', name: '恒生科技ETF', fullName: '恒生科技ETF', type: 'etf', category: '海外', keywords: ['恒生', '港股', '腾讯'] },
  { id: 'us', code: '513100', market: 'sh', secid: '1.513100', name: '纳指ETF', fullName: '纳指ETF', type: 'etf', category: '海外', keywords: ['纳斯达克', '美股', '苹果'] },
  { id: 'japan', code: '513520', market: 'sh', secid: '1.513520', name: '日经ETF', fullName: '日经ETF', type: 'etf', category: '海外', keywords: ['日经', '日本', '东证'] },

  // ===== 主题/概念 =====
  { id: 'esg', code: '516630', market: 'sh', secid: '1.516630', name: 'ESG ETF', fullName: 'ESG ETF', type: 'etf', category: '主题', keywords: ['ESG', '可持续'] },
  { id: 'kaixin', code: '159939', market: 'sz', secid: '0.159939', name: '信息技术ETF', fullName: '信息技术ETF', type: 'etf', category: '科技', keywords: ['信息技术', 'TMT'] },

  // ===== 热门个股（蓝筹）=====
  { id: 'kweichow', code: '600519', market: 'sh', secid: '1.600519', name: '贵州茅台', fullName: '贵州茅台', type: 'stock', category: '白酒', keywords: ['茅台', '白酒', '高端白酒'] },
  { id: 'mengjie', code: '000858', market: 'sz', secid: '0.000858', name: '五粮液', fullName: '五粮液', type: 'stock', category: '白酒', keywords: ['五粮液', '白酒'] },
  { id: 'byd', code: '002594', market: 'sz', secid: '0.002594', name: '比亚迪', fullName: '比亚迪', type: 'stock', category: '新能源', keywords: ['比亚迪', '新能源车', '电池'] },
  { id: 'catl', code: '300750', market: 'sz', secid: '0.300750', name: '宁德时代', fullName: '宁德时代', type: 'stock', category: '新能源', keywords: ['宁德时代', '电池', '储能'] },
  { id: 'longi', code: '601012', market: 'sh', secid: '1.601012', name: '隆基绿能', fullName: '隆基绿能', type: 'stock', category: '新能源', keywords: ['隆基', '光伏', '太阳能'] },
  { id: 'mideagroup', code: '000333', market: 'sz', secid: '0.000333', name: '美的集团', fullName: '美的集团', type: 'stock', category: '消费', keywords: ['美的', '家电', '白色家电'] },
  { id: 'geli', code: '000651', market: 'sz', secid: '0.000651', name: '格力电器', fullName: '格力电器', type: 'stock', category: '消费', keywords: ['格力', '家电', '空调'] },

  // ===== 金融蓝筹 =====
  { id: 'icbc', code: '601398', market: 'sh', secid: '1.601398', name: '工商银行', fullName: '工商银行', type: 'stock', category: '银行', keywords: ['工行', '银行', '四大行'] },
  { id: 'ccb', code: '601939', market: 'sh', secid: '1.601939', name: '建设银行', fullName: '建设银行', type: 'stock', category: '银行', keywords: ['建行', '银行'] },
  { id: 'cmb', code: '600036', market: 'sh', secid: '1.600036', name: '招商银行', fullName: '招商银行', type: 'stock', category: '银行', keywords: ['招行', '银行', '零售银行'] },
  { id: 'pingan', code: '601318', market: 'sh', secid: '1.601318', name: '中国平安', fullName: '中国平安', type: 'stock', category: '保险', keywords: ['平安', '保险', '综合金融'] },
  { id: 'citic', code: '600030', market: 'sh', secid: '1.600030', name: '中信证券', fullName: '中信证券', type: 'stock', category: '证券', keywords: ['中信', '证券', '券商'] },

  // ===== 科技龙头 =====
  { id: 'dawo', code: '002415', market: 'sz', secid: '0.002415', name: '海康威视', fullName: '海康威视', type: 'stock', category: '科技', keywords: ['海康', '安防', 'AI'] },
  { id: 'luxshare', code: '002475', market: 'sz', secid: '0.002475', name: '立讯精密', fullName: '立讯精密', type: 'stock', category: '科技', keywords: ['立讯', '消费电子', '苹果链'] },
  { id: 'zgfh', code: '601138', market: 'sh', secid: '1.601138', name: '工业富联', fullName: '工业富联', type: 'stock', category: '科技', keywords: ['工业富联', '富士康', 'AI服务器'] },
  { id: 'xfh', code: '002230', market: 'sz', secid: '0.002230', name: '科大讯飞', fullName: '科大讯飞', type: 'stock', category: '科技', keywords: ['讯飞', 'AI', '语音'] },

  // ===== 医药龙头 =====
  { id: 'hengrui', code: '600276', market: 'sh', secid: '1.600276', name: '恒瑞医药', fullName: '恒瑞医药', type: 'stock', category: '医药', keywords: ['恒瑞', '创新药', '医药'] },
  { id: 'aisheng', code: '300015', market: 'sz', secid: '0.300015', name: '爱尔眼科', fullName: '爱尔眼科', type: 'stock', category: '医药', keywords: ['爱尔', '眼科', '医疗服务'] },

  // ===== 消费龙头 =====
  { id: 'moutai', code: '600519', market: 'sh', secid: '1.600519', name: '贵州茅台', fullName: '贵州茅台', type: 'stock', category: '白酒', keywords: ['茅台', '白酒'] },
  { id: 'yili', code: '600887', market: 'sh', secid: '1.600887', name: '伊利股份', fullName: '伊利股份', type: 'stock', category: '消费', keywords: ['伊利', '乳业', '食品'] },
];

export const SECURITY_BY_ID = Object.fromEntries(SECURITY_LIBRARY.map((s) => [s.id, s]));
export const SECURITY_BY_CODE = Object.fromEntries(SECURITY_LIBRARY.map((s) => [s.code, s]));

// 默认监测列表
export const DEFAULT_WATCHLIST = ['csi300', 'ai', 'chip', 'battery', 'robot'];

// 按分类分组
export const SECURITIES_BY_CATEGORY = SECURITY_LIBRARY.reduce((acc, s) => {
  if (!acc[s.category]) acc[s.category] = [];
  acc[s.category].push(s);
  return acc;
}, {} as Record<string, SecurityInfo[]>);
