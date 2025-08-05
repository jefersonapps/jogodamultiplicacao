import React, { useRef, useState, useEffect, useMemo, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Text,
  Cylinder,
  Box,
  OrbitControls,
  Extrude,
  RoundedBox,
  SpotLight,
} from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { gsap } from "gsap";
import { GameSetupModal } from "./components/game-setup-modal";
import { Button } from "./components/ui/button";

type Player = "player1" | "player2";
type Operation = "+" | "-" | "×" | "÷";
type Segment = { v: number; c: string };

const PREDEFINED_BOARDS: Record<Operation, number[][]> = {
  "×": [
    [30, 18, 63, 64, 28, 7, 8],
    [32, 45, 60, 70, 27, 6, 9],
    [35, 48, 56, 72, 25, 5, 10],
    [36, 1, 54, 80, 24, 4, 12],
    [40, 16, 50, 81, 21, 3, 14],
    [42, 100, 49, 90, 20, 2, 15],
  ],

  "+": [
    [14, 8, 21, 12, 17, 9, 23],
    [6, 25, 11, 18, 7, 15, 20],
    [24, 10, 19, 5, 22, 13, 16],
    [1, 2, 3, 4, 26, 27, 28],
    [29, 30, 31, 32, 33, 34, 35],
    [36, 37, 38, 39, 40, 41, 42],
  ],

  "-": [
    [2, 5, 3, 7, 1, 6, 20],
    [8, 4, 9, 0, 10, 15, 13],
    [12, 17, 16, 14, 19, 11, 18],
    [21, 22, 23, 24, 25, 26, 27],
    [28, 29, 30, 31, 32, 33, 34],
    [35, 36, 37, 38, 39, 40, 41],
  ],

  "÷": [
    [9, 2, 8, 6, 10, 14, 18],
    [4, 5, 7, 3, 1, 17, 11],
    [21, 20, 19, 12, 16, 15, 13],
    [22, 23, 24, 25, 26, 27, 28],
    [29, 30, 32, 35, 36, 40, 42],
    [45, 48, 50, 54, 56, 60, 81],
  ],
};

const DEFAULT_SPINNER_SEGMENTS: Segment[] = [
  { v: 1, c: "#8A2BE2" },
  { v: 2, c: "#DC143C" },
  { v: 3, c: "#FF4500" },
  { v: 4, c: "#483D8B" },
  { v: 5, c: "#FF69B4" },
  { v: 6, c: "#FFD700" },
  { v: 7, c: "#3CB371" },
  { v: 8, c: "#00CED1" },
  { v: 9, c: "#008B8B" },
  { v: 10, c: "#D2B48C" },
];

const useAudio = (url: string) => {
  const audio = useRef(new Audio(url));
  const play = () => {
    audio.current.currentTime = 0;
    audio.current
      .play()
      .catch((error) => console.error(`Erro ao tocar o áudio ${url}:`, error));
  };
  return play;
};

type GameState =
  | "SETUP"
  | "COIN_FLIP"
  | "PLAYER_1_SPIN_1"
  | "PLAYER_1_SPIN_2"
  | "PLAYER_1_ANSWER"
  | "PLAYER_2_SPIN_1"
  | "PLAYER_2_SPIN_2"
  | "PLAYER_2_ANSWER"
  | "GAME_OVER";
interface PlayerSettings {
  name: string;
  value: string;
  light: string;
}
interface GameSettings {
  player1: PlayerSettings;
  player2: PlayerSettings;
  winCondition: "first_to_5" | "connect_3" | "most_on_full";
  operation: Operation;
}
interface Particle {
  id: number;
  position: [number, number, number];
  velocity: [number, number, number];
  life: number;
  decay: number;
}
interface FireworkExplosionProps {
  position: [number, number, number];
  color: THREE.ColorRepresentation;
}

function FireworkExplosion({ position, color }: FireworkExplosionProps) {
  const particleCount = 100;
  const [particles, setParticles] = useState<Particle[]>([]);
  useEffect(() => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const speed = Math.random() * 8 + 4;
      newParticles.push({
        id: i,
        position: [0, 0, 0],
        velocity: [
          speed * Math.sin(phi) * Math.cos(theta),
          speed * Math.sin(phi) * Math.sin(theta),
          speed * Math.cos(phi),
        ],
        life: 1.0,
        decay: Math.random() * 0.3 + 0.2,
      });
    }
    setParticles(newParticles);
  }, []);
  useFrame((_, delta) => {
    setParticles((prevParticles) =>
      prevParticles
        .map((p) => ({
          ...p,
          position: [
            p.position[0] + p.velocity[0] * delta,
            p.position[1] + p.velocity[1] * delta,
            p.position[2] + p.velocity[2] * delta,
          ] as [number, number, number],
          velocity: [
            p.velocity[0],
            p.velocity[1] - 15 * delta,
            p.velocity[2],
          ] as [number, number, number],
          life: p.life - p.decay * delta,
        }))
        .filter((p) => p.life > 0)
    );
  });
  return (
    <group position={position}>
      {particles.map((particle) => (
        <mesh key={particle.id} position={particle.position}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={particle.life}
          />
        </mesh>
      ))}
    </group>
  );
}

