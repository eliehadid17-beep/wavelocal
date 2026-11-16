#!/usr/bin/env python3
"""Generate royalty-free demo music (synthesized) + cover art for WaveLocal."""
import json
import os
import subprocess
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SR = 44100
# Repo-root/seed-assets, resolved from this script's location so it runs anywhere.
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "seed-assets")
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(20261116)

try:
    from scipy.signal import butter, lfilter

    def lowpass(x, cutoff):
        b, a = butter(2, min(0.99, cutoff / (SR / 2)))
        return lfilter(b, a, x)

    def highpass(x, cutoff):
        b, a = butter(2, min(0.99, cutoff / (SR / 2)), btype="high")
        return lfilter(b, a, x)
except Exception:
    def lowpass(x, cutoff):
        n = max(3, int(SR / max(cutoff, 20)))
        k = np.ones(n) / n
        return np.convolve(x, k, mode="same")

    def highpass(x, cutoff):
        return x - lowpass(x, cutoff)


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def taxis(dur):
    return np.arange(int(SR * dur)) / SR


def osc(kind, freq, t):
    ph = t * freq
    if kind == "sine":
        return np.sin(2 * np.pi * ph)
    if kind == "tri":
        return 2 * np.abs(2 * (ph % 1)) - 1
    if kind == "saw":
        return 2 * (ph % 1) - 1
    return np.sign(np.sin(2 * np.pi * ph))


def adsr(n, a, d, r, sl=0.6):
    a_n, d_n, r_n = int(a * SR), int(d * SR), int(r * SR)
    s_n = max(0, n - a_n - d_n - r_n)
    env = np.concatenate([
        np.linspace(0, 1, max(1, a_n), endpoint=False),
        np.linspace(1, sl, max(1, d_n), endpoint=False),
        np.full(s_n, sl),
        np.linspace(sl, 0, max(1, r_n)),
    ])
    if len(env) < n:
        env = np.pad(env, (0, n - len(env)))
    return env[:n]


def kick(dur=0.3):
    t = taxis(dur)
    f = 42 + 115 * np.exp(-t * 26)
    ph = np.cumsum(f) / SR * 2 * np.pi
    return np.sin(ph) * np.exp(-t * 9)


def hat(dur=0.05, open_=False, seed=7):
    n = int(SR * dur)
    x = np.random.default_rng(seed).standard_normal(n)
    x = np.diff(x, prepend=0.0)
    x /= np.abs(x).max() + 1e-9
    return x * np.exp(-np.arange(n) / (SR * (0.10 if open_ else 0.016))) * 0.45


def snare(dur=0.2):
    t = taxis(dur)
    n = np.random.default_rng(3).standard_normal(len(t))
    tone = np.sin(2 * np.pi * 185 * t) * np.exp(-t * 30)
    return (0.55 * highpass(n, 1500) * np.exp(-t * 20) + 0.8 * tone) * 0.55


def pluck(freq, dur=0.4, bright=0.6):
    t = taxis(dur)
    x = osc("tri", freq, t) + 0.5 * osc("sine", freq * 2, t) + 0.25 * osc("sine", freq * 3.01, t)
    env = np.exp(-t * (6 - 3 * bright))
    return lowpass(x * env, 1200 + 5000 * bright) * 0.8


def bassnote(freq, dur=0.25):
    t = taxis(dur)
    x = osc("sine", freq, t) + 0.35 * osc("tri", freq, t) + 0.15 * osc("sine", freq * 2, t)
    return x * adsr(len(t), 0.005, 0.05, 0.08, 0.75) * 0.9


def padnote(freqs, dur, cutoff=900, gain=0.30):
    t = taxis(dur)
    x = np.zeros(len(t))
    for f in freqs:
        for det in (0.996, 1.004):
            x += osc("saw", f * det, t) * 0.5
    x /= max(1, len(freqs))
    x = lowpass(x, cutoff)
    return x * adsr(len(t), min(0.6, dur * 0.25), 0.3, min(1.0, dur * 0.4), 0.7) * gain


