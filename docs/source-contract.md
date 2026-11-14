# 来源资料约定

连续波形收件服务。现有功能归档单个已剪片段；台站网关以JSON返回已解码记录和校时声明，不声称实现完整miniSEED解码。

## 交互与身份

GET /event为剪好的单段；GET /waveforms?cursor=0返回records和next。每条含sourceIdentifier、recordId、startNs十进制字符串、intervalNs、samples、timeCorrectionNs、correctionApplied、timingQuality及replacementOf。时间为整数纳秒，不可用浮点秒损失精度；末样本时刻=start+(count-1)*interval；质量可为null。replacementOf只替代指定记录，不代表全通道清空。

## 外部变化

正常资料在 `fixtures/source.mjs`。同一来源可能处于这些外部阶段：replacement、uncertain。集成测试通过来源实例的`setPhase`切换外部状态，这不是线上业务接口。阶段内同一URL的响应可以改变，其余URL保留正常资料；来源的请求轨迹在实例的`requests`中可查，控制方法不对网络开放。未知地址返回404，非法请求返回非成功状态。

## 已有收件边界

当前`src/reader.mjs`只收取/event提供的已整理资料。归档按资料标识和内容摘要区分版本，原文按响应字节摘要独立存储，打开归档时逐份校验。来源文件、接收记录和对外查询不共享内存对象。未声明的协议能力不作推断；格式子集以本页和实际来源为准。
