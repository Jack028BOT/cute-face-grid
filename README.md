# 萌系贴贴（cute-face-grid）

小红书「小工具」：上传/选择食物主体 + 波点底图 + 颜文字表情，合成为一张 1180×1180 方图，可保存到相册或发布笔记。主面板为 Y2K 复古 Win98 窗口风格，纯离线运行，符合小红书小工具容器规范（外置脚本、ES2017/Chrome 61 基线、端能力判空降级）。

## 目录结构

```
cute-face-grid/          小工具本体（打包对象，zip 根目录即该目录内容）
├── index.html           主面板（Y2K 复古窗口，样式内联，无内联脚本）
├── app.js               全部业务逻辑（经典外置脚本，含错误兜底）
├── assets.js            素材清单（由脚本自动生成，勿手工编辑）
├── icon.png             工具图标（512×512）
├── objects/             预置主体抠图 ×17（含杨桃/蓝莓/雪糕/布丁/啫喱等）
└── bg/                  预置波点底图 ×11

gen-cute-face-grid-manifest.py   扫描 stickers/ bg/ objects/ 重新生成 assets.js
prep-objects.py                  第一批主体入包：白底去除、裁边、缩放、量化
prep-objects2.py                 第三批主体入包（杨桃/蓝莓/雪糕/布丁/啫喱）
prep-bgs.py / prep-bgs2.py       波点底图缩放、量化入包（两批素材）
crop-bgs.py                      底图中心裁剪为正方形
gen-icon.py                      生成工具图标（蓝底波点 + 纸杯蛋糕 + ·ω·）
check-appjs.py                   app.js 括号配平粗检
```

## 功能一览

- 主体：17 款预置食物抠图，默认「原样 + 白色柔光」；也可上传自己的照片（圆形白边 / 填满 / 圆角渲染）
- 底图：7 款程序化波点 + 11 款预置底图 + 自主上传（最多保留 6 张）
- 表情：颜文字兜底 + 自主上传（最多保留 8 个），拖动定位、滑杆调大小、垃圾桶删除
- 其他：画笔撒星星、撤销栈、清空、预览缩放；菜单栏右侧独立「📤 导出图片」按钮
- 端能力：`writeTempFile → saveImageToPhotosAlbum` / `postNote`，判空降级；普通浏览器长按预览图保存

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
