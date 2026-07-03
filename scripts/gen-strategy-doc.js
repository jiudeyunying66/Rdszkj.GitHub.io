// 生成 ETF 投资辅助系统策略总结 Word 文档
const {
  Document, Packer, Paragraph, TextRun, Header, Footer, PageBreak,
  AlignmentType, HeadingLevel, PageNumber, NumberFormat, SectionType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, TableLayoutType,
  TableOfContents, LevelFormat, convertInchesToTwip,
} = require("docx");
const fs = require("fs");

// 配色：金融投资 - Deep Blue Gold
const P = {
  primary: "0F2027",
  body: "000000",
  secondary: "4A6575",
  accent: "D4AF37",
  surface: "F5F7FA",
  bg: "0F2027",
  titleColor: "FFFFFF",
  subtitleColor: "B0B8C0",
  metaColor: "90989F",
  footerColor: "687078",
};

const c = (hex) => hex.replace("#", "");
const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

// 标题布局计算
function calcTitleLayout(title, maxWidthTwips, preferredPt = 36, minPt = 24) {
  const charWidth = (pt) => pt * 20;
  const charsPerLine = (pt) => Math.floor(maxWidthTwips / charWidth(pt));
  let titlePt = preferredPt;
  let lines;
  while (titlePt >= minPt) {
    const cpl = charsPerLine(titlePt);
    if (cpl < 2) { titlePt -= 2; continue; }
    lines = splitTitleLines(title, cpl);
    if (lines.length <= 3) break;
    titlePt -= 2;
  }
  if (!lines || lines.length > 3) {
    lines = splitTitleLines(title, charsPerLine(minPt));
    titlePt = minPt;
  }
  return { titlePt, titleLines: lines };
}

function splitTitleLines(title, cpl) {
  if (title.length <= cpl) return [title];
  const lines = [];
  let rem = title;
  while (rem.length > cpl) {
    lines.push(rem.slice(0, cpl));
    rem = rem.slice(cpl);
  }
  if (rem) lines.push(rem);
  return lines;
}

// 封面 R1
function buildCover() {
  const padL = 1200, padR = 800;
  const title = "ETF 投资辅助系统策略总结";
  const { titlePt, titleLines } = calcTitleLayout(title, 11906 - padL - padR - 300, 36, 24);
  const titleSize = titlePt * 2;
  const accentLeft = { style: BorderStyle.SINGLE, size: 8, color: P.accent, space: 12 };
  const children = [];

  children.push(new Paragraph({ spacing: { before: 3500 } }));

  // English label
  children.push(new Paragraph({
    indent: { left: padL, right: padR }, spacing: { after: 500 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: P.accent, space: 8 } },
    children: [new TextRun({ text: "ETF  INVESTMENT  STRATEGY  SUMMARY", size: 18, color: P.accent, font: { ascii: "Calibri", eastAsia: "SimHei" }, characterSpacing: 40 })],
  }));

  // Title
  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      indent: { left: padL },
      spacing: { after: i < titleLines.length - 1 ? 100 : 300, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
      children: [new TextRun({ text: titleLines[i], size: titleSize, bold: true, color: P.titleColor, font: { eastAsia: "SimHei", ascii: "Arial" } })],
    }));
  }

  // Subtitle
  children.push(new Paragraph({
    indent: { left: padL }, spacing: { after: 800 },
    children: [new TextRun({ text: "基于宏观信息与自动化监测的 ETF 投资辅助决策系统", size: 24, color: P.subtitleColor, font: { eastAsia: "Microsoft YaHei", ascii: "Arial" } })],
  }));

  // Meta
  const metaLines = [
    "系统版本：v4.0",
    "生成日期：2026-06-30",
    "文档类型：策略总结与系统说明",
    "适用范围：个人 ETF/个股投资辅助决策",
  ];
  for (const line of metaLines) {
    children.push(new Paragraph({
      indent: { left: padL + 200 }, spacing: { after: 80 },
      border: { left: accentLeft },
      children: [new TextRun({ text: line, size: 24, color: P.metaColor, font: { eastAsia: "Microsoft YaHei", ascii: "Arial" } })],
    }));
  }

  children.push(new Paragraph({ spacing: { before: 3000 } }));

  // Footer
  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: P.accent, space: 8 } },
    spacing: { before: 200 },
    children: [
      new TextRun({ text: "ETF 投资辅助系统", size: 16, color: P.footerColor, font: { ascii: "Arial" } }),
      new TextRun({ text: "                                        " }),
      new TextRun({ text: "Strategy Summary v4.0", size: 16, color: P.footerColor, font: { ascii: "Arial" } }),
    ],
  }));

  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: P.bg }, borders: noBorders,
        children,
      })],
    })],
  })];
}

