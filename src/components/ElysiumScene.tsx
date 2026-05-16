"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Sparkles, Stars } from "@react-three/drei";
import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";
import { useMemo, useRef } from "react";
import type { Group, Mesh } from "three";
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

  useFrame(({ clock }) => {
    if (!meshRef.current) {
      return;
    }

    meshRef.current.position.y =
      -0.16 + Math.sin(clock.elapsedTime * 0.8) * 0.012 - audioIntensity * 0.025;
  });

  return (
    <mesh ref={meshRef} position={[0, -0.16, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[90, 90, 1, 1]} />
      <meshBasicMaterial
        color="#0a1718"
        opacity={0.78}
        transparent
      />
    </mesh>
  );
}

function Planet({
  position,
  color,
  scale,
  audioIntensity
}: {
  position: [number, number, number];
  color: string;
  scale: number;
  audioIntensity: number;
}) {
  const ref = useRef<Mesh | null>(null);

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.elapsedTime * 0.04;
      ref.current.scale.setScalar(scale + audioIntensity * 0.16);
    }
  });

  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[1, 48, 24]} />
      <meshBasicMaterial
        color={color}
        opacity={0.42}
        transparent
      />
    </mesh>
  );
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
        color="#f2a45e"
        position={[-5.2, 4.5, -9.5]}
        scale={3.2}
      />
      <Planet
        audioIntensity={props.audioIntensity}
        color="#91aaff"
        position={[5.2, 3.7, -10.2]}
        scale={1.85}
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
      <OrbitControls
        enableDamping
        enablePan={false}
        maxDistance={12}
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
      camera={{ position: [5.8, 5.4, 6.8], fov: 46 }}
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