def lead(freq, dur=0.8, kind="sine"):
    t = taxis(dur)
    vib = 1 + 0.006 * np.sin(2 * np.pi * 5.5 * t)
    x = osc(kind, freq * vib, t) + 0.3 * osc("sine", freq * 2, t)
    return x * adsr(len(t), 0.03, 0.15, 0.2, 0.6) * 0.5


def echo(x, delay=0.28, fb=0.35, reps=3):
    d = max(1, int(delay * SR))
    out = np.zeros(len(x) + d * reps)
    out[: len(x)] += x
    for i in range(1, reps + 1):
        out[d * i : d * i + len(x)] += x * (fb ** i)
    return out


def crackle(n):
    c = (rng.random(n) < 2.2e-4).astype(float) * rng.standard_normal(n) * 0.35
    floor = lowpass(rng.standard_normal(n), 4000) * 0.004
    return c + floor


class Song:
    def __init__(self, bpm, bars):
        self.bpm = bpm
        self.beat = 60.0 / bpm
        self.dur = bars * 4 * self.beat + 2.0
        self.mix = np.zeros(int(self.dur * SR))

    def place(self, sound, at, gain=1.0):
        i = int(at * SR)
        j = min(len(self.mix), i + len(sound))
        if i < len(self.mix):
            self.mix[i:j] += sound[: j - i] * gain

    def render(self, path_wav, width=True):
        x = np.tanh(self.mix * 1.1)
        peak = np.abs(x).max() + 1e-9
        x = x / peak * 0.89
        fi, fo = int(0.25 * SR), int(2.0 * SR)
        x[:fi] *= np.linspace(0, 1, fi)
        x[-fo:] *= np.linspace(1, 0, fo)
        if width:
            d = int(0.011 * SR)
            right = np.concatenate([np.zeros(d), x[:-d]]) * 0.96
            left = x
            stereo = np.stack([left, right], axis=1)
        else:
            stereo = np.stack([x, x], axis=1)
        pcm = (stereo * 32767).astype(np.int16)
        with wave.open(path_wav, "wb") as w:
            w.setnchannels(2)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes(pcm.tobytes())
        return self.dur - 2.0


def beats(song, pattern_kick=(0, 1, 2, 3), snare_beats=(1, 3), hats=8, open_hat_off=False):
    """Standard 4/4 drum loop across the whole song."""
    bars = int(song.dur // (4 * song.beat))
    for b in range(bars):
        base = b * 4 * song.beat
        for k in pattern_kick:
            song.place(kick(), base + k * song.beat, 0.95)
        for s in snare_beats:
            song.place(snare(), base + s * song.beat, 0.7)
        for h in range(hats):
            t = base + h * song.beat * 4 / hats
            song.place(hat(open_=open_hat_off and h % 2 == 1, seed=h + b), t, 0.32 if h % 2 else 0.2)


# ---------------- Track 1: Midnight Drive (lo-fi house, Am, 102 bpm) --------
def track_midnight_drive():
    s = Song(102, 26)
    chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]  # Am F C G
    penta = [57, 60, 62, 64, 67, 69, 72]
    beats(s, open_hat_off=True)
    for bar in range(26):
        base = bar * 4 * s.beat
        ch = chords[bar % 4]
        s.place(padnote([midi(n) for n in ch], 4 * s.beat, cutoff=750, gain=0.22), base)
        for e in range(8):  # bass 8ths
            s.place(bassnote(midi(ch[0] - 24), 0.22), base + e * s.beat / 2, 0.62)
        if bar % 2 == 1:  # sparse pluck melody
            for k, e in enumerate((0.5, 1.5, 2.0, 3.5)):
                note = penta[(bar * 3 + k * 2) % len(penta)]
                s.place(pluck(midi(note), 0.35, 0.55), base + e * s.beat, 0.4)
    s.mix += crackle(len(s.mix))
    return s


