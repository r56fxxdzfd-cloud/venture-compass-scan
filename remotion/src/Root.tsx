import React from "react";
import { Composition } from "remotion";
import { MainVideo, FPS, WIDTH, HEIGHT, TOTAL_FRAMES } from "./MainVideo";
import { DemoVideo, FPS as DFPS, WIDTH as DW, HEIGHT as DH, TOTAL_FRAMES as DTF } from "./DemoVideo";
import { DemoVideoB2B, FPS as B2FPS, WIDTH as B2W, HEIGHT as B2H, TOTAL_FRAMES as B2TF } from "./DemoVideoB2B";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="main" component={MainVideo} durationInFrames={TOTAL_FRAMES} fps={FPS} width={WIDTH} height={HEIGHT} />
    <Composition id="demo" component={DemoVideo} durationInFrames={DTF} fps={DFPS} width={DW} height={DH} />
    <Composition id="demo-b2b" component={DemoVideoB2B} durationInFrames={B2TF} fps={B2FPS} width={B2W} height={B2H} />
  </>
);
