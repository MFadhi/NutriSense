import { get } from './client';
import { mockWeather } from './mock/mockAdapter';

const isMock = import.meta.env.VITE_USE_MOCK === 'true';

export const getCurrentWeather = (lat = 18.5204, lon = 73.8567, city = 'Pune') => {
  if (isMock) return mockWeather.getCurrent(lat, lon, city);
  return get(`/weather/current?lat=${lat}&lon=${lon}&city=${encodeURIComponent(city)}`);
};

export const getWeatherRecommendations = (lat = 18.5204, lon = 73.8567, city = 'Pune') => {
  if (isMock) return mockWeather.getRecommendations(lat, lon, city);
  return get(`/weather/recommendations?lat=${lat}&lon=${lon}&city=${encodeURIComponent(city)}`);
};
