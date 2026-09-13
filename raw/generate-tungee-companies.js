const fs = require("fs");
const path = require("path");
const vm = require("vm");

const repoRoot = path.resolve(__dirname, "..");
const raw = JSON.parse(
  fs.readFileSync(path.join(__dirname, "tungee-audit-raw.json"), "utf8")
);

const auditContext = { window: {} };
vm.runInNewContext(
  fs.readFileSync(path.join(repoRoot, "data", "tungee-audit.js"), "utf8"),
  auditContext
);
const audit = auditContext.window.TUNGEE_AUDIT;
const meta = auditContext.window.TUNGEE_META;
const compoundIds = Object.keys(raw.compoundScan).slice(0, 18);

const sourceRules = {
  poly: {
    source: raw.broadScan["保利国际中心"],
    pattern: /保利国际中心|关山大道330号|关山大道332号/
  },
  softwareCity: {
    source: raw.broadScan["武汉软件新城"],
    pattern: /武汉软件新城|花城大道8号|花城大道9号|山湖北路1号/
  }
};

const exactPatterns = {
  caad: /CAAD财富中心/,
  xiangyang: /襄阳大厦|中北路219号/,
  shipping: /长江航运中心|黄陂街18号/,
  merchants: /招商时代|和平大道977号/,
  "software-park": /光谷软件园|关山大道1号|关山一路特1号/,
  "financial-port": /金融港|光谷大道77号/,
  softwareCity: /武汉软件新城|花城大道8号|花城大道9号|山湖北路1号/,
  "changjiang-securities": /长江证券大厦|淮海路88号/
};

const fixedSourceIds = {
  softwareCity: "software-city"
};

const industryRules = [
  {
    label: "金融与投资",
    pattern: /银行|证券|期货|保险|基金|信托|金融|融资|投资|资本|资产管理|小额贷款|财富|担保|典当|交易所|理财/
  },
  {
    label: "医药与健康",
    pattern: /医药|医疗|生物|健康|诊所|门诊|医院|医美|口腔|康复|护理|体检|生命|药业|制药/
  },
  {
    label: "建筑与地产",
    pattern: /建筑|建设|工程|置业|房地产|物业|园林|市政|监理|测绘|装饰|装修|设计院|勘察|基建/
  },
  {
    label: "制造与能源",
    pattern: /制造|生产|装备|机械|材料|能源|电力|新能源|化工|环境|环保|碳|汽车|工业|重工|船舶|纺织|食品|家具|服饰|金属|建材|涂料|包装|机电|设备/
  },
  {
    label: "教育与社会组织",
    pattern: /教育|培训|学校|学院|大学|研究院|研究所|科研|商会|协会|工会|基金会|促进会|代表处|办事处|中心/
  },
  {
    label: "文化传媒与消费",
    pattern: /文化|传媒|广告|品牌|影视|艺术|酒店|餐饮|咖啡|旅行社|旅游|家政|百货|美容|美发|健身|体育|宠物|娱乐|设计/
  },
  {
    label: "贸易物流与电商",
    pattern: /贸易|商贸|物流|供应链|货运|运输|航运|进出口|电子商务|电商|销售|零售|经贸/
  },
  {
    label: "专业服务",
    pattern: /律师|咨询|管理|财税|税务|会计|审计|评估|人力资源|企业服务|众创|商务|公关|商标|知识产权|认证|检测/
  },
  {
    label: "科技与信息服务",
    pattern: /科技|信息|软件|网络|数据|智能|人工智能|互联网|云计算|电子|通信|半导体|芯片|数字|物联|自动化|光电|计算机|技术/
  }
];

const scaleOrder = [
  "1亿元以上",
  "1000万-1亿元",
  "500万-1000万",
  "100万-500万",
  "100万以下",
  "外币未折算",
  "未披露"
];

function normalizeKeyPart(value) {
  return String(value || "")
    .replace(/\s+/g, "")
    .replace(/[（）()·.,，、/\\-]/g, "")
    .toLowerCase();
}

function parseCapital(label) {
  const original = String(label || "").trim();
  if (!original || original === "--") {
    return {
      capitalWanCny: null,
      capitalType: "undisclosed",
      capitalLabel: original || "未披露"
    };
  }

  const compact = original.replace(/,/g, "").replace(/\s+/g, "");
  const match = compact.match(
    /^([\d.]+)(亿|万)?(人民币|元|美元|香港元|港币|港元|欧元|英镑|日元|新台币)?$/
  );

  if (!match) {
    return {
      capitalWanCny: null,
      capitalType: "other",
      capitalLabel: original
    };
  }

  const value = Number(match[1]);
  const multiplier = match[2] === "亿" ? 10000 : match[2] === "万" ? 1 : 0.0001;
  const currency = match[3] || "人民币";
  const isCny = /人民币|元/.test(currency);

  if (!Number.isFinite(value)) {
    return {
      capitalWanCny: null,
      capitalType: "other",
      capitalLabel: original
    };
  }

  if (!isCny) {
    return {
      capitalWanCny: null,
      capitalType: "foreign",
      capitalLabel: original
    };
  }

  return {
    capitalWanCny: Number((value * multiplier).toFixed(4)),
    capitalType: "cny",
    capitalLabel: original
  };
}

function getScale(capital) {
  if (capital.capitalType === "foreign") return "外币未折算";
  if (capital.capitalType !== "cny" || capital.capitalWanCny === null) return "未披露";
  if (capital.capitalWanCny >= 10000) return "1亿元以上";
  if (capital.capitalWanCny >= 1000) return "1000万-1亿元";
  if (capital.capitalWanCny >= 500) return "500万-1000万";
  if (capital.capitalWanCny >= 100) return "100万-500万";
  return "100万以下";
}

