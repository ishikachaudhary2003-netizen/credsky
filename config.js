/**
 * SKY CRED — application configuration.
 *
 * NOTE (per PRD security requirement): a frontend API key is NOT a secure
 * secret. WeatherAPI.com keys are safe to expose in a public static site
 * (the key is designed for direct browser calls). For production hardening
 * you would proxy requests through a backend, which is out of scope for
 * this release.
 */
window.CONFIG = {
  WEATHER_API_BASE: "https://api.weatherapi.com/v1/current.json",
  WEATHER_API_KEY: "fa13c3a958db4c948e590725261511",
  DEFAULT_CITY: "Mumbai"
};