interface Explosion {
  id: number;
  position: [number, number, number];
  color: THREE.ColorRepresentation;
  startTime: number;
}
interface FireworksProps {
  color: THREE.ColorRepresentation;
  isActive: boolean;
}
function Fireworks({ color, isActive }: FireworksProps) {
  const [explosions, setExplosions] = useState<Explosion[]>([]);
  const playWinnerSound = useAudio("/audio/vencedor.wav");
  useEffect(() => {
    if (!isActive) {
      setExplosions([]);
      return;
    }
    const firstExplosion: Explosion = {
      id: Date.now(),
      position: [
        (Math.random() - 0.5) * 10,
        Math.random() * 3 + 10,
        (Math.random() - 0.5) * 6,
      ],
      color: color,
      startTime: Date.now(),
    };
    setExplosions([firstExplosion]);
    playWinnerSound();
    const interval = setInterval(() => {
      const newExplosion: Explosion = {
        id: Date.now() + Math.random(),
        position: [
          (Math.random() - 0.5) * 10,
          Math.random() * 3 + 10,
          (Math.random() - 0.5) * 6,
        ],
        color: color,
        startTime: Date.now(),
      };
      setExplosions((current) => {
        const now = Date.now();
        const filtered = current.filter((exp) => now - exp.startTime < 5000);
        return [...filtered, newExplosion].slice(-6);
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [color, isActive]);
  useEffect(() => {
    if (!isActive) setExplosions([]);
  }, [isActive]);
  return (
    <group>
      {explosions.map((e) => (
        <FireworkExplosion key={e.id} position={e.position} color={e.color} />
      ))}
    </group>
  );
}

const WALL_HEIGHT = 10;
const BOARD_HEIGHT = 12 + 0.5;
const BOARD_WIDTH = 14 + 0.5;
const DEFAULT_GAME_SETTINGS: GameSettings = {
  player1: { name: "Azul (Padrão)", value: "#4682B4", light: "#00BFFF" },
  player2: { name: "Rosa (Padrão)", value: "#DB7093", light: "#FF1493" },
  winCondition: "first_to_5",
  operation: "×",
};

interface CameraManagerProps {
  gameState: GameState;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}
const CameraManager = ({ gameState, controlsRef }: CameraManagerProps) => {
  const { camera } = useThree();
  const cameraPositions = useMemo(
    () => ({
      spinners: new THREE.Vector3(0, 5, 15),
      board: new THREE.Vector3(0, 18, 15),
      coin: new THREE.Vector3(0, 5, 12),
    }),
    []
  );
  const cameraTargets = useMemo(
    () => ({
      spinners: new THREE.Vector3(0, WALL_HEIGHT / 2, -BOARD_HEIGHT / 2),
      board: new THREE.Vector3(0, 0, 0),
      coin: new THREE.Vector3(0, 5, 0),
    }),
    []
  );
  useEffect(() => {
    if (!controlsRef.current) return;
    const controls = controlsRef.current;
    let pos = cameraPositions.spinners;
    let target = cameraTargets.spinners;
    if (gameState === "COIN_FLIP") {
      pos = cameraPositions.coin;
      target = cameraTargets.coin;
    } else if (
      gameState !== "SETUP" &&
      gameState !== "GAME_OVER" &&
      !gameState.endsWith("SPIN_1") &&
      !gameState.endsWith("SPIN_2")
    ) {
      pos = cameraPositions.board;
      target = cameraTargets.board;
    }
    gsap.to(camera.position, { ...pos, duration: 1.5, ease: "power2.inOut" });
    if (controls.target) {
      gsap.to(controls.target as THREE.Vector3, {
        ...target,
        duration: 1.5,
        ease: "power2.inOut",
      });
    }
  }, [gameState, camera, controlsRef, cameraPositions, cameraTargets]);
  return null;
};

interface PieSliceProps {
  radius: number;
  startAngle: number;
  angleLength: number;
  color: THREE.ColorRepresentation;
}
const PieSlice = ({
  radius,
  startAngle,
  angleLength,
  color,
}: PieSliceProps) => {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.arc(0, 0, radius, startAngle, startAngle + angleLength, false);
    s.lineTo(0, 0);
    return s;
  }, [radius, startAngle, angleLength]);
  const extrudeSettings = useMemo(
    () => ({ steps: 1, depth: 0.2, bevelEnabled: false }),
    []
  );
  return (
    <mesh position={[0, 0, -0.1]}>
      <Extrude args={[shape, extrudeSettings]}>
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.1} />
      </Extrude>
    </mesh>
  );
};

interface Spinner3DProps {
  position: [number, number, number];
  onSpinStart: (() => void) | null;
  onSpinEnd: (value: number) => void;
  isSpinning: boolean;
  targetValue: number | null;
  segments: Segment[];
}
const Spinner3D = ({
  position,
  onSpinStart,
  onSpinEnd,
  isSpinning,
  targetValue,
  segments,
}: Spinner3DProps) => {
  const spinnerGroupRef = useRef<THREE.Group>(null);
  const segmentAngle = (2 * Math.PI) / segments.length;
  useEffect(() => {
    if (isSpinning && spinnerGroupRef.current && targetValue !== null) {
      const targetSegmentIndex = segments.findIndex((s) => s.v === targetValue);
      if (targetSegmentIndex === -1) {
        console.error("Valor alvo inválido para o spinner:", targetValue);
        return;
      }
      const finalRestingAngle = targetSegmentIndex * segmentAngle;
      const currentRotation = spinnerGroupRef.current.rotation.z;
      const currentRotationMod = currentRotation % (2 * Math.PI);
      let shortestDistance = finalRestingAngle - currentRotationMod;
      if (shortestDistance > 0) shortestDistance -= 2 * Math.PI;
      const targetRotation =
        currentRotation + (shortestDistance - 4 * (2 * Math.PI));
      gsap.to(spinnerGroupRef.current.rotation, {
        z: targetRotation,
        duration: 5,
        ease: "power2.out",
        onComplete: () => onSpinEnd(targetValue),
      });
    }
  }, [isSpinning, targetValue, onSpinEnd, segments, segmentAngle]);

  return (
    <group position={position} onClick={onSpinStart || undefined}>
      <group ref={spinnerGroupRef}>
        {segments.map((segment, i) => {
          const midAngle = Math.PI / 2 - i * segmentAngle;
          const startAngle = midAngle - segmentAngle / 2;
          const textRadius = 1.3;
          const textPosition: [number, number, number] = [
            Math.cos(midAngle) * textRadius,
            Math.sin(midAngle) * textRadius,
            0.101,
          ];
          return (
            <React.Fragment key={i}>
              <PieSlice
                radius={1.8}
                startAngle={startAngle}
                angleLength={segmentAngle}
                color={segment.c}
              />
              <Text
                position={textPosition}
                rotation={[0, 0, midAngle - Math.PI / 2]}
                fontSize={segment.v > 99 ? 0.3 : 0.4}
                color="black"
                anchorX="center"
                anchorY="middle"
              >
                {segment.v.toString()}
              </Text>
            </React.Fragment>
          );
        })}
        <Cylinder args={[0.25, 0.25, 0.4, 32]} rotation={[Math.PI / 2, 0, 0]}>
          <meshStandardMaterial color="white" roughness={0.3} />
        </Cylinder>
      </group>
      <Pointer position={[0, 2.2, -0.1]} />
    </group>
  );
};

interface RestartButton3DProps {
  position: [number, number, number];
  onClick: () => void;
}
const RestartButton3D = ({ position, onClick }: RestartButton3DProps) => {
  const [hovered, setHovered] = useState(false);
  const ref = useRef<THREE.Group>(null);
  useEffect(() => {
    document.body.style.cursor = hovered ? "pointer" : "auto";
    if (ref.current) {
      gsap.to(ref.current.scale, {
        x: hovered ? 1.1 : 1,
        y: hovered ? 1.1 : 1,
        z: 1,
        duration: 0.2,
      });
    }
  }, [hovered]);
  return (
    <group
      ref={ref}
      position={position}
      onClick={onClick}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <RoundedBox args={[6, 1.5, 0.2]} radius={0.2}>
        <meshStandardMaterial color={hovered ? "#FFD700" : "#FFFFFF"} />
      </RoundedBox>
      <Text
        position={[0, 0, 0.15]}
        fontSize={0.5}
        color="#111111"
        anchorX="center"
        anchorY="middle"
      >
        Jogar Novamente
      </Text>
    </group>
  );
};

interface EquationDisplay3DProps {
  spinner1Value: number | null;
  spinner2Value: number | null;
  message: string;
  currentPlayer: Player;
  gameSettings: GameSettings;
  isGameOver: boolean;
  winnerInfo: PlayerSettings | null;
  onRestart: () => void;
}
const EquationDisplay3D = ({
  spinner1Value,
  spinner2Value,
  message,
  currentPlayer,
  gameSettings,
  isGameOver,
  winnerInfo,
  onRestart,
}: EquationDisplay3DProps) => {
  const fontUrl = "/fonts/Bangers-Regular.ttf";
  const Z_VALUE = -0.15 + 0.01;
  const playerColor = gameSettings[currentPlayer].light;
  const playerName = gameSettings[currentPlayer].name.split(" ")[0];
  return (
    <group position={[0, 0, 0]}>
      <mesh position={[0, 0, -0.2]}>
        <RoundedBox
          args={[BOARD_WIDTH, WALL_HEIGHT, 0.1]}
          radius={0.05}
          smoothness={8}
          receiveShadow
        >
          <meshStandardMaterial color="#333333" roughness={0.5} />
        </RoundedBox>
      </mesh>
      {isGameOver && winnerInfo ? (
        <group>
          <Text
            font={fontUrl}
            position={[0, 1.5, Z_VALUE]}
            fontSize={1}
            color={winnerInfo.light}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.05}
            outlineColor="#000000"
            textAlign="center"
          >{`O Jogador\n${winnerInfo.name.split(" ")[0]} Ganhou!`}</Text>
          <RestartButton3D position={[0, -2, Z_VALUE]} onClick={onRestart} />
        </group>
      ) : (
        <group>
          <Text
            font={fontUrl}
            position={[0, 4, Z_VALUE]}
            fontSize={1.2}
            color="#FFD700"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.05}
            outlineColor="#000000"
          >
            JOGO DA TABUADA
          </Text>
          <Text
            font={fontUrl}
            position={[0, 2.8, Z_VALUE]}
            fontSize={0.7}
            color={playerColor}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.03}
            outlineColor="#000000"
          >{`Vez do Jogador: ${playerName}`}</Text>
          {spinner1Value !== null && (
            <Text
              font={fontUrl}
              position={[
                spinner1Value > 99 ? -2.2 : spinner1Value > 9 ? -1.8 : -1.5,
                0,
                Z_VALUE,
              ]}
              fontSize={2}
              color="#FFD700"
              anchorX="center"
              anchorY="middle"
              outlineColor="#000000"
              outlineWidth={0.05}
            >
              {spinner1Value.toString()}
            </Text>
          )}
          <Text
            font={fontUrl}
            position={[0, 0, Z_VALUE]}
            fontSize={2}
            color="#FFFFFF"
            anchorX="center"
            anchorY="middle"
            outlineColor="#000000"
            outlineWidth={0.05}
          >
            {gameSettings.operation}
          </Text>
          {spinner2Value !== null && (
            <Text
              font={fontUrl}
              position={[spinner2Value > 9 ? 1.8 : 1.5, 0, Z_VALUE]}
              fontSize={2}
              color="#FFD700"
              anchorX="center"
              anchorY="middle"
              outlineColor="#000000"
              outlineWidth={0.05}
            >
              {spinner2Value.toString()}
            </Text>
          )}
          <Text
            font={fontUrl}
            position={[0, -3.5, Z_VALUE]}
            fontSize={0.5}
            color="#CCCCCC"
            anchorX="center"
            anchorY="middle"
            textAlign="center"
            maxWidth={BOARD_WIDTH - 2}
            outlineColor="#000000"
            outlineWidth={0.02}
          >
            {message}
          </Text>
        </group>
      )}
    </group>
  );
};

