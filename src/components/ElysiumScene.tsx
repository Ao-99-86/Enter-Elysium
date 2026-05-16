"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Sparkles, Stars } from "@react-three/drei";
import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";
import { useEffect, useMemo, useRef } from "react";
import { AdditiveBlending, Color as ThreeColor, Vector3 } from "three";
import type { Group, Mesh, PerspectiveCamera, ShaderMaterial } from "three";
import type { PlayerColor, PublicRoom } from "@/lib/rooms/types";

type ScenePiece = {
  square: Square;
  type: PieceSymbol;
  color: Color;
};

type ElysiumSceneProps = {
  room: PublicRoom | null;
  playerColor?: PlayerColor;
  selectedSquare: Square | null;
  legalTargets: Square[];
  audioIntensity: number;
  onSquareClick: (square: Square) => void;
};

const STARTING_FEN = new Chess().fen();
const FILES = "abcdefgh";
const PLANET_LIGHT_DIRECTION = new Vector3(-0.45, 0.72, 0.54).normalize();

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

    gl_FragColor = vec4(color, 1.0);
  }
`;

const PLANET_CLOUD_FRAGMENT_SHADER = `
  uniform vec3 uCloudColor;
  uniform float uTime;
  uniform float uAudioIntensity;
  uniform float uTerrainScale;
  uniform float uBandOffset;

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
    gl_FragColor = vec4(uCloudColor, alpha);
  }
`;

const PLANET_ATMOSPHERE_FRAGMENT_SHADER = `
  uniform vec3 uAtmosphereColor;
  uniform float uTime;
  uniform float uAudioIntensity;

  varying vec3 vObjectPosition;
  varying vec3 vWorldNormal;
  varying vec3 vViewDirection;

  void main() {
    vec3 normal = normalize(vWorldNormal);
    vec3 viewDirection = normalize(vViewDirection);
    float rim = pow(1.0 - max(dot(normal, viewDirection), 0.0), 2.2);
    float pulse = sin(uTime * 0.9 + vObjectPosition.y * 8.0) * 0.5 + 0.5;
    float alpha = rim * (0.32 + uAudioIntensity * 0.18) + pulse * rim * 0.04;

    gl_FragColor = vec4(uAtmosphereColor, alpha);
  }
`;

const WATER_VERTEX_SHADER = `
  uniform float uTime;
  uniform float uAudioIntensity;

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
    transformed.z += vWave * (0.026 + uAudioIntensity * 0.018);

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

    float alpha = 0.9 + current * 0.05 + wake * 0.06 + glint * 0.03;
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

function PieceMaterial({
  color,
  selected = false
}: {
  color: Color;
  selected?: boolean;
}) {
  const palette =
    color === "w"
      ? {
          color: "#f0a63b",
          emissive: selected ? "#ffd890" : "#5f2f0d"
        }
      : {
          color: "#d9e5ff",
          emissive: selected ? "#c3d5ff" : "#344168"
        };

  return (
    <meshStandardMaterial
      color={palette.color}
      emissive={palette.emissive}
      emissiveIntensity={selected ? 1.1 : 0.55}
      metalness={0.72}
      roughness={0.22}
    />
  );
}

function BasePiece({
  color,
  selected,
  children
}: {
  color: Color;
  selected: boolean;
  children: React.ReactNode;
}) {
  return (
    <>
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.42, 0.5, 0.16, 40]} />
        <PieceMaterial color={color} selected={selected} />
      </mesh>
      <mesh position={[0, 0.24, 0]}>
        <cylinderGeometry args={[0.24, 0.32, 0.22, 36]} />
        <PieceMaterial color={color} selected={selected} />
      </mesh>
      {children}
    </>
  );
}

