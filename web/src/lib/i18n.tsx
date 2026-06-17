"use client";

import { useSyncExternalStore } from "react";

export type Lang = "en" | "zh";

const STORAGE_KEY = "mt-lang";
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function getSnapshot(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "zh") return saved;
    return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
  } catch {
    return "en";
  }
}
function getServerSnapshot(): Lang {
  return "en";
}

export function setLang(lang: Lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {}
  document.documentElement.setAttribute("lang", lang === "zh" ? "zh-CN" : "en");
  emit();
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Translation hook. Supports {name} interpolation. */
export function useT() {
  const lang = useLang();
  return (key: string, params?: Record<string, string | number>): string => {
    const table = DICT[lang] as Record<string, string>;
    let s = table[key] ?? (DICT.en as Record<string, string>)[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      }
    }
    return s;
  };
}

const EN = {
  "brand": "Where's My Money?",
  "nav.import": "Import",
  "nav.review": "Review",
  "nav.dashboard": "Dashboard",
  "nav.export": "Export",
  "nav.settings": "Settings",
  "footer.loaded": "{n} transactions loaded · stored only in your browser",
  "footer.private": "Your data never leaves your browser.",

  "import.title": "Turn your bank CSV into a clean money dashboard",
  "import.subtitle":
    "Import a statement, categorize spending into Needs / Wants / Savings, and see where your money goes. Everything runs locally — your data never leaves this browser.",
  "import.tryDemo": "Try demo data",
  "import.private": "100% private & offline",
  "import.parsing": "Reading and categorizing your transactions…",
  "import.importedN": "Imported {n} transactions from {bank}",
  "import.mergedSummary": "Added {added} · skipped {skipped} duplicates · {total} transactions across {months} months",
  "import.replaceExisting": "Replace existing data",
  "import.filesNeedMapping": "{n} file(s) need manual column mapping.",
  "import.detectedIncome": "Detected income:",
  "import.transfersExcluded": "{n} transfers excluded from spending",
  "import.reviewN": "Review {n} uncategorized",
  "import.reviewAll": "Review transactions",
  "import.skipDashboard": "Skip to dashboard",
  "import.guidesTitle": "Accepted formats & how to get your CSV",
  "import.guidesIntro":
    "OCBC is auto-detected. Any other bank works too — you'll map the columns once and we'll remember it.",
  "import.unknownFormat": "Unknown format?",
  "import.mapManually": "Map columns manually",
  "error.read": "Could not read that file. Please check it's a CSV export.",

  "stat.transactions": "Transactions",
  "stat.months": "Months",
  "stat.autocat": "Auto-categorized",
  "stat.needReview": "Need review",
  "step.imported": "Imported",
  "step.review": "Review",
  "step.dashboard": "Dashboard",

  "dashboard.title": "Dashboard",
  "range.all": "All months",
  "range.custom": "Custom range…",
  "card.income": "Income",
  "card.spent": "Spent",
  "card.saved": "Saved",
  "card.savingsRate": "Savings rate",
  "dash.savingsTargetNote": "target ≥ 20% of income",
  "dash.flowTitle": "Where your income went",
  "dash.flowExcludes":
    "Excludes {t} in transfers ({i} to savings/investments) — these are money moved, not spent.",
  "dash.flowExcludesShort":
    "Excludes {t} in transfers — these are money moved, not spent.",
  "budget.title": "50 / 30 / 20 — share of income",
  "th.bucket": "Bucket",
  "th.amount": "Amount",
  "th.actual": "Actual %",
  "th.target": "Target %",
  "th.status": "Status",
  "status.onTrack": "On track",
  "status.overBudget": "Over budget",
  "status.belowTarget": "Below target",
  "dash.noIncomeNote":
    "No income detected for this range — set it on the Settings tab so the percentages and savings rate are meaningful.",
  "chart.needsVsWants": "Spending: Needs vs Wants",
  "chart.actualVsTarget": "Actual vs target (% of income)",
  "chart.bySub": "Spending by sub-category",
  "chart.trend": "Monthly trend (income · spent · saved)",
  "bucket.Needs": "Needs",
  "bucket.Wants": "Wants",
  "bucket.Savings": "Savings",

  "empty.nothing": "Nothing to show yet",
  "empty.importPrompt": "Import a CSV to build your dashboard.",
  "btn.importFile": "Import a file",

  "review.title": "Review & categorize",
  "review.needN":
    "{n} still need a category. Recurring payees are remembered automatically.",
  "review.allDone": "Everything is categorized.",
  "review.showToReview": "Showing to-review",
  "review.showAll": "Show all",
  "review.rememberMerchant": "Remember merchant",
  "review.selectedN": "{n} selected →",
  "review.applyTo": "Apply to {n}",
  "review.clear": "Clear",
  "th.date": "Date",
  "th.description": "Description",
  "th.source": "Source",
  "th.category": "Category",
  "review.notSpending": "not spending",
  "review.emptyTitle": "No transactions yet",
  "review.emptyBody": "Import a CSV to start categorizing.",

  "settings.title": "Settings",
  "settings.targets": "Budget targets",
  "settings.targetsNote": "Baseline is 50% Needs / 30% Wants / 20% Savings.",
  "settings.income": "Monthly income",
  "settings.incomeNote": "Auto-detected from salary deposits. Override any month here.",
  "settings.noData": "No data imported yet.",
  "settings.remembered": "Remembered merchants ({n})",
  "settings.rememberedNote":
    "These payees auto-categorize on every import. Edit or remove them.",
  "settings.noMerchants": "None yet — tag a transaction with “Remember merchant” on to add one.",
  "settings.presets": "Saved bank presets ({n})",
  "settings.noPresets": "No custom column mappings saved yet.",
  "settings.dangerNote": "Clear all imported data, overrides, learned rules and presets.",
  "settings.clearAll": "Clear all data",
  "settings.confirm": "Are you sure?",
  "settings.yesDelete": "Yes, delete",
  "settings.cancel": "Cancel",

  "export.title": "Export",
  "export.dataFiles": "Data files",
  "export.shareCard": "Share card",
  "export.range": "Range",
  "export.include": "Include",
  "export.theme": "Theme",
  "export.light": "Light",
  "export.dark": "Dark",
  "export.downloadPng": "Download PNG",
  "export.emptyTitle": "Nothing to export yet",
  "metric.totals": "Income / Spent / Remaining",
  "metric.pillars": "Pillar split",
  "metric.top": "Top categories",
  "metric.targets": "Targets vs actual",
  "nav.transactions": "Transactions",
  "tx.resultCount": "{n} transactions",
  "tx.noMatch": "No transactions match these filters.",
  "filter.pillar": "Pillar",
  "filter.allPillars": "All pillars",
  "filter.sub": "Sub-category",
  "filter.allSubs": "All sub-categories",
  "filter.month": "Month",
  "filter.type": "Type",
  "filter.allTypes": "All types",
  "filter.spending": "Spending",
  "filter.transfer": "Transfers",
  "filter.needsReview": "Needs review",
  "filter.search": "Search",
  "filter.sort": "Sort",
  "filter.clear": "Clear",
  "sort.date_desc": "Newest first",
  "sort.date_asc": "Oldest first",
  "sort.amount_desc": "Largest first",
  "sort.amount_asc": "Smallest first",
  "dash.tapHint": "Tap a slice, bar, or row to view its transactions",
  "nav.recurring": "Recurring",
  "recurring.title": "Recurring",
  "recurring.monthlyCommitment": "~{amount} / month",
  "recurring.subsCount": "{n} subscriptions",
  "recurring.sectionSubs": "Subscriptions & bills",
  "recurring.sectionFrequent": "Frequent merchants",
  "recurring.cadence.Monthly": "Monthly",
  "recurring.cadence.Fortnightly": "Fortnightly",
  "recurring.cadence.Weekly": "Weekly",
  "recurring.cadence.Irregular": "Irregular",
  "recurring.nextExpected": "Next ~ {date}",
  "recurring.chargesOverMonths": "{count} charges · {months} months",
  "recurring.total": "Total {amount}",
  "recurring.empty": "Import at least 3 months of statements to see recurring charges.",
  "dash.recurringCard": "Recurring",
  "insights.title": "What changed",
  "insights.subtitle": "{cur} vs {prev}",
  "insights.spentMore": "You spent {amount} more than {prev}",
  "insights.spentLess": "You spent {amount} less than {prev}",
  "insights.spentSame": "Spending held steady vs {prev}",
  "insights.movers": "Biggest changes",
  "insights.biggest": "Top category this month: {sub} ({amount})",
  "insights.newSpend": "new",
  "insights.stopped": "stopped",
  "settings.budgets": "Category budgets",
  "settings.budgetsNote": "Optional monthly spending cap per category. Set to 0 for no limit.",
  "pillar.Fixed Needs": "Fixed Needs",
  "pillar.Variable Wants": "Variable Wants",
  "budgets.title": "Budget watch",
  "budgets.spentOfCap": "{spent} / {cap} per month",
  "budgets.over": "Over by {amount}",
  "budgets.left": "{amount} left",
  "budgets.overCount": "{n} over budget",
  "budgets.empty": "No budgets set yet — add caps in Settings.",
};

