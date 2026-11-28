/**
 * shaders.ts — GLSL ES 3.00 shaders for the 7-Pass Mythic Ink-Cel WebGL2 Pipeline:
 *   Pass 1:   All-Biome Deep Abyssal Chasm Parallax & Atmospheric Spectacle (-1..4)
 *   Pass 1.5: Procedural Animated Organic Hazard Shader (FBM Magma, Voronoi Bile, Consecrated Runes, Curing Caustics)
 *   Pass 2/3: Dynamic Ink-Cel Sprite, Floor, Telegraph & Multi-Layer Ribbon Batcher
 *   Pass 4:   Additive Dynamic Lightmap FBO (Warm Flickering Braziers, Sconces, Hazards, Boons)
 *   Pass 5:   Dual-Pass Selective Bloom (Bright Extract + Separable H/V 9-Tap Gaussian Blur)
 *   Pass 6:   Radial Shockwave, Chromatic Aberration, Chiaroscuro Lightmap, Jewel-Tone Grade,
 *             Split Vignette & Comic Paper/Ink Micro-Grain
 */

export const FULLSCREEN_VERT = `#version 300 es
precision highp float;

out vec2 vUv;

void main() {
  // Single overshooting triangle covering clip space [-1, 1] with zero VBO overhead
  vec2 pos = vec2(
    (gl_VertexID == 1) ? 3.0 : -1.0,
    (gl_VertexID == 2) ? 3.0 : -1.0
  );
  vUv = pos * 0.5 + 0.5;
  gl_Position = vec4(pos, 0.0, 1.0);
}
`;

// ============================================================================
// Pass 2a: Hand-Painted Seamless Isometric Chamber Floor Shader
//   Samples a 1024x1024 seamless hand-painted biome stone floor texture in
//   2:1 isometric world coordinates with painterly macro-variation, recessed
//   Greco-Roman perimeter border trim, and deep architectural wall/corner AO!
// ============================================================================

export const FLOOR_VERT = `#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform vec4 uScreenRect; // x0, y0, x1, y1 in CSS screen px
uniform vec4 uWorldRect;  // minX, minY, maxX, maxY in world units

out vec2 vWorldPos;
out vec2 vRoomUv;

void main() {
  vec2 c;
  if (gl_VertexID == 0) c = vec2(0.0, 0.0);
  else if (gl_VertexID == 1) c = vec2(1.0, 0.0);
  else if (gl_VertexID == 2) c = vec2(1.0, 1.0);
  else if (gl_VertexID == 3) c = vec2(0.0, 0.0);
  else if (gl_VertexID == 4) c = vec2(1.0, 1.0);
  else c = vec2(0.0, 1.0);

  vec2 screenPos = mix(uScreenRect.xy, uScreenRect.zw, c);
  vec2 ndc = (screenPos / uResolution) * 2.0 - 1.0;
  ndc.y = -ndc.y;
  gl_Position = vec4(ndc, 0.0, 1.0);

  vRoomUv = c;
  vWorldPos = mix(uWorldRect.xy, uWorldRect.zw, c);
}
`;

export const FLOOR_FRAG = `#version 300 es
precision highp float;

in vec2 vWorldPos;
in vec2 vRoomUv;

uniform sampler2D uFloorTex;
uniform vec4 uWorldRect; // minX, minY, maxX, maxY
uniform vec3 uTrimColor;
uniform vec3 uDeepColor;
uniform float uRoomSeed;

out vec4 fragColor;

float hash21f(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noisef(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21f(i), hash21f(i + vec2(1.0, 0.0)), f.x),
    mix(hash21f(i + vec2(0.0, 1.0)), hash21f(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

void main() {
  // Sample seamless hand-painted biome stone texture cleanly in isometric space
  // Scale: 1 repeat = 520 world units horizontally, 520 vertically (already projected 2:1 on screen via isoScaleY!)
  vec2 tileUv = (vWorldPos + vec2(uRoomSeed * 19.3, uRoomSeed * 11.7)) / 520.0;
  vec3 texCol = texture(uFloorTex, tileUv).rgb;

  // Secondary subtle large-scale painterly weathering modulation (eliminates wallpaper repetition!)
  float macroA = noisef(vWorldPos * 0.0028 + vec2(uRoomSeed * 0.71, -uRoomSeed * 0.43));
  float macroB = noisef(vWorldPos * 0.0068 - vec2(uRoomSeed * 0.37, uRoomSeed * 0.61));
  float warmShift = (macroA - 0.5) * 0.14;
  float wearMod = 0.86 + 0.24 * (macroA * 0.62 + macroB * 0.38);
  vec3 col = texCol * wearMod * vec3(1.0 + warmShift * 0.7, 1.0 + warmShift * 0.15, 1.0 - warmShift * 0.65);

  // Subtle radial chamber focal illumination (warmer center arena, moodier architectural corners)
  vec2 centered = (vRoomUv - 0.5) * 2.0;
  float rDist = length(centered * vec2(0.92, 0.96));
  float arenaVig = 1.06 - 0.26 * pow(clamp(rDist, 0.0, 1.35), 1.65);
  col *= arenaVig;

  // Recessed Greco-Roman hammered metallic border band inset ~38 world units inside walls!
  float dLeft = vWorldPos.x - uWorldRect.x;
  float dRight = uWorldRect.z - vWorldPos.x;
  float dTop = vWorldPos.y - uWorldRect.y;
  float dBot = uWorldRect.w - vWorldPos.y;
  float edgeDist = min(min(dLeft, dRight), min(dTop, dBot));

  float outerGroove = smoothstep(3.5, 0.0, abs(edgeDist - 36.0));
  float trimBand = smoothstep(4.2, 1.0, abs(edgeDist - 42.0));
  float innerGroove = smoothstep(3.0, 0.0, abs(edgeDist - 48.0));
  // Subtle Greek meander notch pattern along the inlaid border band
  float perimCoord = (min(dLeft, dRight) < min(dTop, dBot)) ? vWorldPos.y : vWorldPos.x;
  float keyNotch = 0.72 + 0.28 * step(0.42, fract(perimCoord / 28.0));

  col = mix(col, vec3(0.035, 0.024, 0.055), clamp(outerGroove * 0.78 + innerGroove * 0.65, 0.0, 0.88));
  col = mix(col, uTrimColor * (0.76 * keyNotch), trimBand * 0.52);

  // Deep architectural wall-base Ambient Occlusion (Northern wall drop shadow + West/East parapet AO)
  float northAO = 1.0 - 0.64 * exp(-max(0.0, dTop) / 42.0);
  float westAO = 1.0 - 0.42 * exp(-max(0.0, dLeft) / 36.0);
  float eastAO = 1.0 - 0.28 * exp(-max(0.0, dRight) / 28.0);
  float southAO = 1.0 - 0.24 * exp(-max(0.0, dBot) / 22.0);
  col *= northAO * westAO * eastAO * southAO;

  // Subtle dark corner blending into abyssal palette at outer rim
  col = mix(uDeepColor * 0.6, col, smoothstep(0.0, 12.0, edgeDist));

  fragColor = vec4(col, 1.0);
}
`;

