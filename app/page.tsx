"use client";

import { useState, useEffect, useRef } from "react";
import { countries, Country } from "@/lib/countries";
import { getDistanceFromLatLonInKm } from "@/lib/utils";
import dynamic from "next/dynamic";

const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

interface Guess {
  country: Country;
  distance: number;
}

interface GlobePoint {
  lat: number;
  lng: number;
  size: number;
  color: string;
  label: string;
  altitude: number;
}

interface RoundResult {
  country: Country;
  guesses: number;
  won: boolean;
}

type GameMode = "practice" | "daily" | null;
type GameScreen = "home" | "setup" | "playing" | "results";

export default function Home() {
  // Game state
  const [gameScreen, setGameScreen] = useState<GameScreen>("home");
  const [gameMode, setGameMode] = useState<GameMode>(null);
  const [totalRounds, setTotalRounds] = useState(5);
  const [currentRound, setCurrentRound] = useState(1);
  const [roundResults, setRoundResults] = useState<RoundResult[]>([]);
  
  // Round state
  const [targetCountry, setTargetCountry] = useState<Country | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [roundOver, setRoundOver] = useState(false);
  const [win, setWin] = useState(false);
  const [filteredCountries, setFilteredCountries] = useState<Country[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const globeEl = useRef<any>(null);
  const [globePoints, setGlobePoints] = useState<GlobePoint[]>([]);
  const [arcs, setArcs] = useState<any[]>([]);
  const [countryPolygons, setCountryPolygons] = useState<any[]>([]);

  useEffect(() => {
    // Fetch country geometries
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
      .then(res => res.json())
      .then(data => {
        const countries = (window as any).topojson.feature(data, data.objects.countries).features;
        setCountryPolygons(countries);
      })
      .catch(err => console.error('Failed to load country geometries:', err));
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

  // Get today's country (same for everyone on the same day)
  const getTodaysCountry = () => {
    const today = new Date();
    const daysSinceEpoch = Math.floor(today.getTime() / (1000 * 60 * 60 * 24));
    const index = daysSinceEpoch % countries.length;
    return countries[index];
  };

  const startGame = (mode: GameMode, rounds: number) => {
    setGameMode(mode);
    setTotalRounds(rounds);
    setCurrentRound(1);
    setRoundResults([]);
    setGameScreen("playing");
    startNewRound(mode);
  };

  const startNewRound = (mode?: GameMode) => {
    const currentMode = mode || gameMode;
    let random: Country;
    
    if (currentMode === "daily") {
      random = getTodaysCountry();
    } else {
      // Ensure truly random selection, avoiding the previous country
      do {
        random = countries[Math.floor(Math.random() * countries.length)];
      } while (targetCountry && random.code === targetCountry.code && countries.length > 1);
    }
    
    setTargetCountry(random);
    setGuesses([]);
    setRoundOver(false);
    setWin(false);
    setInputValue("");
    setError("");
    setGlobePoints([]);
    setArcs([]);
    
    // Point globe to random location initially
    if (globeEl.current) {
      globeEl.current.pointOfView({
        lat: random.latitude,
        lng: random.longitude,
        altitude: 2.5,
      }, 1000);
    }
  };

  const handleGuess = (e: React.FormEvent) => {
    e.preventDefault();
    submitGuess();
  };

  const submitGuess = (selectedCountry?: Country) => {
    if (roundOver || !targetCountry) return;

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

    const newGuess: Guess = {
      country: guessedCountry,
      distance,
    };

    const updatedGuesses = [newGuess, ...guesses];
    setGuesses(updatedGuesses);
    setInputValue("");
    setShowSuggestions(false);
    setError("");

    // Add point to globe
    const pointColor = getPointColor(distance);
    const newPoint: GlobePoint = {
      lat: guessedCountry.latitude,
      lng: guessedCountry.longitude,
      size: distance === 0 ? 1.5 : 0.8,
      color: pointColor,
      label: `${guessedCountry.name} - ${getHotColdText(distance)}`,
      altitude: distance === 0 ? 0.3 : 0.15,
    };
    
    setGlobePoints([...globePoints, newPoint]);

    // Animate camera to guessed location
    if (globeEl.current) {
      globeEl.current.pointOfView({
        lat: guessedCountry.latitude,
        lng: guessedCountry.longitude,
        altitude: 2,
      }, 1000);
    }

    if (guessedCountry.code === targetCountry.code) {
      setWin(true);
      setRoundOver(true);
      
      // Record round result
      const result: RoundResult = {
        country: targetCountry,
        guesses: updatedGuesses.length,
        won: true,
      };
      setRoundResults([...roundResults, result]);
      
      // Show the target point prominently
      if (globeEl.current) {
        setTimeout(() => {
          globeEl.current.pointOfView({
            lat: targetCountry.latitude,
            lng: targetCountry.longitude,
            altitude: 1.5,
          }, 2000);
        }, 500);
      }
    }
  };

  const skipRound = () => {
    if (!targetCountry || roundOver) return;
    
    setRoundOver(true);
    const result: RoundResult = {
      country: targetCountry,
      guesses: 0,
      won: false,
    };
    setRoundResults([...roundResults, result]);
  };

  const nextRound = () => {
    if (currentRound < totalRounds) {
      setCurrentRound(currentRound + 1);
      startNewRound();
    } else {
      setGameScreen("results");
    }
  };

  const returnToHome = () => {
    setGameScreen("home");
    setGameMode(null);
    setCurrentRound(1);
    setRoundResults([]);
    setTargetCountry(null);
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

  const getPointColor = (distance: number) => {
    if (distance === 0) return "#10b981"; // green
    if (distance < 1000) return "#ef4444"; // red
    if (distance < 3000) return "#f97316"; // orange
    if (distance < 8000) return "#facc15"; // yellow
    return "#9ca3af"; // gray
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

  const getPolygonColor = (polygon: any) => {
    if (!targetCountry) return 'rgba(100, 100, 100, 0.3)';
    
    // Find if this polygon matches a guessed country
    const guessedMatch = guesses.find(guess => {
      // Match by country code if available in polygon properties
      const polygonName = polygon.properties?.name || '';
      return polygonName.toLowerCase().includes(guess.country.name.toLowerCase()) ||
             guess.country.name.toLowerCase().includes(polygonName.toLowerCase());
    });

    if (guessedMatch) {
      const distance = guessedMatch.distance;
      if (distance === 0) return 'rgba(16, 185, 129, 0.8)'; // green - correct
      if (distance < 1000) return 'rgba(239, 68, 68, 0.8)'; // red - hot
      if (distance < 3000) return 'rgba(249, 115, 22, 0.8)'; // orange - warm
      if (distance < 8000) return 'rgba(250, 204, 21, 0.8)'; // yellow - cool
      return 'rgba(156, 163, 175, 0.8)'; // gray - cold
    }
    
    return 'rgba(100, 100, 100, 0.3)'; // default unguessed
  };

  // Calculate average score
  const calculateAverageScore = () => {
    const wonRounds = roundResults.filter(r => r.won);
    if (wonRounds.length === 0) return 0;
    const totalGuesses = wonRounds.reduce((sum, r) => sum + r.guesses, 0);
    return (totalGuesses / wonRounds.length).toFixed(1);
  };

  // Render home screen
  if (gameScreen === "home") {
    return (
      <main className="relative min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white overflow-hidden flex items-center justify-center p-4">
        <div className="absolute inset-0 z-0">
          <Globe
            ref={globeEl}
            width={typeof window !== 'undefined' ? window.innerWidth : 1000}
            height={typeof window !== 'undefined' ? window.innerHeight : 800}
            globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
            backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
            atmosphereColor="rgba(139, 92, 246, 0.5)"
            atmosphereAltitude={0.2}
          />
        </div>

        <div className="relative z-10 w-full max-w-2xl pointer-events-auto">
          <div className="text-center mb-8">
            <h1 className="text-5xl md:text-7xl font-extrabold mb-4 bg-clip-text text-transparent drop-shadow-2xl">
              WORLDLE
            </h1>
            <p className="text-lg text-gray-200 drop-shadow-md">Guess the mystery country on the globe!</p>
          </div>

          <div className="bg-white/10 backdrop-blur-xl border-2 border-white/30 rounded-3xl p-8 shadow-2xl space-y-6">
            <h2 className="text-2xl font-bold text-center mb-6">Choose Your Mode</h2>
            
            {/* Practice Mode */}
            <button
              onClick={() => setGameScreen("setup")}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 p-6 rounded-2xl transition-all transform hover:scale-105 shadow-lg"
            >
              <div className="text-left">
                <div className="text-2xl font-bold mb-2">🎮 Practice Mode</div>
                <div className="text-sm text-blue-100">Play multiple rounds and improve your geography skills!</div>
              </div>
            </button>

            {/* Daily Challenge */}
            <button
              onClick={() => startGame("daily", 1)}
              className="w-full bg-gradient-to-r from-orange-500 to-pink-600 hover:from-orange-600 hover:to-pink-700 p-6 rounded-2xl transition-all transform hover:scale-105 shadow-lg"
            >
              <div className="text-left">
                <div className="text-2xl font-bold mb-2">📅 Today's Worldle</div>
                <div className="text-sm text-orange-100">Everyone gets the same country today. Come back tomorrow for a new challenge!</div>
              </div>
            </button>
          </div>
        </div>
      </main>
    );
  }

  // Render setup screen
  if (gameScreen === "setup") {
    return (
      <main className="relative min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white overflow-hidden flex items-center justify-center p-4">
        <div className="absolute inset-0 z-0">
          <Globe
            ref={globeEl}
            width={typeof window !== 'undefined' ? window.innerWidth : 1000}
            height={typeof window !== 'undefined' ? window.innerHeight : 800}
            globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
            backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
            atmosphereColor="rgba(139, 92, 246, 0.5)"
            atmosphereAltitude={0.2}
          />
        </div>

        <div className="relative z-10 w-full max-w-xl pointer-events-auto">
          <button
            onClick={() => setGameScreen("home")}
            className="mb-4 text-gray-300 hover:text-white transition-colors"
          >
            ← Back
          </button>

          <div className="bg-white/10 backdrop-blur-xl border-2 border-white/30 rounded-3xl p-8 shadow-2xl">
            <h2 className="text-3xl font-bold text-center mb-6">Practice Mode Setup</h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-lg font-semibold mb-3">How many rounds?</label>
                <div className="grid grid-cols-3 gap-3">
                  {[3, 5, 10].map((num) => (
                    <button
                      key={num}
                      onClick={() => setTotalRounds(num)}
                      className={`py-4 rounded-xl font-bold transition-all transform hover:scale-105 ${
                        totalRounds === num
                          ? "bg-gradient-to-r from-purple-500 to-pink-500 shadow-lg"
                          : "bg-white/20 hover:bg-white/30"
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => startGame("practice", totalRounds)}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 py-4 rounded-xl font-bold text-lg transition-all transform hover:scale-105 shadow-lg"
              >
                Start Game
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Render results screen
  if (gameScreen === "results") {
    const wonRounds = roundResults.filter(r => r.won).length;
    const avgScore = calculateAverageScore();

    return (
      <main className="relative min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white overflow-hidden flex items-center justify-center p-4">
        <div className="absolute inset-0 z-0">
          <Globe
            ref={globeEl}
            width={typeof window !== 'undefined' ? window.innerWidth : 1000}
            height={typeof window !== 'undefined' ? window.innerHeight : 800}
            globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
            backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
            atmosphereColor="rgba(139, 92, 246, 0.5)"
            atmosphereAltitude={0.2}
          />
        </div>

        <div className="relative z-10 w-full max-w-2xl pointer-events-auto">
          <div className="bg-white/10 backdrop-blur-xl border-2 border-white/30 rounded-3xl p-8 shadow-2xl">
            <h2 className="text-4xl font-bold text-center mb-6">🎉 Game Complete!</h2>
            
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white/10 backdrop-blur-xl p-4 rounded-2xl border border-white/20">
                <div className="text-sm text-gray-300">Rounds Won</div>
                <div className="text-3xl font-bold">{wonRounds}/{totalRounds}</div>
              </div>
              <div className="bg-white/10 backdrop-blur-xl p-4 rounded-2xl border border-white/20">
                <div className="text-sm text-gray-300">Avg Guesses</div>
                <div className="text-3xl font-bold">{avgScore}</div>
              </div>
            </div>

            {/* Round Results */}
            <div className="space-y-3 mb-6 max-h-[300px] overflow-y-auto">
              <h3 className="text-lg font-semibold mb-2">Round Results:</h3>
              {roundResults.map((result, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-xl ${
                    result.won
                      ? "bg-gradient-to-r from-emerald-500/30 to-green-600/30 border border-green-400/50"
                      : "bg-gradient-to-r from-red-500/30 to-red-600/30 border border-red-400/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold">Round {index + 1}</div>
                      <div className="text-sm text-gray-200">{result.country.name}</div>
                    </div>
                    <div className="text-right">
                      {result.won ? (
                        <div className="text-lg font-bold">✓ {result.guesses} guesses</div>
                      ) : (
                        <div className="text-lg font-bold">✗ Skipped</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={() => startGame(gameMode, totalRounds)}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 py-3 rounded-xl font-bold transition-all transform hover:scale-105 shadow-lg"
              >
                Play Again
              </button>
              <button
                onClick={returnToHome}
                className="w-full bg-white/20 hover:bg-white/30 py-3 rounded-xl font-bold transition-all"
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Render playing screen

  // Render playing screen
  return (
    <>
    <main className="relative min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white overflow-hidden">
      {/* Full-screen Globe Background */}
      <div className="absolute inset-0 z-0">
        <Globe
          ref={globeEl}
          width={typeof window !== 'undefined' ? window.innerWidth : 1000}
          height={typeof window !== 'undefined' ? window.innerHeight : 800}
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
          backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
          
          polygonsData={countryPolygons}
          polygonCapColor={getPolygonColor}
          polygonSideColor={() => 'rgba(0, 0, 0, 0.1)'}
          polygonStrokeColor={() => 'rgba(255, 255, 255, 0.3)'}
          polygonAltitude={0.01}
          
          pointsData={globePoints}
          pointLat="lat"
          pointLng="lng"
          pointColor="color"
          pointAltitude="altitude"
          pointRadius="size"
          pointLabel="label"
          
          atmosphereColor="rgba(139, 92, 246, 0.5)"
          atmosphereAltitude={0.2}
        />
      </div>

      {/* Overlay UI */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-4 pointer-events-none">
        {/* Header */}
        <div className="text-center mb-6 pointer-events-auto">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-2 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent drop-shadow-lg">
            🌍 WORLDLE
          </h1>
          <p className="text-sm text-gray-200 drop-shadow-md">
            {gameMode === "daily" ? "Today's Worldle" : `Round ${currentRound} of ${totalRounds}`}
          </p>
        </div>

        {/* Main Game Container with Liquid Glass Effect */}
        <div className="w-full max-w-2xl pointer-events-auto">
          {/* Stats Bar */}
          <div className="flex justify-center gap-3 mb-4">
            {gameMode === "practice" && (
              <div className="bg-white/10 backdrop-blur-xl px-4 py-2 rounded-2xl border border-white/30 shadow-2xl">
                <div className="text-xs text-gray-200">Round</div>
                <div className="text-xl font-bold">{currentRound}/{totalRounds}</div>
              </div>
            )}
            <div className="bg-white/10 backdrop-blur-xl px-4 py-2 rounded-2xl border border-white/30 shadow-2xl">
              <div className="text-xs text-gray-200">Attempts</div>
              <div className="text-xl font-bold">{guesses.length}</div>
            </div>
            {roundOver && (
              <div className="bg-white/10 backdrop-blur-xl px-4 py-2 rounded-2xl border border-white/30 shadow-2xl">
                <div className="text-xs text-gray-200">Result</div>
                <div className="text-xl font-bold">{win ? "🏆 WIN" : "❌ LOST"}</div>
              </div>
            )}
          </div>

            {/* Input Section */}
            {!roundOver ? (
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
                    className="w-full px-6 py-4 text-lg bg-white/10 backdrop-blur-xl border-2 border-white/30 rounded-2xl text-white placeholder-gray-300 focus:outline-none focus:border-purple-400 focus:bg-white/20 transition-all shadow-lg"
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
                  <div className="absolute z-20 w-full mt-2 bg-white/10 backdrop-blur-2xl border border-white/30 rounded-2xl shadow-2xl max-h-60 overflow-y-auto">
                    {filteredCountries.slice(0, 8).map((country, index) => (
                      <button
                        key={country.code}
                        type="button"
                        onClick={() => selectCountry(country)}
                        className={`w-full text-left px-6 py-3 hover:bg-white/20 transition-colors ${
                          index === selectedIndex ? "bg-white/25" : ""
                        } ${index === 0 ? "rounded-t-2xl" : ""} ${
                          index === Math.min(7, filteredCountries.length - 1)
                            ? "rounded-b-2xl"
                            : ""
                        }`}
                      >
                        <span className="font-medium">{country.name}</span>
                        <span className="text-gray-300 text-sm ml-2">({country.code})</span>
                      </button>
                    ))}
                  </div>
                )}
                
                {/* Skip Button for Practice Mode */}
                {gameMode === "practice" && (
                  <button
                    type="button"
                    onClick={skipRound}
                    className="w-full mt-3 bg-white/10 hover:bg-white/20 backdrop-blur-xl px-4 py-2 rounded-xl text-sm transition-all"
                  >
                    Skip Round
                  </button>
                )}
              </form>
            ) : (
              <div className="text-center space-y-4">
                <div className="bg-white/10 backdrop-blur-xl border-2 border-white/30 rounded-2xl p-6 shadow-xl">
                  <h2 className="text-3xl font-bold mb-3">
                    {win ? "🎉 Congratulations!" : "😔 Round Over"}
                  </h2>
                  <p className="text-lg text-gray-200 mb-1">
                    The country was:
                  </p>
                  <p className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    {targetCountry?.name}
                  </p>
                  {win && (
                    <p className="text-gray-300 mt-3 text-sm">
                      You guessed it in {guesses.length} {guesses.length === 1 ? "attempt" : "attempts"}!
                    </p>
                  )}
                </div>
                
                {gameMode === "practice" ? (
                  <div className="space-y-3">
                    <button
                      onClick={nextRound}
                      className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 px-6 py-3 rounded-xl font-bold transition-all transform hover:scale-105 shadow-lg"
                    >
                      {currentRound < totalRounds ? `Next Round (${currentRound + 1}/${totalRounds})` : "View Results"}
                    </button>
                    <button
                      onClick={returnToHome}
                      className="w-full bg-white/20 hover:bg-white/30 px-6 py-3 rounded-xl font-semibold transition-all"
                    >
                      Exit to Home
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={returnToHome}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 px-6 py-3 rounded-xl font-bold transition-all transform hover:scale-105 shadow-lg"
                  >
                    Back to Home
                  </button>
                )}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/20 backdrop-blur-xl border border-red-500/40 text-red-200 px-4 py-3 rounded-xl text-center animate-pulse text-sm shadow-lg mt-3">
                {error}
              </div>
            )}

            {/* Guesses List */}
            {guesses.length > 0 && (
              <div className="space-y-2 max-h-[200px] md:max-h-[280px] overflow-y-auto pr-2 mt-4">
                <h3 className="text-sm font-semibold text-gray-200 mb-2 sticky top-0 bg-white/10 backdrop-blur-xl py-2 rounded-xl px-3 border border-white/20">
                  Your Guesses:
                </h3>
                {guesses.map((guess, index) => (
                  <div
                    key={index}
                    className={`bg-gradient-to-r ${getColor(
                      guess.distance
                    )} ${getTextColor(
                      guess.distance
                    )} p-4 rounded-xl shadow-lg transform transition-all duration-500 hover:scale-102 animate-slideIn`}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-base mb-1">{guess.country.name}</div>
                        <div className="text-xs opacity-90">
                          <span className="font-mono font-semibold">
                            {Math.round(guess.distance).toLocaleString()} km away
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-extrabold">
                          {getHotColdText(guess.distance)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Legend */}
            {guesses.length === 0 && !roundOver && (
              <div className="bg-white/5 backdrop-blur-xl border border-white/20 rounded-2xl p-4 shadow-lg mt-4">
                <h3 className="text-sm font-semibold mb-3 text-center text-gray-200">🎯 Distance Guide</h3>
                <div className="grid grid-cols-5 gap-2">
                  <div className="text-center">
                    <div className="bg-gradient-to-r from-emerald-500 to-green-600 p-2 rounded-lg mb-1">
                      <span className="text-xl">🎯</span>
                    </div>
                    <div className="text-[10px] font-semibold">CORRECT</div>
                  </div>
                  <div className="text-center">
                    <div className="bg-gradient-to-r from-red-500 to-red-600 p-2 rounded-lg mb-1">
                      <span className="text-xl">🔥</span>
                    </div>
                    <div className="text-[10px] font-semibold">&lt;1000km</div>
                  </div>
                  <div className="text-center">
                    <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-2 rounded-lg mb-1">
                      <span className="text-xl">🌡️</span>
                    </div>
                    <div className="text-[10px] font-semibold">&lt;3000km</div>
                  </div>
                  <div className="text-center">
                    <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 p-2 rounded-lg mb-1">
                      <span className="text-xl">❄️</span>
                    </div>
                    <div className="text-[10px] font-semibold">&lt;8000km</div>
                  </div>
                  <div className="text-center">
                    <div className="bg-gradient-to-r from-gray-400 to-gray-500 p-2 rounded-lg mb-1">
                      <span className="text-xl">🧊</span>
                    </div>
                    <div className="text-[10px] font-semibold">&gt;8000km</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
