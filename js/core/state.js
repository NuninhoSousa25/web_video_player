// js/core/state.js
export const appState = {
    currentMode: 'videoPlayer', // 'videoPlayer' or 'pointCloud'
    sensorsGloballyEnabled: false,
    activeSensorTypes: {
        orientation: false, light: false, mic: false, motion: false, gyroscope: false
    },
    sensorStatusMessages: [], // For detailed feedback
    calibrationValues: { alpha: 0, beta: 0, gamma: 0 },
    currentRawSensorValues: {
        alpha: null, beta: null, gamma: null,
        light: null, mic: null,
        accelXg: null, accelYg: null, accelZg: null,
        accelX: null, accelY: null, accelZ: null,
        gyroX: null, gyroY: null, gyroZ: null,
    },
    lastVideoFilterValues: { brightness: 100, saturation: 100, contrast: 100, hue: 0, blur: 0 },
    pointCloudConfig: { density: 32, displacementScale: 50, pointSize: 3, tiltSensitivity: 10 },
    activeMappings: [],
    nextMappingId: 1,
    isLooping: true,
    loopCount: 0,
    // Sensor specific instances/data
    audioContext: null, micSource: null, analyserNode: null, micDataArray: null, micProcessingInterval: null,
    lightSensorInstance: null,
    gyroscopeSensorInstance: null,
    // Point cloud specific
    pointCloudCtx: null,
    pointCloudAnimationFrameId: null,
    tempCanvas: document.createElement('canvas'), 
    tempCtx: null, // Will be initialized later
    pointCloudTiltAngles: { beta: 0, gamma: 0 } // For point cloud internal tilt control if not mapped
};
// Initialize tempCtx for point cloud if canvas is always available
if (appState.tempCanvas.getContext) {
    appState.tempCtx = appState.tempCanvas.getContext('2d', { willReadFrequently: true });
}