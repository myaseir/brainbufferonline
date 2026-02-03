import React from 'react';
import { Check } from 'lucide-react';

const GameBoard = ({ 
  numbers, positions, clickedNumbers, correctNumbers, 
  gameState, error, isPaused, handleClick 
}) => {
  return (
    <div className="absolute left-0 right-0 bottom-0 top-[120px]">
      {numbers.map((num, i) => {
        const isClicked = clickedNumbers.includes(num);
        const isCorrect = correctNumbers.includes(num);
        const showNumber = gameState === 'showing' || isClicked || error;
        
        return (
          <button
            key={i} // simple key since positions regenerate per round
            onClick={() => handleClick(num)}
            disabled={gameState !== 'playing' || isPaused || error}
            style={{ left: `${positions[i]?.left}%`, top: `${positions[i]?.top}%` }}
            className={`
              absolute w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center font-black text-2xl transition-all duration-300 transform -translate-x-1/2 -translate-y-1/2 shadow-lg border-2
              ${(gameState === 'showing' || gameState === 'playing') ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'}
              ${isCorrect ? 'bg-emerald-500 border-emerald-400 text-white shadow-[0_0_30px_rgba(16,185,129,0.6)] scale-110 z-10' : ''}
              ${error && isClicked && !isCorrect ? 'bg-red-500 border-red-400 text-white z-20' : ''}
              ${error && !isClicked && !isCorrect ? 'bg-emerald-100 border-emerald-300 text-emerald-800 opacity-80' : ''}
              ${!isCorrect && !error ? 'bg-emerald-100 border-emerald-300 text-emerald-800 hover:bg-emerald-200' : ''}
              ${isClicked && !isCorrect && !error ? 'opacity-50' : ''}
              active:scale-95 cursor-pointer
            `}
          >
            <span className={`drop-shadow-sm transition-opacity duration-300 ${showNumber ? 'opacity-100' : 'opacity-0'}`}>{num}</span>
            {isCorrect && <Check className="absolute text-white/80 w-full h-full p-4 animate-ping opacity-75" />}
          </button>
        );
      })}
    </div>
  );
};

export default GameBoard;