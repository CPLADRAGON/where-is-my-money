import {
  DEFAULT_CATEGORY,
  SAVINGS_DEFAULT,
  TRANSFER_DEFAULT,
  type Pillar,
} from "./taxonomy";
import type { Provenance } from "./types";

/**
 * Merchant-text rules ported from build_tracker.py. First match wins; matched
 * case-insensitively against the whitespace-normalized description.
 */
const RULES: { re: RegExp; pillar: Pillar; sub: string }[] = [
  { re: /BUS\/MRT|CAUSEWAYLINK|GOPAY|GOJEK|GRAB|COMFORTDELGRO|SMRT|TRANSITLINK/i, pillar: "Fixed Needs", sub: "Transport" },
  { re: /SHENG SIONG|NTUC|FAIRPRICE|NTUC FP|GIANT|COLD STORAGE|GOURMET PARADISE|7-ELEVEN|7 ELEVEN|KK MART|KK SUPER|99 SPEEDMART|CHEERS|PRIME SUPER/i, pillar: "Fixed Needs", sub: "Basic Groceries" },
  { re: /SP SERVICES|SP SVCS|SINGTEL|STARHUB|M1 |MYREPUBLIC|CIRCLES\.LIFE|SINGTEL PREPAID|PUB /i, pillar: "Fixed Needs", sub: "Utilities" },
  { re: /INSURANCE|AIA|PRUDENTIAL|GREAT EASTERN|NTUC INCOME|MANULIFE/i, pillar: "Fixed Needs", sub: "Insurance" },
  { re: /RENT|RENTAL|ACCOMMODATION|HOSTEL|LANDLORD/i, pillar: "Fixed Needs", sub: "Accommodation/Rent" },
  { re: /STRIPE|NETFLIX|SPOTIFY|YOUTUBE|ICLOUD|APPLE\.COM|GOOGLE \*|OPENAI|CHATGPT|ADOBE|MICROSOFT|AMAZON PRIME|DISNEY/i, pillar: "Variable Wants", sub: "Subscriptions" },
  { re: /BURGER KING|MCDONALD|KFC|STARBUCKS|COFFEE|CAFE|KOPITIAM|FOODPANDA|DELIVEROO|ASIAN ROTISSERIE|IRON CHEF|A KITCHEN|CHOCOLICIOUS|RESTAURANT|EATERY|F&B|BAKERY|TOAST|BUBBLE|DESSERT|HAWKER|FOOD|DELIGHT|TECHNO EDGE|KITCHEN|HWANG/i, pillar: "Variable Wants", sub: "Dining Out/Cafes" },
  { re: /SHOPEE|LAZADA|UNIQLO|H&M|MALL|WATSON|GUARDIAN|DAISO|MUJI|DECATHLON|POPULAR|CHALLENGER|COURTS/i, pillar: "Variable Wants", sub: "Shopping" },
  { re: /CATHAY|GOLDEN VILLAGE|GV |SHAW|CINEMA|KARAOKE|KTV|ARCADE|STEAM /i, pillar: "Variable Wants", sub: "Entertainment/Hobbies" },
  { re: /AIRLINE|AIRASIA|SCOOT|SINGAPORE AIRLINES|HOTEL|AGODA|BOOKING\.COM|EXPEDIA|KLOOK|AIRBNB/i, pillar: "Variable Wants", sub: "Travel" },
  // Chinese merchants (WeChat / Alipay / Meituan) — specific-first, then broad.
  { re: /充电宝|租借|免押|共享充电/, pillar: "Variable Wants", sub: "Shopping" },
  { re: /话费|中国移动|中国联通|中国电信|水费|电费|燃气|宽带|网费|流量充值|话费充值/, pillar: "Fixed Needs", sub: "Utilities" },
  { re: /超市|便利店|生鲜|水果|蔬菜|菜场|全家|牛奶|粮油|纯净水|矿泉水|天猫超市/, pillar: "Fixed Needs", sub: "Basic Groceries" },
  { re: /滴滴|高德|地铁|公交|哈啰|打车|出租车|共享单车|骑行|停车|泊车|过路|高速|ETC|加油|充电桩|京[A-Z]|先乘后付|出行|武汉地铁/, pillar: "Fixed Needs", sub: "Transport" },
  { re: /博物馆|故宫|博物院|影院|电影|唱吧|KTV|歌厅|酒馆|酒吧|密室|沉浸|桌游|剧本|剧场|演出|美术馆|展览|汤泉|温泉|洗浴|汗蒸|足疗|按摩|乐园|网吧|游戏/, pillar: "Variable Wants", sub: "Entertainment/Hobbies" },
  { re: /腾讯视频|爱奇艺|优酷|网易云|QQ音乐|哔哩哔哩|喜马拉雅|芒果TV|百度网盘|WPS|会员|DeepSeek|API/i, pillar: "Variable Wants", sub: "Subscriptions" },
  { re: /外卖|美团|饿了么|星巴克|喜茶|瑞幸|麦当劳|肯德基|茶百道|蜜雪冰城|火锅|烧烤|烤肉|炙子|奶茶|餐厅|餐饮|美食|小吃|面馆|拉面|面条|云饺|水饺|饺子|馄饨|云吞|比萨|披萨|汉堡|麻辣|烤鱼|驴肉|灌饼|炒饭|盖浇|快餐|夜宵|甜品|咖啡|面包|蔡林记|尊宝|袁记|佟爷|饭馆|菜馆|食府|熟食/, pillar: "Variable Wants", sub: "Dining Out/Cafes" },
  { re: /拼多多|淘宝|京东|天猫|唯品会|得物|优衣库|无印良品|奥特莱斯|奥莱|旗舰店|专卖|商场|百货|连锁|商业|服装|衣物|服饰|上衣|衫|短袖|外套|裤子|鞋|袜|帽|包|配饰|数码|手机|家电|文具|书店|冲印|相框|照片|神券|优惠券|券|烟|酒/, pillar: "Variable Wants", sub: "Shopping" },
  { re: /携程|去哪儿|飞猪|同程|酒店|民宿|机票|航空|机场|火车票|高铁|12306|铁路|旅游|景区|门票|免税|中免|往返|度假|旅行/, pillar: "Variable Wants", sub: "Travel" },
];

