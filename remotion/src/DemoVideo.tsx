import React from "react";
import {
  AbsoluteFill,
  Img,
  Audio,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Sequence,
} from "remotion";
import { loadFont as loadHeading } from "@remotion/google-fonts/SpaceGrotesk";
import { loadFont as loadBody } from "@remotion/google-fonts/DMSans";

const heading = loadHeading("normal", { weights: ["500", "700"], subsets: ["latin"] });
const body = loadBody("normal", { weights: ["400", "500"], subsets: ["latin"] });
const HEADING = heading.fontFamily;
const BODY = body.fontFamily;

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

const NAVY = "#0a0f1f";
const NAVY_2 = "#101a33";
const GREEN = "#4ade80";
const PURPLE = "#a78bfa";
const WHITE = "#ffffff";
const DIM = "rgba(255,255,255,0.65)";

// Scenes: 8 scenes, 30s total at 30fps = 900 frames
// Durations chosen to match narration cadence
const SCENES: { d: number; c: string; [k: string]: any }[] = [
  { d: 90, c: "logo" }, // 0-90: Darwin logo (3s)
  { d: 90, c: "hook" }, // 90-180: Pergunta (3s)
  { d: 120, c: "shot", img: "dashboard.png", title: "Diagnóstico em minutos", sub: "Avalie a maturidade da operação", focus: { x: 0.55, y: 0.45, z: 1.08 } }, // 180-300 (4s)
  { d: 120, c: "shot", img: "report-1.png", title: "Relatório executivo", sub: "Score, confiança e narrativa", focus: { x: 0.5, y: 0.4, z: 1.05 }, highlight: { x: 0.04, y: 0.3, w: 0.55, h: 0.28, label: "Score consolidado" } }, // 300-420 (4s)
  { d: 120, c: "shot", img: "report-radar.png", title: "9 Dimensões", sub: "Atual · Benchmark · Potencial", focus: { x: 0.5, y: 0.5, z: 1.05 } }, // 420-540 (4s)
  { d: 120, c: "split", imgs: ["report-redflags.png", "report-matrix.png"], title: "Riscos e prioridades", sub: "Red Flags + Matriz Risco × Impacto" }, // 540-660 (4s)
  { d: 120, c: "shot", img: "report-pauta.png", title: "Plano acionável", sub: "Quick wins · Pauta · Roadmap", focus: { x: 0.55, y: 0.5, z: 1.05 }, highlight: { x: 0.04, y: 0.32, w: 0.92, h: 0.55, label: "Próximos passos" } }, // 660-780 (4s)
  { d: 120, c: "outro" }, // 780-900 (4s)
];

export const TOTAL_FRAMES = SCENES.reduce((s, x) => s + x.d, 0); // 900

