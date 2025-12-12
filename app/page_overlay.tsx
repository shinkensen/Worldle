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
  const [countryPolygons, setCountryPolygons] = useState<any[]>([]);

  useEffect(() => {
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

    const newGuess: Guess = {
      country: guessedCountry,
      distance,
    };

    setGuesses([newGuess, ...guesses]);
    setInputValue("");
    setShowSuggestions(false);
    setError("");

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
    if (distance === 0) return "#10b981";
    if (distance < 1000) return "#ef4444";
    if (distance < 3000) return "#f97316";
    if (distance < 8000) return "#facc15";
    return "#9ca3af";
  };

  const getHotColdText = (distance: number) => {
    if (distance === 0) return "🎯 CORRECT!";
    if (distance < 1000) return "🔥 HOT";
    if (distance < 3000) return "🌡️ WARM";
    if (distance < 8000) return "❄️ COOL";
    return "🧊 COLD";
  };

  const getPolygonColor = (polygon: any) => {
    if (!targetCountry) return 'rgba(100, 100, 100, 0.3)';
    
    const guessedMatch = guesses.find(guess => {
      const polygonName = polygon.properties?.name || '';
      return polygonName.toLowerCase().includes(guess.country.name.toLowerCase()) ||
             guess.country.name.toLowerCase().includes(polygonName.toLowerCase());
    });

    if (guessedMatch) {
      const distance = guessedMatch.distance;
      if (distance === 0) return 'rgba(16, 185, 129, 0.8)';
      if (distance < 1000) return 'rgba(239, 68, 68, 0.8)';
      if (distance < 3000) return 'rgba(249, 115, 22, 0.8)';
      if (distance < 8000) return 'rgba(250, 204, 21, 0.8)';
      return 'rgba(156, 163, 175, 0.8)';
    }
    
    return 'rgba(100, 100, 100, 0.3)';
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white overflow-hidden relative">
      {/* Background Globe - Full Screen */}
      <div className="absolute inset-0 z-0">
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
          
          atmosphereColor="rgba(139, 92, 246, 0.5)"
          atmosphereAltitude={0.2}
          width={typeof window !== 'undefined' ? window.innerWidth : 1000}
          height={typeof window !== 'undefined' ? window.innerHeight : 800}
        />
      </div>

      {/* Overlay UI */}
      <div className="relative z-10 min-h-screen flex flex-col pointer-events-none">
        {/* Header */}
        <div className="container mx-auto px-4 py-4">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-extrabold mb-1 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent drop-shadow-2xl">
              🌍 WORLDLE
            </h1>
            <p className="text-sm md:text-base text-gray-200 drop-shadow-lg">Guess the mystery country!</p>
          </div>
        </div>

        {/* Centered Content Overlay */}
        <div className="flex-1 container mx-auto px-4 pb-4 flex items-start md:items-center justify-center">
          <div className="w-full max-w-2xl pointer-events-auto">
            
            {/* Stats */}
            <div className="mb-3 flex justify-center gap-3">
              <div className="bg-black/70 backdrop-blur-md px-4 py-2 rounded-xl border border-white/40 shadow-2xl">
                <div className="text-xs text-gray-300">Attempts</div>
                <div className="text-xl font-bold">{guesses.length}</div>
              </div>
              {gameOver && (
                <div className="bg-black/70 backdrop-blur-md px-4 py-2 rounded-xl border border-white/40 shadow-2xl">
                  <div className="text-xs text-gray-300">Result</div>
                  <div className="text-xl font-bold">{win ? "🏆 WIN" : "❌ LOST"}</div>
                </div>
              )}
            </div>

            {/* Input Section */}
            <div className="mb-3">
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
                      className="w-full px-5 py-3 text-base md:text-lg bg-black/70 backdrop-blur-md border-2 border-white/40 rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:border-purple-400 transition-all shadow-2xl"
                      autoComplete="off"
                    />
                    <button
                      type="submit"
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 px-4 md:px-6 py-2 rounded-xl font-semibold transition-all transform hover:scale-105 shadow-lg text-sm md:text-base"
                    >
                      Guess
                    </button>
                  </div>

                  {/* Suggestions */}
                  {showSuggestions && filteredCountries.length > 0 && (
                    <div className="absolute z-20 w-full mt-2 bg-slate-900/95 backdrop-blur-md border border-white/40 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                      {filteredCountries.slice(0, 8).map((country, index) => (
                        <button
                          key={country.code}
                          type="button"
                          onClick={() => selectCountry(country)}
                          className={`w-full text-left px-5 py-2.5 hover:bg-purple-500/40 transition-colors ${
                            index === selectedIndex ? "bg-purple-500/50" : ""
                          } ${index === 0 ? "rounded-t-xl" : ""} ${
                            index === Math.min(7, filteredCountries.length - 1) ? "rounded-b-xl" : ""
                          }`}
                        >
                          <span className="font-medium text-sm md:text-base">{country.name}</span>
                          <span className="text-gray-400 text-xs md:text-sm ml-2">({country.code})</span>
                        </button>
                      ))}
                    </div>
                  )}
                </form>
              ) : (
                <div className="text-center space-y-3">
                  <div className="bg-black/80 backdrop-blur-md border-2 border-white/40 rounded-2xl p-5 shadow-2xl">
                    <h2 className="text-2xl md:text-3xl font-bold mb-2">
                      {win ? "🎉 Congratulations!" : "😔 Game Over"}
                    </h2>
                    <p className="text-base md:text-lg text-gray-300 mb-1">The country was:</p>
                    <p className="text-xl md:text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                      {targetCountry?.name}
                    </p>
                    <p className="text-gray-400 mt-2 text-xs md:text-sm">
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

              {error && (
                <div className="mt-2 bg-red-500/30 backdrop-blur-md border border-red-500/50 text-red-200 px-3 py-2 rounded-xl text-center animate-pulse text-xs md:text-sm shadow-lg">
                  {error}
                </div>
              )}
            </div>

            {/* Guesses List */}
            {guesses.length > 0 && (
              <div className="bg-black/60 backdrop-blur-md border border-white/30 rounded-2xl p-3 shadow-2xl max-h-[200px] md:max-h-[280px] overflow-y-auto">
                <h3 className="text-xs md:text-sm font-semibold text-gray-300 mb-2 sticky top-0 bg-black/70 backdrop-blur-sm py-1.5 -mx-3 px-3">
                  Your Guesses:
                </h3>
                <div className="space-y-1.5">
                  {guesses.map((guess, index) => (
                    <div
                      key={index}
                      className={`bg-gradient-to-r ${getColor(guess.distance)} ${getTextColor(guess.distance)} p-2.5 rounded-xl shadow-lg animate-slideIn`}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold text-xs md:text-sm mb-0.5">{guess.country.name}</div>
                          <div className="text-[10px] opacity-90">
                            <span className="font-mono font-semibold">
                              {Math.round(guess.distance).toLocaleString()} km away
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm md:text-base font-extrabold whitespace-nowrap">
                            {getHotColdText(guess.distance)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Legend */}
            {guesses.length === 0 && !gameOver && (
              <div className="bg-black/60 backdrop-blur-md border border-white/30 rounded-2xl p-3 shadow-2xl">
                <h3 className="text-xs md:text-sm font-semibold mb-2 text-center">🎯 Distance Guide</h3>
                <div className="grid grid-cols-5 gap-1.5">
                  {[
                    { emoji: "🎯", label: "CORRECT", color: "from-emerald-500 to-green-600" },
                    { emoji: "🔥", label: "<1000km", color: "from-red-500 to-red-600" },
                    { emoji: "🌡️", label: "<3000km", color: "from-orange-500 to-orange-600" },
                    { emoji: "❄️", label: "<8000km", color: "from-yellow-400 to-yellow-500" },
                    { emoji: "🧊", label: ">8000km", color: "from-gray-400 to-gray-500" }
                  ].map((item, i) => (
                    <div key={i} className="text-center">
                      <div className={`bg-gradient-to-r ${item.color} p-1.5 rounded-lg mb-1`}>
                        <span className="text-base md:text-lg">{item.emoji}</span>
                      </div>
                      <div className="text-[8px] md:text-[9px] font-semibold">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