// ============================================================================
// Pass 1: All-Biome Deep Abyssal Chasm Parallax & Atmospheric Spectacle
//   uBiomeMode:
//     -1.0 = Sanctum Courtyard (plum-indigo vault, distant temple pillars, golden ash motes)
//      0.0 = Obsidian Pit (deep cavern, subterranean stone ribs, turquoise soul-mist columns)
//      1.0 = Cinder Mire (molten magma ocean, dark basalt rivers, billowing ash & rising embers)
//      2.0 = Verdant Colosseum (sunlit aquamarine mist gorge, classical colonnades, golden sunbeams, petals)
//      3.0 = Crypt of Bile (vaulted gothic catacomb arches, chartreuse miasma fog, glowing spore shafts)
//      4.0 = Frozen Summit (twilight glacial crags, emerald/violet/rose aurora curtains, slanted blizzard)
// ============================================================================

export const ABYSS_FRAG = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform float uTime;
uniform vec2 uCamPos;
uniform float uZoom;
uniform vec2 uResolution;
uniform vec3 uDeepColor;
uniform vec3 uMidColor;
uniform vec3 uMistColor;
uniform vec3 uAccentColor;
uniform float uBiomeMode;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.52;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 4; i++) {
    v += amp * noise(p);
    p = rot * p * 2.03;
    amp *= 0.5;
  }
  return v;
}

float pillarSilhouette(vec2 p, float freq, float seed) {
  float col = floor(p.x * freq);
  float fx = fract(p.x * freq);
  float h = hash21(vec2(col, seed));
  float pillarPresent = step(0.36, h);
  float width = mix(0.20, 0.42, hash21(vec2(col + 17.0, seed)));
  float inPillar = smoothstep(0.025, 0.0, abs(fx - 0.5) - width * 0.5);
  float topY = mix(0.16, 0.78, h);
  float belowTop = smoothstep(topY + 0.04, topY, p.y);
  return pillarPresent * inPillar * belowTop;
}

float colonnadeArch(vec2 p, float freq, float baseH) {
  float fx = fract(p.x * freq) - 0.5;
  float pillar = smoothstep(0.14, 0.10, abs(abs(fx) - 0.36));
  float archCurve = baseH + sqrt(max(0.0, 0.14 - fx * fx)) * 0.42;
  float upperWall = smoothstep(archCurve - 0.02, archCurve + 0.02, p.y) * smoothstep(baseH + 0.42, baseH + 0.36, p.y);
  float lowerCols = pillar * smoothstep(archCurve + 0.02, archCurve - 0.02, p.y);
  return clamp(max(upperWall, lowerCols), 0.0, 1.0);
}

