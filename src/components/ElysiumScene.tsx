"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Sparkles, Stars } from "@react-three/drei";
import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";
import { useEffect, useMemo, useRef } from "react";
import { AdditiveBlending, BackSide, Color as ThreeColor, Fog, Vector3 } from "three";
import type {
  AmbientLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PointLight,
  ShaderMaterial
} from "three";
import type { PlayerColor, PublicRoom } from "@/lib/rooms/types";

type ScenePiece = {
  square: Square;
  type: PieceSymbol;
  color: Color;
};

type ElysiumSceneProps = {
  room: PublicRoom | null;
  displayFen?: string;
  playerColor?: PlayerColor;
  selectedSquare: Square | null;
  legalTargets: Square[];
  moveAnimation: SceneMoveAnimation | null;
  audioIntensity: number;
  boardInverted: boolean;
  planetEngulfActive: boolean;
  onSquareClick: (square: Square) => void;
};

export type SceneMoveAnimation = {
  id: string;
  from: Square;
  to: Square;
  piece: PieceSymbol;
  color: PlayerColor;
};

const STARTING_FEN = new Chess().fen();
const FILES = "abcdefgh";
const PLANET_LIGHT_DIRECTION = new Vector3(-0.45, 0.72, 0.54).normalize();
const PLANET_ENGULF_SCALE = 14;
const INTERIOR_SURFACE_RADIUS = 19;
const INTERIOR_AURORA_RADIUS = 18.5;
const INTERIOR_HAZE_RADIUS = 18;
const INTERIOR_PALETTE = {
  shadow: "#2a140d",
  ember: "#c0672d",
  highlight: "#ffd38a",
  auroraA: "#7a4cc8",
  auroraB: "#f0a63b",
  coreGlow: "#fff1c4",
  fog: "#1a0a06"
} as const;

type EngulfProgressRef = { current: number };
const BOARD_INVERSION_RISE = 0.78;
const BOARD_INVERSION_SECONDS = 5.6;
const BOARD_SURFACE_SECONDS = 24;
const BOARD_DESCEND_SECONDS = 8;
const BOARD_UNDERWATER_SECONDS = 18;
const BOARD_ASCEND_SECONDS = 9;
const BOARD_SUBMERSION_DEPTH = 2.25;
const BOARD_SUBMERSION_TOTAL_SECONDS =
  BOARD_SURFACE_SECONDS +
  BOARD_DESCEND_SECONDS +
  BOARD_UNDERWATER_SECONDS +
  BOARD_ASCEND_SECONDS;
const WATER_SURFACE_Y = -0.23;
const TARGET_TILE_LIFT = 0.32;
const SELECTED_PIECE_LIFT = 0.28;
const MOVE_PHASE_SECONDS = 0.82;

type PlanetPalette = {
  shadow: string;
  base: string;
  highlight: string;
  ridge: string;
  glow: string;
  atmosphere: string;
  cloud: string;
  terrainScale: number;
  bandOffset: number;
  rotationSpeed: number;
  cloudSpeed: number;
};

const PLANET_PALETTES: Record<"ember" | "azure", PlanetPalette> = {
  ember: {
    shadow: "#2a140d",
    base: "#c0672d",
    highlight: "#ffd38a",
    ridge: "#6b2b37",
    glow: "#f0a63b",
    atmosphere: "#f7b35f",
    cloud: "#ffe2a2",
    terrainScale: 3.6,
    bandOffset: 0.18,
    rotationSpeed: 0.038,
    cloudSpeed: 0.055
  },
  azure: {
    shadow: "#101528",
    base: "#526ec5",
    highlight: "#d6e6ff",
    ridge: "#7bd2ad",
    glow: "#9ab8ff",
    atmosphere: "#9fb8ff",
    cloud: "#dce8ff",
    terrainScale: 4.8,
    bandOffset: -0.08,
    rotationSpeed: -0.031,
    cloudSpeed: -0.047
  }
};

const PLANET_VERTEX_SHADER = `
  varying vec3 vObjectPosition;
  varying vec3 vWorldNormal;
  varying vec3 vViewDirection;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);

    vObjectPosition = normalize(position);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vViewDirection = cameraPosition - worldPosition.xyz;

    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const PLANET_NOISE_SHADER = `
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    return mix(
      mix(
        mix(hash(i + vec3(0.0, 0.0, 0.0)), hash(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x),
        f.y
      ),
      mix(
        mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x),
        f.y
      ),
      f.z
    );
  }

  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;

    for (int i = 0; i < 5; i++) {
      value += noise(p) * amplitude;
      p *= 2.03;
      amplitude *= 0.5;
    }

    return value;
  }
`;

const PLANET_SURFACE_FRAGMENT_SHADER = `
  uniform vec3 uShadowColor;
  uniform vec3 uBaseColor;
  uniform vec3 uHighlightColor;
  uniform vec3 uRidgeColor;
  uniform vec3 uGlowColor;
  uniform vec3 uLightDirection;
  uniform float uTime;
  uniform float uAudioIntensity;
  uniform float uTerrainScale;
  uniform float uBandOffset;
  uniform float uOpacity;

  varying vec3 vObjectPosition;
  varying vec3 vWorldNormal;
  varying vec3 vViewDirection;

  ${PLANET_NOISE_SHADER}

  void main() {
    vec3 normal = normalize(vWorldNormal);
    vec3 viewDirection = normalize(vViewDirection);
    vec3 samplePoint = vObjectPosition;
    vec3 drift = vec3(uTime * 0.012, uTime * 0.004, -uTime * 0.009);

    float continent = fbm(samplePoint * uTerrainScale + drift);
    float fine = fbm(samplePoint * (uTerrainScale * 4.0) - drift.yzx);
    float ridges = 1.0 - abs((fine * 2.0) - 1.0);
    float latitudeBands = sin((samplePoint.y + continent * 0.16 + uBandOffset) * 18.0) * 0.5 + 0.5;
    float land = smoothstep(0.38, 0.76, continent + latitudeBands * 0.14);
    float ridgeMask = smoothstep(0.66, 0.95, ridges + land * 0.12);

    vec3 color = mix(uShadowColor, uBaseColor, land);
    color = mix(color, uHighlightColor, smoothstep(0.72, 0.94, continent + fine * 0.22));
    color = mix(color, uRidgeColor, ridgeMask * 0.38);

    float diffuse = max(dot(normal, normalize(uLightDirection)), 0.0);
    float wrap = clamp(dot(normal, normalize(uLightDirection)) * 0.5 + 0.5, 0.0, 1.0);
    float rim = pow(1.0 - max(dot(normal, viewDirection), 0.0), 2.7);
    float audioGlow = 0.2 + uAudioIntensity * 0.32;

    color *= 0.16 + diffuse * 0.78 + wrap * 0.24;
    color += uGlowColor * rim * audioGlow;
    color += uHighlightColor * ridgeMask * 0.1;

    gl_FragColor = vec4(color, uOpacity);
  }
