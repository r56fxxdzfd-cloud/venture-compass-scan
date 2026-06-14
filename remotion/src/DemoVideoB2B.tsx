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

// 1440 frames @ 30fps = 48s
const SCENES: { d: number; c: string; [k: string]: any }[] = [
  { d: 96, c: "intro" },
  { d: 128, c: "hook" },
  { d: 128, c: "shot", img: "dashboard.png", title: "Case · Vertical Startups", sub: "Uma plataforma de conselhos construída sobre o nosso OS", focus: { x: 0.5, y: 0.45, z: 1.05 } },
  { d: 160, c: "shot", img: "report-1.png", title: "Diagnóstico tangível", sub: "Score, confiança e narrativa executiva para o lead", focus: { x: 0.5, y: 0.4, z: 1.05 } },
  { d: 128, c: "shot", img: "report-radar.png", title: "9 Dimensões", sub: "Atual · Benchmark · Potencial", focus: { x: 0.5, y: 0.5, z: 1.05 } },
  { d: 160, c: "split", imgs: ["report-redflags.png", "report-matrix.png"], title: "Riscos e prioridades", sub: "Red Flags + Matriz Risco × Impacto" },
  { d: 128, c: "shot", img: "report-pauta.png", title: "Pauta pronta", sub: "Quick wins · Próxima reunião · Roadmap", focus: { x: 0.55, y: 0.5, z: 1.05 } },
  { d: 160, c: "split", imgs: ["counselor-center.png", "counselor-overview.png"], title: "Para o conselheiro", sub: "Portfólio inteiro em uma tela · Agenda · Foco" },
  { d: 128, c: "split", imgs: ["meeting-detail.png", "meeting-actions.png"], title: "Acompanhamento contínuo", sub: "Pauta · Decisões · Ações — retenção maior" },
  { d: 224, c: "cta" },
];

export const TOTAL_FRAMES = SCENES.reduce((s, x) => s + x.d, 0);

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

const Chrome: React.FC<{ title: string; sub: string; sceneFrame: number; sceneDur: number; index: number }> = ({ title, sub, sceneFrame, sceneDur, index }) => {
  const { fps } = useVideoConfig();
  const inSpring = spring({ frame: sceneFrame, fps, config: { damping: 18, stiffness: 140 } });
  const out = interpolate(sceneFrame, [sceneDur - 12, sceneDur], [1, 0], { extrapolateLeft: "clamp" });
  const op = inSpring * out;
  const ty = interpolate(inSpring, [0, 1], [30, 0]);
  return (
    <>
      <div style={{ position: "absolute", top: 40, left: 60, right: 60, display: "flex", alignItems: "center", justifyContent: "space-between", opacity: op }}>
        <div style={{ padding: "10px 20px", borderRadius: 999, background: "rgba(167,139,250,0.14)", color: PURPLE, fontFamily: BODY, fontSize: 18, letterSpacing: 2, textTransform: "uppercase", border: "1px solid rgba(167,139,250,0.3)" }}>
          Case · Vertical Startups
        </div>
        <div style={{ color: DIM, fontFamily: BODY, fontSize: 18, letterSpacing: 3, textTransform: "uppercase" }}>
          {String(index).padStart(2, "0")} · OS de Conselhos
        </div>
      </div>
      <div style={{ position: "absolute", left: 60, right: 60, bottom: 70, opacity: op, transform: `translateY(${ty}px)` }}>
        <div style={{ display: "inline-block", padding: "8px 18px", borderRadius: 999, background: "rgba(74,222,128,0.14)", color: GREEN, fontFamily: BODY, fontSize: 18, letterSpacing: 2, textTransform: "uppercase" }}>
          White-label
        </div>
        <div style={{ marginTop: 16, color: WHITE, fontFamily: HEADING, fontWeight: 700, fontSize: 76, lineHeight: 1, letterSpacing: -1 }}>{title}</div>
        <div style={{ marginTop: 12, color: DIM, fontFamily: BODY, fontSize: 26, lineHeight: 1.3, maxWidth: 1200 }}>{sub}</div>
      </div>
    </>
  );
};

const Shot: React.FC<{ img: string; focus: { x: number; y: number; z: number }; sceneFrame: number; sceneDur: number }> = ({ img, focus, sceneFrame, sceneDur }) => {
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
    </div>
  );
};

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

