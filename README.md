# 连续地震观测的采样时钟与质量接收

连续波形收件服务。现有功能归档单个已剪片段，并增加合作台站连续波形的本地归档；台站网关以JSON返回已解码记录和校时声明，不声称实现完整miniSEED解码。本服务只做资料接收、归档与连续性说明，不做地震预报，不生成告警结论。

## 运行

使用 Node.js 22，依赖由 package-lock.json 固定。安装后可执行：

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run demo
npm start
```

服务启动本地来源与收件接口，默认端口分别为4011和4010。`POST /collect` 领取当前单份资料；`POST /collect/continuous` 执行一次连续波形采集；`GET /records`查看结构化记录，`GET /segments`查看波形分段，`GET /continuity`查看连续性说明，`GET /receipts`查看原文凭据，`GET /health`查看服务状态。`PORT`、`SOURCE_PORT`与`DATA_DIR`可分别设置端口和归档目录。示例领取不会自动遍历其他来源资料。

```sh
docker build -t seismic-records .
docker run --rm --network none seismic-records npm test
docker run --rm --network none seismic-records npm run demo
docker run --rm -p 4010:4010 seismic-records
```

## 连续采集

`POST /collect/continuous` 从上次中断的游标（首次为起点）开始逐页领取 `/waveforms`，直到来源给出结束标记。每条记录按 台网.台站.位置码.通道 区分波形，与起始时刻、采样间隔、样本数、样本值和质量声明（timingQuality、timeCorrectionNs、correctionApplied）一起保存；时间为整数纳秒字符串，不使用浮点秒。

- 中途断连：已收取的分页先入库，断点游标持久化，响应为502并给出 `resumeCursor`；下次调用从断点继续，已归档分段不丢不重。
- 来源重发：内容相同记录按摘要去重；声明 `replacementOf` 的记录入库后，被替代分段标记 `supersededBy` 但保留原文，`GET /segments?all=1` 可复查替代关系。
- 每段记录带来源响应的凭据标识 `receipt`，`GET /receipts/<receiptId>` 可取回该段所在的原始响应字节，复查某段波形来自哪里。

## 连续性说明

`GET /continuity` 按 台网.台站.位置码.通道 与采样间隔分组核对当前有效分段（被替代的除外），只描述事实，不拼合数据：

- 同一采样率内相邻分段之间报告 `gaps`（缺口起止、时长、可整除时的缺失样本数）与 `overlaps`（重叠起止、时长、重叠样本数）。
- 不为拼成连续数组补值，不跨采样率边界合并或推算；采样率变化本身不构成缺口。
- 每段标注 `timeFlags`：`correction-pending` 表示来源声明了时刻修正但尚未应用，`quality-unknown` 表示计时质量未知；汇总在 `totals.uncertain`。

## 资料组织

`provider/`是独立本地来源，`fixtures/`记录合成资料和来源阶段，`src/reader.mjs`负责现有单份收件与连续分页收件，`src/continuity.mjs`负责连续性说明，`src/source.mjs`限定来源地址并记录响应字节，`src/archive.mjs`保存按摘要校验的原文、资料版本、波形分段与断点游标。`test/`覆盖现有收件、连续采集、来源边界、原文完整性和服务联通。运行不依赖外网、数据库服务或真实设备。

完整来源约定见 `docs/source-contract.md`。项目只访问本地合成资料，不携带真实身份、密钥或业务数据。

## 快速查看

`npm run demo`启动实际来源和收件服务、执行一次当前收件与连续采集并打印查询结果及凭据，临时归档在退出时清理。正常完成时间小于90秒；需要保留数据时用`npm start`及独立`DATA_DIR`。演示反映当前产品能力，不代表全部来源资料已被接纳。
