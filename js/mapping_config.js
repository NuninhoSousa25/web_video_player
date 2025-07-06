// js/mapping_config.js - Updated with Artistic Effects
const AVAILABLE_SENSORS = [
    { id: 'alpha', name: 'Rotation (Alpha)', description: 'Device rotation around Z-axis (0-360°)', typicalMin: 0, typicalMax: 360, unit: '°' },
    { id: 'beta', name: 'Tilt Fwd/Back (Beta)', description: 'Device tilt front/back (-180 to 180° for Android, -90 to 90° for iOS)', typicalMin: -90, typicalMax: 90, unit: '°' },
    { id: 'gamma', name: 'Tilt Left/Right (Gamma)', description: 'Device tilt left/right (-90 to 90°)', typicalMin: -90, typicalMax: 90, unit: '°' },
    { id: 'compassHeading', name: 'Compass Heading', description: 'Device compass heading (0-360°), derived from Alpha.', typicalMin: 0, typicalMax: 360, unit: '°' },
    { id: 'accelX', name: 'Acceleration X', description: 'Linear acceleration along X-axis', typicalMin: -10, typicalMax: 10, unit: 'm/s²' },
    { id: 'accelY', name: 'Acceleration Y', description: 'Linear acceleration along Y-axis', typicalMin: -10, typicalMax: 10, unit: 'm/s²' },
    { id: 'accelZ', name: 'Acceleration Z', description: 'Linear acceleration along Z-axis (excluding gravity)', typicalMin: -10, typicalMax: 10, unit: 'm/s²' },
    { id: 'proximity', name: 'Proximity', description: 'Distance to nearby objects', typicalMin: 0, typicalMax: 100, unit: 'cm' },
    { id: 'micVolume', name: 'Microphone Volume', description: 'Audio input level from microphone (0-100%)', typicalMin: 0, typicalMax: 100, unit: '%' },
    { id: 'gyroX', name: 'Gyroscope X', description: 'Angular velocity around X-axis', typicalMin: -10, typicalMax: 10, unit: 'rad/s' },
    { id: 'gyroY', name: 'Gyroscope Y', description: 'Angular velocity around Y-axis', typicalMin: -10, typicalMax: 10, unit: 'rad/s' },
    { id: 'gyroZ', name: 'Gyroscope Z', description: 'Angular velocity around Z-axis', typicalMin: -10, typicalMax: 10, unit: 'rad/s' },
    { id: 'gravityX', name: 'Gravity X', description: 'Gravity force along X-axis', typicalMin: -10, typicalMax: 10, unit: 'm/s²' },
    { id: 'gravityY', name: 'Gravity Y', description: 'Gravity force along Y-axis', typicalMin: -10, typicalMax: 10, unit: 'm/s²' },
    { id: 'gravityZ', name: 'Gravity Z', description: 'Gravity force along Z-axis', typicalMin: -10, typicalMax: 10, unit: 'm/s²' },
    { id: 'ambientLight', name: 'Ambient Light', description: 'Ambient light level in the environment', typicalMin: 0, typicalMax: 100, unit: '%' },
    { id: 'magneticX', name: 'Magnetic X', description: 'Magnetic field strength along X-axis', typicalMin: -100, typicalMax: 100, unit: 'µT' },
    { id: 'magneticY', name: 'Magnetic Y', description: 'Magnetic field strength along Y-axis', typicalMin: -100, typicalMax: 100, unit: 'µT' },
    { id: 'magneticZ', name: 'Magnetic Z', description: 'Magnetic field strength along Z-axis', typicalMin: -100, typicalMax: 100, unit: 'µT' }
];