// 标题
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 120 },
    children: [new TextRun({ text, bold: true, color: c(P.primary), font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 32 })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, color: c(P.primary), font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 28 })],
  });
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, bold: true, color: c(P.secondary), font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 24 })],
  });
}

// 正文
function p(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine: 480 },
    spacing: { line: 312, after: 60 },
    children: [new TextRun({ text, size: 24, color: c(P.body), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })],
  });
}

// 列表项
function li(text) {
  return new Paragraph({
    spacing: { line: 312, after: 40 },
    indent: { left: 600, hanging: 240 },
    children: [
      new TextRun({ text: "• ", size: 24, color: c(P.accent), bold: true }),
      new TextRun({ text, size: 24, color: c(P.body), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } }),
    ],
  });
}

// 表格单元格
function tc(text, isHeader = false) {
  return new TableCell({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { line: 276 },
      children: [new TextRun({ text: String(text), size: 20, bold: isHeader, color: isHeader ? "FFFFFF" : c(P.body), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })],
    })],
    shading: isHeader ? { type: ShadingType.CLEAR, fill: P.accent } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
  });
}

function table(headers, rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: P.accent },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: P.accent },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "D0D0D0" },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        tableHeader: true,
        cantSplit: true,
        children: headers.map((t) => tc(t, true)),
      }),
      ...rows.map((row) => new TableRow({
        cantSplit: true,
        children: row.map((t) => tc(t)),
      })),
    ],
  });
}

// ===== 正文内容 =====
const body = [];

// 第一章
body.push(h1("一、策略定位与目标"));
body.push(h2("1.1 策略定位"));
body.push(p("本系统是一套面向小资金积累期的 ETF/个股投资辅助决策工具，定位为「分析+汇报」型系统，不执行实际交易。系统以用户当前持仓（沪深300ETF、人工智能ETF、芯片ETF、电池ETF、机器人ETF）为基础，优先补强核心底仓，结合宏观信息动态调整策略参数，通过自动化监测、多模型预测、智能推荐与结构化报告辅助用户做出更理性的投资决策。"));
body.push(p("系统的核心设计理念是「监测而非操作」。所有功能模块——包括行情监测、宏观信息整合、ARIMA+LSTM 预测、策略规则触发、历史回测、智能选股推荐、报告生成——均为分析与建议，最终交易决策权完全由用户掌握。这种设计既保证了决策的透明性，又避免了自动化交易可能带来的不可控风险。"));

body.push(h2("1.2 策略目标"));
body.push(li("3个月内将沪深300ETF 持仓提升至 1000 股（核心底仓），占比总资金 40% 以上；"));
body.push(li("卫星仓位（AI/芯片/电池/机器人）以「攒筹码」为主，通过宏观信息优化加仓/止盈时机；"));
body.push(li("建立宏观信息与市场数据的关联分析，提升策略的前瞻性与抗风险能力；"));
body.push(li("通过历史回测验证策略规则的有效性，持续优化参数组合；"));
body.push(li("基于全市场扫描与多维度评分，提供智能选股推荐，辅助用户优化持仓结构。"));

