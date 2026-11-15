/* ============ SKY CRED — application logic ============ */
(function () {
  "use strict";

  var CONFIG = window.CONFIG;
  var POPULAR_CITIES = [
    "Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Chennai",
    "Kolkata", "Pune", "Ahmedabad", "New York", "London"
  ];

  /* ---------- DOM refs ---------- */
  var el = {
    form: document.getElementById("search-form"),
    input: document.getElementById("search-input"),
    searchBtn: document.getElementById("search-btn"),
    searchError: document.getElementById("search-error"),
    chips: document.getElementById("popular-cities"),
    loading: document.getElementById("loading"),
    errorState: document.getElementById("error-state"),
    errorTitle: document.getElementById("error-title"),
    errorMessage: document.getElementById("error-message"),
    retryBtn: document.getElementById("retry-btn"),
    card: document.getElementById("weather-card"),
    city: document.getElementById("w-city"),
    localtime: document.getElementById("w-localtime"),
    icon: document.getElementById("w-icon"),
    condition: document.getElementById("w-condition"),
    temp: document.getElementById("w-temp"),
    feelslike: document.getElementById("w-feelslike"),
    pTitle: document.getElementById("p-title"),
    pDesc: document.getElementById("p-desc"),
    mHumidity: document.getElementById("m-humidity"),
    mWind: document.getElementById("m-wind"),
    mUv: document.getElementById("m-uv"),
    mAqi: document.getElementById("m-aqi"),
    aqiBand: document.getElementById("aqi-band"),
    sCloud: document.getElementById("s-cloud"),
    sVisibility: document.getElementById("s-visibility"),
    sPressure: document.getElementById("s-pressure"),
    sWindKph: document.getElementById("s-windkph"),
    sTempF: document.getElementById("s-tempf"),
    sPm25: document.getElementById("s-pm25"),
    sUpdated: document.getElementById("s-updated"),
    tabFormatted: document.getElementById("tab-formatted"),
    tabRaw: document.getElementById("tab-raw"),
    copyBtn: document.getElementById("copy-btn"),
    jsonOutput: document.getElementById("json-output")
  };

  /* ---------- App state ---------- */
  var state = {
    currentCity: "",
    lastData: null,
    view: "formatted",   // "formatted" | "raw"
    requestId: 0         // guards against stale responses overwriting newer results (FR-08)
  };

  /* ================= FR-05: Weather interpretation ================= */

  // Defined thresholds. Priority order handles overlapping conditions:
  // 1) Rain  2) Wind  3) Very hot  4) Very cold  5) Pleasant
  var THRESHOLDS = {
    VERY_HOT_C: 40,     // >= 40 °C
    VERY_COLD_C: 5,     // <= 5 °C
    WINDY_KPH: 30       // > 30 km/h
  };

  var PERSONALITIES = {
    rainCheck: { title: "Rain Check ☔", desc: "Carry an umbrella before stepping out." },
    breeze:     { title: "Breezy Mode 🍃", desc: "Expect strong winds. Dress accordingly." },
    sunAlert:   { title: "Sun Alert ☀️", desc: "Stay hydrated and avoid excessive sun exposure." },
    freeze:     { title: "Freeze Frame ❄️", desc: "Bone-chilling cold. Bundle up tight." },
    perfect:    { title: "Perfect Day 😎", desc: "Great weather to step outside." }
  };

  function isRainy(data) {
    var c = data.current || {};
    var cond = (c.condition && c.condition.text) ? String(c.condition.text).toLowerCase() : "";
    var rainKeywords = ["rain", "drizzle", "shower", "thunder", "storm", "sleet", "snow", "blizzard", "icy"];
    for (var i = 0; i < rainKeywords.length; i++) {
      if (cond.indexOf(rainKeywords[i]) !== -1) return true;
    }
    return (typeof c.precip_mm === "number" && c.precip_mm > 0) ||
           (typeof c.precip_in === "number" && c.precip_in > 0) ||
           (typeof c.humidity === "number" && c.humidity === 100 && cond.indexOf("mist") === -1 && cond.indexOf("fog") === -1 && false);
  }

  function getWeatherPersonality(data) {
    var current = data.current || {};
    var tempC = typeof current.temp_c === "number" ? current.temp_c : null;
    var windKph = typeof current.wind_kph === "number" ? current.wind_kph : null;

    // Priority 1: rainy / snowy conditions
    if (isRainy(data)) return PERSONALITIES.rainCheck;

    // Priority 2: windy conditions
    if (windKph !== null && windKph > THRESHOLDS.WINDY_KPH) return PERSONALITIES.breeze;

    // Priority 3: very hot
    if (tempC !== null && tempC >= THRESHOLDS.VERY_HOT_C) return PERSONALITIES.sunAlert;

    // Priority 4: very cold
    if (tempC !== null && tempC <= THRESHOLDS.VERY_COLD_C) return PERSONALITIES.freeze;

    // Priority 5: pleasant
    return PERSONALITIES.perfect;
  }

  /* ================= Weather themes & city signature colours ================= */

  var THEMES = {
    hot:    { icon: "🔥" },  // red
    warm:   { icon: "☀️" },  // yellow
    cool:   { icon: "🌿" },  // green
    cold:   { icon: "❄️" },  // pink
    rainy:  { icon: "🌧️" },  // storm blue
    windy:  { icon: "💨" },  // violet
    haze:   { icon: "🌫️" },  // smoky grey-amber
    night:  { icon: "🌙" }   // deep indigo
  };

  /* Priority order handles overlapping conditions:
     snow/cold → rain → haze → night → wind → hot → warm → cool → cold */
  function computeTheme(data) {
    var c = data.current || {};
    var tempC = typeof c.temp_c === "number" ? c.temp_c : null;
    var isDay = c.is_day !== 0;
    var cond = (c.condition && c.condition.text) ? String(c.condition.text).toLowerCase() : "";

    // 1) Snow or genuinely cold air → pink frost
    var snowy = cond.indexOf("snow") !== -1 || cond.indexOf("blizzard") !== -1 ||
                cond.indexOf("sleet") !== -1 || cond.indexOf("ice") !== -1;
    if (snowy || (tempC !== null && tempC <= 10)) return "cold";

    // 2) Rain → storm blue
    if (isRainy(data)) return "rainy";

    // 3) Haze / fog / dust / smog → smoky grey-amber
    var hazeWords = ["haze", "mist", "fog", "dust", "smoke", "smog"];
    for (var h = 0; h < hazeWords.length; h++) {
      if (cond.indexOf(hazeWords[h]) !== -1) return "haze";
    }

    // 4) Night → deep indigo (checked after weather conditions, so a rainy
    //    night reads as rainy rather than just dark)
    if (!isDay) return "night";

    // 5) Strong wind → violet
    if (typeof c.wind_kph === "number" && c.wind_kph > THRESHOLDS.WINDY_KPH) return "windy";

    // 6) Temperature buckets — thresholds widened so everyday cities
    //    actually look different (hot red / warm yellow / cool green)
    if (tempC === null) return "warm";
    if (tempC >= 30) return "hot";
    if (tempC >= 20) return "warm";
    if (tempC >= 11) return "cool";
    return "cold";
  }

  /* City signature ("famous") colours — vary the look when the weather
     theme is the same across cities (e.g., Mumbai sea-blue vs Delhi saffron). */
  var CITY_ACCENTS = [
    { match: "mumbai",    accent: "#38bdf8" }, // coastal blue (Gateway of India / sea link)
    { match: "delhi",     accent: "#f59e0b" }, // saffron amber (India Gate sandstone)
    { match: "bengaluru", accent: "#22c55e" }, // garden green (Garden City)
    { match: "bangalore", accent: "#22c55e" },
    { match: "hyderabad", accent: "#a78bfa" }, // pearl violet (City of Pearls)
    { match: "chennai",   accent: "#ef4444" }, // marina red (fort heritage)
    { match: "kolkata",   accent: "#c084fc" }, // purple (City of Joy / tram nostalgia)
    { match: "pune",      accent: "#fb923c" }, // marigold orange (Deccan warmth)
    { match: "ahmedabad", accent: "#ec4899" }, // textile pink (Manchester of India)
    { match: "new york",  accent: "#3b82f6" }, // navy blue (Empire State)
    { match: "london",    accent: "#e11d48" }  // underground red
  ];

  function getCityAccent(city) {
    var name = String(city || "").toLowerCase();
    for (var i = 0; i < CITY_ACCENTS.length; i++) {
      if (name.indexOf(CITY_ACCENTS[i].match) !== -1) return CITY_ACCENTS[i].accent;
    }
    return "#06b6d4"; // default teal
  }

  function applyTheme(theme, city) {
    document.body.setAttribute("data-theme", theme);
    document.documentElement.style.setProperty("--city-accent", getCityAccent(city));
    var iconEl = document.getElementById("brand-icon");
    if (iconEl && THEMES[theme]) iconEl.textContent = THEMES[theme].icon;
  }

  /* ================= City background photo (famous place / skyline) ===== */

  function fetchCityPhoto(city) {
    var key = "skycred:photo:" + String(city).toLowerCase().trim();
    var cached = null;
    try { cached = localStorage.getItem(key); } catch (e) { /* storage unavailable */ }
    if (cached) {
      setBgPhoto(cached);
      return;
    }

    // Free Wikimedia Commons search — no API key, CORS-enabled (origin=*)
    var query = encodeURIComponent(city.trim() + " skyline city");
    var url = "https://commons.wikimedia.org/w/api.php?action=query&generator=search" +
      "&gsrnamespace=6&gsrsearch=" + query + "&gsrlimit=3" +
      "&prop=imageinfo&iiprop=url&iiurlwidth=1600&format=json&origin=*";

    fetch(url)
      .then(function (res) { return res.json(); })
      .then(function (data) {
        var pages = data && data.query && data.query.pages ? data.query.pages : {};
        var found = null;
        for (var id in pages) {
          var info = pages[id].imageinfo && pages[id].imageinfo[0];
          if (info && info.thumburl && /\.(jpe?g|png)(\?|$)/i.test(info.thumburl)) { found = info.thumburl; break; }
        }
        if (found) {
          try { localStorage.setItem(key, found); } catch (e) { /* ignore */ }
          setBgPhoto(found);
        }
      })
      .catch(function () { /* keep gradient-only background */ });
  }

  function setBgPhoto(url) {
    var el = document.getElementById("bg-photo");
    if (el) el.style.backgroundImage = 'url("' + url + '")';
  }

  /* ================= API (FR-10) ================= */

  function buildUrl(city) {
    return CONFIG.WEATHER_API_BASE +
      "?key=" + encodeURIComponent(CONFIG.WEATHER_API_KEY) +
      "&q=" + encodeURIComponent(city) +
      "&aqi=yes"; // enable air-quality data in current.json response
  }

  /**
   * Fetches weather and resolves { ok, data?, rawText?, error? }.
   * Never lets a stale response overwrite a newer one (FR-08).
   */
  function fetchWeather(city) {
    var myId = ++state.requestId;

    return fetch(buildUrl(city))
      .then(function (res) {
        return res.text().then(function (text) {
          var body = null;
          try { body = JSON.parse(text); } catch (e) { /* non-JSON body */ }
          return { status: res.status, ok: res.ok, body: body, rawText: text };
        });
      })
      .then(function (res) {
        if (myId !== state.requestId) return { ok: false, stale: true };

        if (res.ok && res.body && res.body.current) {
          return { ok: true, data: res.body, rawText: res.rawText };
        }

        var err = classifyError(res.status, res.body);
        return { ok: false, error: err };
      })
      .catch(function () {
        if (myId !== state.requestId) return { ok: false, stale: true };
        return { ok: false, error: classifyNetworkError() };
      });
  }

  /* ================= FR-08: Error classification ================= */

  function classifyError(status, body) {
    var code = body && body.error ? body.error.code : null;
    var msg = body && body.error && body.error.message ? body.error.message : "";

    if (code === 1006 || /no matching location/i.test(msg)) {
      return { title: "City not found", message: "We couldn't find \"" + lastSearchedCity() + "\". Please check the spelling and try again." };
    }
    if (code === 1002 || code === 2007 || code === 2008 || code === 10103 || status === 401 || status === 403 && /key/i.test(msg)) {
      return { title: "API configuration error", message: "The WeatherAPI key is missing or invalid. Please verify the key in config.js." };
    }
    if (code === 2009 || status === 429 || /rate limit/i.test(msg)) {
      return { title: "Temporary service error", message: "The weather service is rate limiting requests. Please wait a moment and retry." };
    }
    if (status >= 500) {
      return { title: "Service unavailable", message: "The weather service is currently unavailable. Please try again shortly." };
    }
    if (status >= 400 && msg) {
      return { title: "Weather service error", message: msg };
    }
    return { title: "Unexpected response", message: "We received an unexpected response from the weather service." };
  }

  function classifyNetworkError() {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return { title: "Network unavailable", message: "You appear to be offline. Check your internet connection and retry." };
    }
    return { title: "Network error", message: "We couldn't reach the weather service. Check your connection or try again." };
  }

  var _lastSearched = "";
  function rememberSearchedCity(city) { _lastSearched = city; }
  function lastSearchedCity() { return _lastSearched || state.currentCity || CONFIG.DEFAULT_CITY; }

  /* ================= Rendering ================= */

  function showState(view) {
    // view: "loading" | "error" | "card"
    el.loading.hidden = view !== "loading";
    el.errorState.hidden = view !== "error";
    el.card.hidden = view !== "card";
  }

  function showSearchError(msg) {
    el.searchError.textContent = msg;
    el.searchError.hidden = !msg;
  }

  function renderWeather(data) {
    var c = data.current || {};
    var loc = data.location || {};

    state.lastData = data;

    // Dynamic theme (weather-based colours + city signature accent + photo)
    applyTheme(computeTheme(data), loc.name || lastSearchedCity());
    fetchCityPhoto(loc.name || lastSearchedCity());

    // Location & local time (city timezone, from API)
    el.city.textContent = loc.name + (loc.region ? ", " + loc.region : "") + (loc.country ? ", " + loc.country : "");
    el.localtime.textContent = "Local time: " + (loc.localtime || "—");

    // Condition + icon (from API condition)
    el.condition.textContent = (c.condition && c.condition.text) || "—";
    if (c.condition && c.condition.icon) {
      el.icon.src = "https:" + c.condition.icon;
      el.icon.alt = "Weather icon: " + (c.condition.text || "current conditions");
    } else {
      el.icon.removeAttribute("src");
      el.icon.alt = "";
    }

    // Temperature in Celsius, wind in km/h — all dynamic (FR-04)
    el.temp.textContent = fmt(c.temp_c);
    el.feelslike.textContent = fmt(c.feelslike_c);

    // Personality (FR-05)
    var p = getWeatherPersonality(data);
    el.pTitle.textContent = p.title;
    el.pDesc.textContent = p.desc;

    // Primary metrics (FR-06) + AQI
    el.mHumidity.textContent = fmt(c.humidity);
    el.mWind.textContent = fmt(c.wind_kph);
    el.mUv.textContent = fmt(c.uv);
    renderAqi(c.air_quality);

    // Secondary info (FR-06)
    el.sCloud.textContent = fmt(c.cloud) + " %";
    el.sVisibility.textContent = fmt(c.vis_km) + " km";
    el.sPressure.textContent = fmt(c.pressure_mb) + " mb";
    el.sWindKph.textContent = fmt(c.wind_kph) + " km/h";
    el.sTempF.textContent = fmt(c.temp_f) + " °F";
    el.sPm25.textContent = c.air_quality && typeof c.air_quality.pm2_5 === "number"
      ? c.air_quality.pm2_5.toFixed(1) + " µg/m³" : "—";
    el.sUpdated.textContent = c.last_updated || "—";

    // JSON viewer (FR-07.5)
    renderJson();

    showState("card");
  }

  function fmt(value) {
    return (value === undefined || value === null) ? "—" : String(value);
  }

  /* AQI (US EPA index 1–6) classification */
  var AQI_BANDS = {
    1: "Good", 2: "Moderate", 3: "Unhealthy (Sensitive)",
    4: "Unhealthy", 5: "Very Unhealthy", 6: "Hazardous"
  };

  function renderAqi(airQuality) {
    var idx = airQuality && airQuality["us-epa-index"] ? airQuality["us-epa-index"] : null;
    if (idx && AQI_BANDS[idx]) {
      el.mAqi.textContent = String(idx);
      el.aqiBand.textContent = AQI_BANDS[idx];
      el.aqiBand.setAttribute("data-band", AQI_BANDS[idx]);
      el.aqiBand.hidden = false;
    } else {
      el.mAqi.textContent = "—";
      el.aqiBand.textContent = "Not available";
      el.aqiBand.setAttribute("data-band", "");
      el.aqiBand.hidden = false;
    }
  }

  function showError(err) {
    el.errorTitle.textContent = err.title || "Something went wrong";
    el.errorMessage.textContent = err.message || "";
    showState("error");
  }

  function renderJson() {
    if (!state.lastData) {
      el.jsonOutput.textContent = "Run a search to see the live API response.";
      return;
    }
    if (state.view === "formatted") {
      el.jsonOutput.textContent = JSON.stringify(state.lastData, null, 2);
    } else {
      el.jsonOutput.textContent = JSON.stringify(state.lastData);
    }
  }

  /* ================= Popular cities (FR-03) ================= */

  function buildChips() {
    POPULAR_CITIES.forEach(function (city) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip";
      btn.setAttribute("role", "listitem");
      btn.textContent = city;
      btn.dataset.city = city;
      btn.addEventListener("click", function () { searchCity(city); });
      el.chips.appendChild(btn);
    });
  }

  function highlightChip(city) {
    var chips = el.chips.querySelectorAll(".chip");
    for (var i = 0; i < chips.length; i++) {
      var match = chips[i].dataset.city.toLowerCase() === String(city).toLowerCase();
      chips[i].classList.toggle("active", match);
      if (match) { chips[i].setAttribute("aria-current", "true"); }
      else { chips[i].removeAttribute("aria-current"); }
    }
  }

  function tryHighlightChip(city) {
    var chips = el.chips.querySelectorAll(".chip");
    for (var i = 0; i < chips.length; i++) {
      if (chips[i].dataset.city.toLowerCase() === String(city).toLowerCase()) {
        highlightChip(city);
        return;
      }
    }
    // Not a popular city — clear all highlights (FR-03.4)
    for (var j = 0; j < chips.length; j++) {
      chips[j].classList.remove("active");
      chips[j].removeAttribute("aria-current");
    }
  }

  /* ================= Search orchestration ================= */

  function searchCity(city) {
    var trimmed = String(city || "").trim();

    // FR-02.4: empty input must not trigger an API request
    if (!trimmed) {
      showSearchError("Please enter a city name before searching.");
      return;
    }

    showSearchError("");
    rememberSearchedCity(trimmed);

    // Sync UI immediately
    el.input.value = trimmed;
    tryHighlightChip(trimmed);
    showState("loading"); // FR-01.3 / slow API: loading indicator (FR-08)

    fetchWeather(trimmed).then(function (result) {
      if (result.stale) return; // outdated response — never overwrite newer results

      if (result.ok) {
        renderWeather(result.data);
      } else {
        // FR-08: never show a blank card and never replace valid data with
        // incomplete data — keep showing the previous card if we have one,
        // but always surface the failure to the user.
        if (state.lastData) {
          showState("card");
          showSearchError(result.error.title + " — " + result.error.message);
        } else {
          showError(result.error);
        }
        renderJson();
      }
    });
  }

  /* ================= Events ================= */

  el.form.addEventListener("submit", function (e) {
    e.preventDefault(); // FR-02.3: Enter key triggers search via form submit
    searchCity(el.input.value);
  });

  el.retryBtn.addEventListener("click", function () {
    searchCity(lastSearchedCity());
  });

  // JSON viewer tabs (FR-07.3)
  el.tabFormatted.addEventListener("click", function () { setJsonView("formatted"); });
  el.tabRaw.addEventListener("click", function () { setJsonView("raw"); });

  function setJsonView(view) {
    state.view = view;
    var isFormatted = view === "formatted";
    el.tabFormatted.classList.toggle("active", isFormatted);
    el.tabRaw.classList.toggle("active", !isFormatted);
    el.tabFormatted.setAttribute("aria-selected", String(isFormatted));
    el.tabRaw.setAttribute("aria-selected", String(!isFormatted));
    renderJson();
  }

  // Copy button (FR-07.4)
  el.copyBtn.addEventListener("click", function () {
    if (!state.lastData) return;
    var text = el.jsonOutput.textContent;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        el.copyBtn.textContent = "Copied!";
        setTimeout(function () { el.copyBtn.textContent = "Copy"; }, 1500);
      }).catch(function () {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  });

  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
    el.copyBtn.textContent = "Copied!";
    setTimeout(function () { el.copyBtn.textContent = "Copy"; }, 1500);
  }

  /* ================= Init (FR-01) ================= */

  function init() {
    buildChips();
    document.body.setAttribute("data-theme", "warm"); // pre-fetch theme before data arrives
    el.input.value = CONFIG.DEFAULT_CITY; // search input shows default city
    searchCity(CONFIG.DEFAULT_CITY);      // auto-fetch Mumbai weather on launch
  }

  init();
})();
