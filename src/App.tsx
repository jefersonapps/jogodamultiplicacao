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

/**
 * Hook para carregar e tocar um áudio.
 * @param url O caminho para o arquivo de áudio na pasta public.
 * @returns Uma função para tocar o som.
 */
const useAudio = (url: string) => {
  const audio = useRef(new Audio(url));

  const play = () => {
    audio.current.currentTime = 0;
    audio.current.play().catch((error) => {
      console.error(`Erro ao tocar o áudio ${url}:`, error);
    });
  };

  return play;
};

type Player = "player1" | "player2";
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
    setParticles((prevParticles) => {
      return prevParticles
        .map((particle) => {
          if (particle.life <= 0) return particle;

          const newPos: [number, number, number] = [
            particle.position[0] + particle.velocity[0] * delta,
            particle.position[1] + particle.velocity[1] * delta,
            particle.position[2] + particle.velocity[2] * delta,
          ];

          const newVel: [number, number, number] = [
            particle.velocity[0],
            particle.velocity[1] - 15 * delta,
            particle.velocity[2],
          ];

          return {
            ...particle,
            position: newPos,
            velocity: newVel,
            life: particle.life - particle.decay * delta,
          };
        })
        .filter((p) => p.life > 0);
    });
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
    if (!isActive) {
      setExplosions([]);
    }
  }, [isActive]);

  return (
    <group>
      {explosions.map((explosion) => (
        <FireworkExplosion
          key={explosion.id}
          position={explosion.position}
          color={explosion.color}
        />
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

    if (gameState === "COIN_FLIP") {
      gsap.to(camera.position, {
        ...cameraPositions.coin,
        duration: 1.5,
        ease: "power2.inOut",
      });
      if (controls.target) {
        gsap.to(controls.target as THREE.Vector3, {
          ...cameraTargets.coin,
          duration: 1.5,
          ease: "power2.inOut",
        });
      }
      return;
    }

    if (gameState === "SETUP" || gameState === "GAME_OVER") {
      gsap.to(camera.position, {
        ...cameraPositions.spinners,
        duration: 1.5,
        ease: "power2.inOut",
      });
      if (controls.target) {
        gsap.to(controls.target as THREE.Vector3, {
          ...cameraTargets.spinners,
          duration: 1.5,
          ease: "power2.inOut",
        });
      }
      return;
    }

    const isSpinningPhase =
      gameState.endsWith("SPIN_1") || gameState.endsWith("SPIN_2");
    gsap.to(camera.position, {
      ...(isSpinningPhase ? cameraPositions.spinners : cameraPositions.board),
      duration: 1.5,
      ease: "power2.inOut",
    });
    if (controls.target) {
      gsap.to(controls.target as THREE.Vector3, {
        ...(isSpinningPhase ? cameraTargets.spinners : cameraTargets.board),
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
}

const Spinner3D = ({
  position,
  onSpinStart,
  onSpinEnd,
  isSpinning,
}: Spinner3DProps) => {
  const spinnerGroupRef = useRef<THREE.Group>(null);
  const segments = useMemo(
    () => [
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
    ],
    []
  );
  const segmentAngle = (2 * Math.PI) / segments.length;
  useEffect(() => {
    if (isSpinning && spinnerGroupRef.current) {
      const randomSegmentIndex = Math.floor(Math.random() * segments.length);
      const selectedValue = segments[randomSegmentIndex].v;
      const finalRestingAngle = randomSegmentIndex * segmentAngle;
      const currentRotation = spinnerGroupRef.current.rotation.z;
      const currentRotationMod = currentRotation % (2 * Math.PI);
      let shortestDistance = finalRestingAngle - currentRotationMod;
      if (shortestDistance > 0) shortestDistance -= 2 * Math.PI;
      const extraSpins = 4 * (2 * Math.PI);
      const totalSpinTravel = shortestDistance - extraSpins;
      const targetRotation = currentRotation + totalSpinTravel;
      gsap.to(spinnerGroupRef.current.rotation, {
        z: targetRotation,
        duration: 5,
        ease: "power2.out",
        onComplete: () => onSpinEnd(selectedValue),
      });
    }
  }, [isSpinning, onSpinEnd, segments, segmentAngle]);
  return (
    <group position={position} onClick={onSpinStart ? onSpinStart : undefined}>
      <group ref={spinnerGroupRef}>
        {segments.map((segment, i) => {
          const midAngle = Math.PI / 2 - i * segmentAngle;
          const startAngle = midAngle - segmentAngle / 2;
          const textRadius = 1.3;
          return (
            <React.Fragment key={i}>
              <PieSlice
                radius={1.8}
                startAngle={startAngle}
                angleLength={segmentAngle}
                color={segment.c}
              />
              <Text
                position={[
                  Math.cos(midAngle) * textRadius,
                  Math.sin(midAngle) * textRadius,
                  0.101,
                ]}
                rotation={[0, 0, midAngle - Math.PI / 2]}
                fontSize={0.4}
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
  const playerColor =
    currentPlayer === "player1"
      ? gameSettings.player1.light
      : gameSettings.player2.light;
  const playerName =
    currentPlayer === "player1"
      ? gameSettings.player1.name.split(" ")[0]
      : gameSettings.player2.name.split(" ")[0];

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
          >
            {`O Jogador\n${winnerInfo.name.split(" ")[0]} Ganhou!`}
          </Text>
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
            JOGO DA MULTIPLICAÇÃO
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
          >
            {`Vez do Jogador: ${playerName}`}
          </Text>
          {spinner1Value !== null && (
            <Text
              font={fontUrl}
              position={[spinner1Value > 9 ? -1.8 : -1.5, 0, Z_VALUE]}
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
            ×
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

const Token3D = ({ color, position }: Token3DProps) => {
  return (
    <group position={position}>
      <Cylinder
        args={[0.7, 0.7, 0.2, 32]}
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, 0, -0.01]}
      >
        <meshStandardMaterial
          color={color}
          transparent={true}
          opacity={0.4}
          roughness={0.2}
          metalness={0.2}
          depthWrite={false}
        />
      </Cylinder>
    </group>
  );
};

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

  const color = playerColorData ? playerColorData.value : "#CCCCCC";
  return (
    <group position={position} onClick={onClick}>
      <Box ref={cellRef} args={[1.9, 1.9, 0.1]} receiveShadow>
        <meshStandardMaterial color={color} roughness={0.2} />
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
  const numCols = boardLayout[0].length;
  const numRows = boardLayout.length;
  const gridWidth = numCols * cellSize;
  const gridHeight = numRows * cellSize;
  return (
    <group position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      {boardLayout.map((row, rowIndex) =>
        row.map((cellValue, colIndex) => {
          const isFlashing =
            flashingCell !== null &&
            flashingCell.row === rowIndex &&
            flashingCell.col === colIndex;
          return (
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
              flashing={!!isFlashing}
              gameSettings={gameSettings}
            />
          );
        })
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

        const currentX = coinRef.current.rotation.x;
        const nearestFullCircle =
          Math.round(currentX / (2 * Math.PI)) * (2 * Math.PI);

        const finalAngleOffset = result === "cara" ? Math.PI / 2 : -Math.PI / 2;
        const targetX = nearestFullCircle + finalAngleOffset;

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
      {" "}
      <Cylinder args={[2.5, 2.5, 0.2, 64]} castShadow receiveShadow>
        <meshStandardMaterial color="#FFD700" metalness={0.6} roughness={0.2} />
      </Cylinder>
      <Cylinder
        args={[2.2, 2.2, 0.05, 64]}
        position={[0, 0.125, 0]}
        rotation={[0, 0, 0]}
      >
        <meshStandardMaterial
          color={gameSettings.player1.value}
          metalness={0.1}
          roughness={0.5}
        />
      </Cylinder>
      <Cylinder
        args={[2.2, 2.2, 0.05, 64]}
        position={[0, -0.125, 0]}
        rotation={[0, 0, 0]}
      >
        <meshStandardMaterial
          color={gameSettings.player2.value}
          metalness={0.1}
          roughness={0.5}
        />
      </Cylinder>
    </group>
  );
};

interface SceneHandlers {
  currentPlayer: Player;
  isSpinning1: boolean;
  isSpinning2: boolean;
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

      {gameState !== "GAME_OVER" && gameState !== "COIN_FLIP" && (
        <group position={[0, WALL_HEIGHT / 2, -BOARD_HEIGHT / 2]}>
          <Spinner3D
            position={[-5, 0, 0]}
            isSpinning={handlers.isSpinning1}
            onSpinStart={canSpin1 ? handlers.handleSpin1Start : null}
            onSpinEnd={handlers.handleSpin1End}
          />
          <Spinner3D
            position={[5, 0, 0]}
            isSpinning={handlers.isSpinning2}
            onSpinStart={canSpin2 ? handlers.handleSpin2Start : null}
            onSpinEnd={handlers.handleSpin2End}
          />
        </group>
      )}

      {gameState !== "COIN_FLIP" && (
        <group position={[0, WALL_HEIGHT / 2, -BOARD_HEIGHT / 2]}>
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
      )}

      <Board3D
        boardLayout={boardLayout}
        boardState={boardState}
        onCellClick={handlers.handleCellClick}
        flashingCell={flashingCell}
        gameSettings={gameSettings}
      />
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

  const playCoinSound = useAudio("/audio/moeda.mp3");
  const playSpinnerSound = useAudio("/audio/roleta.mp3");
  const playSuccessSound = useAudio("/audio/sucesso.mp3");
  const playErrorSound = useAudio("/audio/erro.mp3");

  const boardLayout = useMemo(
    () => [
      [30, 18, 63, 64, 28, 7, 8],
      [32, 45, 60, 70, 27, 6, 9],
      [35, 48, 56, 72, 25, 5, 10],
      [36, 1, 54, 80, 24, 4, 12],
      [40, 16, 50, 81, 21, 3, 14],
      [42, 100, 49, 90, 20, 2, 15],
    ],
    []
  );
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

  const handleGameStart = (settings: GameSettings) => {
    setGameSettings(settings);
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
    setBoardState(initialBoardState);
    setIsSpinning1(false);
    setIsSpinning2(false);
    setWinner(null);
  };

  const handleDebugWin = () => {
    setWinner("player1");
    setGameState("GAME_OVER");
    setMessage(`[DEBUG] ${gameSettings.player1.name.split(" ")[0]} venceu!`);
  };

  const handleCoinFlipComplete = (result: "cara" | "coroa") => {
    const startingPlayer = result === "cara" ? "player1" : "player2";
    setCurrentPlayer(startingPlayer);

    const winnerName = gameSettings[startingPlayer].name.split(" ")[0];
    const resultText =
      result === "cara"
        ? `Lado ${gameSettings.player1.name.split(" ")[0]}`
        : `Lado ${gameSettings.player2.name.split(" ")[0]}`;
    setMessage(`${resultText}! O jogador ${winnerName} começa.`);

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
        const count = currentBoard
          .flat()
          .filter((cell) => cell === player).length;
        if (count >= 5) return declareWinner();
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
        const isFull = !currentBoard.flat().includes(null);
        if (isFull) {
          const p1Count = currentBoard
            .flat()
            .filter((cell) => cell === "player1").length;
          const p2Count = currentBoard
            .flat()
            .filter((cell) => cell === "player2").length;
          if (p1Count > p2Count) setWinner("player1");
          else if (p2Count > p1Count) setWinner("player2");
          else setWinner(null);
          setGameState("GAME_OVER");
          return true;
        }
        break;
      }
      default:
        return false;
    }
    return false;
  };

  const changeTurn = () => {
    const nextPlayer = currentPlayer === "player1" ? "player2" : "player1";
    setCurrentPlayer(nextPlayer);
    setGameState(
      `PLAYER_${nextPlayer === "player1" ? 1 : 2}_SPIN_1` as GameState
    );
    setSpinner1Value(null);
    setSpinner2Value(null);
    setMessage(
      `Vez do Jogador ${
        gameSettings[nextPlayer].name.split(" ")[0]
      }. Clique na roleta da esquerda.`
    );
  };

  const handlers: SceneHandlers = {
    currentPlayer,
    isSpinning1,
    isSpinning2,
    handleSpin1Start: () => {
      setIsSpinning1((isCurrentlySpinning) => {
        if (isCurrentlySpinning) {
          return true;
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
      setMessage(`Agora, clique na roleta da direita.`);
    },
    handleSpin2Start: () => {
      setIsSpinning2((isCurrentlySpinning) => {
        if (isCurrentlySpinning) {
          return true;
        }

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
        `Qual o resultado de ${spinner1Value} × ${value}? Clique no tabuleiro!`
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
      const correctProduct = spinner1Value * spinner2Value;
      let isGameOver = false;
      if (cellValue === correctProduct) {
        playSuccessSound();
        const newBoardState = boardState.map((r) => [...r]);
        newBoardState[row][col] = currentPlayer;
        setBoardState(newBoardState);
        setMessage(
          `Correto! ${spinner1Value} × ${spinner2Value} = ${correctProduct}.`
        );
        isGameOver = checkWinCondition(newBoardState, currentPlayer);
      } else {
        playErrorSound();
        setFlashingCell({ row, col });
        setMessage(
          `Incorreto. A resposta era ${correctProduct}. Passando a vez...`
        );
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
            <Button onClick={handleDebugWin} variant="destructive" size="sm">
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
