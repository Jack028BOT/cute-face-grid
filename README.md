# 萌系贴贴（cute-face-grid）

小红书「小工具」：上传/选择食物主体 + 波点底图 + 颜文字表情，合成为一张 1180×1180 方图，可保存到相册或发布笔记。主面板为 Y2K 复古 Win98 窗口风格，纯离线运行，符合小红书小工具容器规范（外置脚本、ES2017/Chrome 61 基线、端能力判空降级）。

## 目录结构

```
cute-face-grid/          小工具本体（打包对象，zip 根目录即该目录内容）
├── index.html           主面板（Y2K 复古窗口，样式内联，无内联脚本）
├── app.js               全部业务逻辑（经典外置脚本，含错误兜底）
├── assets.js            素材清单（由脚本自动生成，勿手工编辑）
├── icon.png             工具图标（512×512）
├── objects/             预置主体抠图 ×12
└── bg/                  预置波点底图 ×11

gen-cute-face-grid-manifest.py   扫描 stickers/ bg/ objects/ 重新生成 assets.js
prep-objects.py                  处理主体抠图：白底去除、裁边、缩放、量化入包
prep-bgs.py / prep-bgs2.py       波点底图缩放、量化入包（两批素材）
crop-bgs.py                      底图中心裁剪为正方形
gen-icon.py                      生成工具图标（蓝底波点 + 纸杯蛋糕 + ·ω·）
check-appjs.py                   app.js 括号配平粗检
```

## 常用操作

补素材后重新打包：

```bash
# 1. 把新素材放进对应目录（英文文件名：png/jpg/webp/gif/svg）
#    表情 → cute-face-grid/stickers/  底图 → cute-face-grid/bg/  主体 → cute-face-grid/objects/
python gen-cute-face-grid-manifest.py

# 2. 以工具目录为工作目录压缩（index.html 必须在 zip 根目录）
python -c "import os,zipfile; d='cute-face-grid'; z=zipfile.ZipFile('cute-face-grid.zip','w',zipfile.ZIP_DEFLATED,compresslevel=9); [z.write(os.path.join(r,f),os.path.relpath(os.path.join(r,f),d).replace(os.sep,'/')) for r,ds,fs in os.walk(d) for f in sorted(fs)]; z.close()"
```

本地预览：

```bash
cd cute-face-grid && python -m http.server 8631
# 浏览器打开 http://127.0.0.1:8631/index.html
# 普通浏览器中 window.xhs 不会注入，保存/发布按钮走降级提示
```

## 注意

- 维护脚本里的输入/输出均为本机绝对路径，换机器使用时需先修改路径。
- 上线前用小红书小工具上传页的最新校验流程复核；仓库内不含构建产物 `cute-face-grid.zip`。