// ---------- background ----------
const AuroraBg: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  return (
    <AbsoluteFill style={{ background: NAVY, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: -200,
          background: `radial-gradient(55% 45% at ${30 + Math.sin(t * 0.5) * 12}% ${40 + Math.cos(t * 0.4) * 12}%, rgba(74,222,128,0.22), transparent 60%), radial-gradient(48% 38% at ${72 + Math.cos(t * 0.55) * 10}% ${62 + Math.sin(t * 0.45) * 10}%, rgba(167,139,250,0.22), transparent 60%)`,
          filter: "blur(50px)",
        }}
      />
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, rgba(10,15,31,0.25), rgba(10,15,31,0.7))` }} />
    </AbsoluteFill>
  );
};

// ---------- chrome ----------
const Chrome: React.FC<{ title: string; sub: string; sceneFrame: number; sceneDur: number; index: number }> = ({ title, sub, sceneFrame, sceneDur, index }) => {
  const { fps } = useVideoConfig();
  const inSpring = spring({ frame: sceneFrame, fps, config: { damping: 18, stiffness: 140 } });
  const out = interpolate(sceneFrame, [sceneDur - 12, sceneDur], [1, 0], { extrapolateLeft: "clamp" });
  const op = inSpring * out;
  const ty = interpolate(inSpring, [0, 1], [30, 0]);
  return (
    <>
      <div style={{ position: "absolute", top: 40, left: 60, right: 60, display: "flex", alignItems: "center", justifyContent: "space-between", opacity: op }}>
        <Img src={staticFile("images/logo.png")} style={{ height: 48, width: "auto" }} />
        <div style={{ color: DIM, fontFamily: BODY, fontSize: 18, letterSpacing: 3, textTransform: "uppercase" }}>
          {String(index + 1).padStart(2, "0")} · Darwin
        </div>
      </div>
      <div style={{ position: "absolute", left: 60, right: 60, bottom: 70, opacity: op, transform: `translateY(${ty}px)` }}>
        <div style={{ display: "inline-block", padding: "8px 18px", borderRadius: 999, background: "rgba(74,222,128,0.14)", color: GREEN, fontFamily: BODY, fontSize: 18, letterSpacing: 2, textTransform: "uppercase" }}>
          Diagnóstico Darwin
        </div>
        <div style={{ marginTop: 16, color: WHITE, fontFamily: HEADING, fontWeight: 700, fontSize: 76, lineHeight: 1, letterSpacing: -1 }}>{title}</div>
        <div style={{ marginTop: 12, color: DIM, fontFamily: BODY, fontSize: 26, lineHeight: 1.3, maxWidth: 1200 }}>{sub}</div>
      </div>
    </>
  );
};

// ---------- shot ----------
const Shot: React.FC<{ img: string; focus: { x: number; y: number; z: number }; highlight?: any; sceneFrame: number; sceneDur: number }> = ({ img, focus, highlight, sceneFrame, sceneDur }) => {
  const stageW = 1480;
  const stageH = 640;
  const stageX = (WIDTH - stageW) / 2;
  const stageY = 150;
  const { fps } = useVideoConfig();
  const s = spring({ frame: sceneFrame, fps, config: { damping: 22, stiffness: 130 } });
  const out = interpolate(sceneFrame, [sceneDur - 10, sceneDur], [1, 0], { extrapolateLeft: "clamp" });
  const op = s * out;
  const ty = interpolate(s, [0, 1], [40, 0]);
  const z = interpolate(sceneFrame, [0, sceneDur], [focus.z, focus.z + 0.06]);
  return (
    <div
      style={{
        position: "absolute",
        left: stageX,
        top: stageY,
        width: stageW,
        height: stageH,
        borderRadius: 20,
        overflow: "hidden",
        boxShadow: "0 60px 140px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)",
        background: NAVY_2,
        opacity: op,
        transform: `translateY(${ty}px)`,
      }}
    >
      <div style={{ position: "absolute", inset: 0, transformOrigin: `${focus.x * 100}% ${focus.y * 100}%`, transform: `scale(${z})` }}>
        <Img src={staticFile(`images/${img}`)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }} />
      </div>
      {highlight && <Highlight {...highlight} sceneFrame={sceneFrame} sceneDur={sceneDur} />}
    </div>
  );
};

const Highlight: React.FC<{ x: number; y: number; w: number; h: number; label: string; sceneFrame: number; sceneDur: number }> = ({ x, y, w, h, label, sceneFrame, sceneDur }) => {
  const a = interpolate(sceneFrame, [16, 28], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) * interpolate(sceneFrame, [sceneDur - 14, sceneDur - 4], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <>
      <div style={{ position: "absolute", left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%`, border: `3px solid ${GREEN}`, boxShadow: `0 0 0 6px rgba(74,222,128,0.18), 0 0 70px rgba(74,222,128,0.5)`, borderRadius: 14, opacity: a }} />
      <div style={{ position: "absolute", left: `${x * 100}%`, top: `calc(${y * 100}% - 44px)`, padding: "6px 14px", background: GREEN, color: NAVY, fontFamily: BODY, fontWeight: 500, fontSize: 18, borderRadius: 8, opacity: a }}>{label}</div>
    </>
  );
};

// ---------- split (two screenshots) ----------
const Split: React.FC<{ imgs: string[]; sceneFrame: number; sceneDur: number }> = ({ imgs, sceneFrame, sceneDur }) => {
  const { fps } = useVideoConfig();
  const stageW = 700;
  const stageH = 640;
  const top = 150;
  const gap = 40;
  const totalW = stageW * 2 + gap;
  const startX = (WIDTH - totalW) / 2;
  const out = interpolate(sceneFrame, [sceneDur - 10, sceneDur], [1, 0], { extrapolateLeft: "clamp" });
  return (
    <>
      {imgs.map((src, i) => {
        const s = spring({ frame: sceneFrame - i * 8, fps, config: { damping: 22, stiffness: 130 } });
        const op = s * out;
        const tx = interpolate(s, [0, 1], [i === 0 ? -60 : 60, 0]);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: startX + i * (stageW + gap),
              top,
              width: stageW,
              height: stageH,
              borderRadius: 20,
              overflow: "hidden",
              boxShadow: "0 50px 120px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)",
              background: NAVY_2,
              opacity: op,
              transform: `translateX(${tx}px)`,
            }}
          >
            <Img src={staticFile(`images/${src}`)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }} />
          </div>
        );
      })}
    </>
  );
};

