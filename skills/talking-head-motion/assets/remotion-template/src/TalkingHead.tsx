import React, {useMemo} from "react";
import {createTikTokStyleCaptions} from "@remotion/captions";
import {
  AbsoluteFill,
  OffthreadVideo,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type {Scene, Timeline} from "./types";

const clamp = {extrapolateLeft: "clamp", extrapolateRight: "clamp"} as const;
const progress = (frame: number, duration: number) =>
  interpolate(frame, [0, Math.max(1, duration)], [0, 1], clamp);

const Placeholder: React.FC<{accent: string}> = ({accent}) => (
  <AbsoluteFill style={{background: "linear-gradient(135deg,#1b2635,#080c14)", alignItems: "center", justifyContent: "center"}}>
    <div style={{width: "25%", aspectRatio: "1", borderRadius: "50%", background: accent, opacity: 0.18}} />
    <div style={{fontSize: 20, letterSpacing: 5, marginTop: 24, opacity: 0.72}}>O TEU VÍDEO</div>
    <div style={{fontSize: 14, opacity: 0.5, marginTop: 10}}>Substituir dados de demonstração</div>
  </AbsoluteFill>
);

const CaptionTrack: React.FC<{captions: Timeline["captions"]; accent: string; scale: number; bottom: string; hidden: boolean}> = ({captions, accent, scale, bottom, hidden}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const nowMs = frame / fps * 1000;
  const {pages} = useMemo(() => createTikTokStyleCaptions({
    captions,
    combineTokensWithinMilliseconds: 700,
    breakOnSilenceAfterMilliseconds: 400,
  }), [captions]);
  // Page durations may bridge silence; cap the display at 250 ms after its last token.
  const page = pages.find((item) => {
    const lastToken = item.tokens[item.tokens.length - 1];
    return nowMs >= item.startMs && nowMs < Math.min(item.startMs + item.durationMs, (lastToken?.toMs ?? item.startMs) + 250);
  });
  if (!page || hidden) return null;
  return (
    <div style={{position: "absolute", bottom, left: "10%", width: "80%", textAlign: "center", zIndex: 5}}>
      <span style={{display: "inline-block", padding: `${10 * scale}px ${22 * scale}px`, borderRadius: 12 * scale, background: "rgba(4,8,15,0.86)", fontSize: 35 * scale, lineHeight: 1.22, fontWeight: 800, whiteSpace: "pre-wrap", textShadow: "0 2px 5px #000"}}>
        {page.tokens.map((token, index) => (
          <span key={index} style={{color: nowMs >= token.fromMs && nowMs < token.toMs ? accent : "#fff"}}>{token.text}</span>
        ))}
      </span>
    </div>
  );
};

const SceneGraphics: React.FC<{scene: Scene; theme: Timeline["theme"]; scale: number}> = ({scene, theme, scale}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const entry = progress(frame, Math.round(fps * 0.3));
  const heading: React.CSSProperties = {fontSize: 60 * scale, lineHeight: 1.04, margin: 0, fontWeight: 900, letterSpacing: -2 * scale};
  const panel: React.CSSProperties = {position: "absolute", boxSizing: "border-box", left: "6%", top: "9%", width: "88%", opacity: entry, transform: `translateY(${(1 - entry) * 25 * scale}px)`};

  if (scene.kind === "hook") return (
    <AbsoluteFill style={{justifyContent: "center", padding: "7%", background: "linear-gradient(90deg,rgba(3,7,15,0.82),transparent)", opacity: entry}}>
      <div style={{fontSize: 16 * scale, letterSpacing: 4 * scale, color: theme.accent, marginBottom: 20 * scale}}>UMA IDEIA. UM VÍDEO.</div>
      <h1 style={{...heading, maxWidth: "94%", transform: `scale(${0.96 + entry * 0.04})`, transformOrigin: "left center"}}>{scene.title}</h1>
    </AbsoluteFill>
  );

  if (scene.kind === "upload") {
    const transfer = progress(frame, scene.durationInFrames * 0.7);
    return <div style={{...panel, padding: 30 * scale, background: "#101a29", border: "1px solid #344255", borderRadius: 24 * scale, boxShadow: "0 20px 80px #0006"}}>
      <div style={{fontSize: 15 * scale, letterSpacing: 3 * scale, color: theme.accent}}>FICHEIRO DE ORIGEM</div>
      <h2 style={{...heading, fontSize: 40 * scale, marginTop: 20 * scale}}>{scene.title}</h2>
      <p style={{fontSize: 21 * scale, color: "#b5c3d6", marginBottom: 28 * scale}}>{scene.body}</p>
      <div style={{height: 8 * scale, borderRadius: 8, background: "#293449", overflow: "hidden"}}><div style={{width: `${transfer * 100}%`, height: "100%", background: theme.accent}} /></div>
      <div style={{fontSize: 16 * scale, marginTop: 16 * scale, color: "#a9b9cc"}}>{transfer < 1 ? "A preparar a montagem" : "Pronto para editar"}</div>
    </div>;
  }

  if (scene.kind === "prompt") {
    const text = scene.body ?? "";
    const characters = Array.from(text);
    const count = Math.floor(progress(frame, scene.durationInFrames * 0.74) * characters.length);
    return <div style={{...panel, background: "#0c1220", border: "1px solid #364256", borderRadius: 20 * scale, padding: 30 * scale}}>
      <div style={{display: "flex", gap: 8 * scale, marginBottom: 25 * scale}}>{["#fa6464", "#f5be54", "#53c785"].map(color => <span key={color} style={{width: 10 * scale, height: 10 * scale, borderRadius: "50%", background: color}} />)}</div>
      <h2 style={{fontSize: 24 * scale, marginTop: 0, color: theme.accent}}>{scene.title}</h2>
      <div style={{position: "relative", fontFamily: "Consolas, monospace", fontSize: 24 * scale, lineHeight: 1.5, whiteSpace: "pre-wrap"}}><div style={{visibility: "hidden"}}>{text}▍</div><div style={{position: "absolute", inset: 0}}>{characters.slice(0, count).join("")}<span style={{opacity: Math.floor(frame / Math.max(1, Math.round(fps / 3))) % 2 ? 0 : 1, color: theme.accent}}>▍</span></div></div>
    </div>;
  }

  if (scene.kind === "steps") {
    const items = scene.items ?? [];
    const triggers = scene.stepFrames ?? items.map((_, index) => Math.floor(index * scene.durationInFrames / items.length));
    const active = triggers.filter(trigger => frame >= trigger).length - 1;
    const compact = items.length > 4;
    return <div style={{...panel, top: "12%"}}>
      <h2 style={{...heading, fontSize: 36 * scale, marginBottom: 18 * scale}}>{scene.title}</h2>
      {items.map((text, index) => {
        const reveal = progress(frame - triggers[index], Math.round(fps * 0.22));
        return <div key={index} style={{display: "flex", alignItems: "center", gap: 18 * scale, padding: `${(compact ? 7 : 11) * scale}px ${20 * scale}px`, marginBottom: 8 * scale, borderRadius: 13 * scale, background: index === active ? "#223045" : "#131c2b", border: `1px solid ${index === active ? theme.accent : "#334057"}`, opacity: 0.25 + 0.75 * reveal, transform: `translateX(${(1 - reveal) * -18 * scale}px)`}}>
          <span style={{fontSize: (compact ? 18 : 22) * scale, color: theme.accent, fontWeight: 800}}>{index < active ? "✓" : String(index + 1).padStart(2, "0")}</span>
          <span style={{fontSize: (compact ? 18 : 22) * scale, fontWeight: 650}}>{text}</span>
        </div>;
      })}
    </div>;
  }

  if (scene.kind === "emphasis") return (
    <AbsoluteFill style={{justifyContent: "center", padding: "7%", background: "#07101be8"}}>
      {[0, 1, 2].map(index => {
        const reveal = progress(frame - index * Math.round(fps * 0.13), Math.round(fps * 0.25));
        return <div key={index} style={{fontSize: 70 * scale, fontWeight: 900, letterSpacing: -3 * scale, lineHeight: 0.96, opacity: reveal * (index === 1 ? 1 : 0.5), color: index === 1 ? theme.accent : "transparent", WebkitTextStroke: index === 1 ? "0" : `${1.5 * scale}px ${theme.foreground}`, transform: `translateX(${(1 - reveal) * 80 * scale}px)`}}>{scene.title}</div>;
      })}
    </AbsoluteFill>
  );

  return (
    <AbsoluteFill style={{justifyContent: "center", padding: "7%", background: theme.background}}>
      <div style={{...heading, maxWidth: "83%", opacity: entry, transform: `translateY(${(1 - entry) * 20 * scale}px)`}}>{scene.title}</div>
      <div style={{fontSize: 28 * scale, color: "#adbdd0", marginTop: 25 * scale, maxWidth: "80%"}}>{scene.body}</div>
      {scene.items?.map((item, index) => <div key={index} style={{fontSize: 25 * scale, marginTop: 18 * scale, color: theme.foreground, opacity: progress(frame - index * 5, 10)}}><span style={{color: theme.accent}}>✓ </span>{item}</div>)}
      <AbsoluteFill style={{background: theme.accent, color: theme.background, justifyContent: "center", boxSizing: "border-box", padding: "7%", transform: `translateY(${interpolate(frame, [Math.max(0, scene.durationInFrames - 36), Math.max(1, scene.durationInFrames - 24)], [100, 0], clamp)}%)`}}>
        <h2 style={{...heading, fontSize: 58 * scale}}>{scene.endTitle ?? scene.title}</h2>
        {scene.endBody ?? scene.body ? <p style={{fontSize: 27 * scale, lineHeight: 1.3}}>{scene.endBody ?? scene.body}</p> : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const TalkingHead: React.FC<Timeline> = ({clips, captions, scenes, theme}) => {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  const scale = Math.min(width / 720, height / 1280);
  const currentScene = scenes.find(scene => frame >= scene.fromFrame && frame < scene.fromFrame + scene.durationInFrames);
  const inset = currentScene?.kind === "steps";
  const insetFrame = currentScene ? frame - currentScene.fromFrame : 0;
  const insetAmount = inset && currentScene ? Math.min(progress(insetFrame, 12), progress(currentScene.durationInFrames - 1 - insetFrame, 12)) : 0;
  const zoom = currentScene?.kind === "hook"
    ? 1 + 0.045 * progress(frame - currentScene.fromFrame, currentScene.durationInFrames)
    : 1;
  const videoBox: React.CSSProperties = {
    position: "absolute", overflow: "hidden",
    left: `${22 * insetAmount}%`, top: `${39 * insetAmount}%`,
    width: `${100 - 44 * insetAmount}%`, height: `${100 - 44 * insetAmount}%`,
    borderRadius: 22 * scale * insetAmount,
    border: insetAmount > 0 ? "1px solid #48556a" : "none",
    boxShadow: insetAmount > 0 ? "0 20px 70px #0007" : "none",
  };

  return (
    <AbsoluteFill style={{background: theme.background, color: theme.foreground, fontFamily: theme.fontFamily, overflow: "hidden"}}>
      <div style={videoBox}>
        <AbsoluteFill style={{transform: `scale(${zoom})`}}>
          {clips.map((clip, index) => (
            <Sequence key={index} from={clip.fromFrame} durationInFrames={clip.durationInFrames}>
              {clip.src ? <OffthreadVideo src={staticFile(clip.src)} trimBefore={clip.sourceStartFrame} volume={clip.volume} style={{width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 40%"}} /> : <Placeholder accent={theme.accent} />}
            </Sequence>
          ))}
        </AbsoluteFill>
      </div>
      {scenes.map((scene, index) => <Sequence key={index} from={scene.fromFrame} durationInFrames={scene.durationInFrames}><SceneGraphics scene={scene} theme={theme} scale={scale} /></Sequence>)}
      <CaptionTrack captions={captions} accent={theme.accent} scale={scale} bottom={inset ? "15%" : "22%"} hidden={currentScene?.hideCaptions ?? false} />
      {theme.demoLabel && clips.every(clip => !clip.src) ? <div style={{position: "absolute", top: "5%", right: "6%", fontSize: 12 * scale, letterSpacing: 2 * scale, color: "#d8e2ed", background: "#09101bc9", padding: "7px 10px", borderRadius: 5}}>{theme.demoLabel} · {Math.floor(frame / fps)}s</div> : null}
    </AbsoluteFill>
  );
};