# ---------------- Track 2: Neon Rain (ambient, Cmaj, 76 bpm) ----------------
def track_neon_rain():
    s = Song(76, 20)
    chords = [[48, 52, 55, 59], [45, 48, 52, 57], [50, 53, 57, 60], [43, 47, 50, 55]]
    arp_seq = [72, 76, 79, 83, 79, 76]
    rain = lowpass(rng.standard_normal(len(s.mix)), 2500) * 0.02
    rain = highpass(rain, 400)
    s.mix += rain
    for bar in range(20):
        base = bar * 4 * s.beat
        ch = chords[bar % 4]
        s.place(padnote([midi(n) for n in ch], 4 * s.beat, cutoff=1100, gain=0.30), base)
        if bar % 2 == 0:
            s.place(kick(0.35), base, 0.6)
            s.place(kick(0.35), base + 2.5 * s.beat, 0.4)
        for k in range(16):  # arp 16ths
            note = arp_seq[(bar + k) % len(arp_seq)] + (12 if (k // 6) % 2 else 0)
            s.place(echo(pluck(midi(note), 0.3, 0.35), 0.24, 0.3, 2), base + k * s.beat / 4, 0.30)
    return s


# ---------------- Track 3: Desert Bloom (Dm, 92 bpm) ------------------------
def track_desert_bloom():
    s = Song(92, 24)
    chords = [[50, 53, 57], [46, 50, 53], [58, 62, 65], [53, 57, 60]]
    scale = [62, 65, 67, 69, 72, 74, 77]
    for bar in range(24):
        base = bar * 4 * s.beat
        ch = chords[bar % 4]
        s.place(kick(), base, 0.95)
        s.place(kick(0.22), base + 2.5 * s.beat, 0.55)
        s.place(snare(0.16), base + 2 * s.beat, 0.55)
        for h in range(8):
            s.place(hat(seed=bar * 8 + h), base + h * s.beat / 2, 0.22)
        s.place(padnote([midi(n) for n in ch], 4 * s.beat, cutoff=850, gain=0.18), base)
        for e, g in ((0, 0.6), (0.75, 0.45), (1.5, 0.5), (2.25, 0.45), (3, 0.6), (3.5, 0.4)):
            s.place(bassnote(midi(ch[0] - 24), 0.2), base + e * s.beat, g)
        melody = [(0, 0), (0.5, 2), (1, 1), (1.75, 3), (2.5, 2), (3, 4), (3.5, 1)]
        for e, deg in melody:
            note = scale[(deg + bar) % len(scale)]
            s.place(echo(pluck(midi(note), 0.45, 0.75), 0.31, 0.32, 3), base + e * s.beat, 0.42)
    return s


# ---------------- Track 4: Slow Waves (Fmaj, 68 bpm) ------------------------
def track_slow_waves():
    s = Song(68, 18)
    chords = [[53, 57, 60, 64], [50, 53, 57, 62], [46, 50, 53, 58], [48, 52, 55, 60]]
    notes = [77, 76, 74, 72, 69, 65, 64, 62]
    for bar in range(18):
        base = bar * 4 * s.beat
        ch = chords[bar % 4]
        s.place(padnote([midi(n - 12) for n in ch], 4 * s.beat, cutoff=600, gain=0.34), base)
        s.place(padnote([midi(n) for n in ch], 4 * s.beat, cutoff=1400, gain=0.14), base)
        s.place(kick(0.4), base, 0.55)
        for h in range(16):  # shaker 16ths
            s.place(hat(0.03, seed=bar * 16 + h), base + h * s.beat / 4, 0.10 if h % 2 else 0.06)
        if bar % 2 == 1:
            n1, n2 = notes[bar % len(notes)], notes[(bar + 3) % len(notes)]
            s.place(echo(lead(midi(n1), 1.6 * s.beat), 0.35, 0.4, 3), base, 0.30)
            s.place(echo(lead(midi(n2), 1.2 * s.beat), 0.35, 0.4, 3), base + 2.5 * s.beat, 0.26)
    s.mix += lowpass(rng.standard_normal(len(s.mix)), 300) * 0.012  # ocean swell
    return s


# ---------------- Track 5: Night Market (Gm, 106 bpm) -----------------------
def track_night_market():
    s = Song(106, 26)
    chords = [[55, 58, 62], [51, 55, 58], [53, 56, 60], [50, 53, 57]]
    stab_scale = [67, 70, 74, 79]
    beats(s, snare_beats=(1, 3), hats=8, open_hat_off=True)
    bassline = [(0, 0, 0.22), (0.5, 0, 0.18), (0.75, 12, 0.14), (1.5, 0, 0.2),
                (2, 3, 0.18), (2.5, 0, 0.14), (3, -2, 0.2), (3.5, 5, 0.16)]
    for bar in range(26):
        base = bar * 4 * s.beat
        ch = chords[bar % 4]
        root = ch[0] - 24
        for e, off, ln in bassline:
            s.place(bassnote(midi(root + off), ln), base + e * s.beat, 0.55)
        s.place(padnote([midi(n) for n in ch], 4 * s.beat, cutoff=900, gain=0.13), base)
        if bar % 2 == 0:  # offbeat stabs
            for e in (0.5, 1.5, 2.5, 3.5):
                chord_stab = np.zeros(int(0.14 * SR))
                for n in ch:
                    chord_stab += pluck(midi(n + 12), 0.14, 0.9)
                s.place(chord_stab, base + e * s.beat, 0.16)
        if bar % 4 == 3:  # lead lick
            for k, e in enumerate((2.0, 2.5, 3.0, 3.5)):
                s.place(pluck(midi(stab_scale[(bar + k) % 4]), 0.3, 0.8), base + e * s.beat, 0.35)
    s.mix += crackle(len(s.mix)) * 0.6
    return s


# ---------------- Track 6: Aurora (Em, 84 bpm) ------------------------------
def track_aurora():
    s = Song(84, 22)
    chords = [[52, 55, 59], [48, 52, 55], [50, 53, 57], [47, 50, 54]]
    arp = [64, 67, 71, 76, 71, 67]
    sparkle = [88, 91, 95, 100, 103]
    for bar in range(22):
        base = bar * 4 * s.beat
        ch = chords[bar % 4]
        s.place(padnote([midi(n) for n in ch], 4 * s.beat, cutoff=1000, gain=0.26), base)
        s.place(kick(0.35), base, 0.5)
        s.place(kick(0.3), base + 2 * s.beat, 0.35)
        for k in range(8):  # dreamy 8th arp with echo
            note = arp[(k + bar) % len(arp)] + (12 if bar % 2 else 0)
            s.place(echo(pluck(midi(note), 0.4, 0.4), 0.36, 0.42, 3), base + k * s.beat / 2, 0.26)
        if bar % 3 == 2:
            for k in range(3):
                note = sparkle[(bar + k) % len(sparkle)]
                s.place(echo(lead(midi(note), 0.9), 0.4, 0.45, 3), base + (1 + k) * s.beat, 0.14)
    return s


TRACKS = [
    {"slug": "midnight-drive", "title": "Midnight Drive", "artist": "Wave Local", "album": "Night Lines", "fn": track_midnight_drive, "hue": 145},
    {"slug": "neon-rain", "title": "Neon Rain", "artist": "Wave Local", "album": "Night Lines", "fn": track_neon_rain, "hue": 160},
    {"slug": "desert-bloom", "title": "Desert Bloom", "artist": "Dune Circuit", "album": "Mirage", "fn": track_desert_bloom, "hue": 95},
    {"slug": "slow-waves", "title": "Slow Waves", "artist": "Tidal Form", "album": "Low Tide", "fn": track_slow_waves, "hue": 190},
    {"slug": "night-market", "title": "Night Market", "artist": "Dune Circuit", "album": "Mirage", "fn": track_night_market, "hue": 130},
    {"slug": "aurora", "title": "Aurora", "artist": "Tidal Form", "album": "Low Tide", "fn": track_aurora, "hue": 220},
]


def hsl(h, s, l):
    import colorsys
    r, g, b = colorsys.hls_to_rgb(h / 360.0, l, s)
    return np.array([r, g, b])


def make_cover(path, hue, seed):
    r = np.random.default_rng(seed)
    W = H = 640
    yy, xx = np.mgrid[0:H, 0:W].astype(float)
    base_top = hsl(hue, 0.25, 0.07)
    base_bot = hsl((hue + 30) % 360, 0.30, 0.11)
    t = (yy / H)[..., None]
    img = base_top * (1 - t) + base_bot * t
    # neon glow blobs
    for i in range(3):
        cx, cy = r.uniform(0.15, 0.85, 2) * [W, H]
        rad = r.uniform(0.25, 0.55) * W
        glow_hue = (hue + r.uniform(-25, 45)) % 360
        gc = hsl(glow_hue, 0.95, 0.55)
        d2 = ((xx - cx) ** 2 + (yy - cy) ** 2) / (rad ** 2)
        glow = np.exp(-d2 * 2.2)[..., None] * gc * r.uniform(0.35, 0.6)
        img = 1 - (1 - np.clip(img, 0, 1)) * (1 - np.clip(glow, 0, 1))
    im = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8))
    # flowing wave lines
    draw = ImageDraw.Draw(im, "RGBA")
    for i in range(7):
        yc = H * (0.18 + 0.11 * i) + r.uniform(-14, 14)
        amp = r.uniform(10, 42)
        ph = r.uniform(0, 6.28)
        freq = r.uniform(1.5, 3.5)
        pts = []
        for x in range(0, W + 8, 8):
            y = yc + amp * np.sin(ph + x / W * 6.28 * freq) * np.sin(x / W * 3.14)
            pts.append((x, y))
        a = int(r.uniform(60, 150))
        col = hsl((hue + r.uniform(-20, 40)) % 360, 0.9, 0.6)
        draw.line(pts, fill=(int(col[0] * 255), int(col[1] * 255), int(col[2] * 255), a), width=2)
    im = im.filter(ImageFilter.GaussianBlur(0.4))
    # grain + vignette
    arr = np.asarray(im).astype(float)
    arr += r.normal(0, 7, arr.shape)
    vig = 1 - 0.35 * (((xx - W / 2) ** 2 + (yy - H / 2) ** 2) / ((W / 1.15) ** 2))
    arr *= vig[..., None]
    Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).save(path)