void main() {
  vec2 aspect = vec2(uResolution.x / max(1.0, uResolution.y), 1.0);
  vec2 centered = (vUv - 0.5) * aspect;

  // Deep abyssal vertical gradient
  float depthGrad = clamp(vUv.y * 0.92 + 0.08, 0.0, 1.0);
  vec3 col = mix(uDeepColor, uMidColor, pow(max(depthGrad, 0.0001), 1.32));

  vec2 p1 = centered + uCamPos * 0.00016 * uZoom;
  vec2 p2 = centered + uCamPos * 0.00032 * uZoom;

  // Flowing animated underworld mist base
  vec2 mistUv1 = centered * vec2(2.0, 3.2) + uCamPos * 0.00038 + vec2(uTime * 0.042, -uTime * 0.024);
  vec2 mistUv2 = centered * vec2(3.2, 2.1) + uCamPos * 0.00058 + vec2(-uTime * 0.055, -uTime * 0.018);
  float m1 = fbm(mistUv1);
  float m2 = fbm(mistUv2 + vec2(m1 * 0.72, -m1 * 0.42));

  if (uBiomeMode < -0.5) {
    // =========================================================================
    // -1.0: Sanctum Courtyard — velvety plum vault, temple colonnade, gold ash
    // =========================================================================
    float farCols = pillarSilhouette(vec2(p1.x + 1.2, vUv.y), 4.8, 7.1);
    float midCols = pillarSilhouette(vec2(p2.x - 0.5, vUv.y + 0.06), 2.9, 19.3);
    float rimShift = pillarSilhouette(vec2(p2.x - 0.486, vUv.y + 0.06), 2.9, 19.3);
    float rim = clamp(rimShift - midCols, 0.0, 1.0);
    col = mix(col, uDeepColor * 0.56, farCols * 0.65);
    col = mix(col, vec3(0.04, 0.02, 0.07), midCols * 0.78);
    col += vec3(0.92, 0.72, 0.30) * rim * 0.30;

    float mistBand = smoothstep(0.36, 0.84, m2) * (0.42 + 0.58 * (1.0 - vUv.y));
    col = mix(col, uMistColor, mistBand * 0.44);

    // Warm hearth horizon glow from deep palace fires
    float hearth = smoothstep(0.55, 0.0, vUv.y) * (0.26 + 0.10 * sin(uTime * 1.4 + centered.x * 2.4));
    col += vec3(0.95, 0.48, 0.20) * hearth * 0.34;
  } else if (uBiomeMode < 0.5) {
    // =========================================================================
    // 0.0: Obsidian Pit — sunken stone ribs + rising spectral jade soul-columns
    // =========================================================================
    float spiresFar = pillarSilhouette(vec2(p1.x + 1.4, vUv.y), 5.4, 11.3);
    float spiresMid = pillarSilhouette(vec2(p2.x - 0.7, vUv.y + 0.08), 3.1, 29.7);
    float rimShift = pillarSilhouette(vec2(p2.x - 0.684, vUv.y + 0.08), 3.1, 29.7);
    float rim = clamp(rimShift - spiresMid, 0.0, 1.0);
    col = mix(col, uDeepColor * 0.62, spiresFar * 0.68);
    col = mix(col, vec3(0.02, 0.05, 0.07), spiresMid * 0.82);
    col += vec3(0.16, 0.94, 0.70) * rim * 0.32;

    // Rising vertical spectral turquoise soul-mist columns
    float colWave = sin(centered.x * 7.5 + m1 * 2.8) * 0.5 + 0.5;
    float soulCol = smoothstep(0.58, 0.95, colWave * fbm(vec2(centered.x * 4.5, vUv.y * 2.2 - uTime * 0.22)));
    col += vec3(0.14, 0.88, 0.68) * soulCol * (0.35 + 0.65 * (1.0 - vUv.y)) * 0.38;

    float mistBand = smoothstep(0.38, 0.82, m2) * (0.45 + 0.55 * (1.0 - vUv.y));
    col = mix(col, uMistColor, mistBand * 0.45);
  } else if (uBiomeMode < 1.5) {
    // =========================================================================
    // 1.0: Cinder Mire — churning incandescent magma ocean + dark ash plumes
    // =========================================================================
    float spiresFar = pillarSilhouette(vec2(p1.x + 0.8, vUv.y), 4.6, 33.1);
    col = mix(col, vec3(0.07, 0.02, 0.02), spiresFar * 0.62);

    // Multi-octave molten lava rivers winding across cracked basalt abyss
    vec2 lavaUv = centered * vec2(2.6, 4.0) + uCamPos * 0.00045 + vec2(uTime * 0.06, -uTime * 0.045);
    float l1 = fbm(lavaUv);
    float l2 = fbm(lavaUv * 1.9 + vec2(l1 * 1.2, -l1 * 0.9) + vec2(-uTime * 0.05, uTime * 0.03));
    float lavaRidge = 1.0 - abs(l2 * 2.0 - 1.0);
    float lavaRiver = smoothstep(0.62, 0.96, lavaRidge);
    float lavaCore = smoothstep(0.84, 0.99, lavaRidge);
    vec3 magmaCol = mix(vec3(0.92, 0.22, 0.02), vec3(1.0, 0.68, 0.14), lavaRiver);
    magmaCol = mix(magmaCol, vec3(1.0, 0.95, 0.65), lavaCore);
    float magmaMask = 0.55 + 0.45 * (1.0 - vUv.y);
    col = mix(col, vec3(0.12, 0.03, 0.03), (1.0 - lavaRiver) * 0.45);
    col += magmaCol * lavaRiver * magmaMask * 0.88;

    // Drifting dark volcanic ash smoke ribbons
    float ashBand = smoothstep(0.45, 0.85, m1) * (0.35 + 0.45 * vUv.y);
    col = mix(col, vec3(0.14, 0.05, 0.05), ashBand * 0.42);
  } else if (uBiomeMode < 2.5) {
    // =========================================================================
    // 2.0: Verdant Colosseum — sunlit aquamarine gorge, marble colonnades & rays
    // =========================================================================
    // Distant classical marble viaduct colonnades
    float archFar = colonnadeArch(vec2(p1.x * 1.15 + 0.4, vUv.y), 2.4, 0.24);
    float archMid = colonnadeArch(vec2(p2.x * 1.05 - 0.3, vUv.y), 1.65, 0.12);
    col = mix(col, vec3(0.08, 0.24, 0.30), archFar * 0.52);
    col = mix(col, vec3(0.05, 0.17, 0.22), archMid * 0.68);
    // Warm sunlit gold rim on left/NW edge of marble columns
    float archRim = clamp(colonnadeArch(vec2(p2.x * 1.05 - 0.288, vUv.y), 1.65, 0.12) - archMid, 0.0, 1.0);
    col += vec3(1.0, 0.90, 0.58) * archRim * 0.36;

    // Diagonal warm golden sun-shafts cutting from Upper-Left (NW) across sunlit mist
    float rayCoord = centered.x * 1.65 + (1.0 - vUv.y) * 0.92;
    float sunShaft = pow(max(0.0, sin(rayCoord * 5.2 + m1 * 1.2) * 0.5 + 0.5), 3.2);
    sunShaft *= smoothstep(0.05, 0.92, vUv.y) * (0.65 + 0.35 * sin(uTime * 0.55 + rayCoord * 2.0));
    col += vec3(1.0, 0.91, 0.56) * sunShaft * 0.30;

    // Luminous aquamarine valley mist
    float mistBand = smoothstep(0.32, 0.80, m2) * (0.48 + 0.52 * (1.0 - vUv.y));
    col = mix(col, uMistColor, mistBand * 0.48);
  } else if (uBiomeMode < 3.5) {
    // =========================================================================
    // 3.0: Crypt of Bile — vaulted gothic catacomb ribs & chartreuse miasma
    // =========================================================================
    // Receding vaulted stone catacomb arch ribs
    float vaultFar = colonnadeArch(vec2(p1.x + 0.2, 1.0 - vUv.y), 2.8, 0.28);
    float vaultMid = colonnadeArch(vec2(p2.x - 0.35, 1.0 - vUv.y), 1.85, 0.18);
    col = mix(col, vec3(0.05, 0.07, 0.03), vaultFar * 0.62);
    col = mix(col, vec3(0.03, 0.05, 0.02), vaultMid * 0.80);
    float vaultRim = clamp(colonnadeArch(vec2(p2.x - 0.338, 1.0 - vUv.y), 1.85, 0.18) - vaultMid, 0.0, 1.0);
    col += vec3(0.56, 0.88, 0.16) * vaultRim * 0.28;

    // Thick drifting sickly chartreuse miasma fog + rising spore shafts
    float sporeShaft = pow(max(0.0, sin(centered.x * 6.8 - uTime * 0.18 + m1 * 2.4) * 0.5 + 0.5), 3.0);
    col += vec3(0.46, 0.78, 0.14) * sporeShaft * (0.35 + 0.65 * (1.0 - vUv.y)) * 0.26;
    float mistBand = smoothstep(0.32, 0.82, m2) * (0.50 + 0.50 * (1.0 - vUv.y));
    col = mix(col, uMistColor, mistBand * 0.52);
  } else {
    // =========================================================================
    // 4.0: Frozen Summit — boreal peaks, multi-band aurora & slanted blizzard
    // =========================================================================
    // Distant silhouetted jagged glacial crags
    float ridge1 = 0.26 + 0.16 * fbm(vec2(p1.x * 2.8 + 4.1, 1.7));
    float ridge2 = 0.16 + 0.14 * fbm(vec2(p2.x * 3.6 - 2.3, 3.1));
    float peakFar = smoothstep(ridge1 + 0.015, ridge1 - 0.015, vUv.y);
    float peakMid = smoothstep(ridge2 + 0.012, ridge2 - 0.012, vUv.y);
    // Faint coral-rose twilight horizon glow behind distant peaks
    float horizonGlow = exp(-pow((vUv.y - 0.34) * 5.2, 2.0));
    col += vec3(0.95, 0.44, 0.32) * horizonGlow * 0.22;
    col = mix(col, vec3(0.06, 0.11, 0.20), peakFar * 0.75);
    col = mix(col, vec3(0.04, 0.07, 0.14), peakMid * 0.88);

    // Sweeping emerald / violet / rose Aurora Borealis curtains across boreal sky
    float waveA = sin(centered.x * 4.2 + uTime * 0.42 + m1 * 3.2) * 0.5 + 0.5;
    float waveB = sin(centered.x * 6.4 - uTime * 0.31 + m2 * 2.6) * 0.5 + 0.5;
    float auroraBand = smoothstep(0.28, 0.94, vUv.y) * smoothstep(0.30, 0.92, (waveA * 0.65 + waveB * 0.35) * (0.45 + 0.75 * m2));
    vec3 auroraCol = mix(vec3(0.21, 0.95, 0.72), vec3(0.70, 0.39, 1.0), smoothstep(0.2, 0.8, sin(centered.x * 2.0 + uTime * 0.25) * 0.5 + 0.5));
    auroraCol = mix(auroraCol, vec3(1.0, 0.43, 0.54), smoothstep(0.65, 0.98, waveB) * 0.45);
    col += auroraCol * auroraBand * 0.68;

    // Slanted high-altitude wind-driven blizzard snow streaks
    vec2 windUv = vec2(centered.x * 16.0 + vUv.y * 9.5 + uTime * 3.6, vUv.y * 8.0 + uTime * 1.4);
    float streakNoise = fbm(windUv * vec2(1.0, 0.25));
    float blizzard = smoothstep(0.72, 0.92, streakNoise) * 0.22;
    col += vec3(0.84, 0.95, 1.0) * blizzard;
  }

  // Subtle chasm bottom glow
  float lowerGlow = smoothstep(0.62, 0.0, vUv.y) * (0.22 + 0.12 * sin(uTime * 1.15 + centered.x * 3.0));
  col += uAccentColor * lowerGlow * 0.22;

  // Atmospheric drifting motes (golden ash, jade sparks, embers, rose petals, chartreuse spores, snow)
  float moteSpeedY = (uBiomeMode > 3.5) ? 0.34 : (uBiomeMode > 1.5 && uBiomeMode < 2.5) ? 0.18 : -0.34;
  float moteSpeedX = (uBiomeMode > 3.5) ? 0.55 : (uBiomeMode > 1.5 && uBiomeMode < 2.5) ? -0.22 : 0.0;
  vec2 moteGrid = centered * 11.5 + uCamPos * 0.00085 + vec2(uTime * moteSpeedX, uTime * moteSpeedY);
  vec2 sparkCell = floor(moteGrid);
  vec2 sparkLocal = fract(moteGrid) - 0.5;
  float sparkSeed = hash21(sparkCell);
  float sparkVis = step(0.90, sparkSeed);
  float sparkDist = length(sparkLocal - vec2(sin(uTime * 2.1 + sparkSeed * 12.0) * 0.16, 0.0));
  float spark = sparkVis * smoothstep(0.12, 0.015, sparkDist) * (0.55 + 0.45 * sin(uTime * 4.8 + sparkSeed * 40.0));
  vec3 moteColor = (uBiomeMode > 1.5 && uBiomeMode < 2.5)
    ? mix(vec3(1.0, 0.46, 0.78), vec3(1.0, 0.92, 0.56), step(0.95, sparkSeed))
    : mix(uAccentColor, vec3(1.0, 0.95, 0.78), 0.52);
  col += moteColor * spark * 0.92;

  fragColor = vec4(col, 1.0);
}
`;

// ============================================================================
// Pass 1.5: Procedural Animated Organic Hazard Shader
//   Replaces ALL flat oval pools with organic domain-warped silhouettes:
//     uKind == 0.0: Molten Magma (advected FBM basalt crust + glowing fissures)
//     uKind == 1.0: Bubbling Caustic Bile (Voronoi popping acid bubbles + mossy ink rim)
//     uKind == 2.0: Consecrated Ground (rotating sacred Greco-Roman rune circles)
//     uKind == 3.0: Curing Pool (rippling luminous turquoise healing caustics)
// ============================================================================

export const HAZARD_VERT = `#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform vec2 uCenterScreen;
uniform vec2 uHalfSizeScreen;
uniform vec2 uCenterWorld;
uniform float uRadius;