`;

const PLANET_CLOUD_FRAGMENT_SHADER = `
  uniform vec3 uCloudColor;
  uniform float uTime;
  uniform float uAudioIntensity;
  uniform float uTerrainScale;
  uniform float uBandOffset;
  uniform float uOpacity;

  varying vec3 vObjectPosition;
  varying vec3 vWorldNormal;
  varying vec3 vViewDirection;

  ${PLANET_NOISE_SHADER}

  void main() {
    vec3 normal = normalize(vWorldNormal);
    vec3 viewDirection = normalize(vViewDirection);
    vec3 flow = vec3(uTime * 0.018, -uTime * 0.011, uTime * 0.014);

    float broad = fbm(vObjectPosition * (uTerrainScale * 2.2) + flow);
    float wisps = fbm(vObjectPosition * (uTerrainScale * 8.0) - flow.zxy);
    float bands = sin((vObjectPosition.y + broad * 0.12 + uBandOffset) * 24.0) * 0.5 + 0.5;
    float cloud = smoothstep(0.55, 0.82, broad * 0.64 + wisps * 0.26 + bands * 0.14);
    float rim = pow(1.0 - max(dot(normal, viewDirection), 0.0), 1.6);

    float alpha = cloud * (0.16 + rim * 0.16 + uAudioIntensity * 0.06);
    gl_FragColor = vec4(uCloudColor, alpha * uOpacity);
  }
`;

const PLANET_ATMOSPHERE_FRAGMENT_SHADER = `
  uniform vec3 uAtmosphereColor;
  uniform float uTime;
  uniform float uAudioIntensity;
  uniform float uOpacity;

  varying vec3 vObjectPosition;
  varying vec3 vWorldNormal;
  varying vec3 vViewDirection;

  void main() {
    vec3 normal = normalize(vWorldNormal);
    vec3 viewDirection = normalize(vViewDirection);
    float rim = pow(1.0 - max(dot(normal, viewDirection), 0.0), 2.2);
    float pulse = sin(uTime * 0.9 + vObjectPosition.y * 8.0) * 0.5 + 0.5;
    float alpha = rim * (0.32 + uAudioIntensity * 0.18) + pulse * rim * 0.04;

    gl_FragColor = vec4(uAtmosphereColor, alpha * uOpacity);
  }
`;

const PLANET_INTERIOR_SURFACE_FRAGMENT_SHADER = `
  uniform vec3 uShadowColor;
  uniform vec3 uEmberColor;
  uniform vec3 uHighlightColor;
  uniform vec3 uAuroraColorA;
  uniform vec3 uAuroraColorB;
  uniform vec3 uCoreGlowColor;
  uniform float uTime;
  uniform float uAudioIntensity;
  uniform float uPulse;
  uniform float uEngulfProgress;
  uniform float uOpacity;

  varying vec3 vObjectPosition;
  varying vec3 vWorldNormal;
  varying vec3 vViewDirection;

  ${PLANET_NOISE_SHADER}

  void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(vViewDirection);
    vec3 p = vObjectPosition;

    vec3 driftSlow = vec3(uTime * 0.004, uTime * 0.0018, -uTime * 0.0031);
    float crust = fbm(p * 2.1 + driftSlow);
    float fineFlow = fbm(p * 5.5 - driftSlow.yzx);
    float veins = 1.0 - abs(fineFlow * 2.0 - 1.0);
    vec3 base = mix(uShadowColor, uEmberColor, smoothstep(0.32, 0.78, crust));
    base = mix(base, uHighlightColor, smoothstep(0.78, 0.96, veins));

    float lat = p.y + fbm(p * 1.4 + vec3(0.0, uTime * 0.02, 0.0)) * 0.35;
    float ribbon1 = exp(-pow((lat - 0.35) * 4.0, 2.0));
    float ribbon2 = exp(-pow((lat + 0.20 - sin(uTime * 0.07) * 0.15) * 5.0, 2.0));
    float ribbonFlow = fbm(p * 3.2 + vec3(uTime * 0.03, 0.0, -uTime * 0.025));
    float aurora = (ribbon1 * 0.8 + ribbon2 * 0.6) * (0.4 + ribbonFlow * 0.8);
    vec3 auroraColor = mix(uAuroraColorA, uAuroraColorB, ribbonFlow);

    float breath = 0.92 + 0.08 * cos(uTime * 0.35);
    float centerward = pow(max(dot(-N, V), 0.0), 1.6);
    float coreFlash = centerward * (uAudioIntensity * 0.6 + uPulse * 1.4);
    float innerRim = pow(1.0 - max(dot(N, V), 0.0), 2.2);

    vec3 color = base * (0.35 + breath * 0.25);
    color += auroraColor * aurora * (0.45 + uAudioIntensity * 0.5) * breath;
    color += uCoreGlowColor * coreFlash;
    color += uAuroraColorB * innerRim * 0.18;

    float reveal = smoothstep(0.45, 0.95, uEngulfProgress);
    gl_FragColor = vec4(color * (0.6 + 0.4 * reveal), uOpacity);
  }
`;

const PLANET_INTERIOR_AURORA_FRAGMENT_SHADER = `
  uniform vec3 uAuroraColorA;
  uniform vec3 uAuroraColorB;
  uniform float uTime;
  uniform float uAudioIntensity;
  uniform float uPulse;
  uniform float uOpacity;

  varying vec3 vObjectPosition;
  varying vec3 vWorldNormal;
  varying vec3 vViewDirection;

  ${PLANET_NOISE_SHADER}

  void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(vViewDirection);
    vec3 p = vObjectPosition;

    float lat1 = p.y + noise(p * 1.2 + vec3(uTime * 0.018, 0.0, 0.0)) * 0.4;
    float lat2 = p.y + noise(p * 1.7 - vec3(uTime * 0.012, 0.0, 0.0)) * 0.45;
    float ribbon1 = exp(-pow((lat1 - 0.18 + sin(uTime * 0.05) * 0.12) * 3.2, 2.0));
    float ribbon2 = exp(-pow((lat2 + 0.42 - sin(uTime * 0.04) * 0.10) * 3.8, 2.0));
    float flow = noise(p * 2.6 + vec3(uTime * 0.04, -uTime * 0.025, 0.0));
    float ribbons = (ribbon1 + ribbon2 * 0.7) * (0.35 + flow * 0.9);

    vec3 color = mix(uAuroraColorA, uAuroraColorB, flow);
    float audioGain = 0.55 + uAudioIntensity * 0.7 + uPulse * 0.9;
    float rim = pow(1.0 - max(dot(N, V), 0.0), 1.8);
    float alpha = ribbons * audioGain * (0.45 + rim * 0.35) * uOpacity;
    gl_FragColor = vec4(color * audioGain, clamp(alpha, 0.0, 1.0));
  }
