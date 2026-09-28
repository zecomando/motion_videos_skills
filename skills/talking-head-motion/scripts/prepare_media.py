#!/usr/bin/env python3
"""Inspect local video, transcribe locally, or export word-timed captions.

Dependencies: ffmpeg + ffprobe + Pillow for inspect; faster-whisper for
transcribe. Captions uses the standard library only. No source is modified.
Whisper models may download on first use; --local-files-only prevents downloads.
API reference: https://github.com/SYSTRAN/faster-whisper
"""

from __future__ import annotations

import argparse
import io
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile


def positive_float(value: str) -> float:
    result = float(value)
    if not math.isfinite(result) or result <= 0:
        raise argparse.ArgumentTypeError("must be a finite number greater than zero")
    return result


def positive_int(value: str) -> int:
    result = int(value)
    if result <= 0:
        raise argparse.ArgumentTypeError("must be greater than zero")
    return result


def run(command: list[str]) -> bytes:
    result = subprocess.run(command, shell=False, capture_output=True, check=False)
    if result.returncode:
        detail = result.stderr.decode("utf-8", errors="replace")[-3000:]
        raise RuntimeError(f"{Path(command[0]).name} failed ({result.returncode}): {detail}")
    return result.stdout


def executable(name: str) -> str:
    found = shutil.which(name)
    if not found:
        raise RuntimeError(f"{name} was not found on PATH; install it before this command")
    return found


def json_bytes(value: object) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode("utf-8")


def check_outputs(args: argparse.Namespace, names: list[str]) -> None:
    args.out.mkdir(parents=True, exist_ok=True)
    for name in names:
        target = args.out / name
        if target.resolve() == args.input.resolve():
            raise ValueError(f"Output would replace the source: {target}")
        if target.is_symlink():
            raise ValueError(f"Refusing symbolic-link output: {target}")
        if target.exists() and (not args.force or not target.is_file()):
            raise FileExistsError(f"Output exists: {target}; choose a new --out or explicitly use --force")


def publish(args: argparse.Namespace, name: str, data: bytes) -> Path:
    check_outputs(args, [name])
    target = args.out / name
    if args.force:
        # Build alongside the destination for an atomic replacement on one filesystem.
        with tempfile.NamedTemporaryFile(dir=args.out, prefix=".prepare-media-", delete=False) as file:
            temporary = Path(file.name)
            file.write(data)
        try:
            os.replace(temporary, target)
        finally:
            temporary.unlink(missing_ok=True)
    else:
        # Exclusive creation also protects against a file appearing after preflight.
        with target.open("xb") as file:
            file.write(data)
    return target


def stamp(seconds: float) -> str:
    milliseconds = round(seconds * 1000)
    hours, rest = divmod(milliseconds, 3_600_000)
    minutes, rest = divmod(rest, 60_000)
    whole, fraction = divmod(rest, 1000)
    return f"{hours:02}:{minutes:02}:{whole:02}.{fraction:03}"