const IntroScene: React.FC<{ sceneFrame: number; sceneDur: number }> = ({ sceneFrame, sceneDur }) => {
  const { fps } = useVideoConfig();
  const s1 = spring({ frame: sceneFrame, fps, config: { damping: 16, stiffness: 110 } });
  const s2 = spring({ frame: sceneFrame - 18, fps, config: { damping: 18, stiffness: 110 } });
  const op = interpolate(sceneFrame, [sceneDur - 14, sceneDur], [1, 0], { extrapolateLeft: "clamp" });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: op, padding: 120 }}>
      <div style={{ opacity: s1, transform: `translateY(${(1 - s1) * 24}px)` }}>
        <div style={{ color: PURPLE, fontFamily: BODY, fontSize: 22, letterSpacing: 6, textTransform: "uppercase", textAlign: "center", marginBottom: 28 }}>
          Plataforma white-label
        </div>
      </div>
      <div style={{ opacity: s2, transform: `scale(${0.92 + s2 * 0.08})`, textAlign: "center" }}>
        <div style={{ color: WHITE, fontFamily: HEADING, fontWeight: 700, fontSize: 120, lineHeight: 1, letterSpacing: -2 }}>
          Sistema Operacional
        </div>
        <div style={{ color: GREEN, fontFamily: HEADING, fontWeight: 700, fontSize: 120, lineHeight: 1, letterSpacing: -2, marginTop: 4 }}>
          de Conselhos
        </div>
      </div>
    </AbsoluteFill>
  );
};

const HookScene: React.FC<{ sceneFrame: number; sceneDur: number }> = ({ sceneFrame, sceneDur }) => {
  const { fps } = useVideoConfig();
  const s = spring({ frame: sceneFrame, fps, config: { damping: 16, stiffness: 130 } });
  const op = interpolate(sceneFrame, [sceneDur - 12, sceneDur], [1, 0], { extrapolateLeft: "clamp" });
  const ty = interpolate(s, [0, 1], [40, 0]);
  return (
    <AbsoluteFill style={{ alignItems: "flex-start", justifyContent: "center", padding: 120, opacity: op }}>
      <div style={{ opacity: s, transform: `translateY(${ty}px)` }}>
        <div style={{ color: PURPLE, fontFamily: BODY, fontSize: 22, letterSpacing: 5, textTransform: "uppercase", marginBottom: 24 }}>
          A pergunta
        </div>
        <div style={{ color: WHITE, fontFamily: HEADING, fontWeight: 700, fontSize: 112, lineHeight: 1.02, letterSpacing: -2, maxWidth: 1500 }}>
          Como o seu conselho <span style={{ color: GREEN }}>prova valor</span> antes do contrato?
        </div>
      </div>
    </AbsoluteFill>
  );
};

const CTAScene: React.FC<{ sceneFrame: number; sceneDur: number }> = ({ sceneFrame, sceneDur }) => {
  const { fps } = useVideoConfig();
  const lines = [
    { t: "Seu Sistema Operacional de Conselhos", big: true, accent: "Sistema Operacional" },
    { t: "White-label · sua marca · seu método", big: false },
    { t: "Tangibilize a venda. Organize o conselho. Retenha mais clientes.", big: false, dim: true },
  ];
  const op = interpolate(sceneFrame, [sceneDur - 18, sceneDur], [1, 0], { extrapolateLeft: "clamp" });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 120, opacity: op }}>
      {lines.map((l, i) => {
        const s = spring({ frame: sceneFrame - i * 14, fps, config: { damping: 18, stiffness: 120 } });
        const ty = interpolate(s, [0, 1], [30, 0]);
        const fontSize = l.big ? 96 : 36;
        return (
          <div
            key={i}
            style={{
              opacity: s,
              transform: `translateY(${ty}px)`,
              color: l.dim ? DIM : WHITE,
              fontFamily: l.big ? HEADING : BODY,
              fontWeight: l.big ? 700 : 500,
              fontSize,
              lineHeight: l.big ? 1.05 : 1.4,
              letterSpacing: l.big ? -1.5 : 0,
              textAlign: "center",
              marginTop: i === 0 ? 0 : (i === 1 ? 32 : 24),
              maxWidth: 1500,
            }}
          >
            {l.accent ? (
              <>
                Seu <span style={{ color: GREEN, textShadow: `0 0 60px rgba(74,222,128,0.5)` }}>Sistema Operacional</span> de Conselhos
              </>
            ) : (
              l.t
            )}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export const DemoVideoB2B: React.FC = () => {
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
      <Audio src={staticFile("audio/music45.mp3")} volume={0.16} />
      <Audio src={staticFile("audio/vo45.mp3")} volume={1} startFrom={0} />
    </AbsoluteFill>
  );
};

const SceneWrapper: React.FC<{ index: number; scene: any }> = ({ index, scene }) => {
  const f = useCurrentFrame();
  if (scene.c === "intro") return <IntroScene sceneFrame={f} sceneDur={scene.d} />;
  if (scene.c === "hook") return <HookScene sceneFrame={f} sceneDur={scene.d} />;
  if (scene.c === "cta") return <CTAScene sceneFrame={f} sceneDur={scene.d} />;
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
      <Shot img={scene.img} focus={scene.focus} sceneFrame={f} sceneDur={scene.d} />
      <Chrome title={scene.title} sub={scene.sub} sceneFrame={f} sceneDur={scene.d} index={index} />
    </>
  );
};