`;

const PLANET_INTERIOR_HAZE_FRAGMENT_SHADER = `
  uniform vec3 uAuroraColorA;
  uniform vec3 uCoreGlowColor;
  uniform float uTime;
  uniform float uAudioIntensity;
  uniform float uPulse;
  uniform float uOpacity;

  varying vec3 vObjectPosition;
  varying vec3 vWorldNormal;
  varying vec3 vViewDirection;

  ${PLANET_NOISE_SHADER}

  void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(vViewDirection);
    vec3 p = vObjectPosition;
    vec3 drift = vec3(uTime * 0.006, uTime * 0.003, -uTime * 0.004);

    float nebula = fbm(p * 1.6 + drift);
    float clouds = noise(p * 3.1 - drift.yzx);
    float density = smoothstep(0.42, 0.92, nebula * 0.7 + clouds * 0.4);
    float pulse = 0.5 + 0.5 * sin(uTime * 0.22 + nebula * 4.0);

    vec3 color = mix(uAuroraColorA, uCoreGlowColor, density * 0.55);
    float rim = pow(1.0 - max(dot(N, V), 0.0), 1.4);
    float gain = 0.32 + uAudioIntensity * 0.4 + uPulse * 0.55;
    float alpha = density * gain * (0.4 + rim * 0.5 + pulse * 0.12) * uOpacity;
    gl_FragColor = vec4(color * (0.6 + pulse * 0.3), clamp(alpha, 0.0, 1.0));
  }
`;

const WATER_VERTEX_SHADER = `
  uniform float uTime;
  uniform float uAudioIntensity;
  uniform float uSubmersion;

  varying vec3 vWorldPosition;
  varying float vWave;

  void main() {
    vec3 transformed = position;
    vec2 point = position.xy;
    float broadWave =
      sin(point.x * 0.2 + uTime * 0.55) * 0.5 +
      sin(point.y * 0.24 - uTime * 0.42) * 0.38 +
      sin((point.x + point.y) * 0.13 + uTime * 0.34) * 0.28;
    float fineWave = sin(point.x * 1.45 + point.y * 0.55 + uTime * 1.7) * 0.16;

    vWave = broadWave + fineWave;
    transformed.z += vWave * (0.026 + uAudioIntensity * 0.018) * (1.0 + uSubmersion * 0.55);

    vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);
    vWorldPosition = worldPosition.xyz;

    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const WATER_FRAGMENT_SHADER = `
  uniform vec3 uDeepColor;
  uniform vec3 uSurfaceColor;
  uniform vec3 uFoamColor;
  uniform vec3 uGlowColor;
  uniform float uTime;
  uniform float uAudioIntensity;
  uniform float uSubmersion;

  varying vec3 vWorldPosition;
  varying float vWave;

  float stripe(vec2 point, float speed, float width) {
    float wave = sin(point.x * 0.82 + point.y * 0.46 + uTime * speed) * 0.5 + 0.5;
    return smoothstep(1.0 - width, 1.0, wave);
  }

  void main() {
    vec2 worldPoint = vWorldPosition.xz;
    float distanceFromCenter = length(worldPoint);
    float tableEdge = max(abs(worldPoint.x), abs(worldPoint.y));
    float nearTable = smoothstep(4.1, 4.55, tableEdge) * (1.0 - smoothstep(5.8, 7.4, tableEdge));
    float tableRipple = sin(tableEdge * 8.4 - uTime * 1.75) * 0.5 + 0.5;
    float wake = nearTable * smoothstep(0.58, 1.0, tableRipple);
    float current =
      stripe(worldPoint, 0.7, 0.08) * 0.34 +
      stripe(worldPoint.yx * vec2(0.74, 1.18), -0.52, 0.05) * 0.22;
    float glint = smoothstep(0.58, 1.0, vWave * 0.5 + 0.5) * (0.22 + uAudioIntensity * 0.32);
    float depth = smoothstep(8.0, 34.0, distanceFromCenter);
    float softSheen = 0.16 + current * 0.24 + glint * 0.22;

    vec3 color = mix(uSurfaceColor, uDeepColor, depth * 0.72);
    color += uGlowColor * softSheen * (0.55 + uAudioIntensity * 0.28);
    color = mix(color, uFoamColor, wake * (0.34 + uAudioIntensity * 0.14));
    color += uFoamColor * current * 0.08;
    color = mix(color, uDeepColor, uSubmersion * 0.22);

    float surfaceAlpha = 0.9 + current * 0.05 + wake * 0.06 + glint * 0.03;
    float underwaterAlpha = 0.36 + current * 0.05 + wake * 0.03 + glint * 0.04;
    float alpha = mix(surfaceAlpha, underwaterAlpha, uSubmersion);
    gl_FragColor = vec4(color, alpha);
  }
`;

const UNDERWATER_SURFACE_VERTEX_SHADER = `
  uniform float uTime;
  uniform float uAudioIntensity;
  uniform float uSubmersion;

  varying vec2 vPoint;
  varying float vRipple;

  void main() {
    vec3 transformed = position;
    vec2 point = position.xy;
    float broad =
      sin(point.x * 1.35 + uTime * 0.62) * 0.5 +
      sin(point.y * 1.7 - uTime * 0.54) * 0.35;
    float fine = sin((point.x - point.y) * 4.4 + uTime * 1.35) * 0.12;

    vPoint = point;
    vRipple = broad + fine;
    transformed.z += vRipple * (0.045 + uAudioIntensity * 0.024) * uSubmersion;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
  }
`;

const UNDERWATER_SURFACE_FRAGMENT_SHADER = `
  uniform vec3 uDeepColor;
  uniform vec3 uFoamColor;
  uniform vec3 uGlowColor;
  uniform float uTime;
  uniform float uAudioIntensity;
  uniform float uSubmersion;

  varying vec2 vPoint;
  varying float vRipple;

  float beam(vec2 point, float angle, float speed, float width) {
    vec2 direction = vec2(cos(angle), sin(angle));
    float wave = sin(dot(point, direction) * 2.9 + uTime * speed) * 0.5 + 0.5;
    return smoothstep(1.0 - width, 1.0, wave);
  }

  void main() {
    float caustics =
      beam(vPoint, 0.42, 0.8, 0.16) * 0.48 +
      beam(vPoint, 1.9, -0.64, 0.12) * 0.36 +
      beam(vPoint * 1.35, 2.7, 0.46, 0.08) * 0.24;
    float centerFade = 1.0 - smoothstep(4.6, 6.1, length(vPoint));
    float rippleGlow = smoothstep(0.24, 0.88, vRipple * 0.5 + 0.5);

    vec3 color = mix(uDeepColor, uFoamColor, caustics * 0.38 + rippleGlow * 0.16);
    color += uGlowColor * (0.15 + caustics * 0.4 + uAudioIntensity * 0.18);

    float alpha = uSubmersion * centerFade * (0.1 + caustics * 0.1 + rippleGlow * 0.04);
    gl_FragColor = vec4(color, alpha);
  }
`;

function piecesFromFen(fen: string): ScenePiece[] {
  const chess = new Chess(fen);
  return chess
    .board()
    .flatMap((rank) =>
      rank.flatMap((piece) =>
        piece
          ? [
              {
                square: piece.square,
                type: piece.type,
                color: piece.color
              }
            ]
          : []
      )
    );
}

function squarePosition(square: Square, perspective: PlayerColor): [number, number, number] {
  const file = FILES.indexOf(square[0]);
  const rank = Number(square[1]);
  const fileIndex = perspective === "white" ? file : 7 - file;
  const rankIndex = perspective === "white" ? 8 - rank : rank - 1;
  return [fileIndex - 3.5, 0, rankIndex - 3.5];
}