// ---------- logo scene ----------
const LogoScene: React.FC<{ sceneFrame: number; sceneDur: number }> = ({ sceneFrame, sceneDur }) => {
  const { fps } = useVideoConfig();
  const s = spring({ frame: sceneFrame, fps, config: { damping: 12, stiffness: 110 } });
  const sub = spring({ frame: sceneFrame - 18, fps, config: { damping: 18, stiffness: 100 } });
  const op = interpolate(sceneFrame, [sceneDur - 14, sceneDur], [1, 0], { extrapolateLeft: "clamp" });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: op }}>
      <div style={{ transform: `scale(${0.6 + s * 0.4})`, opacity: s }}>
        <Img src={staticFile("images/logo.png")} style={{ width: 780, height: "auto" }} />
      </div>
      <div style={{ marginTop: 36, opacity: sub, transform: `translateY(${(1 - sub) * 20}px)` }}>
        <div style={{ color: GREEN, fontFamily: BODY, fontSize: 24, letterSpacing: 6, textTransform: "uppercase", textAlign: "center" }}>
          Diagnóstico que vira ação
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- hook scene ----------
const HookScene: React.FC<{ sceneFrame: number; sceneDur: number }> = ({ sceneFrame, sceneDur }) => {
  const { fps } = useVideoConfig();
  const s = spring({ frame: sceneFrame, fps, config: { damping: 16, stiffness: 130 } });
  const op = interpolate(sceneFrame, [sceneDur - 12, sceneDur], [1, 0], { extrapolateLeft: "clamp" });
  const ty = interpolate(s, [0, 1], [40, 0]);
  return (
    <AbsoluteFill style={{ alignItems: "flex-start", justifyContent: "center", padding: 120, opacity: op }}>
      <div style={{ opacity: s, transform: `translateY(${ty}px)` }}>
        <div style={{ color: PURPLE, fontFamily: BODY, fontSize: 22, letterSpacing: 5, textTransform: "uppercase", marginBottom: 24 }}>
          Pergunta
        </div>
        <div style={{ color: WHITE, fontFamily: HEADING, fontWeight: 700, fontSize: 130, lineHeight: 1.02, letterSpacing: -2, maxWidth: 1400 }}>
          Sua startup está pronta <span style={{ color: GREEN }}>para escalar?</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- outro ----------
const OutroScene: React.FC<{ sceneFrame: number; sceneDur: number }> = ({ sceneFrame, sceneDur }) => {
  const { fps } = useVideoConfig();
  const s = spring({ frame: sceneFrame, fps, config: { damping: 14, stiffness: 110 } });
  const sub = spring({ frame: sceneFrame - 18, fps, config: { damping: 18, stiffness: 100 } });
  const url = spring({ frame: sceneFrame - 32, fps, config: { damping: 18, stiffness: 100 } });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ transform: `scale(${0.85 + s * 0.15})`, opacity: s }}>
        <Img src={staticFile("images/logo.png")} style={{ width: 820, height: "auto" }} />
      </div>
      <div style={{ marginTop: 44, color: WHITE, fontFamily: HEADING, fontWeight: 500, fontSize: 40, textAlign: "center", letterSpacing: -0.5, opacity: sub, maxWidth: 1400, transform: `translateY(${(1 - sub) * 18}px)` }}>
        Conselhos coletivos que aceleram o crescimento.
      </div>
      <div style={{ marginTop: 24, padding: "10px 22px", borderRadius: 999, background: "rgba(74,222,128,0.15)", color: GREEN, fontFamily: BODY, fontSize: 22, letterSpacing: 3, textTransform: "uppercase", opacity: url }}>
        diagnosticostartups.com
      </div>
    </AbsoluteFill>
  );
};

// ---------- root ----------
export const DemoVideo: React.FC = () => {
  let from = 0;
  return (
    <AbsoluteFill style={{ background: NAVY }}>
      <AuroraBg />
      {SCENES.map((scene, i) => {
        const start = from;
        from += scene.d;
        return (
          <Sequence key={i} from={start} durationInFrames={scene.d}>
            <SceneWrapper index={i} scene={scene} />
          </Sequence>
        );
      })}
      <Audio src={staticFile("audio/music30.mp3")} volume={0.22} />
      <Audio src={staticFile("audio/vo30.mp3")} volume={1} />
    </AbsoluteFill>
  );
};

const SceneWrapper: React.FC<{ index: number; scene: any }> = ({ index, scene }) => {
  const f = useCurrentFrame();
  if (scene.c === "logo") return <LogoScene sceneFrame={f} sceneDur={scene.d} />;
  if (scene.c === "hook") return <HookScene sceneFrame={f} sceneDur={scene.d} />;
  if (scene.c === "outro") return <OutroScene sceneFrame={f} sceneDur={scene.d} />;
  if (scene.c === "split") {
    return (
      <>
        <Split imgs={scene.imgs} sceneFrame={f} sceneDur={scene.d} />
        <Chrome title={scene.title} sub={scene.sub} sceneFrame={f} sceneDur={scene.d} index={index} />
      </>
    );
  }
  return (
    <>
      <Shot img={scene.img} focus={scene.focus} highlight={scene.highlight} sceneFrame={f} sceneDur={scene.d} />
      <Chrome title={scene.title} sub={scene.sub} sceneFrame={f} sceneDur={scene.d} index={index} />
    </>
  );
};