// 第二章
body.push(h1("二、核心持仓与资金管理"));
body.push(h2("2.1 当前持仓配置"));
body.push(p("系统默认监测 5 只 ETF，覆盖宽基、科技、新能源、智能制造四大板块。用户可通过「参数设置」面板自由增减监测标的（内置 50+ ETF 与热门个股库），所有持仓参数（数量、成本价、加仓线、止盈线）均可在前端调整并持久化保存。"));
body.push(table(
  ["ETF名称", "代码", "基金公司", "持仓(股)", "成本价", "目标持仓", "类型"],
  [
    ["沪深300ETF", "510300", "华泰柏瑞", "200", "4.984", "1000", "核心底仓"],
    ["人工智能ETF", "159819", "易方达", "900", "2.112", "—", "卫星"],
    ["芯片ETF", "159995", "华夏", "300", "2.881", "—", "卫星"],
    ["电池ETF", "159755", "广发", "500", "1.117", "—", "卫星"],
    ["机器人ETF", "159559", "银华", "300", "1.470", "—", "卫星"],
  ]
));

body.push(h2("2.2 资金分配规则"));
body.push(p("资金分配遵循「核心+卫星+备用金」三层架构，确保底仓稳固的同时保留灵活操作空间。"));
body.push(table(
  ["类别", "用途", "占比要求", "说明"],
  [
    ["核心底仓", "沪深300ETF", "≥40%", "优先将资金集中用于沪深300ETF，目标持仓1000股（约5000元）"],
    ["卫星仓位", "AI/芯片/电池/机器人", "灵活", "维持500-1000股，以「攒筹码」为主，止盈操作简化"],
    ["备用金", "账户现金预留", "≥500元", "确保加仓/定投有资金，可在参数设置中调整"],
  ]
));

body.push(h2("2.3 总资产计算公式"));
body.push(p("系统采用透明的计算公式，用户可在 KPI 行点击「计算公式」折叠面板验证每一步计算："));
body.push(li("持仓市值 = Σ(持仓数 × 现价)"));
body.push(li("持仓成本 = Σ(持仓数 × 成本价)"));
body.push(li("账户现金 = 用户配置的备用金"));
body.push(li("总资产 = 持仓市值 + 账户现金"));
body.push(li("累计盈亏 = 持仓市值 - 持仓成本（与账户现金无关）"));
body.push(li("今日盈亏 = Σ(今日涨跌额 × 持仓数)"));

// 第三章
body.push(h1("三、宏观信息整合体系"));
body.push(h2("3.1 信息来源矩阵"));
body.push(p("系统接入 5 类权威信息源，按可靠性分级赋权，仅保留权重≥60%的信息进入分析流程。"));
body.push(table(
  ["来源类型", "具体渠道", "权重", "采集频率"],
  [
    ["官方权威", "央行/证监会/统计局/发改委官网直连", "90%", "实时"],
    ["财经媒体", "东方财富新闻搜索", "70%", "10分钟"],
    ["行业小众", "中信/中金研报", "50%", "每周"],
    ["地缘监测", "CSIS 地缘冲突数据库", "50%", "实时"],
    ["舆情情绪", "雪球/微博热搜", "30%", "实时"],
  ]
));

body.push(h2("3.2 多轮筛查与过滤"));
body.push(p("所有采集到的信息需经过四轮筛查，去除杂音后才能进入策略分析："));
body.push(li("来源验证：仅保留央行、证监会等权威渠道的信息（如「央行降息」需来自央行官网）；"));
body.push(li("时效性筛查：过滤超过7天的过时信息（如2023年政策）；"));
body.push(li("情绪分析：用关键词匹配分析信息情绪（正面/负面/中性），过滤极端情绪；"));
body.push(li("权重整合：按来源可靠性赋予权重（官方90%＞财经70%＞行业50%＞舆情30%），仅保留权重≥60%的信息。"));