function smoothStep(value: number): number {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function boardSubmersionForTime(time: number): number {
  const phase = time % BOARD_SUBMERSION_TOTAL_SECONDS;
  const descendEnd = BOARD_SURFACE_SECONDS + BOARD_DESCEND_SECONDS;
  const underwaterEnd = descendEnd + BOARD_UNDERWATER_SECONDS;

  if (phase < BOARD_SURFACE_SECONDS) {
    return 0;
  }

  if (phase < descendEnd) {
    return smoothStep((phase - BOARD_SURFACE_SECONDS) / BOARD_DESCEND_SECONDS);
  }

  if (phase < underwaterEnd) {
    return 1;
  }

  return 1 - smoothStep((phase - underwaterEnd) / BOARD_ASCEND_SECONDS);
}

function playerColorToSceneColor(color: PlayerColor): Color {
  return color === "white" ? "w" : "b";
}

function applyPhaseMaterial(group: Group, opacity: number, emissiveIntensity: number): void {
  group.traverse((object) => {
    const mesh = object as Mesh;
    const material = mesh.material as MeshStandardMaterial | MeshStandardMaterial[] | undefined;

    if (!material) {
      return;
    }

    const materials = Array.isArray(material) ? material : [material];
    materials.forEach((item) => {
      item.transparent = true;
      item.depthWrite = opacity > 0.94;
      item.opacity = opacity;
      item.emissiveIntensity = emissiveIntensity;
      item.needsUpdate = true;
    });
  });
}

function PieceMaterial({
  color,
  phase = false
}: {
  color: Color;
  phase?: boolean;
}) {
  const palette =
    color === "w"
      ? {
          color: "#f0a63b",
          emissive: "#5f2f0d"
        }
      : {
          color: "#d9e5ff",
          emissive: "#344168"
        };

  return (
    <meshStandardMaterial
      color={palette.color}
      emissive={palette.emissive}
      emissiveIntensity={0.55}
      metalness={0.72}
      opacity={phase ? 0 : 1}
      roughness={0.22}
      transparent={phase}
    />
  );
}

function BasePiece({
  color,
  phase = false,
  children
}: {
  color: Color;
  phase?: boolean;
  children: React.ReactNode;
}) {
  return (
    <>
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.42, 0.5, 0.16, 40]} />
        <PieceMaterial color={color} phase={phase} />
      </mesh>
      <mesh position={[0, 0.24, 0]}>
        <cylinderGeometry args={[0.24, 0.32, 0.22, 36]} />
        <PieceMaterial color={color} phase={phase} />
      </mesh>
      {children}
    </>
  );
}

function PieceShape({
  type,
  color,
  phase = false
}: {
  type: PieceSymbol;
  color: Color;
  phase?: boolean;
}) {
  if (type === "p") {
    return (
      <BasePiece color={color} phase={phase}>
        <mesh position={[0, 0.52, 0]}>
          <sphereGeometry args={[0.24, 20, 14]} />
          <PieceMaterial color={color} phase={phase} />
        </mesh>
      </BasePiece>
    );
  }

  if (type === "r") {
    return (
      <BasePiece color={color} phase={phase}>
        <mesh position={[0, 0.55, 0]}>
          <cylinderGeometry args={[0.31, 0.25, 0.38, 28]} />
          <PieceMaterial color={color} phase={phase} />
        </mesh>
        {[-0.18, 0.18].map((x) =>
          [-0.18, 0.18].map((z) => (
            <mesh key={`${x}-${z}`} position={[x, 0.8, z]}>
              <boxGeometry args={[0.14, 0.16, 0.14]} />
              <PieceMaterial color={color} phase={phase} />
            </mesh>
          ))
        )}
      </BasePiece>
    );
  }

  if (type === "n") {
    return (
      <BasePiece color={color} phase={phase}>
        <mesh position={[0, 0.57, -0.03]} rotation={[0.35, 0.2, -0.15]}>
          <coneGeometry args={[0.31, 0.58, 5]} />
          <PieceMaterial color={color} phase={phase} />
        </mesh>
        <mesh position={[0.07, 0.78, -0.22]} rotation={[0.1, 0, 0.3]}>
          <boxGeometry args={[0.22, 0.16, 0.32]} />
          <PieceMaterial color={color} phase={phase} />
        </mesh>
      </BasePiece>
    );
  }

  if (type === "b") {
    return (
      <BasePiece color={color} phase={phase}>
        <mesh position={[0, 0.58, 0]}>
          <coneGeometry args={[0.28, 0.62, 36]} />
          <PieceMaterial color={color} phase={phase} />
        </mesh>
        <mesh position={[0, 0.91, 0]}>
          <sphereGeometry args={[0.1, 16, 10]} />
          <PieceMaterial color={color} phase={phase} />
        </mesh>
      </BasePiece>
    );
  }

  if (type === "q") {
    return (
      <BasePiece color={color} phase={phase}>
        <mesh position={[0, 0.57, 0]}>
          <cylinderGeometry args={[0.2, 0.28, 0.48, 36]} />
          <PieceMaterial color={color} phase={phase} />
        </mesh>
        {[-0.25, -0.12, 0, 0.12, 0.25].map((x, index) => (
          <mesh key={x} position={[x, 0.9 + (index === 2 ? 0.07 : 0), 0]}>
            <sphereGeometry args={[index === 2 ? 0.11 : 0.08, 14, 10]} />
            <PieceMaterial color={color} phase={phase} />
          </mesh>
        ))}
      </BasePiece>
    );
  }

  return (
    <BasePiece color={color} phase={phase}>
      <mesh position={[0, 0.57, 0]}>
        <cylinderGeometry args={[0.22, 0.3, 0.52, 36]} />
        <PieceMaterial color={color} phase={phase} />
      </mesh>
      <mesh position={[0, 0.94, 0]}>
        <boxGeometry args={[0.12, 0.36, 0.08]} />
        <PieceMaterial color={color} phase={phase} />
      </mesh>
      <mesh position={[0, 0.98, 0]}>
        <boxGeometry args={[0.34, 0.08, 0.08]} />
        <PieceMaterial color={color} phase={phase} />
      </mesh>
    </BasePiece>
  );
}

function ChessPiece({
  piece,
  perspective,
  selected,
  audioIntensity,
  onSquareClick
}: {
  piece: ScenePiece;
  perspective: PlayerColor;
  selected: boolean;
  audioIntensity: number;
  onSquareClick: (square: Square) => void;
}) {
  const groupRef = useRef<Group | null>(null);
  const liftRef = useRef(0);
  const [x, , z] = squarePosition(piece.square, perspective);

  useFrame(({ clock }, delta) => {
    if (!groupRef.current) {
      return;
    }

    const targetLift = selected ? 1 : 0;
    liftRef.current +=
      (targetLift - liftRef.current) * Math.min(1, delta * (selected ? 7.5 : 5.5));

    groupRef.current.position.y =
      0.09 +
      liftRef.current * TARGET_TILE_LIFT +
      Math.sin(clock.elapsedTime * 1.35 + x + z) * 0.018 +
      audioIntensity * 0.06;
    groupRef.current.rotation.y = selected
      ? Math.sin(clock.elapsedTime * 1.8) * 0.08
      : 0;
  });

  return (
    <group
      ref={groupRef}
      onPointerDown={(event) => {
        event.stopPropagation();
        onSquareClick(piece.square);
      }}
      position={[x, 0.09, z]}
      scale={0.86}
    >
      <PieceShape color={piece.color} type={piece.type} />
    </group>
  );
}

