// js/mapping_config.js
const AVAILABLE_SENSORS = [
    { id: 'alpha', name: 'Rotation (Alpha)', description: 'Device rotation around Z-axis (0-360°)', typicalMin: 0, typicalMax: 360, unit: '°' },
    { id: 'beta', name: 'Tilt Fwd/Back (Beta)', description: 'Device tilt front/back (-180 to 180° for Android, -90 to 90° for iOS)', typicalMin: -90, typicalMax: 90, unit: '°' },
    { id: 'gamma', name: 'Tilt Left/Right (Gamma)', description: 'Device tilt left/right (-90 to 90°)', typicalMin: -90, typicalMax: 90, unit: '°' },
    { id: 'compassHeading', name: 'Compass Heading', description: 'Device compass heading (0-360°), derived from Alpha.', typicalMin: 0, typicalMax: 360, unit: '°' },
    { id: 'accelX', name: 'Acceleration X', description: 'Linear acceleration along X-axis', typicalMin: -10, typicalMax: 10, unit: 'm/s²' },
    { id: 'accelY', name: 'Acceleration Y', description: 'Linear acceleration along Y-axis', typicalMin: -10, typicalMax: 10, unit: 'm/s²' },
    { id: 'accelZ', name: 'Acceleration Z', description: 'Linear acceleration along Z-axis (excluding gravity)', typicalMin: -10, typicalMax: 10, unit: 'm/s²' },
    { id: 'proximity', name: 'Proximity', description: 'Device proximity to an object (0% = closest, 100% = furthest)', typicalMin: 0, typicalMax: 100, unit: '%' },
    { id: 'micVolume', name: 'Microphone Volume', description: 'Audio input level from microphone (0-100%)', typicalMin: 0, typicalMax: 100, unit: '%' }
];

const AVAILABLE_EFFECTS = [
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
    { id: 'pc_displacement', name: 'PC Displacement', target: 'pointcloud', prop: 'displacementScale', min: 0, max: 360, default: 50, unit: '' },
    { id: 'pc_pointSize', name: 'PC Point Size', target: 'pointcloud', prop: 'pointSize', min: 1, max: 10, default: 3, unit: '' },
    { id: 'pc_density', name: 'PC Density', target: 'pointcloud', prop: 'density', min: 8, max: 256, default: 32, unit: '' } // max increased
];

function getSensorById(id) {
    return AVAILABLE_SENSORS.find(sensor => sensor.id === id);
}

function getEffectById(id) {
    return AVAILABLE_EFFECTS.find(effect => effect.id === id);
}
