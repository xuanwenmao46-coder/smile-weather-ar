# Smile Weather / Garden 08 · 伸掌控雨与逐朵绽放

在 Garden 07 上增量修改。保留微笑下雨、大笑烟花、烟花与头部物理碰撞三项核心要求。

## 交互设计

| 输入/状态 | 反馈 | 退出与边界 |
| --- | --- | --- |
| 自然表情 | 人物与花枝，入场花朵逐个开放 | 不自动下雨 |
| 微笑 | 屏幕下雨，近中远三层 | 收回微笑停止生成新雨 |
| 张开手掌保持260ms | 雨滴约0.4秒减速，拉长的雨线转为水珠悬停 | 闭手持续160ms或手部丢失350–450ms后释放 |
| 移动手掌 | 邻近/前景水珠跟随更多，远景滞后更明显 | 有界位移，不把全部雨滴吸到一个点 |
| 松手 | 约0.7–1秒恢复原来的落雨速度 | 保留剩余寿命，避免瞬间消失或瞬移 |
| 大笑 | 烟花升空、爆发、下坠，头部碰撞反弹 | 控雨只影响雨滴，不冻结烟花 |
| 重看逐朵绽放 | 六处花朵沿两侧枝条错峰从花苞到盛开 | 不改变表情状态或粒子物理 |

入场绽放：每朵1.65秒，起始延迟为0、0.45、0.9、0.25、0.7、1.15秒。由六阶段AI预生成花朵素材交叉过渡并渐进生长；不以单张完整花图缩放冒充花瓣展开。蝴蝶在花朵展开后淡入。仍是二维阶段动画，不是连续三维花瓣模拟。

## 工程与成本

- 手部模型来自 Google MediaPipe HandLandmarker full float16，7,819,105字节，SHA256 fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1。
- 手部推理在 classic Worker 内运行；现有WASM加载器使用importScripts，因此不能使用module Worker。模块通过dynamic import加载。
- 最多8Hz调度、320px宽输入、单帧在途；不排队堆积。摄像头结束时终止Worker并清空状态。
- 模型失败只关闭手势增强，保留原表情雨/烟花。手部模型超时、推理超时和关闭开关均有提示。
- 本机识别，不录制、不上传画面。原人脸推理仍在主线程，整机性能仍需实测。
- 原600粒子池、固定花朵与蝴蝶数量继续生效；悬停时停止补充雨滴并暂停其寿命消耗。

## 验证证据与限制

node tests/test-cinematic.cjs、node tests/test-garden.mjs、node tests/test-rain-control.mjs通过。覆盖手掌开合几何、触发去抖、手部丢失、闭手释放、冻结稳定/寿命、上下左右牵引、释放下落、先伸掌再微笑、控雨不冻结烟花、花朵重播、人脸丢失和资源预算。

浏览器实际验证模拟伸掌、拖动牵引、松手恢复与逐朵开花。Worker模型用非人物植物图完成初始化和一次推理，返回无人手符合预期。这不代表真人手势精度或目标设备帧率已验收；真实手部遮挡、侧掌、快速运动仍待真人设备测试。

## 官方来源

https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js

https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/index

## 花朵素材（内置 ImageGen）

项目路径：dist/assets/peony-opening.png。透明3×2六阶段图集，用内置ImageGen生成，运行时不请求图像生成。

提示词：Create a botanical animation SPRITE SHEET, true transparent alpha background, 3 columns by 2 rows of equal SQUARE cells, total canvas landscape ratio 3:2. Exactly SIX images of the SAME single ivory-blush pink peony blossom, same front-facing three-quarter camera, same warm daylight, same petal colors and identity across all six stages. No grid, no text, no labels, no leaf, no stem, no bouquet, no other objects. Each flower entirely INSIDE its own cell with generous 18% empty margins and centered precisely. Read order left to right then next row: 1 very small tightly closed rounded green-pink flower bud, 2 pink bud just revealing pale folded petals, 3 partially opening cupped peony with outer petals unfolding, 4 half open peony with outer petals spread and center still cupped, 5 almost fully open delicate peony, 6 fully open lush airy peony with fine golden stamens visible. Keep physical growth gradual, stages 1 and 2 smaller than stages 5 and 6. Photoreal botanical fine art, detailed soft crumpled translucent petals, natural irregular folds, elegant romantic floral aesthetic. No opaque background or shadow plane. All six individual assets isolated, must never cross their cell boundaries. Not a collage of different flower species. This will be used for a believable opening animation in a live AR effect.