function getIndustry(name) {
  const rule = industryRules.find((item) => item.pattern.test(name));
  return rule ? rule.label : "其他";
}

function getEstablishedTime(value) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
}

function getSource(buildingId, auditItem) {
  if (compoundIds.includes(buildingId)) {
    return {
      source: raw.compoundScan[buildingId],
      pattern: null,
      mode: "楼名 + 门牌双条件"
    };
  }

  if (fixedSourceIds[buildingId]) {
    const override = sourceRules[fixedSourceIds[buildingId]];
    return {
      source: override.source,
      pattern: override.pattern,
      mode: "楼名检索"
    };
  }

  const override = sourceRules[buildingId];
  if (override) {
    return {
      source: override.source,
      pattern: override.pattern,
      mode: "楼名检索"
    };
  }

  return {
    source: raw.exactScan[buildingId],
    pattern: exactPatterns[buildingId] || null,
    mode: "门牌检索"
  };
}

const output = {};

Object.entries(audit).forEach(([buildingId, auditItem]) => {
  const sourceInfo = getSource(buildingId, auditItem);
  const source = sourceInfo.source;
  const eligible = auditItem.confidence !== "C" && auditItem.confidence !== "X";
  const rawCards = source && Array.isArray(source.cards) ? source.cards : [];
  const excluded = [];
  const unique = new Map();

  rawCards.forEach((card) => {
    if (!card || !card.name || !card.address) {
      excluded.push({ reason: "missing-field", card });
      return;
    }

    if (sourceInfo.pattern && !sourceInfo.pattern.test(card.address)) {
      excluded.push({ reason: "address-boundary", card });
      return;
    }

    const key = normalizeKeyPart(card.name) + "|" + normalizeKeyPart(card.address);
    if (!unique.has(key)) unique.set(key, card);
  });

  const records = eligible
    ? Array.from(unique.values()).map((card) => {
        const capital = parseCapital(card.cap);
        return {
          name: card.name,
          address: card.address,
          capitalWanCny: capital.capitalWanCny,
          capitalType: capital.capitalType,
          capitalLabel: capital.capitalLabel,
          established: card.est || "",
          industry: getIndustry(card.name),
          scale: getScale(capital)
        };
      })
    : [];

  records.sort((left, right) => {
    const leftRanked = left.capitalWanCny !== null;
    const rightRanked = right.capitalWanCny !== null;
    if (leftRanked !== rightRanked) return leftRanked ? -1 : 1;
    if (leftRanked && left.capitalWanCny !== right.capitalWanCny) {
      return right.capitalWanCny - left.capitalWanCny;
    }
    const establishedDiff =
      getEstablishedTime(left.established) - getEstablishedTime(right.established);
    if (establishedDiff !== 0) return establishedDiff;
    return left.name.localeCompare(right.name, "zh-CN");
  });

  let rank = 0;
  records.forEach((record) => {
    if (record.capitalWanCny !== null) {
      rank += 1;
      record.rank = rank;
    } else {
      record.rank = null;
    }
  });

  output[buildingId] = {
    confidence: auditItem.confidence,
    sourceQuery: auditItem.query,
    matchAddress: auditItem.matchAddress,
    total: auditItem.total,
    captured: auditItem.captured,
    recordCount: records.length,
    excludedCount: excluded.length,
    analysisEligible: eligible,
    sourceMode: sourceInfo.mode,
    coverageNote: eligible
      ? auditItem.confidence === "A"
        ? "当前查询条件的命中集合已完整采集。"
        : "当前仅采集审计批次中的前 " + records.length + " 条，不代表楼内全部注册企业。"
      : auditItem.confidence === "C"
        ? "现有命中属于项目范围或别名候选，未纳入主楼正式分析。"
        : "当前查询无有效结果，未纳入正式分析。",
    records
  };
});

const generated = [
  "window.TUNGEE_COMPANIES_META = " +
    JSON.stringify(
      {
        capturedAt: meta.capturedAt,
        source: meta.source,
        limitation:
          "注册地址记录不等同于实际办公租户；B级楼宇仅为当前审计批次的前50条。行业和规模层级由企业名称关键词、注册资本计算，属于分析分类，不是官方行业标签或企业质量评级。",
        industryMethod: "按企业名称关键词进行启发式分类。",
        scaleOrder,
        scaleLegend: {
          "1亿元以上": "注册资本折算后不低于 1 亿元人民币",
          "1000万-1亿元": "注册资本折算后不低于 1000 万元且低于 1 亿元人民币",
          "500万-1000万": "注册资本折算后不低于 500 万元且低于 1000 万元人民币",
          "100万-500万": "注册资本折算后不低于 100 万元且低于 500 万元人民币",
          "100万以下": "注册资本折算后低于 100 万元人民币",
          外币未折算: "登记为外币，当前不按汇率折算或参与排名",
          未披露: "快照未提供可用注册资本"
        }
      },
      null,
      2
    ) +
    ";\n\n" +
    "window.TUNGEE_COMPANIES = " +
    JSON.stringify(output, null, 2) +
    ";\n"
];

fs.writeFileSync(
  path.join(repoRoot, "data", "tungee-companies.js"),
  generated.join(""),
  "utf8"
);

const summary = Object.entries(output).map(([buildingId, item]) => ({
  buildingId,
  confidence: item.confidence,
  total: item.total,
  captured: item.captured,
  records: item.recordCount,
  excluded: item.excludedCount
}));
console.table(summary);