body.push(h2("3.3 政府源直连实现"));
body.push(p("系统通过 HTML 解析直接抓取以下政府官网列表页，确保信息源权威可靠："));
body.push(li("中国人民银行（pbc.gov.cn）：公告/政策/新闻发布会"));
body.push(li("中国证监会（csrc.gov.cn）：要闻/监管动态/新闻发布会"));
body.push(li("国家统计局（stats.gov.cn）：GDP/CPI/PPI/PMI 等经济数据发布"));
body.push(li("国家发改委（ndrc.gov.cn）：产业政策/重大项目/投资计划"));
body.push(li("CSIS（csis.org）：地缘政治分析/中美关系/科技制裁"));

// 第四章
body.push(h1("四、自动化监测与汇报流程"));
body.push(h2("4.1 分时段监测"));
body.push(p("系统在每个交易日设置6个监测点，覆盖开盘、午盘、收盘前、盘后全时段，非工作日单独监测宏观突发事件。"));
body.push(table(
  ["监测点", "时间", "触发条件", "汇报内容"],
  [
    ["开盘后", "10:30", "ETF涨跌超阈值/宏观突发", "实时价格、涨跌幅、成交量变化"],
    ["午盘后", "14:00", "市场异常/宏观事件", "各ETF运行状态汇总"],
    ["收盘前", "14:30", "技术指标触发", "均线/MACD/KDJ指标分析"],
    ["收盘总结", "14:50", "自动触发", "当日总结+次日预测+操作建议"],
    ["盘后复盘", "16:30", "自动触发", "技术面深度分析+3日预测+策略建议"],
    ["非工作日", "10:00/16:00", "宏观突发", "事件详情及对开盘的潜在影响"],
  ]
));

body.push(h2("4.2 实时推送服务"));
body.push(p("系统通过 SSE（Server-Sent Events）实时推送 6 类事件到前端通知中心，每 30 秒检查一次异常，30 分钟去重："));
body.push(li("市场预警：ETF涨跌幅超4%、成交量异常放大（量比>1.5）"));
body.push(li("止盈提醒：持仓盈亏达止盈线，建议卖出整百股"));
body.push(li("加仓提醒：持仓盈亏跌破加仓线，建议分批建仓"));
body.push(li("宏观新闻：高影响政策/地缘事件推送"));
body.push(li("技术信号：KDJ超买(>100)/超卖(<0)、MACD金叉/死叉"));
body.push(li("系统通知：服务状态/异常处理"));

body.push(h2("4.3 异常处理与人工干预"));
body.push(table(
  ["异常场景", "处理逻辑", "通知方式"],
  [
    ["盘中数据延迟", "用缓存数据替代，标注「数据延迟」", "正常汇报"],
    ["预测模型误差", "用历史平均涨幅替代，标注「预测仅供参考」", "正常汇报"],
    ["重大地缘事件", "触发紧急汇报：暂停加仓，关注避险资产", "紧急推送（短信/APP）"],
  ]
));

// 第五章
body.push(h1("五、策略调整规则"));
body.push(h2("5.1 四类触发场景"));
body.push(p("系统基于宏观信息与市场数据，自动调整加仓线、止盈线、定投金额等策略参数。规则引擎实时监测新闻关键词，匹配到相关事件即激活对应规则。"));
body.push(table(
  ["宏观信息类型", "触发条件", "策略调整", "示例"],
  [
    ["政策利好", "产业扶持政策", "提高加仓线(-3%→-2%)、止盈线(8%→10%)", "国家投入1000亿支持AI"],
    ["地缘紧张", "重大地缘冲突", "暂停所有加仓、提前止盈", "某国限制芯片出口"],
    ["经济数据不及预期", "PMI<50", "降低定投金额、增加备用金", "5月PMI 49.8"],
    ["市场情绪过热", "情绪指数>80", "提高止盈比例、暂停加仓", "AI ETF必涨到100元热搜"],
  ]
));

body.push(h2("5.2 规则激活机制"));
body.push(p("每条规则基于真实新闻自动判断激活状态。系统扫描最近7天的新闻，匹配关键词后标记规则为「已激活」，并在面板显示激活原因与触发新闻标题。用户可直观看到哪些规则正在生效，以及生效的具体依据。"));