interface PointerProps {
  position: [number, number, number];
}
const Pointer = ({ position }: PointerProps) => {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(0.3, 0.4);
    s.lineTo(-0.3, 0.4);
    s.closePath();
    return s;
  }, []);
  const extrudeSettings = useMemo(
    () => ({ steps: 1, depth: 0.2, bevelEnabled: false }),
    []
  );
  return (
    <Extrude args={[shape, extrudeSettings]} position={position}>
      <meshStandardMaterial color="white" />
    </Extrude>
  );
};

interface Token3DProps {
  color: THREE.ColorRepresentation;
  position: [number, number, number];
}
const Token3D = ({ color, position }: Token3DProps) => (
  <group position={position}>
    <Cylinder
      args={[0.7, 0.7, 0.2, 32]}
      rotation={[Math.PI / 2, 0, 0]}
      position={[0, 0, -0.01]}
    >
      <meshStandardMaterial
        color={color}
        transparent
        opacity={0.4}
        roughness={0.2}
        metalness={0.2}
        depthWrite={false}
      />
    </Cylinder>
  </group>
);

interface Cell3DProps {
  position: [number, number, number];
  value: number;
  player: Player | null;
  onClick: () => void;
  flashing: boolean;
  gameSettings: GameSettings;
}
const Cell3D = ({
  position,
  value,
  player,
  onClick,
  flashing,
  gameSettings,
}: Cell3DProps) => {
  const cellRef =
    useRef<THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>>(null);
  const playerColorData = player ? gameSettings[player] : null;
  useEffect(() => {
    if (flashing && cellRef.current) {
      const originalColor = cellRef.current.material.color.clone();
      gsap.to(cellRef.current.material.color, {
        r: 1,
        g: 0.3,
        b: 0.3,
        duration: 0.25,
        yoyo: true,
        repeat: 5,
        onComplete: () => {
          cellRef.current?.material.color.set(originalColor);
        },
      });
    }
  }, [flashing]);
  useEffect(() => {
    if (cellRef.current) {
      const material = cellRef.current.material;
      if (playerColorData) {
        gsap.to(material.emissive, {
          r: new THREE.Color(playerColorData.value).r,
          g: new THREE.Color(playerColorData.value).g,
          b: new THREE.Color(playerColorData.value).b,
          duration: 0.5,
        });
        gsap.to(material, { emissiveIntensity: 0.8, duration: 0.5 });
      } else {
        gsap.to(material, { emissiveIntensity: 0, duration: 0.5 });
      }
    }
  }, [player, playerColorData]);
  return (
    <group position={position} onClick={onClick}>
      <Box ref={cellRef} args={[1.9, 1.9, 0.1]} receiveShadow>
        <meshStandardMaterial
          color={playerColorData ? playerColorData.value : "#CCCCCC"}
          roughness={0.2}
        />
      </Box>
      <Text
        position={[0, 0, 0.1]}
        fontSize={0.8}
        color="#333"
        anchorX="center"
        anchorY="middle"
        renderOrder={1}
      >
        {value.toString()}
      </Text>
      {playerColorData && (
        <Token3D color={playerColorData.value} position={[0, 0, 0.15]} />
      )}
    </group>
  );
};

