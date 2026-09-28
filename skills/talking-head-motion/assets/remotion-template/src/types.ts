import type {Caption} from "@remotion/captions";

export type Clip = {
  src: string;
  fromFrame: number;
  sourceStartFrame: number;
  durationInFrames: number;
  volume: number;
};

export type Scene = {
  kind: "hook" | "upload" | "prompt" | "steps" | "emphasis" | "cta";
  fromFrame: number;
  durationInFrames: number;
  title?: string;
  body?: string;
  items?: string[];
  stepFrames?: number[];
  hideCaptions?: boolean;
  endTitle?: string;
  endBody?: string;
};

export type Timeline = {
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  clips: Clip[];
  captions: Caption[];
  scenes: Scene[];
  theme: {
    background: string;
    foreground: string;
    accent: string;
    fontFamily: string;
    demoLabel?: string;
  };
};

export const validateTimeline = (data: Timeline): Timeline => {
  const positive = (value: number) => Number.isFinite(value) && value > 0;
  const integer = (value: number) => Number.isInteger(value) && value >= 0;
  if (!positive(data.fps) || !positive(data.width) || !positive(data.height) ||
      !Number.isInteger(data.width) || !Number.isInteger(data.height) ||
      !integer(data.durationInFrames) || data.durationInFrames === 0) {
    throw new Error("fps, dimensões e duração da timeline têm de ser positivos; dimensões e duração em inteiros.");
  }
  const kinds = ["hook", "upload", "prompt", "steps", "emphasis", "cta"];
  for (const track of [data.clips, data.scenes]) {
    let previousEnd = 0;
    for (const entry of track) {
      if (!integer(entry.fromFrame) || !integer(entry.durationInFrames) || entry.durationInFrames === 0 ||
          entry.fromFrame < previousEnd || entry.fromFrame + entry.durationInFrames > data.durationInFrames) {
        throw new Error("Clips/cenas devem estar ordenados, sem sobreposições e dentro da timeline.");
      }
      previousEnd = entry.fromFrame + entry.durationInFrames;
    }
  }
  for (const clip of data.clips) {
    if (!integer(clip.sourceStartFrame) || !Number.isFinite(clip.volume) || clip.volume < 0 || clip.volume > 1 ||
        typeof clip.src !== "string" || /(^[A-Za-z]:|^[/\\]|(^|[/\\])\.\.([/\\]|$)|:\/\/)/.test(clip.src)) {
      throw new Error("Cada clip requer src relativo a public/, sourceStartFrame inteiro e volume entre 0 e 1.");
    }
  }
  for (const scene of data.scenes) {
    if (!kinds.includes(scene.kind) || (scene.kind === "steps" && (!scene.items || scene.items.length < 1 || scene.items.length > 6))) {
      throw new Error("Cena desconhecida ou painel steps sem 1 a 6 itens.");
    }
    if (scene.stepFrames && (scene.stepFrames.length !== scene.items?.length || scene.stepFrames.some((value, index) =>
      !integer(value) || value >= scene.durationInFrames || (index > 0 && value <= scene.stepFrames![index - 1])))) {
      throw new Error("stepFrames deve ter um frame relativo por item, crescente e dentro da cena.");
    }
  }
  let previousCaptionStart = -1;
  const endMs = data.durationInFrames / data.fps * 1000;
  for (const caption of data.captions) {
    if (typeof caption.text !== "string" || !Number.isFinite(caption.startMs) ||
        !Number.isFinite(caption.endMs) || caption.startMs < previousCaptionStart ||
        caption.startMs < 0 || caption.endMs <= caption.startMs || caption.endMs > endMs) {
      throw new Error("Legendas devem estar ordenadas, em milissegundos e dentro da timeline editada.");
    }
    previousCaptionStart = caption.startMs;
  }
  return data;
};