const ZH: Record<keyof typeof EN, string> = {
  "brand": "花哪了",
  "nav.import": "导入",
  "nav.review": "核对",
  "nav.dashboard": "仪表盘",
  "nav.export": "导出",
  "nav.settings": "设置",
  "footer.loaded": "已加载 {n} 笔交易 · 仅保存在本机浏览器",
  "footer.private": "你的数据只保存在本机浏览器，绝不上传。",

  "import.title": "把银行 CSV 变成清晰的记账仪表盘",
  "import.subtitle":
    "导入对账单，将支出归类为必要 / 想要 / 储蓄，看清钱花在哪里。全部在本地运行——数据绝不离开此浏览器。",
  "import.tryDemo": "试用示例数据",
  "import.private": "100% 私密 · 离线",
  "import.parsing": "正在读取并归类你的交易…",
  "import.importedN": "已从 {bank} 导入 {n} 笔交易",
  "import.mergedSummary": "新增 {added} · 跳过 {skipped} 条重复 · 共 {total} 笔，{months} 个月",
  "import.replaceExisting": "替换现有数据",
  "import.filesNeedMapping": "{n} 个文件需要手动映射列。",
  "import.detectedIncome": "检测到的收入：",
  "import.transfersExcluded": "{n} 笔转账已从支出中排除",
  "import.reviewN": "核对 {n} 笔未归类",
  "import.reviewAll": "核对交易",
  "import.skipDashboard": "直接看仪表盘",
  "import.guidesTitle": "支持的格式 & 如何获取 CSV",
  "import.guidesIntro":
    "OCBC 会自动识别。其他银行也可以——只需映射一次列，我们会记住它。",
  "import.unknownFormat": "格式无法识别？",
  "import.mapManually": "手动映射列",
  "error.read": "无法读取该文件，请确认它是 CSV 导出文件。",

  "stat.transactions": "交易数",
  "stat.months": "月份数",
  "stat.autocat": "已自动归类",
  "stat.needReview": "待核对",
  "step.imported": "已导入",
  "step.review": "核对",
  "step.dashboard": "仪表盘",

  "dashboard.title": "仪表盘",
  "range.all": "全部月份",
  "range.custom": "自定义区间…",
  "card.income": "收入",
  "card.spent": "支出",
  "card.saved": "结余",
  "card.savingsRate": "储蓄率",
  "dash.savingsTargetNote": "目标 ≥ 收入的 20%",
  "dash.flowTitle": "你的收入去向",
  "dash.flowExcludes":
    "不含 {t} 转账（其中 {i} 转入储蓄/投资）——这些是资金转移，并非消费。",
  "dash.flowExcludesShort":
    "不含 {t} 转账——这些是资金转移，并非消费。",
  "budget.title": "50 / 30 / 20 — 占收入比例",
  "th.bucket": "类别",
  "th.amount": "金额",
  "th.actual": "实际 %",
  "th.target": "目标 %",
  "th.status": "状态",
  "status.onTrack": "达标",
  "status.overBudget": "超支",
  "status.belowTarget": "未达标",
  "dash.noIncomeNote":
    "此区间未检测到收入——请在“设置”中填写，百分比和储蓄率才有意义。",
  "chart.needsVsWants": "支出：必要 vs 想要",
  "chart.actualVsTarget": "实际 vs 目标（占收入比例）",
  "chart.bySub": "按子类别的支出",
  "chart.trend": "每月趋势（收入 · 支出 · 结余）",
  "bucket.Needs": "必要",
  "bucket.Wants": "想要",
  "bucket.Savings": "储蓄",

  "empty.nothing": "暂无可显示的内容",
  "empty.importPrompt": "导入 CSV 以生成仪表盘。",
  "btn.importFile": "导入文件",

  "review.title": "核对与归类",
  "review.needN": "还有 {n} 笔需要归类。重复的收款方会被自动记住。",
  "review.allDone": "所有交易都已归类。",
  "review.showToReview": "只看待核对",
  "review.showAll": "显示全部",
  "review.rememberMerchant": "记住商家",
  "review.selectedN": "已选 {n} 笔 →",
  "review.applyTo": "应用到 {n} 笔",
  "review.clear": "清除",
  "th.date": "日期",
  "th.description": "描述",
  "th.source": "来源",
  "th.category": "类别",
  "review.notSpending": "非消费",
  "review.emptyTitle": "暂无交易",
  "review.emptyBody": "导入 CSV 开始归类。",

  "settings.title": "设置",
  "settings.targets": "预算目标",
  "settings.targetsNote": "基准为 50% 必要 / 30% 想要 / 20% 储蓄。",
  "settings.income": "每月收入",
  "settings.incomeNote": "根据工资入账自动检测。可在此覆盖任意月份。",
  "settings.noData": "尚未导入数据。",
  "settings.remembered": "已记住的商家（{n}）",
  "settings.rememberedNote": "这些收款方会在每次导入时自动归类。可编辑或删除。",
  "settings.noMerchants": "暂无——在交易上开启“记住商家”即可添加。",
  "settings.presets": "已保存的银行模板（{n}）",
  "settings.noPresets": "尚未保存自定义列映射。",
  "settings.dangerNote": "清除所有已导入数据、覆盖、学习规则和模板。",
  "settings.clearAll": "清除所有数据",
  "settings.confirm": "确定吗？",
  "settings.yesDelete": "确认删除",
  "settings.cancel": "取消",

  "export.title": "导出",
  "export.dataFiles": "数据文件",
  "export.shareCard": "分享卡片",
  "export.range": "区间",
  "export.include": "包含",
  "export.theme": "主题",
  "export.light": "浅色",
  "export.dark": "深色",
  "export.downloadPng": "下载 PNG",
  "export.emptyTitle": "暂无可导出的内容",
  "metric.totals": "收入 / 支出 / 结余",
  "metric.pillars": "类别占比",
  "metric.top": "主要类别",
  "metric.targets": "目标 vs 实际",
  "nav.transactions": "交易",
  "tx.resultCount": "{n} 笔交易",
  "tx.noMatch": "没有符合筛选条件的交易。",
  "filter.pillar": "类别",
  "filter.allPillars": "全部类别",
  "filter.sub": "子类别",
  "filter.allSubs": "全部子类别",
  "filter.month": "月份",
  "filter.type": "类型",
  "filter.allTypes": "全部类型",
  "filter.spending": "消费",
  "filter.transfer": "转账",
  "filter.needsReview": "待核对",
  "filter.search": "搜索",
  "filter.sort": "排序",
  "filter.clear": "清除",
  "sort.date_desc": "最新优先",
  "sort.date_asc": "最早优先",
  "sort.amount_desc": "金额从高到低",
  "sort.amount_asc": "金额从低到高",
  "dash.tapHint": "点击扇区、柱条或行即可查看对应交易",
  "nav.recurring": "定期",
  "recurring.title": "定期支出",
  "recurring.monthlyCommitment": "约 {amount} / 月",
  "recurring.subsCount": "{n} 项订阅",
  "recurring.sectionSubs": "订阅与账单",
  "recurring.sectionFrequent": "常用商家",
  "recurring.cadence.Monthly": "每月",
  "recurring.cadence.Fortnightly": "每两周",
  "recurring.cadence.Weekly": "每周",
  "recurring.cadence.Irregular": "不定期",
  "recurring.nextExpected": "下次约 {date}",
  "recurring.chargesOverMonths": "{count} 笔 · {months} 个月",
  "recurring.total": "合计 {amount}",
  "recurring.empty": "导入至少 3 个月的对账单即可查看定期支出。",
  "dash.recurringCard": "定期",
  "insights.title": "变化概览",
  "insights.subtitle": "{cur} 对比 {prev}",
  "insights.spentMore": "比 {prev} 多花了 {amount}",
  "insights.spentLess": "比 {prev} 少花了 {amount}",
  "insights.spentSame": "与 {prev} 持平",
  "insights.movers": "变化最大的类别",
  "insights.biggest": "本月最大类别：{sub}（{amount}）",
  "insights.newSpend": "新增",
  "insights.stopped": "停止",
  "settings.budgets": "类别预算",
  "settings.budgetsNote": "可为每个类别设置每月支出上限。设为 0 表示不限制。",
  "pillar.Fixed Needs": "固定必要",
  "pillar.Variable Wants": "弹性想要",
  "budgets.title": "预算监控",
  "budgets.spentOfCap": "每月 {spent} / {cap}",
  "budgets.over": "超出 {amount}",
  "budgets.left": "剩余 {amount}",
  "budgets.overCount": "{n} 项超支",
  "budgets.empty": "尚未设置预算 — 可在设置中添加上限。",
};

const DICT: Record<Lang, Record<string, string>> = { en: EN, zh: ZH };