const AVAILABLE_EFFECTS = [
    // Original video effects
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
    
    // Point cloud effects
    { id: 'pc_displacement', name: 'PC Displacement', target: 'pointcloud', prop: 'displacementScale', min: 0, max: 360, default: 50, unit: '' },
    { id: 'pc_pointSize', name: 'PC Point Size', target: 'pointcloud', prop: 'pointSize', min: 1, max: 10, default: 3, unit: '' },
    { id: 'pc_density', name: 'PC Density', target: 'pointcloud', prop: 'density', min: 8, max: 256, default: 32, unit: '' },
    
    // NEW: Simple Artistic Effects (that actually work!)
    { id: 'pixelSort', name: '🎨 Pixel Sort', target: 'artistic', prop: 'pixelSort', min: 0, max: 100, default: 0, unit: '%' },
    { id: 'digitalGlitch', name: '🎨 Digital Glitch', target: 'artistic', prop: 'digitalGlitch', min: 0, max: 100, default: 0, unit: '%' },
    { id: 'chromaShift', name: '🎨 Chroma Shift', target: 'artistic', prop: 'chromaShift', min: 0, max: 100, default: 0, unit: '%' },
    { id: 'kaleidoscope', name: '🎨 Kaleidoscope', target: 'artistic', prop: 'kaleidoscope', min: 0, max: 100, default: 0, unit: '%' },
    { id: 'colorQuantize', name: '🎨 Color Quantize', target: 'artistic', prop: 'colorQuantize', min: 0, max: 100, default: 0, unit: '%' },
    { id: 'noiseOverlay', name: '🎨 Noise Overlay', target: 'artistic', prop: 'noiseOverlay', min: 0, max: 100, default: 0, unit: '%' }
]; 'noiseSpeed', name: '🎨 Noise Animation', target: 'artistic', prop: 'noiseSpeed', min: 0, max: 10, default: 1, unit: '', 
      description: 'Speed of noise animation' },
    
    // NEW: Color Displacement
    { id: 'chromaShift', name: '🎨 Chroma Shift', target: 'artistic', prop: 'chromaShift', min: 0, max: 100, default: 0, unit: '%', 
      description: 'RGB channel displacement for glitch effect' },
    { id: 'chromaAngle', name: '🎨 Chroma Angle', target: 'artistic', prop: 'chromaAngle', min: 0, max: 360, default: 0, unit: '°', 
      description: 'Direction of color channel shift' },
    { id: 'chromaDistance', name: '🎨 Chroma Distance', target: 'artistic', prop: 'chromaDistance', min: 1, max: 50, default: 10, unit: 'px', 
      description: 'Distance of color separation' },
    
    // NEW: Flow Field
    { id: 'flowField', name: '🎨 Flow Field', target: 'artistic', prop: 'flowField', min: 0, max: 100, default: 0, unit: '%', 
      description: 'Organic flowing distortion field' },
    { id: 'flowResolution', name: '🎨 Flow Resolution', target: 'artistic', prop: 'flowResolution', min: 5, max: 50, default: 20, unit: '', 
      description: 'Resolution of flow field grid' },
    { id: 'flowSpeed', name: '🎨 Flow Speed', target: 'artistic', prop: 'flowSpeed', min: 0, max: 5, default: 1, unit: '', 
      description: 'Animation speed of flow field' },
    
    // NEW: Voronoi Cells
    { id: 'voronoi', name: '🎨 Voronoi Cells', target: 'artistic', prop: 'voronoi', min: 0, max: 100, default: 0, unit: '%', 
      description: 'Cellular pattern overlay' },
    { id: 'voronoiCells', name: '🎨 Voronoi Cell Count', target: 'artistic', prop: 'voronoiCells', min: 10, max: 200, default: 50, unit: '', 
      description: 'Number of Voronoi cells' },
    { id: 'voronoiColorMode', name: '🎨 Voronoi Color Mode', target: 'artistic', prop: 'voronoiColorMode', min: 0, max: 3, default: 0, unit: '', 
      description: 'Color mode: 0=original, 1=random, 2=distance, 3=index' },
    
    // NEW: Audio-Reactive Artistic Effects
    { id: 'audioPixelSort', name: '🎵 Audio Pixel Sort', target: 'artistic', prop: 'audioPixelSort', min: 0, max: 100, default: 0, unit: '%', 
      description: 'Audio-reactive pixel sorting intensity' },
    { id: 'audioGlitch', name: '🎵 Audio Glitch', target: 'artistic', prop: 'audioGlitch', min: 0, max: 100, default: 0, unit: '%', 
      description: 'Audio-reactive digital glitch' },
    { id: 'audioDistortion', name: '🎵 Audio Distortion', target: 'artistic', prop: 'audioDistortion', min: 0, max: 100, default: 0, unit: '%', 
      description: 'Audio-reactive image distortion' }
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

// Default artistic effect mappings for quick setup
const DEFAULT_ARTISTIC_MAPPINGS = [
    { sensorId: 'gyroX', effectId: 'pixelSort', sensitivity: 2.0, rangeMin: 0, rangeMax: 80 },
    { sensorId: 'gyroY', effectId: 'digitalGlitch', sensitivity: 1.5, rangeMin: 0, rangeMax: 60 },
    { sensorId: 'micVolume', effectId: 'audioPixelSort', sensitivity: 1.0, rangeMin: 0, rangeMax: 100 },
    { sensorId: 'alpha', effectId: 'kaleidoscope', sensitivity: 0.8, rangeMin: 0, rangeMax: 100 },
    { sensorId: 'beta', effectId: 'chromaShift', sensitivity: 1.2, rangeMin: 0, rangeMax: 50 },
    { sensorId: 'gamma', effectId: 'datamosh', sensitivity: 1.0, rangeMin: 0, rangeMax: 40 },
    { sensorId: 'proximity', effectId: 'flowField', sensitivity: 0.5, rangeMin: 0, rangeMax: 70 }
];