// 第六章
body.push(h1("六、预测分析模型"));
body.push(h2("6.1 ARIMA 模型"));
body.push(p("使用 statsmodels.tsa.arima.model.ARIMA 实现真实 ARIMA(p,d,q) 模型。通过 ADF 检验决定差分阶数 d（非平稳序列 d=1），AIC 自动定阶搜索 p、q（搜索空间 0-3），选择 AIC 最小的阶数组合。输出次日与未来3日预测，含 80%/95% 置信区间。"));
body.push(p("实测沪深300ETF：最优阶数 ARIMA(2,1,2)，AIC=-164.66，置信度 0.79。模型基于60日历史K线收盘价序列，适用于短期趋势外推。"));

body.push(h2("6.2 TensorFlow LSTM 模型"));
body.push(p("使用 tensorflow.keras.layers.LSTM 实现真实 LSTM 神经网络。模型架构：LSTM(32, return_sequences=True) → LSTM(16) → Dense(8) → Dense(1)，输入3特征滑动窗口[收益率, 振幅, 量变化]，窗口大小10日。Adam 优化器（learning_rate=0.005）+ 早停（patience=15）+ Dropout(0.1)。递归多步预测未来3日。"));
body.push(p("模型持久化：训练完成后缓存到 scripts/predict/cache/，缓存键基于 ETF id + K线末尾日期 + K线数量，12小时有效期。首次训练约5-10秒，缓存命中后仅需1-2秒，大幅提升响应速度。"));
body.push(p("回退机制：系统启动时检测 TensorFlow 是否可用，不可用时自动回退到 sklearn MLPRegressor（3层64-32-16，tanh激活）作为 LSTM proxy，确保预测功能始终可用。"));

body.push(h2("6.3 综合预测"));
body.push(p("按两模型各自置信度加权融合 ARIMA 与 LSTM 的预测结果，置信度越高权重越大。综合区间反映两种模型的共识，降低单一模型偏差风险。"));

// 第七章
body.push(h1("七、历史回测"));
body.push(h2("7.1 回测设计"));
body.push(p("系统拉取 5 只 ETF 250 日真实K线，回测最近 180 个交易日。策略规则包括：止盈线卖出整百股、加仓线买入100/200股、沪深300周一定投。基准为等权持有初始仓位不变（buy & hold）。"));
body.push(p("计算指标：总收益、年化收益、超额收益、夏普比率、最大回撤、年化波动率、胜率、交易次数。每只ETF单独统计交易次数、最终持仓、平均成本、盈亏。"));

body.push(h2("7.2 策略对比模式"));
body.push(p("支持4组策略参数横向对比，自动推荐最优策略（按夏普比率排序）："));
body.push(table(
  ["策略", "加仓线", "止盈线", "特点"],
  [
    ["保守策略", "-3%/-5%", "+8%", "触发少，风险低"],
    ["基准策略", "用户当前参数", "用户当前参数", "使用用户配置"],
    ["激进策略", "-1%/-3%", "+15%", "触发频繁，收益波动大"],
    ["只定投不加仓", "不触发", "不触发", "仅周定投，对照基准"],
  ]
));

// 第八章
body.push(h1("八、智能选股推荐"));
body.push(h2("8.1 推荐范围"));
body.push(p("系统内置 50+ 证券库（ETF + 个股），覆盖宽基、科技、新能源、智能制造、医药、消费、金融、红利、资源、海外、主题等11大分类。推荐以 ETF 为主、个股为辅，每小时扫描一次全市场（避免数据源压力）。"));

body.push(h2("8.2 多维度评分"));
body.push(p("每个证券按4个维度评分（基础分50，满分100）："));
body.push(table(
  ["维度", "评分逻辑", "分值"],
  [
    ["技术面", "多头排列(+10)/超卖反弹(+15)/RSI超卖(+10)/近5日强势(+5)", "0-30"],
    ["政策面", "新闻关键词匹配板块(+12/关键词)", "0-24"],
    ["资金面", "量比≥1.5放量(+10)/量比<0.5缩量(-3)", "-3~+10"],
    ["板块轮动", "近20日涨幅>5%板块强势(+5)", "0-5"],
  ]
));

