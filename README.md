# Jogo da Tabuada

<div align="center">
  <img src="./public/icon.png" alt="Logo do Jogo da Tabuada" width="100px" />
</div>

---

Este é um jogo de tabuleiro 3D interativo, desenvolvido para tornar a prática de **operações matemáticas básicas (adição, subtração, multiplicação e divisão)** uma experiência divertida e visualmente atraente. Desafie um amigo, personalize as regras e teste seus conhecimentos em um ambiente dinâmico construído com React e Three.js.

<div align="center">
  <img src="./public/screenshot.png" alt="Screenshot do Jogo" />
</div>

## 🚀 Sobre o Projeto

O objetivo deste projeto é criar uma ferramenta educacional que engaje os jogadores através de interatividade e um design moderno. Em vez de exercícios repetitivos, os jogadores giram roletas, resolvem o problema matemático proposto e conquistam espaços no tabuleiro, transformando o aprendizado em uma competição amigável.

---

## ✨ Funcionalidades

- **✨ Ambiente 3D Completo:** Cena, iluminação e objetos renderizados com `@react-three/fiber`.
- **⚙️ Configuração de Jogo Personalizável:** Escolha a **operação matemática (+, -, ×, ÷)**, as cores dos jogadores e a condição de vitória.
- **🎡 Roletas 3D Interativas:** Gire as roletas para sortear os números para a operação da rodada.
- **🎲 Tabuleiro Dinâmico:** Responda corretamente para marcar sua cor em uma célula do tabuleiro.
- **🔊 Efeitos Sonoros:** Feedback de áudio para giros, acertos, erros e transições de jogo.
- **🎆 Animações e Efeitos Visuais:** Movimentos de câmera suaves, animações de interface e fogos de artifício para o vencedor.

---

## 🛠️ Tecnologias Utilizadas

- **React** - Biblioteca para a interface do usuário.
- **TypeScript** - Para tipagem estática e um código mais robusto.
- **Vite** - Ferramenta de build extremamente rápida.
- **@react-three/fiber** - Renderizador React para Three.js.
- **@react-three/drei** - Coleção de helpers e componentes úteis para R3F.
- **GSAP (GreenSock)** - Para animações complexas e performáticas (câmera, roletas, UI).
- **Tailwind CSS** & **shadcn/ui** - Para a estilização do modal de configuração.

---

## 🎮 Como Jogar

1.  **Configure o Jogo:** Na tela inicial, escolha a **operação matemática**, a cor para cada jogador e a condição de vitória.
2.  **Sorteio Inicial:** Uma moeda será lançada para decidir qual jogador começa.
3.  **Gire as Roletas:** Na sua vez, clique na roleta da esquerda e depois na da direita para sortear dois números.
4.  **Resolva a Operação:** Calcule o resultado da operação matemática sorteada (ex: 8 × 5, 15 + 7, 20 - 9).
5.  **Marque no Tabuleiro:** Encontre o resultado da operação no tabuleiro e clique nele.
    - Se acertar, a célula será marcada com a sua cor.
    - Se errar, você perde a vez.
6.  **Vença o Jogo:** O primeiro jogador a cumprir a condição de vitória estabelecida no início é o vencedor!

---

## 🙏 Agradecimentos

- Inspirado fortemente [neste vídeo de Yasmin Karynne](https://www.youtube.com/watch?v=lI7CmidViXU), que serviu como base para a ideia.