out vec2 vLocal;
out vec2 vWorldPos;

void main() {
  vec2 corner;
  if (gl_VertexID == 0) corner = vec2(-1.0, -1.0);
  else if (gl_VertexID == 1) corner = vec2(1.0, -1.0);
  else if (gl_VertexID == 2) corner = vec2(1.0, 1.0);
  else if (gl_VertexID == 3) corner = vec2(-1.0, -1.0);
  else if (gl_VertexID == 4) corner = vec2(1.0, 1.0);
  else corner = vec2(-1.0, 1.0);

  // Pad local space to [-1.38, 1.38] so organic lobes & outer basalt/ink rim never clip
  vec2 local = corner * 1.38;
  vec2 screenPos = uCenterScreen + local * uHalfSizeScreen;
  vec2 ndc = (screenPos / uResolution) * 2.0 - 1.0;
  ndc.y = -ndc.y;
  gl_Position = vec4(ndc, 0.0, 1.0);

  vLocal = local;
  vWorldPos = uCenterWorld + local * uRadius;
}
`;

export const HAZARD_FRAG = `#version 300 es
precision highp float;

in vec2 vLocal;
in vec2 vWorldPos;

uniform float uTime;
uniform float uKind;    // 0=lava, 1=poison, 2=consecrated, 3=curing
uniform float uSeed;
uniform float uRadius;
uniform float uOpacity;