body.push(h2("8.3 三类推荐输出"));
body.push(li("替换建议：找出 watchlist 中近20日表现最差的，推荐3个候选替换；"));
body.push(li("加入建议：Top 5 新证券，一键加入监测；"));
body.push(li("完整推荐列表：评分排序，含入场价/止损价(-7%)/目标价(+10%)/仓位建议/持有周期/推荐理由。"));

// 第九章
body.push(h1("九、技术架构"));
body.push(h2("9.1 技术栈"));
body.push(table(
  ["层级", "技术", "说明"],
  [
    ["前端", "Next.js 16 + TypeScript + Tailwind 4 + shadcn/ui + Recharts", "App Router, 8个Tab面板"],
    ["后端", "Next.js API Routes + Python 子进程", "SSE 推送, subprocess 调用"],
    ["数据源", "腾讯财经/ifzq/东方财富/央行/证监会/统计局/发改委/CSIS", "8类真实数据源"],
    ["预测模型", "statsmodels ARIMA + TensorFlow LSTM", "ADF定阶+Keras LSTM+缓存"],
    ["图表生成", "matplotlib + Noto Sans SC", "Base64 PNG 嵌入报告"],
    ["持久化", "localStorage + Prisma", "用户配置/推送状态"],
  ]
));

body.push(h2("9.2 数据源详情"));
body.push(table(
  ["数据类型", "来源", "刷新频率"],
  [
    ["实时行情", "腾讯财经 qt.gtimg.cn", "5秒"],
    ["历史K线", "腾讯 ifzq", "5分钟"],
    ["政府新闻", "央行/证监会/统计局/发改委官网直连", "15分钟"],
    ["财经新闻", "东方财富搜索", "10分钟"],
    ["地缘分析", "CSIS", "15分钟"],
    ["预测模型", "ARIMA + LSTM", "按需+12h缓存"],
    ["推送事件", "SSE 实时流", "30秒检查"],
    ["回测", "180日历史K线", "按需"],
    ["推荐", "30+证券多维度评分", "1小时"],
  ]
));

body.push(h2("9.3 8大功能模块"));
body.push(li("持仓管理：5只ETF详细持仓表+沪深300补仓进度+资金分配环形图"));
body.push(li("宏观信息流：27条官网直连新闻+东方财富聚合，按权威源分级标注"));
body.push(li("监测面板：6监测点时间轴+实时异常事件流+SSE推送"));
body.push(li("预测分析：ARIMA+TF LSTM真实模型+综合预测+60日K线走势图"));
body.push(li("策略规则：4类触发场景+基于真实新闻自动激活"));
body.push(li("历史回测：4策略对比+净值曲线+交易明细"));
body.push(li("智能推荐：30+证券扫描+替换/加入建议+完整推荐列表"));
body.push(li("汇报中心：Markdown/HTML导出+4张Base64图表嵌入+预览"));

// 第十章
body.push(h1("十、使用指南"));
body.push(h2("10.1 参数设置"));
body.push(p("点击右上角「参数设置」按钮，可在3个Tab中调整："));
body.push(li("持仓/监测管理：添加/移除 ETF 或个股（内置50+证券库，支持搜索/分类筛选）"));
body.push(li("资金管理：调整账户现金（备用金）、周定投金额"));
body.push(li("持仓参数：每只ETF的持仓数量、成本价、一级加仓线、二级加仓线、止盈线"));
body.push(p("所有修改实时生效并持久化到 localStorage，刷新页面不丢失。支持「重置默认」恢复策略文档原始参数。"));

body.push(h2("10.2 报告导出"));
body.push(p("在「汇报中心」Tab，选择报告类型（日报/收盘前总结/盘后复盘），支持三种操作："));
body.push(li("预览：在页面内查看完整 Markdown 报告内容"));
body.push(li("下载 .md：生成 Markdown 文件，可在 Typora/Obsidian/VSCode 中查看"));
body.push(li("下载 .html：生成 HTML 文件，浏览器打开后 Ctrl+P 可直接打印为 PDF"));
body.push(p("报告自动嵌入4张 Base64 图表（今日涨跌幅/资金分配/持仓盈亏/走势图），含真实数据，无需手动编辑。"));

