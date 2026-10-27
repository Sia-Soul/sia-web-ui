import { useState } from "react";
import { Button, CursorPreview, Image, ImagePreview, ImagePreviewGroup, Space, Switch, Typography } from "@sia.soul/sia-react-ui";

/** 复用仓库自有位图，示例不依赖外部图片服务；帧引用固定以避免交互时重启动画。 */
const frames = [
  { src: "/examples/desktop-mark.png", duration: 650, hotspotX: 0.5, hotspotY: 0.5 },
  { src: "/examples/database-mark.png", duration: 650, hotspotX: 0.5, hotspotY: 0.5 },
];
const pictures = [
  { src: frames[0].src, alt: "Sia 桌面应用图标" },
  { src: frames[1].src, alt: "Sia 数据库应用图标" },
];

/** 演示帧播放、热点跟随、空态，以及自动分组和受控切图两种图片预览。 */
export function MediaExamples() {
  const [playing, setPlaying] = useState(true);
  const [following, setFollowing] = useState(true);
  const [hotspot, setHotspot] = useState(true);
  const [empty, setEmpty] = useState(false);
  const [devicePixels, setDevicePixels] = useState(false);
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(0);
  const [loaded, setLoaded] = useState(false);
  return <Space direction="vertical" style={{ width: "100%" }}>
    <Typography.Text>两张应用位图交替播放；移入预览区观察热点跟随。系统减少动态效果时使用静态首帧。</Typography.Text>
    <Space wrap>
      <Switch label="播放帧动画" checked={playing} onCheckedChange={setPlaying} />
      <Switch label="跟随指针" checked={following} onCheckedChange={setFollowing} />
      <Switch label="显示热点" checked={hotspot} onCheckedChange={setHotspot} />
      <Switch label="物理像素尺寸" checked={devicePixels} onCheckedChange={setDevicePixels} />
      <Switch label="清空预览帧" checked={empty} onCheckedChange={setEmpty} />
    </Space>
    <CursorPreview frames={empty ? [] : frames} size={devicePixels ? 128 : 64} sizeUnit={devicePixels ? "device" : "css"}
      playing={playing} followPointer={following} showHotspot={hotspot} height={220}
      empty={<Typography.Text>没有帧；关闭“清空预览帧”恢复演示。</Typography.Text>} alt="应用位图热点预览" />
    <Typography.Text>点击任意缩略图打开自动图片组，使用左右方向键切换。</Typography.Text>
    <ImagePreviewGroup>
      <Space>{pictures.map(picture => <Image key={picture.src} src={picture.src} alt={picture.alt} width={96} height={96}
        onLoad={() => setLoaded(true)} />)}</Space>
    </ImagePreviewGroup>
    <Typography.Text role="status">{loaded ? "图片加载成功，onLoad 已触发" : "等待图片加载"}</Typography.Text>
    <Button onClick={() => { setCurrent(0); setOpen(true); }}>打开受控图片预览</Button>
    {/* current、src、alt 同步回填，确保切图按钮与实际图片一致。 */}
    <ImagePreview open={open} onOpenChange={setOpen} current={current} count={pictures.length}
      onCurrentChange={setCurrent} src={pictures[current].src} alt={pictures[current].alt} />
  </Space>;
}