function PieceShape({
  type,
  color,
  selected
}: {
  type: PieceSymbol;
  color: Color;
  selected: boolean;
}) {
  if (type === "p") {
    return (
      <BasePiece color={color} selected={selected}>
        <mesh position={[0, 0.52, 0]}>
          <sphereGeometry args={[0.24, 20, 14]} />
          <PieceMaterial color={color} selected={selected} />
        </mesh>
      </BasePiece>
    );
  }

  if (type === "r") {
    return (
      <BasePiece color={color} selected={selected}>
        <mesh position={[0, 0.55, 0]}>
          <cylinderGeometry args={[0.31, 0.25, 0.38, 28]} />
          <PieceMaterial color={color} selected={selected} />
        </mesh>
        {[-0.18, 0.18].map((x) =>
          [-0.18, 0.18].map((z) => (
            <mesh key={`${x}-${z}`} position={[x, 0.8, z]}>
              <boxGeometry args={[0.14, 0.16, 0.14]} />
              <PieceMaterial color={color} selected={selected} />
            </mesh>
          ))
        )}
      </BasePiece>
    );
  }

  if (type === "n") {
    return (
      <BasePiece color={color} selected={selected}>
        <mesh position={[0, 0.57, -0.03]} rotation={[0.35, 0.2, -0.15]}>
          <coneGeometry args={[0.31, 0.58, 5]} />
          <PieceMaterial color={color} selected={selected} />
        </mesh>
        <mesh position={[0.07, 0.78, -0.22]} rotation={[0.1, 0, 0.3]}>
          <boxGeometry args={[0.22, 0.16, 0.32]} />
          <PieceMaterial color={color} selected={selected} />
        </mesh>
      </BasePiece>
    );
  }

  if (type === "b") {
    return (
      <BasePiece color={color} selected={selected}>
        <mesh position={[0, 0.58, 0]}>
          <coneGeometry args={[0.28, 0.62, 36]} />
          <PieceMaterial color={color} selected={selected} />
        </mesh>
        <mesh position={[0, 0.91, 0]}>
          <sphereGeometry args={[0.1, 16, 10]} />
          <PieceMaterial color={color} selected={selected} />
        </mesh>
      </BasePiece>
    );
  }

  if (type === "q") {
    return (
      <BasePiece color={color} selected={selected}>
        <mesh position={[0, 0.57, 0]}>
          <cylinderGeometry args={[0.2, 0.28, 0.48, 36]} />
          <PieceMaterial color={color} selected={selected} />
        </mesh>
        {[-0.25, -0.12, 0, 0.12, 0.25].map((x, index) => (
          <mesh key={x} position={[x, 0.9 + (index === 2 ? 0.07 : 0), 0]}>
            <sphereGeometry args={[index === 2 ? 0.11 : 0.08, 14, 10]} />
            <PieceMaterial color={color} selected={selected} />
          </mesh>
        ))}
      </BasePiece>
    );
  }

  return (
    <BasePiece color={color} selected={selected}>
      <mesh position={[0, 0.57, 0]}>
        <cylinderGeometry args={[0.22, 0.3, 0.52, 36]} />
        <PieceMaterial color={color} selected={selected} />
      </mesh>
      <mesh position={[0, 0.94, 0]}>
        <boxGeometry args={[0.12, 0.36, 0.08]} />
        <PieceMaterial color={color} selected={selected} />
      </mesh>
      <mesh position={[0, 0.98, 0]}>
        <boxGeometry args={[0.34, 0.08, 0.08]} />
        <PieceMaterial color={color} selected={selected} />
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
  const [x, , z] = squarePosition(piece.square, perspective);

  useFrame(({ clock }) => {
    if (!groupRef.current) {
      return;
    }

    groupRef.current.position.y =
      0.09 + Math.sin(clock.elapsedTime * 1.35 + x + z) * 0.018 + audioIntensity * 0.06;
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
      <PieceShape color={piece.color} selected={selected} type={piece.type} />
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
  const [x, , z] = squarePosition(square, perspective);
  const file = FILES.indexOf(square[0]);
  const rank = Number(square[1]);
  const light = (file + rank) % 2 === 0;

  return (
    <mesh
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
  audioIntensity,
  onSquareClick
}: {
  fen: string;
  perspective: PlayerColor;
  selectedSquare: Square | null;
  legalTargets: Square[];
  audioIntensity: number;
  onSquareClick: (square: Square) => void;
}) {
  const pieces = useMemo(() => piecesFromFen(fen), [fen]);
  const squares = useMemo(
    () =>
      FILES.split("").flatMap((file) =>
        Array.from({ length: 8 }, (_, index) => `${file}${index + 1}` as Square)
      ),
    []
  );

  return (
    <group>
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
      {pieces.map((piece) => (
        <ChessPiece
          audioIntensity={audioIntensity}
          key={piece.square}
          onSquareClick={onSquareClick}
          perspective={perspective}
          piece={piece}
          selected={selectedSquare === piece.square}
        />
      ))}
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
      -0.23 + Math.sin(time * 0.8) * 0.012 - audioIntensity * 0.025;

    if (materialRef.current) {
      materialRef.current.uniforms.uAudioIntensity.value = audioIntensity;
      materialRef.current.uniforms.uTime.value = time;
    }
  });

  return (
    <mesh ref={meshRef} position={[0, -0.23, 0]} rotation={[-Math.PI / 2, 0, 0]}>
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

function Planet({
  position,
  palette,
  scale,
  audioIntensity
}: {
  position: [number, number, number];
  palette: PlanetPalette;
  scale: number;
  audioIntensity: number;
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
      uTerrainScale: { value: palette.terrainScale },
      uTime: { value: 0 }
    }),
    [palette]
  );
  const atmosphereUniforms = useMemo(
    () => ({
      uAtmosphereColor: { value: new ThreeColor(palette.atmosphere) },
      uAudioIntensity: { value: 0 },
      uTime: { value: 0 }
    }),
    [palette]
  );

  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    const activeScale = scale + audioIntensity * 0.16;

    if (groupRef.current) {
      groupRef.current.rotation.y = time * palette.rotationSpeed;
      groupRef.current.rotation.z = Math.sin(time * 0.08) * 0.025;
      groupRef.current.scale.setScalar(activeScale);
    }

    if (cloudRef.current) {
      cloudRef.current.rotation.y = time * palette.cloudSpeed;
      cloudRef.current.rotation.x = Math.sin(time * 0.05) * 0.06;
    }

    if (surfaceMaterialRef.current) {
      surfaceMaterialRef.current.uniforms.uAudioIntensity.value = audioIntensity;
      surfaceMaterialRef.current.uniforms.uTime.value = time;
    }

    if (cloudMaterialRef.current) {
      cloudMaterialRef.current.uniforms.uAudioIntensity.value = audioIntensity;
      cloudMaterialRef.current.uniforms.uTime.value = time;
    }

    if (atmosphereMaterialRef.current) {
      atmosphereMaterialRef.current.uniforms.uAudioIntensity.value = audioIntensity;
      atmosphereMaterialRef.current.uniforms.uTime.value = time;
    }
  });

  return (
    <group ref={groupRef} position={position} scale={scale}>
      <mesh renderOrder={1} rotation={[0.08, 0.18, -0.05]}>
        <sphereGeometry args={[1, 96, 48]} />
        <shaderMaterial
          ref={surfaceMaterialRef}
          fragmentShader={PLANET_SURFACE_FRAGMENT_SHADER}
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
  const fen = props.room?.fen ?? STARTING_FEN;

  return (
    <>
      <color attach="background" args={["#07090b"]} />
      <fog attach="fog" args={["#0a0d0e", 8, 28]} />
      <ambientLight intensity={1.65} />
      <directionalLight intensity={2.6} position={[-3.5, 7, 4]} />
      <pointLight color="#f0a63b" intensity={18} position={[-4, 2.8, 3]} />
      <pointLight color="#9ab8ff" intensity={16} position={[4, 3.5, -3]} />
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
        palette={PLANET_PALETTES.ember}
        position={[-6.8, 1.1, -11.5]}
        scale={2.45}
      />
      <Planet
        audioIntensity={props.audioIntensity}
        palette={PLANET_PALETTES.azure}
        position={[-1, 1, -11]}
        scale={1.35}
      />
      <WaterPlane audioIntensity={props.audioIntensity} />
      <Board
        audioIntensity={props.audioIntensity}
        fen={fen}
        legalTargets={props.legalTargets}
        onSquareClick={props.onSquareClick}
        perspective={perspective}
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