interface Board3DProps {
  boardLayout: number[][];
  boardState: (Player | null)[][];
  onCellClick: (cellValue: number, rowIndex: number, colIndex: number) => void;
  flashingCell: { row: number; col: number } | null;
  gameSettings: GameSettings;
}
const Board3D = ({
  boardLayout,
  boardState,
  onCellClick,
  flashingCell,
  gameSettings,
}: Board3DProps) => {
  const cellSize = 2.1;
  const numCols = boardLayout[0]?.length || 7;
  const numRows = boardLayout.length;
  const gridWidth = numCols * cellSize;
  const gridHeight = numRows * cellSize;
  return (
    <group position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      {boardLayout.map((row, rowIndex) =>
        row.map((cellValue, colIndex) => (
          <Cell3D
            key={`${rowIndex}-${colIndex}`}
            position={[
              colIndex * cellSize - gridWidth / 2 + cellSize / 2,
              rowIndex * cellSize - gridHeight / 2 + cellSize / 2,
              0,
            ]}
            value={cellValue}
            player={boardState[rowIndex][colIndex]}
            onClick={() => onCellClick(cellValue, rowIndex, colIndex)}
            flashing={
              !!(
                flashingCell &&
                flashingCell.row === rowIndex &&
                flashingCell.col === colIndex
              )
            }
            gameSettings={gameSettings}
          />
        ))
      )}
    </group>
  );
};

