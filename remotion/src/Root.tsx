import React from "react";
import { Composition } from "remotion";
import { MainVideo, FPS, WIDTH, HEIGHT, TOTAL_FRAMES } from "./MainVideo";
import { DemoVideo, FPS as DFPS, WIDTH as DW, HEIGHT as DH, TOTAL_FRAMES as DTF } from "./DemoVideo";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="main" component={MainVideo} durationInFrames={TOTAL_FRAMES} fps={FPS} width={WIDTH} height={HEIGHT} />
    <Composition id="demo" component={DemoVideo} durationInFrames={DTF} fps={DFPS} width={DW} height={DH} />
  </>
);