def inspect_media(args: argparse.Namespace) -> None:
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError as exc:
        raise RuntimeError("inspect requires Pillow in this Python environment") from exc
    ffprobe, ffmpeg = executable("ffprobe"), executable("ffmpeg")
    probe = json.loads(run([ffprobe, "-v", "error", "-show_format", "-show_streams", "-of", "json", str(args.input)]))
    videos = [s for s in probe.get("streams", []) if s.get("codec_type") == "video" and not s.get("disposition", {}).get("attached_pic")]
    if not videos:
        raise ValueError("No video stream found")
    stream = videos[0]
    duration = None
    # Audio can outlast video. Prefer the selected video stream so sampling
    # cannot seek into a trailing audio-only interval of the container.
    for raw_duration in (stream.get("duration"), probe.get("format", {}).get("duration")):
        try:
            candidate = float(raw_duration)
        except (TypeError, ValueError):
            continue
        if math.isfinite(candidate) and candidate > 0:
            duration = candidate
            break
    if duration is None:
        raise ValueError("Cannot determine duration; inspect requires a finite-duration video")
    count = math.ceil(duration / args.interval)
    if args.max_frames:
        count = min(count, args.max_frames)
    times = [index * args.interval for index in range(count)]
    per_page = args.columns * args.rows
    pages = math.ceil(count / per_page)
    names = ["ffprobe.json", "inspection.json"] + [f"contact-sheet-{page + 1:03}.jpg" for page in range(pages)]
    check_outputs(args, names)
    try:
        font = ImageFont.truetype("DejaVuSans.ttf", 17)
    except OSError:
        font = ImageFont.load_default()
    gutter, label_height, header_height = 12, 30, 42
    cell_width, cell_height = args.tile_width, args.tile_height + label_height
    sheet_width = gutter + args.columns * (cell_width + gutter)
    frames = []
    # Generated frames stay in an isolated temporary folder, never beside the source.
    with tempfile.TemporaryDirectory(prefix="prepare-media-") as temporary:
        tmp = Path(temporary)
        for page in range(pages):
            page_times = times[page * per_page:(page + 1) * per_page]
            occupied_rows = math.ceil(len(page_times) / args.columns)
            sheet = Image.new("RGB", (sheet_width, header_height + gutter + occupied_rows * (cell_height + gutter)), "#151820")
            draw = ImageDraw.Draw(sheet)
            draw.text((gutter, 12), f"Page {page + 1}/{pages} | interval {args.interval:g}s | duration {stamp(duration)}", fill="white", font=font)
            for local_index, seconds in enumerate(page_times):
                frame = tmp / f"frame-{local_index:03}.png"
                # Autorotation is ffmpeg's default. Scale using display aspect
                # ratio and square pixels; this also supports older ffmpeg builds.
                filter_graph = f"scale=w='min({args.tile_width},{args.tile_height}*dar)':h='min({args.tile_height},{args.tile_width}/dar)',setsar=1"
                run([ffmpeg, "-hide_banner", "-loglevel", "error", "-nostdin", "-n", "-ss", f"{seconds:.6f}", "-i", str(args.input), "-map", f"0:{stream['index']}", "-frames:v", "1", "-vf", filter_graph, str(frame)])
                if not frame.exists():
                    raise RuntimeError(f"No frame decoded at {stamp(seconds)}")
                column, row = local_index % args.columns, local_index // args.columns
                x, y = gutter + column * (cell_width + gutter), header_height + gutter + row * (cell_height + gutter)
                with Image.open(frame) as original:
                    picture = original.convert("RGB")
                    picture.thumbnail((args.tile_width, args.tile_height), Image.Resampling.LANCZOS)
                    sheet.paste(picture, (x + (cell_width - picture.width) // 2, y + (args.tile_height - picture.height) // 2))
                draw.text((x + 4, y + args.tile_height + 5), stamp(seconds), fill="white", font=font)
                frames.append({"requestedTimeSeconds": seconds, "sheet": f"contact-sheet-{page + 1:03}.jpg", "cell": local_index + 1})
                frame.unlink()
            buffer = io.BytesIO()
            sheet.save(buffer, format="JPEG", quality=90)
            (tmp / f"contact-sheet-{page + 1:03}.jpg").write_bytes(buffer.getvalue())
        inspection = {
            "source": str(args.input), "durationSeconds": duration,
            "intervalSeconds": args.interval, "frameCount": count,
            "limitedByMaxFrames": bool(args.max_frames and count < math.ceil(duration / args.interval)),
            "timestampNote": "Labels identify requested seek times; decoded frames follow the source frame grid.",
            "frames": frames,
        }
        publish(args, "ffprobe.json", json_bytes(probe))
        publish(args, "inspection.json", json_bytes(inspection))
        for name in names[2:]:
            publish(args, name, (tmp / name).read_bytes())
    print(json.dumps({"output": str(args.out), "durationSeconds": duration, "frames": count, "sheets": pages}, ensure_ascii=False))


def transcribe_media(args: argparse.Namespace) -> None:
    names = ["transcript.json", "transcript.txt"]
    check_outputs(args, names)
    try:
        from faster_whisper import WhisperModel
    except ImportError as exc:
        raise RuntimeError("transcribe requires faster-whisper in this Python environment") from exc
    model = WhisperModel(args.model, device="cpu", compute_type="int8", local_files_only=args.local_files_only)
    segments, info = model.transcribe(str(args.input), language=None if args.language == "auto" else args.language, task="transcribe", word_timestamps=True, beam_size=5)
    normalized = []
    for segment in segments:  # Consuming this generator performs the transcription.
        normalized.append({
            "id": segment.id, "start": segment.start, "end": segment.end,
            "text": segment.text,
            "words": [{"text": word.word, "start": word.start, "end": word.end, "confidence": word.probability} for word in (segment.words or [])],
        })
        print(f"[{stamp(segment.start)} - {stamp(segment.end)}] {segment.text}", file=sys.stderr)
    result = {
        "source": str(args.input), "model": args.model, "device": "cpu", "computeType": "int8",
        "task": "transcribe", "language": info.language, "languageProbability": info.language_probability,
        "durationSeconds": info.duration, "timeUnit": "seconds", "segments": normalized,
        "reviewRequired": "Check names, numbers, punctuation, omissions and timing against the source; no wording or number normalization has been applied.",
    }
    publish(args, "transcript.json", json_bytes(result))
    publish(args, "transcript.txt", ("".join(segment["text"] for segment in normalized) + "\n").encode("utf-8"))
    print(json.dumps({"output": str(args.out), "segments": len(normalized), "language": info.language}, ensure_ascii=False))


def captions(args: argparse.Namespace) -> None:
    check_outputs(args, ["captions.json"])
    source = json.loads(args.input.read_text(encoding="utf-8-sig"))
    if not isinstance(source, dict) or not isinstance(source.get("segments"), list):
        raise ValueError("Expected an object with a segments array")
    result = []
    previous_start = -1.0
    for index, segment in enumerate(source["segments"]):
        if not isinstance(segment, dict):
            raise ValueError(f"Segment {index} must be an object")
        words = segment.get("words")
        if not isinstance(words, list) or (str(segment.get("text", "")).strip() and not words):
            raise ValueError(f"Segment {index} has no word timestamps; transcribe with word_timestamps=True")
        for word in words:
            if not isinstance(word, dict):
                raise ValueError(f"Word in segment {index} must be an object")
            text = word.get("text", word.get("word"))
            if not isinstance(text, str):
                raise ValueError(f"Invalid word text in segment {index}")
            start, end = float(word["start"]), float(word["end"])
            if not all(math.isfinite(time) for time in (start, end)) or start < 0 or end < start or start < previous_start:
                raise ValueError(f"Invalid or unordered timestamps in segment {index}")
            start_ms, end_ms = round(start * 1000), round(end * 1000)
            if end_ms <= start_ms:
                raise ValueError(
                    f"Timestamp sem duração após conversão para ms: segmento {index}, palavra {text!r} "
                    f"({start:g}s–{end:g}s); rever e alinhar a palavra no áudio antes de converter. "
                    "O texto e os tempos originais não foram alterados."
                )
            confidence = word.get("confidence", word.get("probability"))
            if confidence is not None:
                confidence = float(confidence)
                if not math.isfinite(confidence) or not 0 <= confidence <= 1:
                    raise ValueError(f"Confidence outside [0, 1] in segment {index}")
            previous_start = start
            result.append({"text": text, "startMs": start_ms, "endMs": end_ms, "timestampMs": None, "confidence": confidence})
    publish(args, "captions.json", json_bytes(result))
    print(json.dumps({"output": str(args.out / "captions.json"), "words": len(result)}, ensure_ascii=False))


def main() -> int:
    # Keep diagnostics and recognized text readable when Windows captures pipes.
    for output in (sys.stdout, sys.stderr):
        if hasattr(output, "reconfigure"):
            output.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    commands = parser.add_subparsers(dest="command", required=True)
    for name in ("inspect", "transcribe", "captions"):
        command = commands.add_parser(name)
        command.add_argument("input", type=Path)
        command.add_argument("--out", required=True, type=Path, help="output directory")
        command.add_argument("--force", action="store_true", help="explicitly allow replacing generated output files")
        if name == "inspect":
            command.add_argument("--interval", type=positive_float, default=4.0)
            command.add_argument("--columns", type=positive_int, default=4)
            command.add_argument("--rows", type=positive_int, default=4)
            command.add_argument("--tile-width", type=positive_int, default=320)
            command.add_argument("--tile-height", type=positive_int, default=320)
            command.add_argument("--max-frames", type=positive_int, help="optional prefix limit; recorded in inspection.json")
            command.set_defaults(handler=inspect_media)
        elif name == "transcribe":
            command.add_argument("--language", default="pt", help="language code; use auto for detection")
            command.add_argument("--model", default="small", help="model size, local model directory, or Hugging Face model ID")
            command.add_argument("--local-files-only", action="store_true", help="require a cached/local model; never download")
            command.set_defaults(handler=transcribe_media)
        else:
            command.set_defaults(handler=captions)
    args = parser.parse_args()
    args.input, args.out = args.input.expanduser().resolve(), args.out.expanduser().resolve()
    if not args.input.is_file():
        parser.error(f"Input is not a file: {args.input}")
    try:
        args.handler(args)
    except (OSError, ValueError, KeyError, TypeError, RuntimeError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
