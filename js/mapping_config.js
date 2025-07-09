// js/mapping_config.js - Fixed with correct mobile sensor ranges
const AVAILABLE_SENSORS = [
    // Orientation sensors - updated ranges for mobile devices
    { id: 'alpha', name: 'Rotation (Alpha)', description: 'Device rotation around Z-axis (0-360°)', typicalMin: 0, typicalMax: 360, unit: '°' },
    { id: 'beta', name: 'Tilt Fwd/Back (Beta)', description: 'Device tilt front/back (-180° to 180°)', typicalMin: -180, typicalMax: 180, unit: '°' },
    { id: 'gamma', name: 'Tilt Left/Right (Gamma)', description: 'Device tilt left/right (-90° to 90°)', typicalMin: -90, typicalMax: 90, unit: '°' },
    { id: 'compassHeading', name: 'Compass Heading', description: 'Device compass heading (0-360°), derived from Alpha.', typicalMin: 0, typicalMax: 360, unit: '°' },
    
    // Motion sensors - updated ranges for mobile devices
    { id: 'accelX', name: 'Acceleration X', description: 'Linear acceleration along X-axis', typicalMin: -20, typicalMax: 20, unit: 'm/s²' },
    { id: 'accelY', name: 'Acceleration Y', description: 'Linear acceleration along Y-axis', typicalMin: -20, typicalMax: 20, unit: 'm/s²' },
    { id: 'accelZ', name: 'Acceleration Z', description: 'Linear acceleration along Z-axis (excluding gravity)', typicalMin: -20, typicalMax: 20, unit: 'm/s²' },
    
    // Gyroscope sensors - updated ranges for mobile devices
    { id: 'gyroX', name: 'Gyroscope X', description: 'Angular velocity around X-axis', typicalMin: -20, typicalMax: 20, unit: 'rad/s' },
    { id: 'gyroY', name: 'Gyroscope Y', description: 'Angular velocity around Y-axis', typicalMin: -20, typicalMax: 20, unit: 'rad/s' },
    { id: 'gyroZ', name: 'Gyroscope Z', description: 'Angular velocity around Z-axis', typicalMin: -20, typicalMax: 20, unit: 'rad/s' },
    
    // Gravity sensors - updated ranges for mobile devices
    { id: 'gravityX', name: 'Gravity X', description: 'Gravity force along X-axis', typicalMin: -20, typicalMax: 20, unit: 'm/s²' },
    { id: 'gravityY', name: 'Gravity Y', description: 'Gravity force along Y-axis', typicalMin: -20, typicalMax: 20, unit: 'm/s²' },
    { id: 'gravityZ', name: 'Gravity Z', description: 'Gravity force along Z-axis', typicalMin: -20, typicalMax: 20, unit: 'm/s²' },
    
    // Other sensors - unchanged
    { id: 'proximity', name: 'Proximity', description: 'Distance to nearby objects', typicalMin: 0, typicalMax: 100, unit: 'cm' },
    { id: 'micVolume', name: 'Microphone Volume', description: 'Audio input level from microphone (0-100%)', typicalMin: 0, typicalMax: 100, unit: '%' },
    { id: 'ambientLight', name: 'Ambient Light', description: 'Ambient light level in the environment', typicalMin: 0, typicalMax: 100, unit: '%' },
    { id: 'magneticX', name: 'Magnetic X', description: 'Magnetic field strength along X-axis', typicalMin: -100, typicalMax: 100, unit: 'µT' },
    { id: 'magneticY', name: 'Magnetic Y', description: 'Magnetic field strength along Y-axis', typicalMin: -100, typicalMax: 100, unit: 'µT' },
    { id: 'magneticZ', name: 'Magnetic Z', description: 'Magnetic field strength along Z-axis', typicalMin: -100, typicalMax: 100, unit: 'µT' }
];

const AVAILABLE_EFFECTS = [
    // Video effects
    { id: 'brightness', name: 'Brightness', target: 'player', prop: 'brightness', min: 0, max: 300, default: 100, unit: '%', isFilter: true },
    { id: 'contrast', name: 'Contrast', target: 'player', prop: 'contrast', min: 0, max: 300, default: 100, unit: '%', isFilter: true },
    { id: 'saturation', name: 'Saturation', target: 'player', prop: 'saturate', min: 0, max: 300, default: 100, unit: '%', isFilter: true },
    { id: 'hue', name: 'Hue Rotate', target: 'player', prop: 'hue-rotate', min: 0, max: 360, default: 0, unit: 'deg', isFilter: true },
    { id: 'blur', name: 'Blur', target: 'player', prop: 'blur', min: 0, max: 20, default: 0, unit: 'px', isFilter: true },
    { id: 'sepia', name: 'Sepia', target: 'player', prop: 'sepia', min: 0, max: 100, default: 0, unit: '%', isFilter: true },
    { id: 'grayscale', name: 'Grayscale', target: 'player', prop: 'grayscale', min: 0, max: 100, default: 0, unit: '%', isFilter: true },
    { id: 'invertColors', name: 'Invert Colors', target: 'player', prop: 'invert', min: 0, max: 100, default: 0, unit: '%', isFilter: true },
    { id: 'playbackRate', name: 'Playback Speed', target: 'player', prop: 'playbackRate', min: 0.25, max: 4, default: 1, unit: 'x' },
    { id: 'volume', name: 'Volume', target: 'player', prop: 'volume', min: 0, max: 1, default: 1, unit: '' },
    
    // Artistic Effects
    { id: 'pixelSort', name: '🎨 Pixel Sort', target: 'artistic', prop: 'pixelSort', min: 0, max: 100, default: 0, unit: '%' },
    { id: 'digitalGlitch', name: '🎨 Digital Glitch', target: 'artistic', prop: 'digitalGlitch', min: 0, max: 100, default: 0, unit: '%' },
    { id: 'chromaShift', name: '🎨 Chroma Shift', target: 'artistic', prop: 'chromaShift', min: 0, max: 100, default: 0, unit: '%' },
    { id: 'kaleidoscope', name: '🎨 Kaleidoscope', target: 'artistic', prop: 'kaleidoscope', min: 0, max: 100, default: 0, unit: '%' },
    { id: 'colorQuantize', name: '🎨 Color Quantize', target: 'artistic', prop: 'colorQuantize', min: 0, max: 100, default: 0, unit: '%' },
    { id: 'noiseOverlay', name: '🎨 Noise Overlay', target: 'artistic', prop: 'noiseOverlay', min: 0, max: 100, default: 0, unit: '%' }
];

