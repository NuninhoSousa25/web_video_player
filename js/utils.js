// js/utils.js
const Utils = (function() {
    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
    }

    function handlePlayError(e) {
        console.error("Video play error:", e);
    }

    function loadPlayerSettings(videoPlayer, volumeSlider, brightnessSlider, saturationSlider, contrastSlider, hueSlider) { // Added hueSlider
        const savedVolume = localStorage.getItem('videoPlayerVolume');
        if (savedVolume && volumeSlider) { 
            videoPlayer.volume = parseFloat(savedVolume); 
            volumeSlider.value = parseFloat(savedVolume); 
        }
        
        if(brightnessSlider) brightnessSlider.value = localStorage.getItem('videoPlayerBrightness') || 100;
        if(saturationSlider) saturationSlider.value = localStorage.getItem('videoPlayerSaturation') || 100;
        if(contrastSlider) contrastSlider.value = localStorage.getItem('videoPlayerContrast') || 100;
        if(hueSlider) hueSlider.value = localStorage.getItem('videoPlayerHue') || 0; // Load hue, default 0
    }

    function saveVideoPlayerSettings(brightnessSlider, saturationSlider, contrastSlider, hueSlider) { // Added hueSlider
         if(brightnessSlider) localStorage.setItem('videoPlayerBrightness', brightnessSlider.value);
         if(saturationSlider) localStorage.setItem('videoPlayerSaturation', saturationSlider.value);
         if(contrastSlider) localStorage.setItem('videoPlayerContrast', contrastSlider.value);
         if(hueSlider) localStorage.setItem('videoPlayerHue', hueSlider.value); // Save hue
    }
    
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