def make_mix_cover(path, hue_a, hue_b, seed):
    r = np.random.default_rng(seed)
    W = H = 640
    yy, xx = np.mgrid[0:H, 0:W].astype(float)
    m = np.clip((xx + yy) / (W + H) + r.normal(0, 0.02, (H, W)), 0, 1)[..., None]
    img = hsl(hue_a, 0.35, 0.09) * (1 - m) + hsl(hue_b, 0.45, 0.14) * m
    cx, cy = W * 0.5, H * 0.42
    d2 = ((xx - cx) ** 2 + (yy - cy) ** 2) / ((W * 0.42) ** 2)
    glow = np.exp(-d2 * 2.0)[..., None] * hsl(hue_b, 0.95, 0.55) * 0.55
    img = 1 - (1 - np.clip(img, 0, 1)) * (1 - np.clip(glow, 0, 1))
    im = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8))
    draw = ImageDraw.Draw(im, "RGBA")
    for i in range(4):  # concentric rings
        rr = 60 + i * 42
        col = hsl((hue_b + i * 12) % 360, 0.9, 0.62)
        draw.ellipse([cx - rr, cy - rr, cx + rr, cy + rr],
                     outline=(int(col[0]*255), int(col[1]*255), int(col[2]*255), 130 - i * 22), width=3)
    arr = np.asarray(im).astype(float)
    arr += r.normal(0, 6, arr.shape)
    Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).save(path)


