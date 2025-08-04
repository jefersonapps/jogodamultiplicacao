import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

const PREDEFINED_COLORS = [
  { name: "Azul (Padrão)", value: "#4682B4", light: "#00BFFF" },
  { name: "Rosa (Padrão)", value: "#DB7093", light: "#FF1493" },
  { name: "Verde Esmeralda", value: "#2ecc71", light: "#58D68D" },
  { name: "Laranja Cenoura", value: "#e67e22", light: "#F5B041" },
  { name: "Roxo Ametista", value: "#9b59b6", light: "#C39BD3" },
  { name: "Amarelo Sol", value: "#f1c40f", light: "#F7DC6F" },
];

const WIN_CONDITIONS = [
  {
    id: "first_to_5",
    label: "Primeiro a ter 5 peças",
    description: "O primeiro jogador a colocar 5 peças no tabuleiro vence.",
  },
  {
    id: "connect_3",
    label: "Conectar 3 peças",
    description:
      "O primeiro jogador a alinhar 3 peças na horizontal, vertical ou diagonal vence.",
  },
  {
    id: "most_on_full",
    label: "Mais peças no tabuleiro cheio",
    description:
      "Quando o tabuleiro estiver completo, vence quem tiver mais peças.",
  },
] as const;

type PlayerColor = {
  name: string;
  value: string;
  light: string;
};

type GameSettings = {
  player1: PlayerColor;
  player2: PlayerColor;
  winCondition: (typeof WIN_CONDITIONS)[number]["id"];
};

interface GameSetupModalProps {
  isOpen: boolean;
  onGameStart: (settings: GameSettings) => void;
  defaultSettings: GameSettings;
}

export function GameSetupModal({
  isOpen,
  onGameStart,
  defaultSettings,
}: GameSetupModalProps) {
  const [player1Color, setPlayer1Color] = useState(
    defaultSettings.player1.value
  );
  const [player2Color, setPlayer2Color] = useState(
    defaultSettings.player2.value
  );
  const [winCondition, setWinCondition] = useState<
    (typeof WIN_CONDITIONS)[number]["id"]
  >(WIN_CONDITIONS[0].id);

  const handleStartClick = () => {
    const p1ColorData = PREDEFINED_COLORS.find(
      (c) => c.value === player1Color
    ) as PlayerColor;
    const p2ColorData = PREDEFINED_COLORS.find(
      (c) => c.value === player2Color
    ) as PlayerColor;
    onGameStart({
      player1: p1ColorData,
      player2: p2ColorData,
      winCondition: winCondition,
    });
  };

  const isButtonDisabled = player1Color === player2Color;

  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-[520px] bg-gray-900/80 backdrop-blur-sm text-white border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-2xl text-yellow-400">
            Configurar Jogo
          </DialogTitle>
          <DialogDescription className="text-gray-300">
            Escolham suas cores e como desejam vencer antes de começar.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-200">
              Cores dos Jogadores
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="player1-color" className="text-gray-300">
                  Jogador 1
                </Label>
                <Select value={player1Color} onValueChange={setPlayer1Color}>
                  <SelectTrigger
                    id="player1-color"
                    className="bg-gray-800 border-gray-600 text-white"
                  >
                    <SelectValue placeholder="Selecione uma cor" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    {PREDEFINED_COLORS.map((color) => (
                      <SelectItem
                        key={color.value}
                        value={color.value}
                        disabled={color.value === player2Color}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: color.value }}
                          ></div>
                          {color.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="player2-color" className="text-gray-300">
                  Jogador 2
                </Label>
                <Select value={player2Color} onValueChange={setPlayer2Color}>
                  <SelectTrigger
                    id="player2-color"
                    className="bg-gray-800 border-gray-600 text-white"
                  >
                    <SelectValue placeholder="Selecione uma cor" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    {PREDEFINED_COLORS.map((color) => (
                      <SelectItem
                        key={color.value}
                        value={color.value}
                        disabled={color.value === player1Color}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: color.value }}
                          ></div>
                          {color.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {isButtonDisabled && (
              <p className="text-sm text-red-500 text-center">
                Os jogadores devem escolher cores diferentes.
              </p>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-200">
              Como Vencer?
            </h3>
            <RadioGroup
              value={winCondition}
              onValueChange={
                setWinCondition as (
                  value: (typeof WIN_CONDITIONS)[number]["id"]
                ) => void
              }
              className="space-y-3"
            >
              {WIN_CONDITIONS.map((cond) => (
                <Label
                  key={cond.id}
                  htmlFor={cond.id}
                  className="flex items-start space-x-3 p-3 rounded-md bg-gray-800/50 hover:bg-gray-800/70 transition-colors cursor-pointer border-2 border-transparent has-[[data-state=checked]]:border-yellow-400 has-[[data-state=checked]]:bg-gray-800/90"
                >
                  <RadioGroupItem
                    value={cond.id}
                    id={cond.id}
                    className="mt-1 border-gray-500 text-yellow-400"
                  />
                  <div className="flex flex-col gap-1">
                    <p className="font-medium text-gray-200">{cond.label}</p>
                    <p className="text-sm text-gray-400 font-normal">
                      {cond.description}
                    </p>
                  </div>
                </Label>
              ))}
            </RadioGroup>
          </div>
        </div>

        <DialogFooter>
          <div className="flex flex-col gap-3 w-full">
            <Button
              onClick={handleStartClick}
              disabled={isButtonDisabled}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold disabled:bg-gray-500 disabled:cursor-not-allowed"
            >
              Iniciar Jogo
            </Button>
            <p className="text-xs text-center text-gray-500">
              Jogo feito por{" "}
              <a
                href="https://github.com/jefersonapps"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-yellow-500 hover:text-yellow-400 underline"
              >
                Jeferson Leite
              </a>{" "}
              inspirado{" "}
              <a
                href="https://www.youtube.com/watch?v=lI7CmidViXU"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-yellow-500 hover:text-yellow-400 underline"
              >
                neste vídeo
              </a>
              .
            </p>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
