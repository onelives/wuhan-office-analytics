# 原始数据与生成脚本

本目录保存 `data/tungee-companies.js` 和 `data/tungee-audit.js` 的上游素材。原始快照较大（解压后约 53 MB），因此以 gzip 形式入库，克隆仓库的体量保持在 3 MB 出头。

## 文件

| 文件 | 解压后 | 说明 |
| --- | --- | --- |
| `tungee-final-preview.json.gz` | 27 MB | 2026-09-12 的完整企业快照，`meta` 记录总计 20,294 条、名址双匹配 13,221 条、地址候选 7,073 条 |
| `tungee-geo-parts-01.json.gz` | 25 MB | 按注册详细地址分组的探迹原始记录，键为查询地址 |
| `tungee-audit-raw.json.gz` | 1.1 MB | 31 栋楼宇的核查原始结果 |
| `generate-tungee-companies.js` | 12 KB | 由原始快照生成 `data/tungee-companies.js` |
| `fix-tungee-scales.js` | 4 KB | 修正注册资本规模层级的补丁脚本 |

## 解压

```bash
cd raw
gunzip -k tungee-final-preview.json.gz tungee-geo-parts-01.json.gz tungee-audit-raw.json.gz
```

## 重新生成前端数据

```bash
node raw/generate-tungee-companies.js   # 生成 data/tungee-companies.js
node raw/fix-tungee-scales.js           # 修正规模层级
```

生成后本地打开 `index.html`，或运行 `python3 -m http.server` 后访问页面核对排名与楼内企业分析。

## 口径提醒

- 记录只包含企业名称、注册地址、登记状态、统一社会信用代码、成立日期、行业、规模层级与注册资本，不含法人、电话、邮箱等个人信息。
- 注册地址来自探迹，仅代表登记地址，不代表实际办公占用。
- 行业分类为名称关键词启发式结果，规模层级按注册资本区间计算，两者都不是企业质量评级。
- 该数据不参与楼宇评分，楼宇评分只由公开来源的五项信号构成。
