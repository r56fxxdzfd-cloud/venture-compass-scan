import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Sequence } from "remotion";
import { loadFont as loadHeading } from "@remotion/google-fonts/SpaceGrotesk";
import { loadFont as loadBody } from "@remotion/google-fonts/DMSans";

const heading = loadHeading("normal", { weights: ["500", "700"], subsets: ["latin"] });
const body = loadBody("normal", { weights: ["400", "500"], subsets: ["latin"] });

export const HEADING = heading.fontFamily;
export const BODY = body.fontFamily;

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

// Scene structure: [durationFrames, kind, props]
const SCENES = [
  { d: 75, c: "intro" },
  { d: 75, c: "shot", img: "dashboard.png", title: "Painel Executivo", sub: "Visão consolidada do portfólio de organizações", focus: { x: 0.55, y: 0.5, z: 1.05 } },
  { d: 105, c: "shot", img: "counselor-overview.png", title: "Central do Conselheiro", sub: "Priorize riscos, prepare reuniões, acompanhe execução", focus: { x: 0.5, y: 0.4, z: 1.08 }, highlight: { x: 0.05, y: 0.36, w: 0.95, h: 0.22, label: "Cockpit do Conselheiro" } },
  { d: 90, c: "shot", img: "counselor-center.png", title: "Central da Organização", sub: "Supertech — visão executiva pronta para o encontro", focus: { x: 0.5, y: 0.5, z: 1.0 }, highlight: { x: 0.2, y: 0.6, w: 0.8, h: 0.3, label: "Antes da próxima reunião" } },
  { d: 90, c: "shot", img: "meeting-detail.png", title: "Encontro de Conselho", sub: "Conselho Março · Eficiência Operacional · Supertech", focus: { x: 0.5, y: 0.4, z: 1.05 }, highlight: { x: 0.18, y: 0.32, w: 0.85, h: 0.2, label: "Saúde do ciclo · Ações · Atrasos" } },
  { d: 110, c: "shot", img: "meeting-actions.png", title: "Ações Acionáveis", sub: "Kanban de ações combinadas — owner, prazo, evidência", focus: { x: 0.55, y: 0.5, z: 1.05 }, highlight: { x: 0.65, y: 0.3, w: 0.32, h: 0.55, label: "Concluídas com evidência" } },
  { d: 75, c: "shot", img: "report-1.png", title: "Relatório de Diagnóstico", sub: "Score 48/100 · Em evolução · Confiança Alta", focus: { x: 0.55, y: 0.5, z: 1.05 } },
  { d: 75, c: "scroll", imgs: ["report-1.png", "report-radar.png", "report-dimensoes.png"], title: "Radar e Dimensões", sub: "Atual vs Benchmark vs Potencial" },
  { d: 80, c: "shot", img: "report-redflags.png", title: "Red Flags", sub: "5 alertas · 2 críticos · ação imediata", focus: { x: 0.55, y: 0.45, z: 1.05 }, highlight: { x: 0.27, y: 0.49, w: 0.7, h: 0.18, label: "Críticos -15pts" } },
  { d: 70, c: "shot", img: "report-pauta.png", title: "Pauta Sugerida", sub: "Próximo Conselho Coletivo · Deep Dive", focus: { x: 0.55, y: 0.5, z: 1.05 } },
  { d: 80, c: "shot", img: "report-matrix.png", title: "Matriz Risco × Impacto", sub: "Decida onde agir primeiro", focus: { x: 0.55, y: 0.6, z: 1.08 } },
  { d: 75, c: "outro" },
];

export const TOTAL_FRAMES = SCENES.reduce((s, x) => s + x.d, 0);

const NAVY = "#0a0f1f";
const NAVY_2 = "#101a33";
const GREEN = "#4ade80";
const PURPLE = "#a78bfa";
const WHITE = "#ffffff";
const DIM = "rgba(255,255,255,0.6)";