function PhaseMovePiece({
  animation,
  perspective,
  audioIntensity
}: {
  animation: SceneMoveAnimation;
  perspective: PlayerColor;
  audioIntensity: number;
}) {
  const groupRef = useRef<Group | null>(null);
  const progressRef = useRef(0);
  const [fromX, , fromZ] = squarePosition(animation.from, perspective);
  const [toX, , toZ] = squarePosition(animation.to, perspective);
  const color = playerColorToSceneColor(animation.color);

  useEffect(() => {
    progressRef.current = 0;
  }, [animation.id]);

  useFrame(({ clock }, delta) => {
    const group = groupRef.current;

    if (!group) {
      return;
    }

    const progress = Math.min(1, progressRef.current + delta / MOVE_PHASE_SECONDS);
    progressRef.current = progress;

    const atSource = progress < 0.48;
    const localProgress = atSource ? progress / 0.48 : (progress - 0.48) / 0.52;
    const eased = smoothStep(localProgress);
    const opacity = atSource ? 1 - eased : eased;
    const flare = Math.sin(eased * Math.PI);
    const x = atSource ? fromX : toX;
    const z = atSource ? fromZ : toZ;

    group.position.set(
      x,
      0.09 +
        SELECTED_PIECE_LIFT +
        flare * 0.18 +
        Math.sin(clock.elapsedTime * 4.6 + x + z) * 0.025 +
        audioIntensity * 0.08,
      z
    );
    group.rotation.y = clock.elapsedTime * 2.8 + flare * Math.PI * 0.18;
    group.scale.setScalar(0.86 * (0.94 + flare * 0.18));
    applyPhaseMaterial(group, opacity, 1.35 + flare * 2.1 + audioIntensity * 0.8);
  });

  return (
    <group ref={groupRef} position={[fromX, 0.09 + SELECTED_PIECE_LIFT, fromZ]} scale={0.86}>
      <PieceShape color={color} phase type={animation.piece} />
    </group>
  );
}

function BoardSquare({
  square,
  perspective,
  selected,
  target,
  onSquareClick
}: {
  square: Square;
  perspective: PlayerColor;
  selected: boolean;
  target: boolean;
  onSquareClick: (square: Square) => void;
}) {
  const meshRef = useRef<Mesh | null>(null);
  const liftRef = useRef(0);
  const [x, , z] = squarePosition(square, perspective);
  const file = FILES.indexOf(square[0]);
  const rank = Number(square[1]);
  const light = (file + rank) % 2 === 0;
  const raised = selected || target;

  useFrame(({ clock }, delta) => {
    if (!meshRef.current) {
      return;
    }

    const targetLift = raised ? 1 : 0;
    liftRef.current +=
      (targetLift - liftRef.current) * Math.min(1, delta * (raised ? 7.5 : 5.25));

    meshRef.current.position.y =
      liftRef.current * TARGET_TILE_LIFT +
      Math.sin(clock.elapsedTime * 2.6 + x * 0.73 + z * 0.91) * 0.028 * liftRef.current;
  });

  useFrame(({ clock }, delta) => {
    if (!meshRef.current) {
      return;
    }

    const targetLift = target ? 1 : 0;
    liftRef.current +=
      (targetLift - liftRef.current) * Math.min(1, delta * (target ? 7.5 : 5.25));

    meshRef.current.position.y =
      liftRef.current * TARGET_TILE_LIFT +
      Math.sin(clock.elapsedTime * 2.6 + x * 0.73 + z * 0.91) * 0.028 * liftRef.current;
  });

  return (
    <mesh
      ref={meshRef}
      onPointerDown={(event) => {
        event.stopPropagation();
        onSquareClick(square);
      }}
      position={[x, 0, z]}
    >
      <boxGeometry args={[0.98, 0.08, 0.98]} />
      <meshBasicMaterial
        color={selected ? "#f0a63b" : target ? "#7bd2ad" : light ? "#203332" : "#10191c"}
      />
    </mesh>
  );
}

function Board({
  fen,
  perspective,
  selectedSquare,
  legalTargets,
  moveAnimation,
  audioIntensity,
  inverted,
  onSquareClick
}: {
  fen: string;
  perspective: PlayerColor;
  selectedSquare: Square | null;
  legalTargets: Square[];
  moveAnimation: SceneMoveAnimation | null;
  audioIntensity: number;
  inverted: boolean;
  onSquareClick: (square: Square) => void;
}) {
  const groupRef = useRef<Group | null>(null);
  const inversionProgressRef = useRef(0);
  const pieces = useMemo(() => piecesFromFen(fen), [fen]);
  const hiddenSquares = useMemo(
    () =>
      moveAnimation
        ? new Set<Square>([moveAnimation.from, moveAnimation.to])
        : new Set<Square>(),
    [moveAnimation]
  );
  const squares = useMemo(
    () =>
      FILES.split("").flatMap((file) =>
        Array.from({ length: 8 }, (_, index) => `${file}${index + 1}` as Square)
      ),
    []
  );

  useFrame(({ clock }, delta) => {
    if (!groupRef.current) {
      return;
    }

    const targetProgress = inverted ? 1 : 0;
    const step = delta / BOARD_INVERSION_SECONDS;

    if (inversionProgressRef.current < targetProgress) {
      inversionProgressRef.current = Math.min(
        targetProgress,
        inversionProgressRef.current + step
      );
    } else if (inversionProgressRef.current > targetProgress) {
      inversionProgressRef.current = Math.max(
        targetProgress,
        inversionProgressRef.current - step
      );
    }

    const eased = smoothStep(inversionProgressRef.current);
    const submersion = boardSubmersionForTime(clock.elapsedTime);
    const breath = Math.sin(clock.elapsedTime * 0.42) * 0.026;

    groupRef.current.position.y =
      breath + eased * BOARD_INVERSION_RISE - submersion * BOARD_SUBMERSION_DEPTH;
    groupRef.current.rotation.y = eased * Math.PI;
    groupRef.current.rotation.z =
      Math.sin(clock.elapsedTime * 0.28) * 0.018 * eased +
      Math.sin(clock.elapsedTime * 0.5) * 0.01 * submersion;
  });

  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.08, 0]}>
        <boxGeometry args={[8.5, 0.12, 8.5]} />
        <meshBasicMaterial color="#593018" />
      </mesh>
      {squares.map((square) => (
        <BoardSquare
          key={square}
          onSquareClick={onSquareClick}
          perspective={perspective}
          selected={selectedSquare === square}
          square={square}
          target={legalTargets.includes(square)}
        />
      ))}
      {pieces.filter((piece) => !hiddenSquares.has(piece.square)).map((piece) => (
        <ChessPiece
          audioIntensity={audioIntensity}
          key={piece.square}
          onSquareClick={onSquareClick}
          perspective={perspective}
          piece={piece}
          selected={selectedSquare === piece.square}
        />
      ))}
      {moveAnimation ? (
        <PhaseMovePiece
          animation={moveAnimation}
          audioIntensity={audioIntensity}
          perspective={perspective}
        />
      ) : null}
    </group>
  );
}