interface StageLightingProps {
  currentPlayer: Player;
  winner: Player | null;
  gameSettings: GameSettings;
}
const StageLighting = ({
  currentPlayer,
  winner,
  gameSettings,
}: StageLightingProps) => {
  const light1Ref = useRef<THREE.SpotLight>(null);
  const light2Ref = useRef<THREE.SpotLight>(null);
  const boardTarget = useMemo(() => new THREE.Object3D(), []);
  const activePlayer = winner || currentPlayer;
  const lightColor1 = gameSettings.player1.light;
  const lightColor2 = gameSettings.player2.light;
  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    if (light1Ref.current) {
      light1Ref.current.position.x = Math.sin(time * 0.5) * 15;
      light1Ref.current.position.z = Math.cos(time * 0.5) * 15;
    }
    if (light2Ref.current) {
      light2Ref.current.position.x = Math.sin(-time * 0.5) * 15;
      light2Ref.current.position.z = Math.cos(-time * 0.5) * 15;
    }
  });
  useEffect(() => {
    const targetColor = new THREE.Color(
      activePlayer === "player1" ? lightColor1 : lightColor2
    );
    if (light1Ref.current) {
      gsap.to(light1Ref.current.color, {
        r: targetColor.r,
        g: targetColor.g,
        b: targetColor.b,
        duration: 1.5,
        ease: "power2.inOut",
      });
    }
    if (light2Ref.current) {
      gsap.to(light2Ref.current.color, {
        r: targetColor.r,
        g: targetColor.g,
        b: targetColor.b,
        duration: 1.5,
        ease: "power2.inOut",
      });
    }
  }, [activePlayer, lightColor1, lightColor2]);
  return (
    <>
      <primitive object={boardTarget} position={[0, 0, 0]} />
      <pointLight
        position={[-6, 6, -4]}
        intensity={10}
        color="#FFFFFF"
        distance={30}
      />
      <pointLight
        position={[6, 6, -4]}
        intensity={10}
        color="#FFFFFF"
        distance={30}
      />
      <SpotLight
        ref={light1Ref}
        target={boardTarget}
        position={[10, 10, 10]}
        angle={2}
        penumbra={0.5}
        intensity={500}
        castShadow
        distance={45}
        attenuation={5}
        color={activePlayer === "player1" ? lightColor1 : lightColor2}
      />
      <SpotLight
        ref={light2Ref}
        target={boardTarget}
        position={[-10, 10, 10]}
        angle={2}
        penumbra={0.5}
        intensity={500}
        castShadow
        distance={45}
        attenuation={5}
        color={activePlayer === "player1" ? lightColor1 : lightColor2}
      />
    </>
  );
};

interface CoinFlipProps {
  onFlipComplete: (result: "cara" | "coroa") => void;
  gameSettings: GameSettings;
}

const CoinFlip = ({ onFlipComplete, gameSettings }: CoinFlipProps) => {
  const coinRef = useRef<THREE.Group>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!coinRef.current || !gameSettings) return;
    const randomRotations = (Math.random() * 3 + 3) * (2 * Math.PI);
    gsap.to(coinRef.current.rotation, {
      x: randomRotations,
      duration: 3,
      ease: "power3.inOut",
      onComplete: () => {
        if (!coinRef.current) return;
        const finalRotation = coinRef.current.rotation.x % (2 * Math.PI);
        const result =
          finalRotation > Math.PI / 2 && finalRotation < (3 * Math.PI) / 2
            ? "coroa"
            : "cara";
        const targetX =
          Math.round(coinRef.current.rotation.x / (2 * Math.PI)) *
            (2 * Math.PI) +
          (result === "cara" ? Math.PI / 2 : -Math.PI / 2);
        gsap.to(coinRef.current.rotation, {
          x: targetX,
          duration: 0.5,
          ease: "power2.out",
          onComplete: () => {
            onFlipComplete(result);
            setTimeout(() => {
              gsap.to(coinRef.current!.scale, {
                x: 0,
                y: 0,
                z: 0,
                duration: 0.5,
                ease: "power2.in",
                onComplete: () => setVisible(false),
              });
            }, 1000);
          },
        });
      },
    });
  }, [onFlipComplete, gameSettings]);

  if (!visible) return null;

  return (
    <group ref={coinRef} position={[0, 5, 0]}>
      <Cylinder args={[2.5, 2.5, 0.2, 64]} castShadow receiveShadow>
        <meshStandardMaterial color="#FFD700" metalness={0.6} roughness={0.2} />
      </Cylinder>

      <Cylinder args={[2.2, 2.2, 0.05, 64]} position={[0, 0.125, 0]}>
        <meshStandardMaterial
          color={gameSettings.player1.value}
          metalness={0.1}
          roughness={0.5}
          emissive={gameSettings.player1.value}
          emissiveIntensity={1}
        />
      </Cylinder>

      <Cylinder args={[2.2, 2.2, 0.05, 64]} position={[0, -0.125, 0]}>
        <meshStandardMaterial
          color={gameSettings.player2.value}
          metalness={0.1}
          roughness={0.5}
          emissive={gameSettings.player2.value}
          emissiveIntensity={1}
        />
      </Cylinder>
    </group>
  );
};

