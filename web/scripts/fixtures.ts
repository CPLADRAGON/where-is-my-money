// Sanitized (fake merchant names / order-ids) statement fixtures. These are the
// only committed data for this app — real bank files are gitignored. Keep the
// real column headers + encoding so parser coverage is faithful.

export const ALIPAY_FIXTURE = `支付宝交易记录明细查询
共2笔记录
支付宝账户：65-xxx
------------------------支付宝支付------------------------
交易时间,交易对方,对方账号,商品说明,收/支,金额,收/付款方式,交易状态,交易订单号,商家订单号,备注
2026-08-01 12:00:00,美团,sz@x,美团外卖订单,支出,105.79,花呗,交易成功,ORDER-100001,,
2026-08-24 06:00:00,余额宝,,余额宝-收益,不计收支,0.25,余额宝,交易成功,ORDER-100002,,`;

export const WECHAT_CSV_FIXTURE = `微信支付账单明细
微信昵称：[X]
----------------------微信支付
交易时间,交易类型,交易对方,商品,收/支,金额(元),支付方式,当前状态,交易单号,商户单号,备注
2026-08-15 18:23:34,商户消费,OCTOBOX,Powered by NETS,支出,8.40,零钱,支付成功,ORDER-200001,N2,/
2026-08-13 16:58:02,转账,钇龙,转账备注:祝儿子旅途愉快,收入,1666,,已存入零钱,ORDER-200002,,`;

export const MEITUAN_FIXTURE = `美团交易账单明细
共：16笔记录
【美团交易账单明细列表】
交易创建时间,交易成功时间,交易类型,订单标题,收/支,支付方式,订单金额,实付金额,交易单号,商家单号,备注
2026-08-13 17:17:10,2026-08-13 17:17:25,支付,袁记云饺-袁记云饺代金券,支出,美团月付,¥73.60,¥73.37,ORDER-300001,1M,/
2026-08-12 19:34:12,2026-08-12 19:34:20,支付,PHO THE ONE福万越南餐厅,支出,微信支付,¥72.00,¥71.95,ORDER-300002,1N,/`;

export const OCBC_FIXTURE = `Account details for: TEST
Transaction History
Transaction date,Value date,Description,Withdrawals(SGD),Deposits(SGD)
12/08/2026,12/08/2026,DEBIT PURCHASE  xx-1767 BK BURGER 313446,8.40,
12/08/2026,13/08/2026,GIRO - SALARY INFINEON,,3200.00`;

/** An OCBC statement showing a repayment to a BNPL issuer (the double-count target). */
export const OCBC_REPAY_FIXTURE = `Transaction History
Transaction date,Value date,Description,Withdrawals(SGD),Deposits(SGD)
20/08/2026,20/08/2026,MEITUAN,105.79,`;