function WaterPlane({ audioIntensity }: { audioIntensity: number }) {
  const meshRef = useRef<Mesh | null>(null);
  const materialRef = useRef<ShaderMaterial | null>(null);
  const uniforms = useMemo(
    () => ({
      uAudioIntensity: { value: 0 },
      uDeepColor: { value: new ThreeColor("#064452") },
      uFoamColor: { value: new ThreeColor("#b8fff3") },
      uGlowColor: { value: new ThreeColor("#8af7ff") },
      uSurfaceColor: { value: new ThreeColor("#15959a") },
      uSubmersion: { value: 0 },
      uTime: { value: 0 }
    }),
    []
  );

  useFrame(({ clock }) => {
    const time = clock.elapsedTime;

    if (!meshRef.current) {
      return;
    }

    meshRef.current.position.y =
      WATER_SURFACE_Y + Math.sin(time * 0.8) * 0.012 - audioIntensity * 0.025;

    if (materialRef.current) {
      materialRef.current.uniforms.uAudioIntensity.value = audioIntensity;
      materialRef.current.uniforms.uSubmersion.value = boardSubmersionForTime(time);
      materialRef.current.uniforms.uTime.value = time;
    }
  });

  return (
    <mesh ref={meshRef} position={[0, WATER_SURFACE_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[110, 110, 144, 144]} />
      <shaderMaterial
        ref={materialRef}
        depthWrite={false}
        fragmentShader={WATER_FRAGMENT_SHADER}
        transparent
        uniforms={uniforms}
        vertexShader={WATER_VERTEX_SHADER}
      />
    </mesh>
  );
}

function UnderwaterSurface({ audioIntensity }: { audioIntensity: number }) {
  const meshRef = useRef<Mesh | null>(null);
  const materialRef = useRef<ShaderMaterial | null>(null);
  const uniforms = useMemo(
    () => ({
      uAudioIntensity: { value: 0 },
      uDeepColor: { value: new ThreeColor("#022935") },
      uFoamColor: { value: new ThreeColor("#b8fff3") },
      uGlowColor: { value: new ThreeColor("#7bd2ad") },
      uSubmersion: { value: 0 },
      uTime: { value: 0 }
    }),
    []
  );

  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    const submersion = boardSubmersionForTime(time);

    if (meshRef.current) {
      meshRef.current.visible = submersion > 0.015;
      meshRef.current.position.y =
        WATER_SURFACE_Y + 0.05 + Math.sin(time * 0.36) * 0.018;
    }

    if (materialRef.current) {
      materialRef.current.uniforms.uAudioIntensity.value = audioIntensity;
      materialRef.current.uniforms.uSubmersion.value = submersion;
      materialRef.current.uniforms.uTime.value = time;
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={[0, WATER_SURFACE_Y + 0.05, 0]}
      renderOrder={5}
      rotation={[-Math.PI / 2, 0, 0]}
      visible={false}
    >
      <planeGeometry args={[12.5, 12.5, 96, 96]} />
      <shaderMaterial
        ref={materialRef}
        blending={AdditiveBlending}
        depthWrite={false}
        fragmentShader={UNDERWATER_SURFACE_FRAGMENT_SHADER}
        transparent
        uniforms={uniforms}
        vertexShader={UNDERWATER_SURFACE_VERTEX_SHADER}
      />
    </mesh>
  );
}

function SceneAtmosphere({ engulfProgressRef }: { engulfProgressRef: EngulfProgressRef }) {
  const { scene } = useThree();
  const backgroundColorRef = useRef(new ThreeColor("#07090b"));
  const fogRef = useRef<Fog | null>(null);
  const paletteRef = useRef({
    surfaceBackground: new ThreeColor("#07090b"),
    surfaceFog: new ThreeColor("#0a0d0e"),
    underwaterBackground: new ThreeColor("#021d26"),
    underwaterFog: new ThreeColor("#043540"),
    interiorBackground: new ThreeColor(INTERIOR_PALETTE.fog),
    interiorFog: new ThreeColor(INTERIOR_PALETTE.fog)
  });

  useEffect(() => {
    const fog = new Fog("#0a0d0e", 8, 28);

    fogRef.current = fog;
    scene.background = backgroundColorRef.current;
    scene.fog = fog;

    return () => {
      if (scene.background === backgroundColorRef.current) {
        scene.background = null;
      }

      if (scene.fog === fog) {
        scene.fog = null;
      }

      fogRef.current = null;
    };
  }, [scene]);

  useFrame(({ clock }) => {
    const submersion = smoothStep(boardSubmersionForTime(clock.elapsedTime));
    const current = Math.max(
      0,
      Math.min(1, submersion * (0.94 + Math.sin(clock.elapsedTime * 0.72) * 0.06))
    );
    const interior = smoothStep((engulfProgressRef.current - 0.45) / 0.5);
    const palette = paletteRef.current;

    backgroundColorRef.current
      .copy(palette.surfaceBackground)
      .lerp(palette.underwaterBackground, current)
      .lerp(palette.interiorBackground, interior);

    if (fogRef.current) {
      fogRef.current.color
        .copy(palette.surfaceFog)
        .lerp(palette.underwaterFog, current)
        .lerp(palette.interiorFog, interior);
      fogRef.current.near = 8 - current * 3.2;
      fogRef.current.far = lerp(28 - current * 8.5, 60, interior);
    }
  });

  return null;
}

function Planet({
  position,
  palette,
  scale,
  audioIntensity,
  engulfProgressRef,
  engulfCenter = [0, 0.6, 0],
  engulfScale = PLANET_ENGULF_SCALE
}: {
  position: [number, number, number];
  palette: PlanetPalette;
  scale: number;
  audioIntensity: number;
  engulfProgressRef?: EngulfProgressRef;
  engulfCenter?: [number, number, number];
  engulfScale?: number;
}) {
  const groupRef = useRef<Group | null>(null);
  const cloudRef = useRef<Mesh | null>(null);
  const surfaceMaterialRef = useRef<ShaderMaterial | null>(null);
  const cloudMaterialRef = useRef<ShaderMaterial | null>(null);
  const atmosphereMaterialRef = useRef<ShaderMaterial | null>(null);
  const surfaceUniforms = useMemo(
    () => ({
      uAudioIntensity: { value: 0 },
      uBandOffset: { value: palette.bandOffset },
      uBaseColor: { value: new ThreeColor(palette.base) },
      uGlowColor: { value: new ThreeColor(palette.glow) },
      uHighlightColor: { value: new ThreeColor(palette.highlight) },
      uLightDirection: { value: PLANET_LIGHT_DIRECTION },
      uOpacity: { value: 1 },
      uRidgeColor: { value: new ThreeColor(palette.ridge) },
      uShadowColor: { value: new ThreeColor(palette.shadow) },
      uTerrainScale: { value: palette.terrainScale },
      uTime: { value: 0 }
    }),
    [palette]
  );
  const cloudUniforms = useMemo(
    () => ({
      uAudioIntensity: { value: 0 },
      uBandOffset: { value: palette.bandOffset },
      uCloudColor: { value: new ThreeColor(palette.cloud) },
      uOpacity: { value: 1 },
      uTerrainScale: { value: palette.terrainScale },
      uTime: { value: 0 }
    }),
    [palette]
  );
  const atmosphereUniforms = useMemo(
    () => ({
      uAtmosphereColor: { value: new ThreeColor(palette.atmosphere) },
      uAudioIntensity: { value: 0 },
      uOpacity: { value: 1 },
      uTime: { value: 0 }
    }),
    [palette]
  );

  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    const progress = engulfProgressRef ? engulfProgressRef.current : 0;
    const t = smoothStep(progress);
    const baseScale = scale + audioIntensity * 0.16;
    const activeScale = lerp(baseScale, engulfScale, t);
    const shellFade = 1 - smoothStep((progress - 0.55) / 0.25);

    if (groupRef.current) {
      groupRef.current.rotation.y = time * palette.rotationSpeed;
      groupRef.current.rotation.z = Math.sin(time * 0.08) * 0.025;
      groupRef.current.position.x = lerp(position[0], engulfCenter[0], t);
      groupRef.current.position.y = lerp(position[1], engulfCenter[1], t);
      groupRef.current.position.z = lerp(position[2], engulfCenter[2], t);
      groupRef.current.scale.setScalar(activeScale);
    }

    if (cloudRef.current) {
      cloudRef.current.rotation.y = time * palette.cloudSpeed;
      cloudRef.current.rotation.x = Math.sin(time * 0.05) * 0.06;
    }

    if (surfaceMaterialRef.current) {
      surfaceMaterialRef.current.uniforms.uAudioIntensity.value = audioIntensity;
      surfaceMaterialRef.current.uniforms.uTime.value = time;
      surfaceMaterialRef.current.uniforms.uOpacity.value = shellFade;
    }

    if (cloudMaterialRef.current) {
      cloudMaterialRef.current.uniforms.uAudioIntensity.value = audioIntensity;
      cloudMaterialRef.current.uniforms.uTime.value = time;
      cloudMaterialRef.current.uniforms.uOpacity.value = shellFade;
    }

    if (atmosphereMaterialRef.current) {
      atmosphereMaterialRef.current.uniforms.uAudioIntensity.value = audioIntensity;
      atmosphereMaterialRef.current.uniforms.uTime.value = time;
      atmosphereMaterialRef.current.uniforms.uOpacity.value = shellFade;
    }
  });

  return (
    <group ref={groupRef} position={position} scale={scale}>
      <mesh renderOrder={1} rotation={[0.08, 0.18, -0.05]}>
        <sphereGeometry args={[1, 96, 48]} />
        <shaderMaterial
          ref={surfaceMaterialRef}
          fragmentShader={PLANET_SURFACE_FRAGMENT_SHADER}
          transparent
          uniforms={surfaceUniforms}
          vertexShader={PLANET_VERTEX_SHADER}
        />
      </mesh>
      <mesh ref={cloudRef} renderOrder={2} scale={1.018}>
        <sphereGeometry args={[1, 96, 48]} />
        <shaderMaterial
          ref={cloudMaterialRef}
          blending={AdditiveBlending}
          depthWrite={false}
          fragmentShader={PLANET_CLOUD_FRAGMENT_SHADER}
          transparent
          uniforms={cloudUniforms}
          vertexShader={PLANET_VERTEX_SHADER}
        />
      </mesh>
      <mesh renderOrder={3} scale={1.15}>
        <sphereGeometry args={[1, 96, 48]} />
        <shaderMaterial
          ref={atmosphereMaterialRef}
          blending={AdditiveBlending}
          depthWrite={false}
          fragmentShader={PLANET_ATMOSPHERE_FRAGMENT_SHADER}
          transparent
          uniforms={atmosphereUniforms}
          vertexShader={PLANET_VERTEX_SHADER}
        />
      </mesh>
    </group>
  );
}

