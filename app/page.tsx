"use client";

import { useState, useEffect, useRef } from "react";
import { countries, Country } from "@/lib/countries";
import { getDistanceFromLatLonInKm, getDirection } from "@/lib/utils";

interface Guess {
  country: Country;
  distance: number;
  direction: string;
}

export default function Home() {
  const [targetCountry, setTargetCountry] = useState<Country | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [win, setWin] = useState(false);
  const [filteredCountries, setFilteredCountries] = useState<Country[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    startNewGame();
  }, []);

  useEffect(() => {
    if (inputValue.length > 0) {
      const filtered = countries.filter((c) =>
        c.name.toLowerCase().includes(inputValue.toLowerCase())
      );
      setFilteredCountries(filtered);
      setShowSuggestions(true);
      setSelectedIndex(-1);
    } else {
      setFilteredCountries([]);
      setShowSuggestions(false);
    }
  }, [inputValue]);

  const startNewGame = () => {
    const random = countries[Math.floor(Math.random() * countries.length)];
    setTargetCountry(random);
    setGuesses([]);
    setGameOver(false);
    setWin(false);
    setInputValue("");
    setError("");
  };

  const handleGuess = (e: React.FormEvent) => {
    e.preventDefault();
    submitGuess();
  };

  const submitGuess = (selectedCountry?: Country) => {
    if (gameOver || !targetCountry) return;

    const guessedCountry = selectedCountry || countries.find(
      (c) => c.name.toLowerCase() === inputValue.toLowerCase()
    );

    if (!guessedCountry) {
      setError("Country not found! Please select from the list.");
      setTimeout(() => setError(""), 3000);
      return;
    }

    if (guesses.some((g) => g.country.code === guessedCountry.code)) {
      setError("You already guessed this country!");
      setTimeout(() => setError(""), 3000);
      return;
    }

    const distance = getDistanceFromLatLonInKm(
      guessedCountry.latitude,
      guessedCountry.longitude,
      targetCountry.latitude,
      targetCountry.longitude
    );

    const direction = getDirection(
      guessedCountry.latitude,
      guessedCountry.longitude,
      targetCountry.latitude,
      targetCountry.longitude
    );

    const newGuess: Guess = {
      country: guessedCountry,
      distance,
      direction,
    };

    setGuesses([newGuess, ...guesses]);
    setInputValue("");
    setShowSuggestions(false);
    setError("");

    if (guessedCountry.code === targetCountry.code) {
      setWin(true);
      setGameOver(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || filteredCountries.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < filteredCountries.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      submitGuess(filteredCountries[selectedIndex]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  const selectCountry = (country: Country) => {
    submitGuess(country);
  };

  const getColor = (distance: number) => {
    if (distance === 0) return "from-emerald-500 to-green-600";
    if (distance < 1000) return "from-red-500 to-red-600";
    if (distance < 3000) return "from-orange-500 to-orange-600";
    if (distance < 8000) return "from-yellow-400 to-yellow-500";
    return "from-gray-400 to-gray-500";
  };

  const getTextColor = (distance: number) => {
    if (distance < 8000) return "text-white";
    return "text-gray-900";
  };

  const getHotColdText = (distance: number) => {
    if (distance === 0) return "🎯 CORRECT!";
    if (distance < 1000) return "🔥 HOT";
    if (distance < 3000) return "🌡️ WARM";
    if (distance < 8000) return "❄️ COOL";
    return "🧊 COLD";
  };

  const getDirectionArrow = (direction: string) => {
    const arrows: Record<string, string> = {
      N: "↑",
      NE: "↗",
      E: "→",
      SE: "↘",
      S: "↓",
      SW: "↙",
      W: "←",
      NW: "↖",
    };
    return arrows[direction] || direction;
  };

  return (
    <>
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      {/* Header */}
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-6xl font-extrabold mb-4 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent animate-pulse">
            🌍 WORLDLE
          </h1>
          <p className="text-lg text-gray-300 mb-2">Guess the mystery country!</p>
          <p className="text-sm text-gray-400">Get hot or cold feedback based on distance</p>
        </div>

        {/* Game Stats */}
        <div className="max-w-2xl mx-auto mb-8 flex justify-center gap-6">
          <div className="bg-white/10 backdrop-blur-sm px-6 py-3 rounded-xl border border-white/20">
            <div className="text-sm text-gray-300">Attempts</div>
            <div className="text-2xl font-bold">{guesses.length}</div>
          </div>
          {gameOver && (
            <div className="bg-white/10 backdrop-blur-sm px-6 py-3 rounded-xl border border-white/20">
              <div className="text-sm text-gray-300">Result</div>
              <div className="text-2xl font-bold">{win ? "🏆 WIN" : "❌ LOST"}</div>
            </div>
          )}
        </div>

        {/* Input Section */}
        <div className="max-w-2xl mx-auto mb-8">
          {!gameOver ? (
            <form onSubmit={handleGuess} className="relative">
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={() => inputValue && setShowSuggestions(true)}
                  placeholder="Type a country name..."
                  className="w-full px-6 py-4 text-lg bg-white/10 backdrop-blur-sm border-2 border-white/20 rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:border-purple-400 transition-all"
                  autoComplete="off"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 px-6 py-2 rounded-xl font-semibold transition-all transform hover:scale-105 shadow-lg"
                >
                  Guess
                </button>
              </div>

              {/* Suggestions Dropdown */}
              {showSuggestions && filteredCountries.length > 0 && (
                <div className="absolute z-10 w-full mt-2 bg-slate-800/95 backdrop-blur-sm border border-white/20 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                  {filteredCountries.slice(0, 8).map((country, index) => (
                    <button
                      key={country.code}
                      type="button"
                      onClick={() => selectCountry(country)}
                      className={`w-full text-left px-6 py-3 hover:bg-purple-500/30 transition-colors ${
                        index === selectedIndex ? "bg-purple-500/40" : ""
                      } ${index === 0 ? "rounded-t-xl" : ""} ${
                        index === Math.min(7, filteredCountries.length - 1)
                          ? "rounded-b-xl"
                          : ""
                      }`}
                    >
                      <span className="font-medium">{country.name}</span>
                      <span className="text-gray-400 text-sm ml-2">({country.code})</span>
                    </button>
                  ))}
                </div>
              )}
            </form>
          ) : (
            <div className="text-center space-y-6">
              <div className="bg-white/10 backdrop-blur-sm border-2 border-white/20 rounded-2xl p-8">
                <h2 className="text-4xl font-bold mb-4">
                  {win ? "🎉 Congratulations!" : "😔 Game Over"}
                </h2>
                <p className="text-xl text-gray-300 mb-2">
                  The country was:
                </p>
                <p className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  {targetCountry?.name}
                </p>
                <p className="text-gray-400 mt-4">
                  You guessed it in {guesses.length} {guesses.length === 1 ? "attempt" : "attempts"}!
                </p>
              </div>
              <button
                onClick={startNewGame}
                className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 px-8 py-4 rounded-xl font-bold text-lg transition-all transform hover:scale-105 shadow-lg"
              >
                🔄 Play Again
              </button>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-4 bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-xl text-center animate-pulse">
              {error}
            </div>
          )}
        </div>

        {/* Guesses List */}
        <div className="max-w-2xl mx-auto space-y-3">
          {guesses.length > 0 && (
            <h3 className="text-xl font-semibold text-gray-300 mb-4">Your Guesses:</h3>
          )}
          {guesses.map((guess, index) => (
            <div
              key={index}
              className={`bg-gradient-to-r ${getColor(
                guess.distance
              )} ${getTextColor(
                guess.distance
              )} p-5 rounded-2xl shadow-lg transform transition-all duration-500 hover:scale-102 animate-slideIn`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-xl mb-1">{guess.country.name}</div>
                  <div className="flex gap-3 text-sm opacity-90">
                    <span className="font-mono font-semibold">
                      {Math.round(guess.distance).toLocaleString()} km
                    </span>
                    <span className="font-bold text-2xl">
                      {getDirectionArrow(guess.direction)}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-extrabold">
                    {getHotColdText(guess.distance)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        {guesses.length === 0 && !gameOver && (
          <div className="max-w-2xl mx-auto mt-12 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <h3 className="text-lg font-semibold mb-4 text-center">🎯 Distance Guide</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="text-center">
                <div className="bg-gradient-to-r from-emerald-500 to-green-600 p-3 rounded-lg mb-2">
                  <span className="text-2xl">🎯</span>
                </div>
                <div className="text-xs font-semibold">CORRECT</div>
              </div>
              <div className="text-center">
                <div className="bg-gradient-to-r from-red-500 to-red-600 p-3 rounded-lg mb-2">
                  <span className="text-2xl">🔥</span>
                </div>
                <div className="text-xs font-semibold">&lt; 1000 km</div>
              </div>
              <div className="text-center">
                <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-3 rounded-lg mb-2">
                  <span className="text-2xl">🌡️</span>
                </div>
                <div className="text-xs font-semibold">&lt; 3000 km</div>
              </div>
              <div className="text-center">
                <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 p-3 rounded-lg mb-2">
                  <span className="text-2xl">❄️</span>
                </div>
                <div className="text-xs font-semibold">&lt; 8000 km</div>
              </div>
              <div className="text-center">
                <div className="bg-gradient-to-r from-gray-400 to-gray-500 p-3 rounded-lg mb-2">
                  <span className="text-2xl">🧊</span>
                </div>
                <div className="text-xs font-semibold">&gt; 8000 km</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
    </>
  );
}