out vec4 fragColor;

float hash21(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

vec2 hash22(vec2 p) {
  float n = hash21(p);
  return vec2(n, hash21(p + vec2(17.3, 41.7)));
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.52;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 4; i++) {
    v += amp * noise(p);
    p = rot * p * 2.04;
    amp *= 0.5;
  }
  return v;
}

// Returns vec3(minDist, edgeDist, cellHash)
vec3 voronoi(vec2 x, float t) {
  vec2 n = floor(x);
  vec2 f = fract(x);
  float md = 8.0;
  float md2 = 8.0;
  float id = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = hash22(n + g);
      o = 0.5 + 0.42 * sin(t + 6.2831 * o);
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < md) {
        md2 = md;
        md = d;
        id = hash21(n + g + vec2(3.1, 7.7));
      } else if (d < md2) {
        md2 = d;
      }
    }
  }
  return vec3(sqrt(md), sqrt(md2) - sqrt(md), id);
}

void main() {
  float rLen = length(vLocal);
  float ang = atan(vLocal.y, vLocal.x + 1e-5);

  if (uKind < 0.5) {
    // =========================================================================
    // Kind 0: Molten Magma Pool (Organic domain-warped caldera + FBM crust)
    // =========================================================================
    float lobe = 0.14 * sin(3.0 * ang + uSeed * 6.2831)
               + 0.09 * cos(5.0 * ang - uSeed * 9.31)
               + 0.05 * sin(7.0 * ang + uSeed * 4.13);
    float warp = (fbm(vWorldPos * 0.026 + vec2(uSeed * 3.7, -uSeed * 2.1)) - 0.5) * 0.24;
    float d = rLen + lobe + warp;

    if (d > 1.28) discard;

    // Outer scorched floor halo
    float scorchAlpha = smoothstep(1.28, 1.06, d) * 0.45;
    vec3 col = vec3(0.06, 0.02, 0.03);
    float alpha = scorchAlpha;

    // Crisp comic-ink obsidian outline + charred volcanic basalt curb (d in 0.96..1.14)
    float outerInk = smoothstep(1.15, 1.11, d);
    float rimRock = smoothstep(1.09, 1.05, d);
    if (outerInk > 0.001) {
      vec3 inkCol = vec3(0.035, 0.024, 0.055); // #09060E
      float rimLight = smoothstep(-0.6, 0.8, -vLocal.x * 0.62 - vLocal.y * 0.78);
      vec3 basaltCol = mix(vec3(0.11, 0.045, 0.045), vec3(0.32, 0.14, 0.10), rimLight);
      col = mix(col, inkCol, outerInk);
      col = mix(col, basaltCol, rimRock);
      alpha = max(alpha, outerInk * 0.98);
    }

    // Molten interior (d < 0.99)
    float inside = smoothstep(1.00, 0.94, d);
    if (inside > 0.001) {
      // 2-layer advected FBM tectonic magma crust
      vec2 flow1 = vWorldPos * 0.022 + vec2(uTime * 0.17, -uTime * 0.11) + vec2(uSeed * 5.0);
      float f1 = fbm(flow1);
      vec2 flow2 = vWorldPos * 0.038 + vec2(-uTime * 0.13, uTime * 0.16) + vec2(f1 * 1.45, -f1 * 1.15);
      float f2 = fbm(flow2);

      // Sharp glowing fissure network tearing between dark drifting volcanic basalt plates
      float ridge = 1.0 - abs(f2 * 2.0 - 1.0);
      float fissure = smoothstep(0.58, 0.93, ridge);
      float hotCore = smoothstep(0.84, 0.98, ridge);

      // Cel-stepped cooled dark basalt plates (#190707 -> #30110D) covering ~55% of surface
      float crustStep = smoothstep(0.36, 0.62, f1);
      vec3 crustCol = mix(vec3(0.095, 0.028, 0.028), vec3(0.22, 0.072, 0.055), crustStep);

      // Blazing magma gradient (#B81D03 -> #FF680C -> #FFF099) inside narrow volcanic cracks
      vec3 magmaCol = mix(vec3(0.76, 0.12, 0.015), vec3(1.0, 0.42, 0.05), fissure);
      magmaCol = mix(magmaCol, vec3(1.0, 0.94, 0.62), hotCore);

      // Glowing hot meniscus bevel hugging the inner volcanic rim
      float meniscus = smoothstep(0.78, 0.95, d) * smoothstep(1.01, 0.94, d);
      // Popping thermal blisters via animated Voronoi
      vec3 vor = voronoi(vWorldPos * 0.042 + vec2(uSeed * 2.0), uTime * 1.35);
      float bPhase = fract(uTime * 0.55 + vor.z * 3.7);
      float bRing = smoothstep(0.07, 0.0, abs(vor.x - (0.08 + bPhase * 0.30))) * sin(bPhase * 3.14159);

      vec3 innerCol = mix(crustCol, magmaCol, smoothstep(0.18, 0.78, fissure));
      innerCol += vec3(1.0, 0.44, 0.08) * meniscus * 0.82;
      innerCol += vec3(1.0, 0.84, 0.36) * bRing * 0.75;

      // Recessed northern overhang depth shadow
      float recessAO = 1.0 - 0.40 * smoothstep(-0.32, -0.95, vLocal.y);
      innerCol *= recessAO;

      // Selective emissive lift strictly on hot magma cracks & blisters
      float emissiveLift = 1.0 + hotCore * 0.62 + meniscus * 0.28 + bRing * 0.35;
      innerCol *= emissiveLift;

      // Crisp thin inner ink line separating basalt curb from magma
      float innerInk = smoothstep(0.032, 0.0, abs(d - 0.97));
      innerCol = mix(innerCol, vec3(0.035, 0.024, 0.055), innerInk * 0.88);

      col = mix(col, innerCol, inside);
      alpha = max(alpha, inside * 0.99);
    }

    fragColor = vec4(col, alpha * uOpacity);
    return;
  }

  if (uKind < 1.5) {
    // =========================================================================
    // Kind 1: Bubbling Caustic Bile (Organic acid spill + Voronoi bubbles)
    // =========================================================================
    float lobe = 0.15 * sin(3.0 * ang + uSeed * 5.71)
               + 0.10 * cos(4.0 * ang - uSeed * 8.19)
               + 0.06 * sin(6.0 * ang + uSeed * 2.93);
    float warp = (fbm(vWorldPos * 0.030 + vec2(-uSeed * 2.5, uSeed * 4.1)) - 0.5) * 0.22;
    float d = rLen + lobe + warp;

    if (d > 1.24) discard;

    // Damp outer mossy seep
    vec3 col = vec3(0.06, 0.10, 0.03);
    float alpha = smoothstep(1.24, 1.04, d) * 0.42;

    // Comic-ink dark contour + damp moss-stone edge
    float outerInk = smoothstep(1.12, 1.08, d);
    float rimStone = smoothstep(1.06, 1.02, d);
    if (outerInk > 0.001) {
      vec3 inkCol = vec3(0.035, 0.024, 0.055);
      vec3 mossRim = vec3(0.15, 0.22, 0.10);
      col = mix(col, inkCol, outerInk);
      col = mix(col, mossRim, rimStone);
      alpha = max(alpha, outerInk * 0.96);
    }

    float inside = smoothstep(0.99, 0.93, d);
    if (inside > 0.001) {
      // Deep swirling olive-emerald bile gradient
      float swirl = fbm(vWorldPos * 0.032 + vec2(uTime * 0.14, -uTime * 0.18) + vec2(uSeed * 4.0));
      vec3 bileCol = mix(vec3(0.09, 0.22, 0.04), vec3(0.24, 0.56, 0.08), smoothstep(0.22, 0.72, swirl));
      bileCol = mix(bileCol, vec3(0.42, 0.88, 0.09), smoothstep(0.55, 0.88, swirl));

      // Animated Voronoi cellular caustic bubbles popping & expanding
      vec3 vor = voronoi(vWorldPos * 0.048 + vec2(uTime * 0.06, -uTime * 0.04), uTime * 1.1);
      float causticWeb = smoothstep(0.18, 0.02, vor.y);
      bileCol += vec3(0.36, 0.78, 0.12) * causticWeb * 0.42;

      // Individual popping toxic bubbles with dark outline & bright specular crescent
      float bCycle = fract(uTime * 0.62 + vor.z * 5.3);
      float bRad = 0.06 + bCycle * 0.30;
      float bFade = sin(bCycle * 3.14159);
      float bRim = smoothstep(0.055, 0.01, abs(vor.x - bRad)) * bFade;
      float bDark = smoothstep(0.085, 0.03, abs(vor.x - bRad)) * bFade;
      float bSpec = smoothstep(0.08, 0.01, length(vec2(vor.x - bRad * 0.45, vor.y - 0.15))) * bFade;
      bileCol = mix(bileCol, vec3(0.05, 0.12, 0.03), bDark * 0.55);
      bileCol += vec3(0.82, 1.0, 0.33) * (bRim * 0.92 + bSpec * 0.45);

      // Luminous acidic meniscus rim glow
      float acidRim = smoothstep(0.75, 0.94, d) * smoothstep(1.0, 0.93, d);
      bileCol += vec3(0.56, 0.96, 0.16) * acidRim * 0.72;

      // Sunken top-lip depth shadow + crisp ink inner contour
      bileCol *= (1.0 - 0.30 * smoothstep(-0.35, -0.94, vLocal.y));
      float innerInk = smoothstep(0.032, 0.0, abs(d - 0.96));
      bileCol = mix(bileCol, vec3(0.035, 0.024, 0.055), innerInk * 0.85);
      bileCol *= (1.0 + acidRim * 0.25 + bRim * 0.35);

      col = mix(col, bileCol, inside);
      alpha = max(alpha, inside * 0.97);
    }

    fragColor = vec4(col, alpha * uOpacity);
    return;
  }

  if (uKind < 2.5) {
    // =========================================================================
    // Kind 2: Consecrated Ground (Rotating Greco-Roman gilded rune circles)
    // =========================================================================
    if (rLen > 1.08) discard;

    float rotA = ang + uTime * 0.45;
    float rotB = ang - uTime * 0.65;
    float outerRing = smoothstep(0.045, 0.012, abs(rLen - 0.95));
    float innerRing = smoothstep(0.032, 0.008, abs(rLen - 0.72));
    float runeNotch = step(0.48, sin(rotA * 16.0) * 0.5 + 0.5) * smoothstep(0.065, 0.01, abs(rLen - 0.84));
    float starRays = pow(max(0.0, cos(rotB * 4.0)), 14.0) * smoothstep(0.92, 0.18, rLen) * smoothstep(0.08, 0.22, rLen);

    float mist = smoothstep(1.0, 0.08, rLen) * (0.24 + 0.10 * fbm(vWorldPos * 0.025 + vec2(uTime * 0.2, -uTime * 0.15)));
    float inkFrame = smoothstep(0.065, 0.025, abs(rLen - 0.975));

    vec3 goldCol = vec3(1.0, 0.88, 0.46);
    vec3 warmCore = vec3(1.0, 0.96, 0.78);
    vec3 col = mix(vec3(0.035, 0.024, 0.055), goldCol, clamp(outerRing + innerRing + runeNotch + starRays, 0.0, 1.0));
    col = mix(col, warmCore * 1.45, clamp(outerRing * 0.8 + starRays * 0.7, 0.0, 1.0));
    float alpha = clamp(mist + inkFrame * 0.65 + outerRing * 0.95 + innerRing * 0.78 + runeNotch * 0.82 + starRays * 0.55, 0.0, 0.96);

    fragColor = vec4(col, alpha * uOpacity);
    return;
  }

  // ===========================================================================
  // Kind 3: Curing Pool (Rippling luminous turquoise healing caustics)
  // ===========================================================================
  if (rLen > 1.04) discard;

  float inside = smoothstep(0.98, 0.88, rLen);
  vec3 vor1 = voronoi(vWorldPos * 0.065 + vec2(uTime * 0.16, -uTime * 0.12), uTime * 1.4);
  vec3 vor2 = voronoi(vWorldPos * 0.095 + vec2(-uTime * 0.14, uTime * 0.18), uTime * 1.8 + 1.7);
  float caustic = smoothstep(0.24, 0.02, vor1.y) * 0.65 + smoothstep(0.22, 0.02, vor2.y) * 0.55;
  float ripple = sin(rLen * 18.0 - uTime * 4.2) * 0.5 + 0.5;

  vec3 waterCol = mix(vec3(0.05, 0.42, 0.62), vec3(0.16, 0.88, 1.0), clamp(0.45 + ripple * 0.3 + caustic * 0.5, 0.0, 1.0));
  waterCol = mix(waterCol, vec3(0.86, 1.0, 1.0) * 1.45, clamp(caustic * 0.75, 0.0, 1.0));
  float rimGlow = smoothstep(0.70, 0.92, rLen) * inside;
  waterCol += vec3(0.28, 0.94, 1.0) * rimGlow * 0.55;

  fragColor = vec4(waterCol, inside * 0.86 * uOpacity);
}
`;

// ============================================================================
// Pass 2 & 3: Ink-Cel Batched Sprite, Floor, Telegraph & Bezier Ribbon Shader
// ============================================================================

export const BATCH_VERT = `#version 300 es
precision highp float;