function EngulfCoordinator({
  active,
  progressRef
}: {
  active: boolean;
  progressRef: EngulfProgressRef;
}) {
  useFrame((_, delta) => {
    const target = active ? 1 : 0;
    progressRef.current += (target - progressRef.current) * Math.min(1, delta * 1.1);
  });
  return null;
}

function PlanetInterior({
  audioIntensity,
  engulfProgressRef
}: {
  audioIntensity: number;
  engulfProgressRef: EngulfProgressRef;
}) {
  const { size } = useThree();
  const groupRef = useRef<Group | null>(null);
  const surfaceMaterialRef = useRef<ShaderMaterial | null>(null);
  const auroraMaterialRef = useRef<ShaderMaterial | null>(null);
  const hazeMaterialRef = useRef<ShaderMaterial | null>(null);
  const pulseRef = useRef(0);
  const pulseThresholdRef = useRef(0.5);
  const narrow = size.width < 700;
  const segments = useMemo<[number, number, number]>(
    () => (narrow ? [1, 96, 48] : [1, 128, 64]),
    [narrow]
  );
  const auroraSegments = useMemo<[number, number, number]>(
    () => (narrow ? [1, 72, 36] : [1, 96, 48]),
    [narrow]
  );
  const hazeSegments = useMemo<[number, number, number]>(
    () => (narrow ? [1, 56, 28] : [1, 80, 40]),
    [narrow]
  );

  const surfaceUniforms = useMemo(
    () => ({
      uAudioIntensity: { value: 0 },
      uAuroraColorA: { value: new ThreeColor(INTERIOR_PALETTE.auroraA) },
      uAuroraColorB: { value: new ThreeColor(INTERIOR_PALETTE.auroraB) },
      uCoreGlowColor: { value: new ThreeColor(INTERIOR_PALETTE.coreGlow) },
      uEmberColor: { value: new ThreeColor(INTERIOR_PALETTE.ember) },
      uEngulfProgress: { value: 0 },
      uHighlightColor: { value: new ThreeColor(INTERIOR_PALETTE.highlight) },
      uOpacity: { value: 0 },
      uPulse: { value: 0 },
      uShadowColor: { value: new ThreeColor(INTERIOR_PALETTE.shadow) },
      uTime: { value: 0 }
    }),
    []
  );
  const auroraUniforms = useMemo(
    () => ({
      uAudioIntensity: { value: 0 },
      uAuroraColorA: { value: new ThreeColor(INTERIOR_PALETTE.auroraA) },
      uAuroraColorB: { value: new ThreeColor(INTERIOR_PALETTE.auroraB) },
      uOpacity: { value: 0 },
      uPulse: { value: 0 },
      uTime: { value: 0 }
    }),
    []
  );
  const hazeUniforms = useMemo(
    () => ({
      uAudioIntensity: { value: 0 },
      uAuroraColorA: { value: new ThreeColor(INTERIOR_PALETTE.auroraA) },
      uCoreGlowColor: { value: new ThreeColor(INTERIOR_PALETTE.coreGlow) },
      uOpacity: { value: 0 },
      uPulse: { value: 0 },
      uTime: { value: 0 }
    }),
    []
  );

  useFrame(({ clock }, delta) => {
    const progress = engulfProgressRef.current;
    const visible = progress > 0.02;

    if (groupRef.current) {
      groupRef.current.visible = visible;
      groupRef.current.rotation.y += delta * 0.012;
    }
    if (!visible) {
      return;
    }

    if (audioIntensity > pulseThresholdRef.current) {
      pulseRef.current = Math.min(1, audioIntensity);
      pulseThresholdRef.current = audioIntensity * 1.05;
    }
    pulseRef.current *= 0.92;
    pulseThresholdRef.current = Math.max(0.5, pulseThresholdRef.current * 0.985);

    const time = clock.elapsedTime;
    const opacity = smoothStep((progress - 0.45) / 0.5);
    const pulse = pulseRef.current;

    if (surfaceMaterialRef.current) {
      const u = surfaceMaterialRef.current.uniforms;
      u.uTime.value = time;
      u.uAudioIntensity.value = audioIntensity;
      u.uPulse.value = pulse;
      u.uEngulfProgress.value = progress;
      u.uOpacity.value = opacity;
    }
    if (auroraMaterialRef.current) {
      const u = auroraMaterialRef.current.uniforms;
      u.uTime.value = time;
      u.uAudioIntensity.value = audioIntensity;
      u.uPulse.value = pulse;
      u.uOpacity.value = opacity;
    }
    if (hazeMaterialRef.current) {
      const u = hazeMaterialRef.current.uniforms;
      u.uTime.value = time;
      u.uAudioIntensity.value = audioIntensity;
      u.uPulse.value = pulse;
      u.uOpacity.value = opacity;
    }
  });

  return (
    <group ref={groupRef} position={[0, 0.6, 0]} visible={false}>
      <mesh renderOrder={10} scale={INTERIOR_SURFACE_RADIUS} raycast={() => null}>
        <sphereGeometry args={segments} />
        <shaderMaterial
          ref={surfaceMaterialRef}
          depthWrite={false}
          fragmentShader={PLANET_INTERIOR_SURFACE_FRAGMENT_SHADER}
          side={BackSide}
          transparent
          uniforms={surfaceUniforms}
          vertexShader={PLANET_VERTEX_SHADER}
        />
      </mesh>
      <mesh renderOrder={11} scale={INTERIOR_AURORA_RADIUS} raycast={() => null}>
        <sphereGeometry args={auroraSegments} />
        <shaderMaterial
          ref={auroraMaterialRef}
          blending={AdditiveBlending}
          depthWrite={false}
          fragmentShader={PLANET_INTERIOR_AURORA_FRAGMENT_SHADER}
          side={BackSide}
          transparent
          uniforms={auroraUniforms}
          vertexShader={PLANET_VERTEX_SHADER}
        />
      </mesh>
      <mesh renderOrder={12} scale={INTERIOR_HAZE_RADIUS} raycast={() => null}>
        <sphereGeometry args={hazeSegments} />
        <shaderMaterial
          ref={hazeMaterialRef}
          blending={AdditiveBlending}
          depthWrite={false}
          fragmentShader={PLANET_INTERIOR_HAZE_FRAGMENT_SHADER}
          side={BackSide}
          transparent
          uniforms={hazeUniforms}
          vertexShader={PLANET_VERTEX_SHADER}
        />
      </mesh>
    </group>
  );
}

