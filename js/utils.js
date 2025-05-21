// js/utils.js
const Utils = (function() {
    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
    }

    function handlePlayError(e) {
        console.error("Video play error:", e);
        // Potentially show a user-friendly message
    }

    function loadPlayerSettings(videoPlayer, volumeSlider, brightnessSlider, saturationSlider, contrastSlider) {
        const savedVolume = localStorage.getItem('videoPlayerVolume');
        if (savedVolume) { 
            videoPlayer.volume = parseFloat(savedVolume); 
            volumeSlider.value = parseFloat(savedVolume); 
        }
        
        brightnessSlider.value = localStorage.getItem('videoPlayerBrightness') || 100;
        saturationSlider.value = localStorage.getItem('videoPlayerSaturation') || 100;
        contrastSlider.value = localStorage.getItem('videoPlayerContrast') || 100;
    }

    function saveVideoPlayerSettings(brightnessSlider, saturationSlider, contrastSlider) {
         localStorage.setItem('videoPlayerBrightness', brightnessSlider.value);
         localStorage.setItem('videoPlayerSaturation', saturationSlider.value);
         localStorage.setItem('videoPlayerContrast', contrastSlider.value);
    }
    
    // If you need to apply smoothing in multiple places or make it more generic:
    function applySmoothing(currentValue, newValue, factor) {
        if (factor === 0) return newValue;
        return currentValue * factor + newValue * (1 - factor);
    }


    return {
        formatTime,
        handlePlayError,
        loadPlayerSettings,
        saveVideoPlayerSettings,
        applySmoothing
    };
})();