layout(location = 0) in vec2 aPos;
layout(location = 1) in vec2 aUv;
layout(location = 2) in vec4 aColor;
layout(location = 3) in vec2 aFx; // x: hitFlashWhite (0..1), y: emissiveBoost (0..3)

uniform vec2 uResolution;

out vec2 vUv;
out vec4 vColor;
out vec2 vFx;

void main() {
  // Convert top-left screen CSS/pixel coordinates to clip space [-1, 1]
  vec2 ndc = (aPos / uResolution) * 2.0 - 1.0;
  ndc.y = -ndc.y;
  gl_Position = vec4(ndc, 0.0, 1.0);
  vUv = aUv;
  vColor = aColor;
  vFx = aFx;
}
`;

export const BATCH_FRAG = `#version 300 es
precision highp float;

in vec2 vUv;
in vec4 vColor;
in vec2 vFx;

uniform sampler2D uAtlas;

out vec4 fragColor;

void main() {
  vec4 tex = texture(uAtlas, vUv);
  float alpha = tex.a * vColor.a;
  if (alpha < 0.004) discard;

  vec3 rgb = tex.rgb * vColor.rgb;
  // Crisp comic-ink hit-flash white silhouette blend
  rgb = mix(rgb, vec3(1.0, 0.98, 0.95), clamp(vFx.x, 0.0, 1.0));
  // Selective emissive luminance lift (drives Pass 5 bloom!)
  rgb *= (1.0 + max(0.0, vFx.y));

  fragColor = vec4(rgb, alpha);
}
`;

// ============================================================================
// Pass 4: Dynamic Additive Lightmap Shader
// ============================================================================

export const LIGHT_VERT = `#version 300 es
precision highp float;

