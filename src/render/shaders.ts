/**
 * shaders.ts — GLSL ES 3.00 shaders for the 6-Pass Supergiant Ink-Cel WebGL2 Pipeline:
 *   Pass 1: Deep Abyssal Chasm Parallax & Animated Underworld Mist
 *   Pass 2 & 3: Dynamic Ink-Cel Sprite, Floor, Telegraph & Bezier Ribbon Batcher
 *   Pass 4: Additive Dynamic Lightmap FBO
 *   Pass 5: Dual-Pass Selective Bloom (Bright Extract + Separable H/V Gaussian Blur)
 *   Pass 6: Per-Biome Jewel-Tone Color Grading + Vignette + Hit-Flash / Death-Defiance Pulse
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
// Pass 1: Deep Abyssal Chasm Parallax & Animated Underworld Mist
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
  float active = step(0.42, h);
  float width = mix(0.22, 0.44, hash21(vec2(col + 17.0, seed)));
  float inPillar = smoothstep(0.02, 0.0, abs(fx - 0.5) - width * 0.5);
  // Broken stepped top silhouette
  float topY = mix(0.18, 0.72, h);
  float belowTop = smoothstep(topY + 0.04, topY, p.y);
  return active * inPillar * belowTop;
}

void main() {
  vec2 aspect = vec2(uResolution.x / max(1.0, uResolution.y), 1.0);
  vec2 centered = (vUv - 0.5) * aspect;

  // Deep abyssal vertical gradient
  float depthGrad = clamp(vUv.y * 0.9 + 0.12, 0.0, 1.0);
  vec3 col = mix(uDeepColor, uMidColor, pow(depthGrad, 1.35));

  // Distant parallax layer 1: ancient sunken underworld spires
  vec2 p1 = centered + uCamPos * 0.00018 * uZoom;
  float spiresFar = pillarSilhouette(vec2(p1.x + 1.4, vUv.y), 5.5, 11.3);
  col = mix(col, uDeepColor * 0.68, spiresFar * 0.65);

  // Mid parallax layer 2: monumental chasm buttresses with emerald/magma rim glow
  vec2 p2 = centered + uCamPos * 0.00034 * uZoom;
  float spiresMid = pillarSilhouette(vec2(p2.x - 0.7, vUv.y + 0.08), 3.2, 29.7);
  col = mix(col, uDeepColor * 0.45, spiresMid * 0.78);

  // Subtle rim edge along mid chasm columns
  float rimShift = pillarSilhouette(vec2(p2.x - 0.685, vUv.y + 0.08), 3.2, 29.7);
  float rim = clamp(rimShift - spiresMid, 0.0, 1.0);
  col += uAccentColor * rim * 0.24;

  // Flowing animated underworld mist ribbons
  vec2 mistUv1 = centered * vec2(2.1, 3.4) + uCamPos * 0.00042 + vec2(uTime * 0.045, -uTime * 0.025);
  vec2 mistUv2 = centered * vec2(3.4, 2.2) + uCamPos * 0.00062 + vec2(-uTime * 0.06, -uTime * 0.018);
  float m1 = fbm(mistUv1);
  float m2 = fbm(mistUv2 + vec2(m1 * 0.7, -m1 * 0.4));
  float mistBand = smoothstep(0.38, 0.82, m2) * (0.45 + 0.55 * (1.0 - vUv.y));
  col = mix(col, uMistColor, mistBand * 0.48);

  // Subtle chasm bottom glow + rising underworld ember motes
  float lowerGlow = smoothstep(0.65, 0.0, vUv.y) * (0.28 + 0.14 * sin(uTime * 1.1 + centered.x * 3.0));
  col += uAccentColor * lowerGlow * 0.24;

  vec2 sparkCell = floor((centered * 11.0 + uCamPos * 0.0009 + vec2(0.0, -uTime * 0.35)));
  vec2 sparkLocal = fract((centered * 11.0 + uCamPos * 0.0009 + vec2(0.0, -uTime * 0.35))) - 0.5;
  float sparkSeed = hash21(sparkCell);
  float sparkVis = step(0.93, sparkSeed);
  float sparkDist = length(sparkLocal - vec2(sin(uTime * 2.0 + sparkSeed * 12.0) * 0.15, 0.0));
  float spark = sparkVis * smoothstep(0.11, 0.015, sparkDist) * (0.55 + 0.45 * sin(uTime * 5.0 + sparkSeed * 40.0));
  col += mix(uAccentColor, vec3(1.0, 0.95, 0.78), 0.55) * spark * 0.95;

  fragColor = vec4(col, 1.0);
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
  // Crisp Supergiant hit-flash white silhouette blend
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
  // Artistic smooth warm radial falloff
  float falloff = pow(1.0 - d, 1.85);
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
  // Combine high-energy scene pixels with intense lightmap peaks
  vec3 combined = scene + light * 0.42;
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
// Pass 6: Per-Biome Jewel-Tone Color Grading + Vignette + Combat Pulses
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

vec3 applyJewelColorGrade(vec3 col) {
  float lum = clamp(dot(col, vec3(0.2126, 0.7152, 0.0722)), 0.0, 1.0);
  // 3-way shadow / midtone / highlight Supergiant jewel-tone curve
  float wShadow = pow(1.0 - lum, 2.0);
  float wHigh = pow(lum, 2.0);
  float wMid = clamp(1.0 - wShadow - wHigh, 0.0, 1.0);
  vec3 tint = uShadowTint * wShadow + uMidtoneTint * wMid + uHighlightTint * wHigh;
  col *= tint;

  // Filmic crisp saturation & gentle S-curve contrast keeping blacks jet-ink
  float l2 = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l2), col, 1.16);
  col = col / (col + vec3(0.28)) * 1.24;
  return col;
}

void main() {
  vec3 scene = texture(uSceneTex, vUv).rgb;
  vec3 light = texture(uLightTex, vUv).rgb;
  vec3 bloom = texture(uBloomTex, vUv).rgb;

  // Dynamic lightmap illumination + subtle additive warm glow lift
  vec3 lit = scene * (vec3(0.84) + light * 0.68) + light * 0.14;
  vec3 col = lit + bloom * uBloomStrength;

  // Per-biome color grading LUT approximation
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

  // Atmospheric radial vignette
  vec2 vigUv = (vUv - 0.5) * 2.0;
  float distSq = dot(vigUv, vigUv);
  float vig = 1.0 - clamp(distSq * uVignetteStrength, 0.0, 0.62);
  col *= vig;

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