/** Investment / savings platforms — money here is a transfer, not spending. */
const INVESTMENT_RE =
  /SYFE|ENDOWUS|STASHAWAY|FSMONE|FUNDSUPERMART|MOOMOO|FUTU|TIGER BROKERS|INTERACTIVE BROKERS|\bIBKR\b|WEBULL|SAXO|POEMS|DBS INVEST|REGULAR SAVINGS|FIXED DEPOSIT|\bSSB\b|SINGAPORE SAVINGS BOND|CPF|SRS|GIGANTIQ|SINGLIFE/i;

/**
 * Detect a transfer (money moved, not spent). Returns a category or null.
 * - Investment/savings platforms -> Savings / Investment.
 * - Person-to-person PayNow/FAST transfers (to a person, via Mobile) -> Personal Transfer.
 */
export function detectTransfer(description: string): { pillar: Pillar; sub: string } | null {
  if (INVESTMENT_RE.test(description)) return SAVINGS_DEFAULT;

  const d = description.toUpperCase();
  // Person-to-person heuristics: mobile PayNow / "Transfer - Mobile" / fund transfer
  // to a named individual. UEN payments are businesses → treated as spending.
  const looksP2P =
    /PAYNOW-MOBILE/.test(d) ||
    /TRANSFER\s*-\s*MOBILE/.test(d) ||
    (/(FAST PAYMENT|FUND TRANSFER|PAYMENT\/TRANSFER)/.test(d) &&
      /\bTO\s+[A-Z]/.test(d) &&
      !/PAYNOW-UEN/.test(d));
  if (looksP2P) return TRANSFER_DEFAULT;
  return null;
}

export interface CategoryResult {
  pillar: Pillar;
  sub: string;
  provenance: Provenance;
}

/**
 * Categorize a transaction using precedence:
 * manual override -> learned merchant rule -> spending RULES -> transfer
 * detection -> default (Variable Wants / Shopping).
 */
export function categorize(
  description: string,
  merchantKey: string,
  opts: {
    overrides?: Record<string, { pillar: Pillar; sub: string }>;
    learned?: Record<string, { pillar: Pillar; sub: string }>;
    fingerprint?: string;
  } = {}
): CategoryResult {
  const { overrides, learned, fingerprint } = opts;

  if (fingerprint && overrides?.[fingerprint]) {
    const o = overrides[fingerprint];
    return { pillar: o.pillar, sub: o.sub, provenance: "manual" };
  }
  if (merchantKey && learned?.[merchantKey]) {
    const l = learned[merchantKey];
    return { pillar: l.pillar, sub: l.sub, provenance: "learned" };
  }
  for (const rule of RULES) {
    // Match on the description OR the counterparty/merchant key — for Chinese
    // sources the real merchant lives in 交易对方 (counterparty), not 商品说明.
    if (rule.re.test(description) || (merchantKey && rule.re.test(merchantKey))) {
      return { pillar: rule.pillar, sub: rule.sub, provenance: "rule" };
    }
  }
  const transfer = detectTransfer(description) || (merchantKey ? detectTransfer(merchantKey) : null);
  if (transfer) {
    return { pillar: transfer.pillar, sub: transfer.sub, provenance: "rule" };
  }
  return {
    pillar: DEFAULT_CATEGORY.pillar,
    sub: DEFAULT_CATEGORY.sub,
    provenance: "default",
  };
}

/**
 * Derive a clean payee key from noisy bank text so recurring merchants/people
 * collapse to the same key. Strips transfer noise, card masks, ref numbers.
 */
export function merchantKeyFrom(description: string): string {
  let s = description.toUpperCase();

  // Pull out the human/merchant name in "to NAME" / "from NAME" transfers.
  const toFrom = s.match(/\b(?:TO|FROM)\s+([A-Z][A-Z .'&-]{2,40})/);
  if (toFrom) {
    s = toFrom[1];
  }

  s = s
    .replace(/VIA PAYNOW[-\w]*/g, " ")
    .replace(/PAYNOW[-\w]*/g, " ")
    .replace(/\bOTHR\b[-\w]*/g, " ")
    .replace(/\bBEXP\b|\bCHAR\b/g, " ")
    .replace(/\bXX-\d+\b/g, " ") // card masks like xx-1767
    .replace(/\b\d{4,}\b/g, " ") // long ref numbers
    .replace(/\bSGD?\b|\bMYR\b/g, " ")
    .replace(/\bDEBIT PURCHASE\b|\bFAST PAYMENT\b|\bFUND TRANSFER\b|\bPAYMENT\/TRANSFER\b|\bNETS QR\b|\bBILL PAYMENT\b|\bINB\b/g, " ")
    .replace(/[^A-Z0-9一-鿿 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Keep it to the first few significant words.
  return s.split(" ").slice(0, 4).join(" ");
}