layout(location = 0) in vec2 aPos;
layout(location = 1) in vec2 aLocal; // -1..1 radial space
layout(location = 2) in vec4 aColor; // rgb = color, a = intensity

uniform vec2 uResolution;

out vec2 vLocal;
out vec4 vColor;

void main() {
  vec2 ndc = (aPos / uResolution) * 2.0 - 1.0;
  ndc.y = -ndc.y;
  gl_Position = vec4(ndc, 0.0, 1.0);
  vLocal = aLocal;
  vColor = aColor;
}
`;

export const LIGHT_FRAG = `#version 300 es
precision highp float;

in vec2 vLocal;
in vec4 vColor;

out vec4 fragColor;

void main() {
  float d = length(vLocal);
  if (d >= 1.0) discard;
  // Two-tier warm chiaroscuro falloff: bright hearth core + broad painterly wash
  float inv = 1.0 - d;
  float falloff = pow(inv, 1.72) + 0.26 * pow(inv, 4.2);
  fragColor = vec4(vColor.rgb * (falloff * vColor.a), 1.0);
}
`;

// ============================================================================
// Pass 5a: Selective Bloom Bright-Extract Shader
// ============================================================================

export const BLOOM_EXTRACT_FRAG = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSceneTex;
uniform sampler2D uLightTex;
uniform float uThreshold;
uniform float uKnee;

void main() {
  vec3 scene = texture(uSceneTex, vUv).rgb;
  vec3 light = texture(uLightTex, vUv).rgb;
  vec3 combined = scene + light * 0.44;
  float lum = dot(combined, vec3(0.2126, 0.7152, 0.0722));
  float soft = clamp(lum - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  soft = (soft * soft) / max(0.0001, 4.0 * uKnee);
  float contrib = max(soft, lum - uThreshold) / max(lum, 0.0001);
  vec3 bright = combined * max(0.0, contrib);
  fragColor = vec4(bright, 1.0);
}
`;

// ============================================================================
// Pass 5b & 5c: Separable 9-Tap Gaussian Blur Shader
// ============================================================================

export const BLOOM_BLUR_FRAG = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uTex;
uniform vec2 uTexelStep; // (1/w, 0) for H-pass, (0, 1/h) for V-pass