const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  return (
    <AbsoluteFill style={{ background: NAVY, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: -200,
          background: `radial-gradient(60% 50% at ${30 + Math.sin(t * 0.4) * 10}% ${40 + Math.cos(t * 0.3) * 10}%, rgba(74,222,128,0.18), transparent 60%), radial-gradient(50% 40% at ${70 + Math.cos(t * 0.5) * 8}% ${60 + Math.sin(t * 0.4) * 8}%, rgba(167,139,250,0.18), transparent 60%)`,
          filter: "blur(40px)",
        }}
      />
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, rgba(10,15,31,0.2), rgba(10,15,31,0.65))` }} />
    </AbsoluteFill>
  );
};

const Chrome: React.FC<{ title: string; sub: string; index: number; total: number; sceneFrame: number; sceneDur: number }> = ({ title, sub, index, total, sceneFrame, sceneDur }) => {
  const inOp = interpolate(sceneFrame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const outOp = interpolate(sceneFrame, [sceneDur - 10, sceneDur], [1, 0], { extrapolateLeft: "clamp" });
  const op = Math.min(inOp, outOp);
  const ty = interpolate(sceneFrame, [0, 18], [20, 0], { extrapolateRight: "clamp" });
  return (
    <>
      {/* Top brand bar */}
      <div style={{ position: "absolute", top: 36, left: 60, right: 60, display: "flex", alignItems: "center", justifyContent: "space-between", opacity: op }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, color: WHITE, fontFamily: HEADING, fontWeight: 700, fontSize: 24, letterSpacing: 0.5 }}>
          <Img src={staticFile("images/logo.png")} style={{ height: 44, width: "auto" }} />
        </div>
        <div style={{ color: DIM, fontFamily: BODY, fontSize: 18, letterSpacing: 2, textTransform: "uppercase" }}>
          {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </div>
      </div>
      {/* Bottom caption */}
      <div style={{ position: "absolute", left: 60, right: 60, bottom: 60, opacity: op, transform: `translateY(${ty}px)` }}>
        <div style={{ display: "inline-block", padding: "8px 18px", borderRadius: 999, background: "rgba(74,222,128,0.12)", color: GREEN, fontFamily: BODY, fontSize: 18, letterSpacing: 2, textTransform: "uppercase" }}>
          Darwin Growth
        </div>
        <div style={{ marginTop: 18, color: WHITE, fontFamily: HEADING, fontWeight: 700, fontSize: 72, lineHeight: 1, letterSpacing: -1 }}>{title}</div>
        <div style={{ marginTop: 14, color: DIM, fontFamily: BODY, fontSize: 26, lineHeight: 1.3, maxWidth: 1200 }}>{sub}</div>
      </div>
    </>
  );
};

const ShotScene: React.FC<{ img: string; focus: { x: number; y: number; z: number }; highlight?: { x: number; y: number; w: number; h: number; label: string } | undefined; sceneFrame: number; sceneDur: number }> = ({ img, focus, highlight, sceneFrame, sceneDur }) => {
  // Stage area for screenshot (centered, leaves room for chrome)
  const stageW = 1480;
  const stageH = 720;
  const stageX = (WIDTH - stageW) / 2;
  const stageY = 130;

  const inOp = interpolate(sceneFrame, [0, 14], [0, 1], { extrapolateRight: "clamp" });
  const outOp = interpolate(sceneFrame, [sceneDur - 10, sceneDur], [1, 0], { extrapolateLeft: "clamp" });
  const op = Math.min(inOp, outOp);

  // Subtle ken-burns zoom on the screenshot
  const z = interpolate(sceneFrame, [0, sceneDur], [focus.z, focus.z + 0.05]);
  const tx = interpolate(sceneFrame, [0, sceneDur], [0, -10]);
  const ty = interpolate(sceneFrame, [0, sceneDur], [0, -6]);

  return (
    <>
      <div
        style={{
          position: "absolute",
          left: stageX,
          top: stageY,
          width: stageW,
          height: stageH,
          borderRadius: 18,
          overflow: "hidden",
          boxShadow: "0 50px 120px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)",
          background: NAVY_2,
          opacity: op,
        }}
      >
        <div style={{ position: "absolute", inset: 0, transformOrigin: `${focus.x * 100}% ${focus.y * 100}%`, transform: `scale(${z}) translate(${tx}px, ${ty}px)` }}>
          <Img src={staticFile(`images/${img}`)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }} />
        </div>

        {highlight && (
          <Highlight x={highlight.x} y={highlight.y} w={highlight.w} h={highlight.h} label={highlight.label} sceneFrame={sceneFrame} sceneDur={sceneDur} />
        )}
      </div>
    </>
  );
};

const Highlight: React.FC<{ x: number; y: number; w: number; h: number; label: string; sceneFrame: number; sceneDur: number }> = ({ x, y, w, h, label, sceneFrame, sceneDur }) => {
  const appear = interpolate(sceneFrame, [16, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const out = interpolate(sceneFrame, [sceneDur - 14, sceneDur - 4], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const a = appear * out;
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: `${x * 100}%`,
          top: `${y * 100}%`,
          width: `${w * 100}%`,
          height: `${h * 100}%`,
          border: `2px solid ${GREEN}`,
          boxShadow: `0 0 0 6px rgba(74,222,128,0.18), 0 0 60px rgba(74,222,128,0.45)`,
          borderRadius: 14,
          opacity: a,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: `${x * 100}%`,
          top: `calc(${y * 100}% - 44px)`,
          padding: "6px 14px",
          background: GREEN,
          color: NAVY,
          fontFamily: BODY,
          fontWeight: 500,
          fontSize: 18,
          borderRadius: 8,
          opacity: a,
        }}
      >
        {label}
      </div>
    </>
  );
};

const ScrollScene: React.FC<{ imgs: string[]; sceneFrame: number; sceneDur: number }> = ({ imgs, sceneFrame, sceneDur }) => {
  const stageW = 1480;
  const stageH = 720;
  const stageX = (WIDTH - stageW) / 2;
  const stageY = 130;

  const inOp = interpolate(sceneFrame, [0, 14], [0, 1], { extrapolateRight: "clamp" });
  const outOp = interpolate(sceneFrame, [sceneDur - 10, sceneDur], [1, 0], { extrapolateLeft: "clamp" });
  const op = Math.min(inOp, outOp);

  // each image stacks at stageH, scroll continuously
  const totalH = imgs.length * stageH;
  const offset = interpolate(sceneFrame, [0, sceneDur], [0, -(totalH - stageH)]);

  return (
    <div
      style={{
        position: "absolute",
        left: stageX,
        top: stageY,
        width: stageW,
        height: stageH,
        borderRadius: 18,
        overflow: "hidden",
        boxShadow: "0 50px 120px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)",
        background: NAVY_2,
        opacity: op,
      }}
    >
      <div style={{ position: "absolute", left: 0, top: 0, width: "100%", transform: `translateY(${offset}px)` }}>
        {imgs.map((src, i) => (
          <Img key={i} src={staticFile(`images/${src}`)} style={{ width: "100%", height: stageH, objectFit: "cover", objectPosition: "top center", display: "block" }} />
        ))}
      </div>
      {/* fade edges */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 80, background: `linear-gradient(180deg, ${NAVY_2}, transparent)` }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 80, background: `linear-gradient(0deg, ${NAVY_2}, transparent)` }} />
      {/* scroll indicator */}
      <div style={{ position: "absolute", right: 20, top: 20, bottom: 20, width: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: `${(sceneFrame / sceneDur) * 100}%`, height: 60, background: GREEN, borderRadius: 2, transform: "translateY(-30px)" }} />
      </div>
    </div>
  );
};

const IntroScene: React.FC<{ sceneFrame: number; sceneDur: number }> = ({ sceneFrame, sceneDur }) => {
  const { fps } = useVideoConfig();
  const s = spring({ frame: sceneFrame, fps, config: { damping: 14, stiffness: 110 } });
  const op = interpolate(sceneFrame, [sceneDur - 12, sceneDur], [1, 0], { extrapolateLeft: "clamp" });
  const sub = spring({ frame: sceneFrame - 18, fps, config: { damping: 18, stiffness: 100 } });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: op }}>
      <div style={{ transform: `scale(${0.7 + s * 0.3})`, opacity: s }}>
        <Img src={staticFile("images/logo.png")} style={{ width: 720, height: "auto" }} />
      </div>
      <div style={{ marginTop: 40, opacity: sub, transform: `translateY(${(1 - sub) * 20}px)` }}>
        <div style={{ color: GREEN, fontFamily: BODY, fontSize: 22, letterSpacing: 6, textTransform: "uppercase", textAlign: "center" }}>
          Conselho · Diagnóstico · Execução
        </div>
      </div>
    </AbsoluteFill>
  );
};

const OutroScene: React.FC<{ sceneFrame: number; sceneDur: number }> = ({ sceneFrame, sceneDur }) => {
  const { fps } = useVideoConfig();
  const s = spring({ frame: sceneFrame, fps, config: { damping: 14, stiffness: 110 } });
  const inOp = interpolate(sceneFrame, [0, 14], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: inOp }}>
      <div style={{ transform: `scale(${0.85 + s * 0.15})` }}>
        <Img src={staticFile("images/logo.png")} style={{ width: 760, height: "auto" }} />
      </div>
      <div style={{ marginTop: 50, color: WHITE, fontFamily: HEADING, fontWeight: 500, fontSize: 36, textAlign: "center", letterSpacing: -0.5 }}>
        Conselhos coletivos que aceleram o crescimento.
      </div>
      <div style={{ marginTop: 18, color: DIM, fontFamily: BODY, fontSize: 22, letterSpacing: 3, textTransform: "uppercase" }}>
        diagnosticostartups.com
      </div>
    </AbsoluteFill>
  );
};

export const MainVideo: React.FC = () => {
  let from = 0;
  const total = SCENES.length;
  return (
    <AbsoluteFill style={{ background: NAVY }}>
      <Background />
      {SCENES.map((scene, i) => {
        const start = from;
        from += scene.d;
        return (
          <Sequence key={i} from={start} durationInFrames={scene.d}>
            <SceneWrapper index={i} total={total} scene={scene as any} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

const SceneWrapper: React.FC<{ index: number; total: number; scene: any }> = ({ index, total, scene }) => {
  const f = useCurrentFrame();
  if (scene.c === "intro") return <IntroScene sceneFrame={f} sceneDur={scene.d} />;
  if (scene.c === "outro") return <OutroScene sceneFrame={f} sceneDur={scene.d} />;
  if (scene.c === "scroll") {
    return (
      <>
        <ScrollScene imgs={scene.imgs} sceneFrame={f} sceneDur={scene.d} />
        <Chrome title={scene.title} sub={scene.sub} index={index} total={total} sceneFrame={f} sceneDur={scene.d} />
      </>
    );
  }
  return (
    <>
      <ShotScene img={scene.img} focus={scene.focus} highlight={scene.highlight} sceneFrame={f} sceneDur={scene.d} />
      <Chrome title={scene.title} sub={scene.sub} index={index} total={total} sceneFrame={f} sceneDur={scene.d} />
    </>
  );
};