interface SceneHandlers {
  currentPlayer: Player;
  isSpinning1: boolean;
  isSpinning2: boolean;
  spinner1Target: number | null;
  spinner2Target: number | null;
  spinner1Segments: Segment[];
  handleSpin1Start: (() => void) | null;
  handleSpin1End: (value: number) => void;
  handleSpin2Start: (() => void) | null;
  handleSpin2End: (value: number) => void;
  handleCellClick: (cellValue: number, row: number, col: number) => void;
  handleCoinFlipComplete: (result: "cara" | "coroa") => void;
}
interface SceneProps {
  gameState: GameState;
  handlers: SceneHandlers;
  boardLayout: number[][];
  boardState: (Player | null)[][];
  flashingCell: { row: number; col: number } | null;
  spinner1Value: number | null;
  spinner2Value: number | null;
  message: string;
  gameSettings: GameSettings;
  winner: Player | null;
  onRestart: () => void;
}
const Scene = ({
  gameState,
  handlers,
  boardLayout,
  boardState,
  flashingCell,
  spinner1Value,
  spinner2Value,
  message,
  gameSettings,
  winner,
  onRestart,
}: SceneProps) => {
  const controlsRef = useRef<OrbitControlsImpl>(null);

  const wallGroupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (!wallGroupRef.current) return;

    const shouldBeVisible = gameState !== "SETUP" && gameState !== "COIN_FLIP";

    gsap.to(wallGroupRef.current.scale, {
      y: shouldBeVisible ? 1 : 0,
      duration: 1.2,
      ease: "power3.out",
    });
  }, [gameState]);

  const isPlayerTurn = gameState.startsWith(
    `PLAYER_${handlers.currentPlayer === "player1" ? 1 : 2}`
  );
  const canSpin1 = isPlayerTurn && gameState.endsWith("SPIN_1");
  const canSpin2 = isPlayerTurn && gameState.endsWith("SPIN_2");
  const winnerInfo = winner ? gameSettings[winner] : null;

  return (
    <>
      <ambientLight intensity={0.2} />
      <directionalLight position={[0, 10, -20]} intensity={0.05} />
      <StageLighting
        currentPlayer={handlers.currentPlayer}
        gameSettings={gameSettings}
        winner={winner}
      />
      {gameState === "COIN_FLIP" && (
        <CoinFlip
          onFlipComplete={handlers.handleCoinFlipComplete}
          gameSettings={gameSettings}
        />
      )}

      <group
        ref={wallGroupRef}
        position={[0, 0, -BOARD_HEIGHT / 2]}
        scale-y={0}
      >
        <group position={[0, WALL_HEIGHT / 2, 0]}>
          {gameState !== "GAME_OVER" && (
            <>
              <Spinner3D
                position={[-5, 0, 0]}
                isSpinning={handlers.isSpinning1}
                targetValue={handlers.spinner1Target}
                onSpinStart={canSpin1 ? handlers.handleSpin1Start : null}
                onSpinEnd={handlers.handleSpin1End}
                segments={handlers.spinner1Segments}
              />
              <Spinner3D
                position={[5, 0, 0]}
                isSpinning={handlers.isSpinning2}
                targetValue={handlers.spinner2Target}
                onSpinStart={canSpin2 ? handlers.handleSpin2Start : null}
                onSpinEnd={handlers.handleSpin2End}
                segments={DEFAULT_SPINNER_SEGMENTS}
              />
            </>
          )}

          <EquationDisplay3D
            spinner1Value={spinner1Value}
            spinner2Value={spinner2Value}
            message={message}
            currentPlayer={handlers.currentPlayer}
            gameSettings={gameSettings}
            isGameOver={gameState === "GAME_OVER"}
            winnerInfo={winnerInfo}
            onRestart={onRestart}
          />
        </group>
      </group>

      {boardLayout.length > 0 && (
        <Board3D
          boardLayout={boardLayout}
          boardState={boardState}
          onCellClick={handlers.handleCellClick}
          flashingCell={flashingCell}
          gameSettings={gameSettings}
        />
      )}
      <OrbitControls ref={controlsRef} />
      <CameraManager gameState={gameState} controlsRef={controlsRef} />
      <Fireworks
        color={winnerInfo ? winnerInfo.value : "#FFD700"}
        isActive={gameState === "GAME_OVER" && winnerInfo !== null}
      />
    </>
  );
};

