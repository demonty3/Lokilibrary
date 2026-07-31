/**
 * Style-pack fx 'glow' — phosphor bloom for the terminal-land desk
 * (docs/blueprints/style-pack.md slot 3).
 *
 * One custom single-pass filter on the desk's `world` container: an 8-tap
 * ring samples the source at ~2.5px, keeps only what clears a brightness
 * threshold, and adds that halo over the UNMODIFIED source — so bright
 * glyphs bleed light but legibility survives (a plain blur would smear the
 * text itself). Beings own the brightest accents, so they get the loudest
 * halos: the salience contract is enhanced, not eroded. Static (no
 * animation, no per-frame uniforms, no render textures); the taps are
 * negligible per frame.
 *
 * GL-only: WebGL leads pixi v8's default renderer preference. A WGSL twin
 * (gpuProgram) is needed only if WebGPU is ever preferred.
 */

import { defaultFilterVert, Filter, GlProgram } from 'pixi.js';

const GLOW_FRAG = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
// highp: the default filter VERTEX shader also declares uInputSize, and a
// cross-stage precision mismatch is a WebGL link error (renders nothing).
uniform highp vec4 uInputSize;  // xy: texture size, zw: 1/size (texel)
uniform vec4 uInputClamp;       // xy: min uv, zw: max uv

const float RADIUS = 2.5;     // halo reach in px (keep <= the filter padding)
const float THRESHOLD = 0.2;  // brightness floor — dim texture never blooms
const float STRENGTH = 0.55;  // halo gain over the source

vec3 tapAt(vec2 dir) {
    vec2 uv = clamp(vTextureCoord + dir * uInputSize.zw * RADIUS, uInputClamp.xy, uInputClamp.zw);
    return max(texture(uTexture, uv).rgb - vec3(THRESHOLD), vec3(0.0));
}

void main() {
    vec4 src = texture(uTexture, vTextureCoord);
    vec3 halo = tapAt(vec2(1.0, 0.0)) + tapAt(vec2(-1.0, 0.0))
              + tapAt(vec2(0.0, 1.0)) + tapAt(vec2(0.0, -1.0))
              + tapAt(vec2(0.7071, 0.7071)) + tapAt(vec2(-0.7071, 0.7071))
              + tapAt(vec2(0.7071, -0.7071)) + tapAt(vec2(-0.7071, -0.7071));
    finalColor = vec4(src.rgb + STRENGTH * (halo / 8.0), src.a);
}
`;

export function createGlowFilter(): Filter {
  return new Filter({
    glProgram: GlProgram.from({
      vertex: defaultFilterVert,
      fragment: GLOW_FRAG,
      name: 'loki-glow-filter',
    }),
    padding: 4, // room for the halo outside glyph bounds
  });
}
