// Mock implementation of the geolocation API for browser environment
const mockGeolocation = {
  getCurrentPosition: (success: PositionCallback, error?: PositionErrorCallback, options?: PositionOptions) => {
    if (success) {
      const coords = {
        latitude: 51.1,
        longitude: 45.3,
        accuracy: 1,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
        toJSON: () => ({
          latitude: 51.1,
          longitude: 45.3,
          accuracy: 1,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null
        })
      };
      
      const position = {
        coords,
        timestamp: Date.now(),
        toJSON: () => ({
          coords: {
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: coords.accuracy,
            altitude: coords.altitude,
            altitudeAccuracy: coords.altitudeAccuracy,
            heading: coords.heading,
            speed: coords.speed
          },
          timestamp: Date.now()
        })
      };
      
      success(position as GeolocationPosition);
    }
    return Promise.resolve();
  },
  watchPosition: (success: PositionCallback, error?: PositionErrorCallback, options?: PositionOptions) => {
    return 1; // Return a watchId
  },
  clearWatch: (watchId: number) => {}
};

// Only add to global if we're in a browser environment
if (typeof window !== 'undefined') {
  // @ts-ignore - We're intentionally overriding the geolocation for testing
  window.navigator.geolocation = mockGeolocation;
}

export { mockGeolocation };
export default mockGeolocation;