void main() {
  vec3 acc = texture(uTex, vUv).rgb * 0.2270270270;
  acc += texture(uTex, vUv + uTexelStep * 1.3846153846).rgb * 0.3162162162;
  acc += texture(uTex, vUv - uTexelStep * 1.3846153846).rgb * 0.3162162162;
  acc += texture(uTex, vUv + uTexelStep * 3.2307692308).rgb * 0.0702702703;
  acc += texture(uTex, vUv - uTexelStep * 3.2307692308).rgb * 0.0702702703;
  fragColor = vec4(acc, 1.0);
}
`;

// ============================================================================
// Pass 6: Per-Biome Jewel-Tone Color Grading + Radial Shockwave + Chromatic
//         Aberration + Split Chiaroscuro Vignette + Paper/Ink Micro-Grain
// ============================================================================

export const COMPOSITE_FRAG = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSceneTex;
uniform sampler2D uLightTex;
uniform sampler2D uBloomTex;

uniform vec3 uShadowTint;
uniform vec3 uMidtoneTint;
uniform vec3 uHighlightTint;
uniform float uBloomStrength;
uniform float uVignetteStrength;
uniform float uHitFlash;
uniform float uDeathDefiance;
uniform float uFinalKillPulse;
uniform float uChromaticAmount; // 0.0..0.014 radial UV RGB split
uniform vec4 uShockwave;        // xy = screen UV epicenter, z = radius (0..1.2), w = amplitude (0..0.028)
uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uShockwaveTint;

float grainHash(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

vec3 applyJewelColorGrade(vec3 col) {
  float lum = clamp(dot(col, vec3(0.2126, 0.7152, 0.0722)), 0.0, 1.0);
  // 3-way shadow / midtone / highlight mythic jewel-tone curve
  float wShadow = pow(max(1.0 - lum, 0.0001), 2.2);
  float wHigh = pow(max(lum, 0.0001), 2.0);
  float wMid = clamp(1.0 - wShadow - wHigh, 0.0, 1.0);
  vec3 tint = uShadowTint * wShadow + uMidtoneTint * wMid + uHighlightTint * wHigh;
  col *= tint;

  // Deep underworld contrast curve preserving heavy #09060E ink mass & luminous highlights
  col = pow(max(col, vec3(0.0001)), vec3(1.13));
  // Subtle ACES-inspired highlight shoulder
  col = (col * (2.25 * col + 0.07)) / (col * (2.0 * col + 0.54) + 0.038);
  // Rich jewel saturation boost
  float l2 = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l2), col, 1.26);
  return col;
}

void main() {
  vec2 uv = vUv;
  float aspect = uResolution.x / max(1.0, uResolution.y);
  float shockRingGlow = 0.0;

  // 1. Expanding Radial Shockwave UV Distortion (boss phase, Greater Call, armor shatter, Death Defiance)
  if (uShockwave.w > 0.0001) {
    vec2 delta = uv - uShockwave.xy;
    vec2 deltaAspect = vec2(delta.x * aspect, delta.y);
    float dist = length(deltaAspect);
    float ringDelta = dist - uShockwave.z;
    float ringMask = exp(-ringDelta * ringDelta * 185.0) * smoothstep(0.0, 0.055, dist);
    vec2 pushDir = deltaAspect / max(dist, 0.0001);
    vec2 uvOffset = vec2(pushDir.x / max(aspect, 0.0001), pushDir.y) * (ringMask * uShockwave.w);
    uv = clamp(uv - uvOffset, vec2(0.001), vec2(0.999));
    shockRingGlow = ringMask * uShockwave.w;
  }

  // 2. Crisp Edge-Weighted Radial Chromatic Aberration (tight 140-180ms kinetic prism snap, zero blurry double-vision)
  vec3 scene;
  if (uChromaticAmount > 0.0001) {
    vec2 caDelta = uv - 0.5;
    float edgeWeight = 0.28 + 1.50 * dot(caDelta, caDelta);
    vec2 caDir = caDelta * (min(uChromaticAmount, 0.0065) * edgeWeight);
    float rCh = texture(uSceneTex, clamp(uv + caDir, vec2(0.0), vec2(1.0))).r;
    float gCh = texture(uSceneTex, uv).g;
    float bCh = texture(uSceneTex, clamp(uv - caDir, vec2(0.0), vec2(1.0))).b;
    scene = vec3(rCh, gCh, bCh);
  } else {
    scene = texture(uSceneTex, uv).rgb;
  }

  vec3 light = texture(uLightTex, uv).rgb;
  vec3 bloom = texture(uBloomTex, uv).rgb;

  // Dramatic chiaroscuro lightmap illumination: warm brazier/sconce pools carving through painted stone
  // Preserves crisp hand-painted gouache midtones while deepening mood in unlit corners!
  vec3 lit = scene * (vec3(0.58) + light * 1.12) + light * 0.065;
  vec3 col = lit + bloom * uBloomStrength;

  // Luminous shockwave crest highlight
  if (shockRingGlow > 0.0001) {
    col += uShockwaveTint * shockRingGlow * 13.5;
  }

  // Per-biome jewel-tone color grading
  col = applyJewelColorGrade(col);

  // Final-kill slow-mo dramatic contrast & gilded edge lift
  if (uFinalKillPulse > 0.001) {
    float fkLum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    vec3 dramatic = mix(col, vec3(fkLum) * vec3(1.18, 0.96, 1.05), uFinalKillPulse * 0.35);
    col = mix(col, dramatic * 1.12, uFinalKillPulse);
  }

  // Death Defiance dramatic desaturation & crimson-gold pulse
  if (uDeathDefiance > 0.001) {
    float gray = dot(col, vec3(0.299, 0.587, 0.114));
    vec3 ddCol = mix(vec3(gray) * vec3(1.15, 0.85, 0.95), col, 0.25);
    col = mix(col, ddCol, clamp(uDeathDefiance, 0.0, 1.0));
  }

  // Split warm/cool chiaroscuro vignette framing (deep underworld ink corners, warm center clarity)
  vec2 vigUv = (vUv - 0.5) * 2.0;
  float distSq = dot(vigUv, vigUv);
  float vigAmt = clamp(distSq * uVignetteStrength, 0.0, 0.64);
  vec3 vigTint = mix(vec3(1.0), uShadowTint * 0.72, vigAmt);
  col = col * (1.0 - vigAmt * 0.85) * vigTint;

  // Subtle high-frequency comic paper/ink micro-grain (+/-0.012 luminance modulation)
  float grain = (grainHash(floor(vUv * uResolution * 0.75) + fract(uTime * 11.7) * 37.0) - 0.5) * 0.024;
  col += vec3(grain);

  // Player Hit-Flash crimson border flash
  if (uHitFlash > 0.001) {
    float edge = smoothstep(0.32, 1.35, distSq);
    vec3 hitRed = vec3(1.0, 0.14, 0.18);
    col = mix(col, hitRed, edge * uHitFlash * 0.58);
    col += vec3(0.22, 0.04, 0.05) * uHitFlash * 0.35;
  }

  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