body.push(h2("10.3 通知中心"));
body.push(p("右上角铃铛按钮打开通知中心，支持："));
body.push(li("实时 SSE 推送（无需刷新页面）"));
body.push(li("微信风格通知卡片（含来源/时间/情绪/关联ETF标签）"));
body.push(li("右下角桌面弹窗（6秒自动消失）"));
body.push(li("浏览器桌面通知授权（需用户手动允许）"));
body.push(li("历史通知查看与清空"));

// 第十一章
body.push(h1("十一、风险提示与免责声明"));
body.push(h2("11.1 策略局限性"));
body.push(li("本系统所有流程均为「分析+汇报」，不执行交易，投资决策需用户自行判断；"));
body.push(li("预测模型（ARIMA + LSTM）基于历史数据，未来表现不保证，存在模型误差；"));
body.push(li("宏观信息来自官网直连+东方财富搜索，已按权重分级，但无法保证100%准确；"));
body.push(li("历史回测结果不代表未来收益，市场存在不确定性；"));
body.push(li("智能推荐基于技术面+政策面+资金面评分，仅供参考，不构成投资建议；"));
body.push(li("数据源可能因网络波动或接口变更导致暂时不可用，系统已做容错处理。"));

body.push(h2("11.2 免责声明"));
body.push(p("本系统仅供学习研究使用，不构成任何投资建议。用户据此操作风险自担，系统开发者不承担任何因使用本系统而产生的直接或间接损失。投资有风险，入市需谨慎。"));
body.push(p("系统涉及的 ETF 与个股仅为示例，不代表推荐购买。用户应根据自身风险承受能力、投资目标、财务状况独立做出投资决策，必要时咨询专业投资顾问。"));

body.push(h2("11.3 数据来源声明"));
body.push(p("本系统数据来源包括：腾讯财经（实时行情）、腾讯 ifzq（历史K线）、东方财富（财经新闻）、央行/证监会/统计局/发改委官网（政策公告）、CSIS（地缘分析）。所有数据版权归原作者所有，本系统仅作信息整合与分析展示。"));

// ===== 组装文档 =====
const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, size: 24, color: c(P.body) },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 32, bold: true, color: c(P.primary) },
      },
      heading2: {
        run: { font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 28, bold: true, color: c(P.primary) },
      },
      heading3: {
        run: { font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 24, bold: true, color: c(P.secondary) },
      },
    },
  },
  sections: [
    // 封面
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 0, bottom: 0, left: 0, right: 0 },
        },
      },
      children: buildCover(),
    },
    // 目录
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
          pageNumbers: { start: 1, formatType: NumberFormat.LOWER_ROMAN },
        },
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: c(P.secondary) })],
          })],
        }),
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 480, after: 360 },
          children: [new TextRun({ text: "目  录", size: 36, bold: true, color: c(P.primary), font: { eastAsia: "SimHei" } })],
        }),
        new TableOfContents("Table of Contents", {
          hyperlink: true,
          headingStyleRange: "1-3",
        }),
        new Paragraph({
          spacing: { before: 200 },
          children: [new TextRun({ text: "（右键点击目录 → 「更新域」可刷新页码）", italics: true, size: 18, color: c(P.secondary) })],
        }),
        new Paragraph({ children: [new PageBreak()] }),
      ],
    },
    // 正文
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "ETF 投资辅助系统策略总结", size: 18, color: c(P.secondary) })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: c(P.secondary) })],
          })],
        }),
      },
      children: body,
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  const outPath = "/home/z/my-project/download/ETF投资辅助系统策略总结.docx";
  fs.writeFileSync(outPath, buf);
  console.log("✅ 文档已生成:", outPath);
  console.log("文件大小:", (buf.length / 1024).toFixed(1), "KB");
});
