// js/device_detector.js
const DeviceDetector = (function() {
    let deviceType = 'desktop'; // Default
    let capabilities = {
        hasTouch: false,
        hasMotionSensors: false
    };

    // Function to detect the general device type based on User Agent
    function detectDeviceType() {
        const ua = navigator.userAgent;
        if (/(tablet|ipad|playbook|silk)|(android(?!.*mobile))/i.test(ua)) {
            deviceType = 'tablet';
        } else if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
            deviceType = 'mobile';
        } else if (/\b(TV|CrKey|SMART-TV|SmartTV|GoogleTV|HbbTV|NetCast)\b/.test(ua)) {
            deviceType = 'tv';
        } else {
            deviceType = 'desktop';
        }
        console.log(`[DeviceDetector] Detected device type: ${deviceType}`);
    }
    
    // Function to detect specific hardware/API capabilities
    function detectCapabilities() {
        // Detect touch capabilities
        capabilities.hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

        // Detect motion sensor capabilities. 
        // On iOS 13+, permission must be requested, so the existence of the event is a good indicator.
        // On other platforms, its existence is also the primary way to check.
        capabilities.hasMotionSensors = ('DeviceMotionEvent' in window && typeof DeviceMotionEvent.requestPermission === 'function') || ('ondevicemotion' in window);

        console.log(`[DeviceDetector] Capabilities:`, capabilities);
    }
    
    function init() {
        detectDeviceType();
        detectCapabilities();
    }

    return {
        init,
        getDeviceType: () => deviceType,
        getCapabilities: () => capabilities
    };
})();
