import confetti from 'canvas-confetti';

export const triggerConfetti = () => {
  confetti({
    particleCount: 120,
    spread: 80,
    origin: { y: 0.65 },
    colors: ['#A78BFA', '#C4B5FD', '#F5DFA0', '#FBCFE8', '#93C5FD', '#A7F3D0']
  });
};

const ConfettiCelebration = () => null;

export default ConfettiCelebration;