function App() {
  const [gameState, setGameState] = useState<GameState>("SETUP");
  const [currentPlayer, setCurrentPlayer] = useState<Player>("player1");
  const [gameSettings, setGameSettings] = useState<GameSettings>(
    DEFAULT_GAME_SETTINGS
  );
  const [message, setMessage] = useState("Configure o jogo para começar.");
  const [isSpinning1, setIsSpinning1] = useState(false);
  const [isSpinning2, setIsSpinning2] = useState(false);
  const [spinner1Value, setSpinner1Value] = useState<number | null>(null);
  const [spinner2Value, setSpinner2Value] = useState<number | null>(null);
  const [winner, setWinner] = useState<Player | null>(null);
  const [spinner1Target, setSpinner1Target] = useState<number | null>(null);
  const [spinner2Target, setSpinner2Target] = useState<number | null>(null);
  const [boardLayout, setBoardLayout] = useState<number[][]>(
    PREDEFINED_BOARDS["×"]
  );
  const [spinner1Segments, setSpinner1Segments] = useState<Segment[]>(
    DEFAULT_SPINNER_SEGMENTS
  );
  const [divisionTableNumber, setDivisionTableNumber] = useState<number | null>(
    null
  );

  const playCoinSound = useAudio("/audio/moeda.mp3");
  const playSpinnerSound = useAudio("/audio/roleta.mp3");
  const playSuccessSound = useAudio("/audio/sucesso.mp3");
  const playErrorSound = useAudio("/audio/erro.mp3");

  const initialBoardState = useMemo(
    () =>
      Array(6)
        .fill(null)
        .map(() => Array(7).fill(null)),
    []
  );
  const [boardState, setBoardState] =
    useState<(Player | null)[][]>(initialBoardState);
  const [flashingCell, setFlashingCell] = useState<{
    row: number;
    col: number;
  } | null>(null);

  const prepareTurn = (settings: GameSettings) => {
    if (settings.operation === "÷") {
      const tableNumber = Math.floor(Math.random() * 10) + 1;
      setDivisionTableNumber(tableNumber);
      const newSegments = Array.from({ length: 10 }, (_, i) => ({
        v: tableNumber * (i + 1),
        c: DEFAULT_SPINNER_SEGMENTS[i % 10].c,
      }));
      setSpinner1Segments(newSegments);
    } else {
      setSpinner1Segments(DEFAULT_SPINNER_SEGMENTS);
      setDivisionTableNumber(null);
    }
  };

  const handleGameStart = (settings: GameSettings) => {
    setBoardLayout(PREDEFINED_BOARDS[settings.operation]);
    setGameSettings(settings);
    prepareTurn(settings);
    setGameState("COIN_FLIP");
    setMessage("Sorteando quem começa...");
    playCoinSound();
  };

  const handleRestart = () => {
    setGameState("SETUP");
    setCurrentPlayer("player1");
    setGameSettings(DEFAULT_GAME_SETTINGS);
    setMessage("Configure o jogo para começar.");
    setSpinner1Value(null);
    setSpinner2Value(null);
    setSpinner1Target(null);
    setSpinner2Target(null);
    setBoardState(initialBoardState);
    setSpinner1Segments(DEFAULT_SPINNER_SEGMENTS);
    setDivisionTableNumber(null);
    setIsSpinning1(false);
    setIsSpinning2(false);
    setWinner(null);
  };

  const handleCoinFlipComplete = (result: "cara" | "coroa") => {
    const startingPlayer = result === "cara" ? "player1" : "player2";
    setCurrentPlayer(startingPlayer);
    prepareTurn(gameSettings);
    const winnerName = gameSettings[startingPlayer].name.split(" ")[0];
    setMessage(
      `${
        result === "cara"
          ? `Lado ${gameSettings.player1.name.split(" ")[0]}`
          : `Lado ${gameSettings.player2.name.split(" ")[0]}`
      }! O jogador ${winnerName} começa.`
    );
    setTimeout(() => {
      setGameState(
        `PLAYER_${startingPlayer === "player1" ? 1 : 2}_SPIN_1` as GameState
      );
      setMessage(`Vez do Jogador ${winnerName}. Clique na roleta da esquerda.`);
    }, 1600);
  };

  const checkWinCondition = (
    currentBoard: (Player | null)[][],
    player: Player
  ): boolean => {
    if (!gameSettings) return false;
    const { winCondition } = gameSettings;
    const numRows = currentBoard.length;
    const numCols = currentBoard[0].length;
    const declareWinner = () => {
      playSuccessSound();
      setWinner(player);
      setGameState("GAME_OVER");
      setMessage(`Fim de jogo!`);
      return true;
    };
    switch (winCondition) {
      case "first_to_5": {
        if (currentBoard.flat().filter((cell) => cell === player).length >= 5)
          return declareWinner();
        break;
      }
      case "connect_3": {
        const checkLine = (line: (Player | null)[]) => {
          for (let i = 0; i < line.length - 2; i++) {
            if (
              line[i] === player &&
              line[i + 1] === player &&
              line[i + 2] === player
            )
              return true;
          }
          return false;
        };
        for (let r = 0; r < numRows; r++)
          if (checkLine(currentBoard[r])) return declareWinner();
        for (let c = 0; c < numCols; c++) {
          const col = currentBoard.map((row) => row[c]);
          if (checkLine(col)) return declareWinner();
        }
        for (let r = 0; r < numRows - 2; r++) {
          for (let c = 0; c < numCols - 2; c++) {
            if (
              currentBoard[r][c] === player &&
              currentBoard[r + 1][c + 1] === player &&
              currentBoard[r + 2][c + 2] === player
            )
              return declareWinner();
          }
        }
        for (let r = 2; r < numRows; r++) {
          for (let c = 0; c < numCols - 2; c++) {
            if (
              currentBoard[r][c] === player &&
              currentBoard[r - 1][c + 1] === player &&
              currentBoard[r - 2][c + 2] === player
            )
              return declareWinner();
          }
        }
        break;
      }
      case "most_on_full": {
        if (!currentBoard.flat().includes(null)) {
          const p1Count = currentBoard
            .flat()
            .filter((c) => c === "player1").length;
          const p2Count = currentBoard
            .flat()
            .filter((c) => c === "player2").length;
          if (p1Count > p2Count) setWinner("player1");
          else if (p2Count > p1Count) setWinner("player2");
          else setWinner(null);
          setGameState("GAME_OVER");
          return true;
        }
        break;
      }
    }
    return false;
  };

  const changeTurn = () => {
    const nextPlayer = currentPlayer === "player1" ? "player2" : "player1";
    setCurrentPlayer(nextPlayer);
    setGameState(
      `PLAYER_${nextPlayer === "player1" ? 1 : 2}_SPIN_1` as GameState
    );
    prepareTurn(gameSettings);
    setSpinner1Value(null);
    setSpinner2Value(null);
    setSpinner1Target(null);
    setSpinner2Target(null);
    setMessage(
      `Vez do Jogador ${
        gameSettings[nextPlayer].name.split(" ")[0]
      }. Clique na roleta da esquerda.`
    );
  };

  const getCorrectAnswer = (
    op: Operation,
    val1: number,
    val2: number
  ): number | null => {
    switch (op) {
      case "×":
        return val1 * val2;
      case "+":
        return val1 + val2;
      case "-":
        return val1 - val2;
      case "÷":
        return val1 % val2 === 0 ? val1 / val2 : null;
    }
  };

  const handlers: SceneHandlers = {
    currentPlayer,
    isSpinning1,
    isSpinning2,
    spinner1Target,
    spinner2Target,
    spinner1Segments,
    handleSpin1Start: () => {
      setIsSpinning1((isCurrentlySpinning) => {
        if (isCurrentlySpinning) return true;
        if (gameSettings.operation === "÷" && divisionTableNumber) {
          const randomMultiplierIndex = Math.floor(Math.random() * 10);
          const dividend = spinner1Segments[randomMultiplierIndex].v;
          setSpinner1Target(dividend);
          setSpinner2Target(divisionTableNumber);
        } else {
          const num1 = Math.floor(Math.random() * 10) + 1;
          const num2 = Math.floor(Math.random() * 10) + 1;
          if (gameSettings.operation === "-") {
            setSpinner1Target(Math.max(num1, num2));
            setSpinner2Target(Math.min(num1, num2));
          } else {
            setSpinner1Target(num1);
            setSpinner2Target(num2);
          }
        }
        setMessage("Girando...");
        playSpinnerSound();
        return true;
      });
    },
    handleSpin1End: (value) => {
      setIsSpinning1(false);
      setSpinner1Value(value);
      setGameState(
        `PLAYER_${currentPlayer === "player1" ? 1 : 2}_SPIN_2` as GameState
      );
      setMessage("Agora, clique na roleta da direita.");
    },
    handleSpin2Start: () => {
      setIsSpinning2((isCurrentlySpinning) => {
        if (isCurrentlySpinning) return true;
        setMessage("Girando...");
        playSpinnerSound();
        return true;
      });
    },
    handleSpin2End: (value) => {
      setIsSpinning2(false);
      setSpinner2Value(value);
      setGameState(
        `PLAYER_${currentPlayer === "player1" ? 1 : 2}_ANSWER` as GameState
      );
      setMessage(
        `Qual o resultado de ${spinner1Value} ${gameSettings.operation} ${value}? Clique no tabuleiro!`
      );
    },
    handleCellClick: (cellValue, row, col) => {
      if (
        !gameState.endsWith("ANSWER") ||
        gameState === "GAME_OVER" ||
        spinner1Value === null ||
        spinner2Value === null
      )
        return;
      const correctResult = getCorrectAnswer(
        gameSettings.operation,
        spinner1Value,
        spinner2Value
      );
      let isGameOver = false;
      if (correctResult !== null && cellValue === correctResult) {
        playSuccessSound();
        const newBoardState = boardState.map((r) => [...r]);
        newBoardState[row][col] = currentPlayer;
        setBoardState(newBoardState);
        setMessage(
          `Correto! ${spinner1Value} ${gameSettings.operation} ${spinner2Value} = ${correctResult}.`
        );
        isGameOver = checkWinCondition(newBoardState, currentPlayer);
      } else {
        playErrorSound();
        setFlashingCell({ row, col });
        const incorrectMessage =
          correctResult !== null
            ? `Incorreto. A resposta era ${correctResult}. Passando a vez...`
            : `Incorreto. A operação ${spinner1Value} ${gameSettings.operation} ${spinner2Value} não resulta em um número inteiro. Passando a vez...`;
        setMessage(incorrectMessage);
        setTimeout(() => setFlashingCell(null), 1600);
      }
      if (!isGameOver) {
        const boardIsNowFull = !boardState.flat().includes(null);
        if (gameSettings.winCondition === "most_on_full" && boardIsNowFull) {
          checkWinCondition(boardState, currentPlayer);
        } else {
          setTimeout(changeTurn, 2000);
        }
      }
    },
    handleCoinFlipComplete,
  };

  return (
    <div className="w-screen h-screen relative bg-[#101015]">
      <GameSetupModal
        isOpen={gameState === "SETUP"}
        onGameStart={handleGameStart}
        defaultSettings={DEFAULT_GAME_SETTINGS}
      />
      {gameState !== "SETUP" &&
        gameState !== "GAME_OVER" &&
        import.meta.env.MODE === "development" && (
          <div className="absolute bottom-5 left-5 z-50">
            <Button
              onClick={() => {
                setWinner("player1");
                setGameState("GAME_OVER");
              }}
              variant="destructive"
              size="sm"
            >
              Debug Win
            </Button>
          </div>
        )}
      <Canvas camera={{ position: [0, 15, 25], fov: 60 }} shadows>
        <color attach="background" args={["#101015"]} />
        <fog attach="fog" args={["#101015", 20, 60]} />
        <Suspense fallback={null}>
          <Scene
            gameState={gameState}
            handlers={handlers}
            boardLayout={boardLayout}
            boardState={boardState}
            flashingCell={flashingCell}
            spinner1Value={spinner1Value}
            spinner2Value={spinner2Value}
            message={message}
            gameSettings={gameSettings}
            winner={winner}
            onRestart={handleRestart}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}

export default App;