def make_icon(path, size):
    im = Image.new("RGB", (size, size), (16, 19, 19))
    draw = ImageDraw.Draw(im)
    u = size / 512.0
    # subtle radial glow
    glow = Image.new("L", (size, size), 0)
    gd = ImageDraw.Draw(glow)
    gd.ellipse([size*0.2, size*0.2, size*0.8, size*0.8], fill=70)
    glow = glow.filter(ImageFilter.GaussianBlur(size * 0.12))
    neon = Image.new("RGB", (size, size), (0, 255, 102))
    im = Image.composite(neon, im, glow.point(lambda p: p * 0.35 // 1))
    draw = ImageDraw.Draw(im)
    bars = [0.34, 0.62, 0.95, 0.72, 0.45, 0.28, 0.55]
    bw = 34 * u
    gap = 22 * u
    total = len(bars) * bw + (len(bars) - 1) * gap
    x0 = (size - total) / 2
    cy = size / 2
    for i, h in enumerate(bars):
        bh = h * size * 0.52
        x = x0 + i * (bw + gap)
        draw.rounded_rectangle([x, cy - bh / 2, x + bw, cy + bh / 2], radius=bw / 2, fill=(0, 255, 102))
    im.save(path)


def to_mp3(wav_path, mp3_path):
    r = subprocess.run(
        ["ffmpeg", "-y", "-i", wav_path, "-codec:a", "libmp3lame", "-b:a", "160k", mp3_path],
        capture_output=True, text=True)
    if r.returncode != 0:
        print("ffmpeg failed:", r.stderr[-500:])
        raise SystemExit(1)


def main():
    meta = {"tracks": [], "mixes": []}
    for i, tr in enumerate(TRACKS):
        print(f"[{i+1}/6] synthesizing {tr['title']} ...", flush=True)
        song = tr["fn"]()
        wav_path = os.path.join(OUT, f"{tr['slug']}.wav")
        dur = song.render(wav_path)
        mp3_path = os.path.join(OUT, f"{tr['slug']}.mp3")
        to_mp3(wav_path, mp3_path)
        os.remove(wav_path)
        cover = f"{tr['slug']}.png"
        make_cover(os.path.join(OUT, cover), tr["hue"], 1000 + i)
        meta["tracks"].append({
            "title": tr["title"], "artist": tr["artist"], "album": tr["album"],
            "durationSec": round(dur), "audioFile": f"{tr['slug']}.mp3", "coverFile": cover,
        })
    mixes = [
        {"name": "Late Night Focus", "description": "Hazy synths and slow pulses for deep work.", "hue": (150, 190)},
        {"name": "Morning Energy", "description": "Bright grooves to start the day moving.", "hue": (95, 140)},
        {"name": "Desert Nights", "description": "Warm plucks and neon haze after dark.", "hue": (130, 220)},
    ]
    for i, mx in enumerate(mixes):
        cover = f"mix-{i+1}.png"
        make_mix_cover(os.path.join(OUT, cover), mx["hue"][0], mx["hue"][1], 5000 + i)
        meta["mixes"].append({**mx, "coverFile": cover})
    make_icon(os.path.join(OUT, "icon-512.png"), 512)
    make_icon(os.path.join(OUT, "icon-192.png"), 192)
    with open(os.path.join(OUT, "meta.json"), "w") as f:
        json.dump(meta, f, indent=2)
    print("done:", json.dumps(meta, indent=2)[:400])


if __name__ == "__main__":
    main()
