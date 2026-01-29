// pages/index.js
import React from 'react';

export default function Home() {
  const scores = [12, 43, 5, 30, 18, 7];

  return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <div className="max-w-sm mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between h-16 px-4 md:px-6 text-gray-700">
          {/* Brain Icon */}
          <svg
            aria-label="Brain Icon"
            className="w-6 h-6 text-gray-700"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 2C10.343 2 9 3.343 9 5c0 1.657 1.343 3 3 3s3-1.343 3-3S13.657 2 12 2zM5 11c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3-1.343-3-3-3zm14 0c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3-1.343-3-3-3z"
            />
          </svg>

          {/* Score Display */}
          <h1 className="text-lg font-semibold">Score: 56</h1>

          {/* Menu Button */}
          <button
            aria-label="Menu Icon"
            className="w-6 h-6 text-gray-700 focus:outline-none"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="stroke-current"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16m-7 6h7"
              />
            </svg>
          </button>
        </header>

        {/* Scores Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {scores.map((score) => (
            <button
              key={score}
              className="flex items-center justify-center w-28 h-14 bg-[rgba(194,214,223,0.7)] text-white text-2xl font-medium rounded-full shadow-md transition-all duration-200 hover:bg-[rgba(174,194,203,0.7)] hover:scale-105 active:scale-95"
              aria-label={`Score ${score}`}
            >
              {score}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
