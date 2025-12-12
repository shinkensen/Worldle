"use client";

import { useState, useEffect, useRef } from "react";
import { countries, Country } from "@/lib/countries";
import { getDistanceFromLatLonInKm, getDirection } from "@/lib/utils";
import dynamic from "next/dynamic";

const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

interface Guess {
  country: Country;
  distance: number;
  direction: string;
}

interface GlobePoint {
  lat: number;
  lng: number;
  size: number;
  color: string;
  label: string;
  altitude: number;
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
    
    // Add arc from guess to target
    const newArc = {
      startLat: guessedCountry.latitude,
      startLng: guessedCountry.longitude,
      endLat: targetCountry.latitude,
      endLng: targetCountry.longitude,
      color: [pointColor, pointColor],
      dashLength: 0.3,
      dashGap: 0.2,
      dashAnimateTime: 3000,
      stroke: 2,
    };
    
    setArcs([...arcs, newArc]);

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
      setGameOver(true);
      
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

  return (
    <>
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white overflow-hidden">
      {/* Header */}
      <div className="container mx-auto px-4 py-6 relative z-10">
        <div className="text-center mb-6">
          <h1 className="text-5xl md:text-6xl font-extrabold mb-3 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            🌍 WORLDLE
          </h1>
          <p className="text-base text-gray-300 mb-1">Guess the mystery country on the globe!</p>
        </div>

        {/* Game Layout: Globe + Controls Side by Side */}
        <div className="grid lg:grid-cols-2 gap-6 items-start max-w-7xl mx-auto">
          
          {/* Left Side: 3D Globe */}
          <div className="relative">
            <div className="bg-black/30 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden" style={{ height: "600px" }}>
              <Globe
                ref={globeEl}
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
                
                arcsData={arcs}
                arcStartLat="startLat"
                arcStartLng="startLng"
                arcEndLat="endLat"
                arcEndLng="endLng"
                arcColor="color"
                arcDashLength="dashLength"
                arcDashGap="dashGap"
                arcDashAnimateTime="dashAnimateTime"
                arcStroke="stroke"
                
                atmosphereColor="rgba(139, 92, 246, 0.5)"
                atmosphereAltitude={0.2}
              />
            </div>
            
            {/* Globe Stats Overlay */}
            <div className="absolute top-4 left-4 right-4 flex justify-between gap-3 pointer-events-none">
              <div className="bg-black/60 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/20 pointer-events-auto">
                <div className="text-xs text-gray-300">Attempts</div>
                <div className="text-xl font-bold">{guesses.length}</div>
              </div>
              {gameOver && (
                <div className="bg-black/60 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/20 pointer-events-auto">
                  <div className="text-xs text-gray-300">Result</div>
                  <div className="text-xl font-bold">{win ? "🏆 WIN" : "❌ LOST"}</div>
                </div>
              )}
            </div>
          </div>

          {/* Right Side: Controls & Guesses */}
          <div className="flex flex-col gap-6">
            
            {/* Input Section */}
            <div>
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
                <div className="text-center space-y-4">
                  <div className="bg-white/10 backdrop-blur-sm border-2 border-white/20 rounded-2xl p-6">
                    <h2 className="text-3xl font-bold mb-3">
                      {win ? "🎉 Congratulations!" : "😔 Game Over"}
                    </h2>
                    <p className="text-lg text-gray-300 mb-1">
                      The country was:
                    </p>
                    <p className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                      {targetCountry?.name}
                    </p>
                    <p className="text-gray-400 mt-3 text-sm">
                      You guessed it in {guesses.length} {guesses.length === 1 ? "attempt" : "attempts"}!
                    </p>
                  </div>
                  <button
                    onClick={startNewGame}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 px-6 py-3 rounded-xl font-bold transition-all transform hover:scale-105 shadow-lg"
                  >
                    🔄 Play Again
                  </button>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="mt-4 bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-xl text-center animate-pulse text-sm">
                  {error}
                </div>
              )}
            </div>

            {/* Guesses List */}
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {guesses.length > 0 && (
                <h3 className="text-lg font-semibold text-gray-300 mb-3 sticky top-0 bg-slate-900/80 backdrop-blur-sm py-2">Your Guesses:</h3>
              )}
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
                      <div className="font-bold text-lg mb-1">{guess.country.name}</div>
                      <div className="flex gap-3 text-xs opacity-90">
                        <span className="font-mono font-semibold">
                          {Math.round(guess.distance).toLocaleString()} km
                        </span>
                        <span className="font-bold text-xl">
                          {getDirectionArrow(guess.direction)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-extrabold">
                        {getHotColdText(guess.distance)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Legend */}
            {guesses.length === 0 && !gameOver && (
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5">
                <h3 className="text-base font-semibold mb-3 text-center">🎯 Distance Guide</h3>
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
      </div>
    </main>
    </>
  );
}