function getSensorById(id) {
    return AVAILABLE_SENSORS.find(sensor => sensor.id === id);
}

function getEffectById(id) {
    return AVAILABLE_EFFECTS.find(effect => effect.id === id);
}

// Helper function to get effects by category
function getEffectsByTarget(target) {
    return AVAILABLE_EFFECTS.filter(effect => effect.target === target);
}

// Get artistic effects specifically
function getArtisticEffects() {
    return AVAILABLE_EFFECTS.filter(effect => effect.target === 'artistic');
}

// NEW: Mobile-optimized default mappings with appropriate ranges
const DEFAULT_MOBILE_MAPPINGS = [
    // Orientation-based mappings (work well on mobile)
    { sensorId: 'beta', effectId: 'brightness', sensitivity: 1.0, rangeMin: 50, rangeMax: 200, invert: false },
    { sensorId: 'gamma', effectId: 'contrast', sensitivity: 1.0, rangeMin: 50, rangeMax: 200, invert: false },
    { sensorId: 'alpha', effectId: 'hue', sensitivity: 1.0, rangeMin: 0, rangeMax: 360, invert: false },
    
    // Motion-based mappings (responsive on mobile)
    { sensorId: 'accelX', effectId: 'saturation', sensitivity: 2.0, rangeMin: 0, rangeMax: 200, invert: false },
    { sensorId: 'accelY', effectId: 'sepia', sensitivity: 1.5, rangeMin: 0, rangeMax: 50, invert: false },
    { sensorId: 'accelZ', effectId: 'blur', sensitivity: 1.5, rangeMin: 0, rangeMax: 5, invert: false },
    
    // Gyroscope-based artistic effects
    { sensorId: 'gyroX', effectId: 'pixelSort', sensitivity: 3.0, rangeMin: 0, rangeMax: 80, invert: false },
    { sensorId: 'gyroY', effectId: 'digitalGlitch', sensitivity: 2.5, rangeMin: 0, rangeMax: 60, invert: false },
    { sensorId: 'gyroZ', effectId: 'chromaShift', sensitivity: 2.0, rangeMin: 0, rangeMax: 40, invert: false }
];

// Default artistic effect mappings for quick setup
const DEFAULT_ARTISTIC_MAPPINGS = [
    { sensorId: 'gyroX', effectId: 'pixelSort', sensitivity: 2.0, rangeMin: 0, rangeMax: 80 },
    { sensorId: 'gyroY', effectId: 'digitalGlitch', sensitivity: 1.5, rangeMin: 0, rangeMax: 60 },
    { sensorId: 'micVolume', effectId: 'noiseOverlay', sensitivity: 1.0, rangeMin: 0, rangeMax: 100 },
    { sensorId: 'alpha', effectId: 'kaleidoscope', sensitivity: 0.8, rangeMin: 0, rangeMax: 100 },
    { sensorId: 'beta', effectId: 'chromaShift', sensitivity: 1.2, rangeMin: 0, rangeMax: 50 },
    { sensorId: 'gamma', effectId: 'colorQuantize', sensitivity: 1.0, rangeMin: 0, rangeMax: 40 }
];

// NEW: Function to get mobile-optimized mappings
function getMobileOptimizedMappings() {
    return DEFAULT_MOBILE_MAPPINGS;
}

// NEW: Function to validate sensor ranges for mobile
function validateSensorRangeForMobile(sensorId, value) {
    const sensor = getSensorById(sensorId);
    if (!sensor) return false;
    
    // Check if value is within expected mobile range
    return value >= sensor.typicalMin && value <= sensor.typicalMax;
}

// NEW: Function to normalize sensor value for mobile devices
function normalizeSensorValueForMobile(sensorId, value) {
    const sensor = getSensorById(sensorId);
    if (!sensor) return 0;
    
    // Clamp value to expected range
    const clampedValue = Math.max(sensor.typicalMin, Math.min(sensor.typicalMax, value));
    
    // Normalize to 0-1 range
    const range = sensor.typicalMax - sensor.typicalMin;
    if (range === 0) return 0;
    
    return (clampedValue - sensor.typicalMin) / range;
}
