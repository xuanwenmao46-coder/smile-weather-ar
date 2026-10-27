# Smile Weather / 笑容天气

浏览器端 TikTok LIVE 概念原型：微笑下雨、大笑烟花，烟花粒子与实时头部代理碰撞反弹。独立笔试作品，非 TikTok 官方产品；留言、礼物与观众数据为本地模拟。

**Live Demo:** https://xuanwenmao46-coder.github.io/smile-weather-ar/

**Source Code (Public):** https://github.com/xuanwenmao46-coder/smile-weather-ar

## 运行与验证

Node.js 22+，无需 npm install、后端或 API Key。

```sh
npm start
# 打开 http://127.0.0.1:8017
npm test
```

也可将 dist 部署到 HTTPS 静态托管。手机请打开在线 HTTPS 链接；首次开启摄像头需等待模型加载。不请求麦克风。

## 验收路径

1. 开启摄像头，正对镜头保持自然表情完成校准。
2. 微笑：冷色雨幕出现，单侧透明泪痕沿外侧脸颊滑落，接近嘴角前消失。
3. 微笑同时张嘴笑开：暖色烟花出现；移动头部观察粒子沿碰撞法线反弹。仅张嘴不是大笑条件。
4. 张开手掌悬停并牵引雨幕；食指停留触发水波或小烟花。指尖烟花使用同一物理系统。
5. 关闭花园可单独检查核心特效。关闭摄像头返回明确标记的静态预览。
6. 点击试听检查音乐和实际电平；16秒短片为模拟演绎，不是识别准确性的证据。

## 设计取舍

人物表情为因，天气为果。冷雨与暖烟花互斥过渡，保留面部清晰区域。花园是可关闭的奖励层：初始无花，首次大笑解锁，随持续互动累积，最多24组。最后雨滴消失后才出现低饱和彩虹。解释文字放在主播面板，不覆盖特效画面。

## 工程与 ROI

- 原生 ES Modules + Canvas 2D，无服务端推理或按次生成成本。
- 人脸推理限频15Hz，慢帧降至10Hz；手部推理在 Worker，过期结果丢弃。
- 固定600粒子池；壳体、碰撞反馈队列有界；花草缓存25项。
- 物理采用移动屏幕空间椭圆、子步进及头部相对速度响应；不是3D头部网格刚体。
- 镜像与 cover 裁切统一映射；自然表情校准、160ms稳定时间和阈值滞回抑制抖动。
- Canvas宽度上限1000、DPR上限1.4；暂停、丢脸、关闭摄像头均有清理路径。
- 摄像头画面仅本地处理；保存画面必须由用户主动操作。

## 代码地图

| 文件 | 职责 |
|---|---|
| dist/app.js | 摄像头、表情状态、校准、音频及渲染调度 |
| dist/cinematic-effects.js | 粒子池、烟花及移动头部碰撞 |
| dist/garden-effects.js | 天气编排、植物层和动作音效 |
| dist/hand-input.js / hand-worker.js | 手部推理及异步结果清理 |
| dist/rain-control.js / fingertip.js | 手掌牵引与指尖触发 |
| dist/rain-tear.js | 面部局部坐标中的透明泪痕 |
| dist/interaction-audio.js | Web Audio解锁、音效及实际电平 |
| tests/ | 行为、物理、资源预算及生命周期回归 |

## 验证与边界

15个测试脚本通过，覆盖移动头部反弹、指尖共享碰撞、粒子和缓存上限、手势释放、镜像映射、花园门控、雨尽彩虹、摄像头取消/关闭、乐句连续性。Canvas桩测试不证明视觉质量，也不代表真实设备FPS。

本轮在Windows内置浏览器实际打开摄像头，确认人脸识别和手部模型就绪，再关闭返回预览；新配乐有非零实际音频电平。真人连续微笑/大笑识别准确率、弱光、遮挡、说话/哈欠误触发、iOS/Android长时负载仍需真人设备测试。

这是浏览器交互原型，不是已接入TikTok直播SDK的上线包。正式上线还需平台集成和移动设备矩阵验收。

## 素材署名

- Music: 'Reverie' by Scott Buckley — released under CC-BY 4.0. www.scottbuckley.com.au 。曲目 https://www.scottbuckley.com.au/library/reverie/ ，许可 https://creativecommons.org/licenses/by/4.0/ 。使用16秒节选，做淡入淡出和音量调整。发布录屏时将署名放入视频说明。
- 水声：Joseph Sardin / BigSoundBank，Sparkling water 0230，CC0。https://bigsoundbank.com/sparkling-water-s0230.html
- 示意人像：Unsplash https://images.unsplash.com/photo-1534528741775-53994a69daeb ，仅作预览，不表示人物背书。https://unsplash.com/license
- MediaPipe Tasks Vision 0.10.21：Google，Apache-2.0；模型来自官方 mediapipe-models 存储桶。第三方代码许可见 vendor 目录。
- 花草图集为本项目生成素材，其他动作音效为程序合成。第三方素材不随项目代码重新授权。