function InteriorLighting({
  engulfProgressRef
}: {
  engulfProgressRef: EngulfProgressRef;
}) {
  const pointRef = useRef<PointLight | null>(null);
  const ambientRef = useRef<AmbientLight | null>(null);

  useFrame(() => {
    const intensity = smoothStep((engulfProgressRef.current - 0.45) / 0.5);
    if (pointRef.current) {
      pointRef.current.intensity = 12 * intensity;
    }
    if (ambientRef.current) {
      ambientRef.current.intensity = 0.6 * intensity;
    }
  });

  return (
    <>
      <pointLight
        ref={pointRef}
        color="#ffd38a"
        distance={20}
        intensity={0}
        position={[0, 4, 0]}
      />
      <ambientLight ref={ambientRef} color="#f0a63b" intensity={0} />
    </>
  );
}

function ResponsiveCamera() {
  const { camera, size } = useThree();

  useEffect(() => {
    const perspectiveCamera = camera as PerspectiveCamera;
    const narrow = size.width < 700;

    perspectiveCamera.position.set(
      narrow ? 7.2 : 6.4,
      narrow ? 6.3 : 5.9,
      narrow ? 8.8 : 7.6
    );
    perspectiveCamera.fov = narrow ? 60 : 52;
    perspectiveCamera.updateProjectionMatrix();
    perspectiveCamera.lookAt(0, 0, 0);
  }, [camera, size.width]);

  return null;
}

function SceneContent(props: ElysiumSceneProps) {
  const perspective = props.playerColor ?? "white";
  const fen = props.displayFen ?? props.room?.fen ?? STARTING_FEN;
  const engulfProgressRef = useRef(0);

  return (
    <>
      <EngulfCoordinator active={props.planetEngulfActive} progressRef={engulfProgressRef} />
      <SceneAtmosphere engulfProgressRef={engulfProgressRef} />
      <ambientLight intensity={1.65} />
      <directionalLight intensity={2.6} position={[-3.5, 7, 4]} />
      <pointLight color="#f0a63b" intensity={18} position={[-4, 2.8, 3]} />
      <pointLight color="#9ab8ff" intensity={16} position={[4, 3.5, -3]} />
      <InteriorLighting engulfProgressRef={engulfProgressRef} />
      <Stars count={800} depth={36} factor={4} fade radius={80} saturation={0} />
      <Sparkles
        color="#f0d9ab"
        count={70}
        opacity={0.44}
        scale={[12, 2.2, 12]}
        size={1.9 + props.audioIntensity * 3}
        speed={0.22}
      />
      <Planet
        audioIntensity={props.audioIntensity}
        engulfProgressRef={engulfProgressRef}
        palette={PLANET_PALETTES.ember}
        position={[-6.8, 1.1, -11.5]}
        scale={2.45}
      />
      <PlanetInterior
        audioIntensity={props.audioIntensity}
        engulfProgressRef={engulfProgressRef}
      />
      <Planet
        audioIntensity={props.audioIntensity}
        palette={PLANET_PALETTES.azure}
        position={[-1, 1, -11]}
        scale={1.35}
      />
      <WaterPlane audioIntensity={props.audioIntensity} />
      <UnderwaterSurface audioIntensity={props.audioIntensity} />
      <Board
        audioIntensity={props.audioIntensity}
        fen={fen}
        legalTargets={props.legalTargets}
        moveAnimation={props.moveAnimation}
        onSquareClick={props.onSquareClick}
        perspective={perspective}
        inverted={props.boardInverted}
        selectedSquare={props.selectedSquare}
      />
      <ResponsiveCamera />
      <OrbitControls
        enableDamping
        enablePan={false}
        maxDistance={14}
        maxPolarAngle={Math.PI / 2.15}
        minDistance={6}
        minPolarAngle={Math.PI / 4}
        target={[0, 0, 0]}
      />
    </>
  );
}

export function ElysiumScene(props: ElysiumSceneProps) {
  return (
    <Canvas
      camera={{ position: [6.4, 5.9, 7.6], fov: 52 }}
      dpr={1}
      gl={{ antialias: true, alpha: false }}
      onCreated={({ camera }) => {
        camera.lookAt(0, 0, 0);
      }}
      style={{ background: "#07090b", touchAction: "none" }}
    >
      <SceneContent {...props} />
    </Canvas>
  );
}
