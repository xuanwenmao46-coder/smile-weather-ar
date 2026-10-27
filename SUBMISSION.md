# 工程交付

## 1. Live Demo

https://xuanwenmao46-coder.github.io/smile-weather-ar/

开启摄像头并校准 → 微笑下雨 → 微笑同时张嘴笑开触发烟花 → 移动头部观察反弹。花园可关闭以单独验收核心效果。需要HTTPS和摄像头权限。

## 2. Source Code

https://github.com/xuanwenmao46-coder/smile-weather-ar

仓库权限：Public。

README包含本地运行、架构、性能预算、测试方式和授权信息；npm test运行全部回归。静态预览与测试桩不代表真人准确率。

## 3. Vibecoding复盘（不超过200字）

AI曾给出不存在的MediaPipe版本地址，导致摄像头可打开但识别模型无法加载。我将依赖锁定为已验证的0.10.21，改为本地托管模型与WASM，并补充加载失败、取消与关闭测试。核心Prompt：“不要猜版本或CDN地址；逐一验证依赖可下载，固定版本并本地托管；模型失败必须明确报错，不能用模拟画面冒充识别成功。”
