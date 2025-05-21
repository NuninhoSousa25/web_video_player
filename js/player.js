// js/player.js
const Player = (function() {
    let videoPlayer, mainVideoContainer, videoPlaceholder, videoPlayerControls, videoFilterControls,
        playPauseBtn, loopBtn, fileInput, fileName, progressBar, mainProgressContainer,
        currentTimeEl, durationEl, volumeSlider, loopInfo, brightnessSlider, saturationSlider,
        contrastSlider, hueSlider, // Added hueSlider
        brightnessValue, saturationValue, contrastValue, hueValue, // Added hueValue
        resetFiltersBtn, videoFullscreenBtn, fullscreenControlsOverlay, progressBarFullscreen,
        playPauseFullscreen, exitVideoFullscreenBtn, fullscreenProgressContainer;

    let isLooping = true;
    let loopCount = 0;
    let currentFilterStyles = {}; 
    let lastVideoTap = 0;

    let currentModeGetter = () => 'videoPlayer'; 
    let pointCloudModuleRef; 

    function cacheDOMElements() {
        videoPlayer = document.getElementById('videoPlayer');
        mainVideoContainer = document.getElementById('mainVideoContainer');
        videoPlaceholder = document.getElementById('videoPlaceholder');
        videoPlayerControls = document.getElementById('videoPlayerControls');
        videoFilterControls = document.getElementById('videoFilterControls');
        playPauseBtn = document.getElementById('playPauseBtn');
        loopBtn = document.getElementById('loopBtn');
        fileInput = document.getElementById('fileInput');
        fileName = document.getElementById('fileName');
        progressBar = document.getElementById('progressBar');
        mainProgressContainer = document.getElementById('mainProgressContainer');
        currentTimeEl = document.getElementById('currentTime');
        durationEl = document.getElementById('duration');
        volumeSlider = document.getElementById('volumeSlider');
        loopInfo = document.getElementById('loopInfo');
        brightnessSlider = document.getElementById('brightnessSlider');
        saturationSlider = document.getElementById('saturationSlider');
        contrastSlider = document.getElementById('contrastSlider');
        hueSlider = document.getElementById('hueSlider'); // Cache hueSlider
        brightnessValue = document.getElementById('brightnessValue');
        saturationValue = document.getElementById('saturationValue');
        contrastValue = document.getElementById('contrastValue');
        hueValue = document.getElementById('hueValue'); // Cache hueValue
        resetFiltersBtn = document.getElementById('resetFiltersBtn');
        videoFullscreenBtn = document.getElementById('videoFullscreenBtn');
        fullscreenControlsOverlay = document.getElementById('fullscreenControlsOverlay');
        progressBarFullscreen = document.getElementById('progressBarFullscreen');
        playPauseFullscreen = document.getElementById('playPauseFullscreen');
        exitVideoFullscreenBtn = document.getElementById('exitVideoFullscreenBtn');
        fullscreenProgressContainer = fullscreenControlsOverlay.querySelector('.progress-container');
    }
    
    function applyCombinedVideoFilters() {
        let filterString = "";
        AVAILABLE_EFFECTS.forEach(effect => {
            if (effect.isFilter && currentFilterStyles[effect.id] !== undefined) {
                if ((effect.id === 'blur' && currentFilterStyles[effect.id] === 0) ||
                    (effect.id === 'hue' && currentFilterStyles[effect.id] === 0) || // Updated to use effect.id
                    (effect.id === 'sepia' && currentFilterStyles[effect.id] === 0) ||
                    (effect.id === 'grayscale' && currentFilterStyles[effect.id] === 0) ||
                    (effect.id === 'invertColors' && currentFilterStyles[effect.id] === 0)
                ) {
                    // Don't add to filter string
                } else {
                    filterString += `${effect.prop}(${currentFilterStyles[effect.id]}${effect.unit}) `;
                }
            }
        });
        videoPlayer.style.filter = filterString.trim();
        UI.updateActiveMappingIndicators(); // Call this after applying filters
    }

    function setEffect(effectId, value) {
        const effectDetails = getEffectById(effectId);
        if (!effectDetails || effectDetails.target !== 'player') return;

        if (effectDetails.isFilter) {
            currentFilterStyles[effectId] = value;
            applyCombinedVideoFilters();
            
            if (effectId === 'brightness' && brightnessSlider) brightnessSlider.value = value;
            else if (effectId === 'saturation' && saturationSlider) saturationSlider.value = value;
            else if (effectId === 'contrast' && contrastSlider) contrastSlider.value = value;
            else if (effectId === 'hue' && hueSlider) hueSlider.value = value; // Update hue slider
            
            if (brightnessValue) UI.updateFilterDisplayValues(
                brightnessSlider, saturationSlider, contrastSlider, hueSlider, // Pass hueSlider
                brightnessValue, saturationValue, contrastValue, hueValue // Pass hueValue
            );
        } else if (effectDetails.prop === 'playbackRate') {
            videoPlayer.playbackRate = Math.max(effectDetails.min, Math.min(effectDetails.max, value));
             UI.updateActiveMappingIndicators(); // Update indicators if playbackRate is mapped
        } else if (effectDetails.prop === 'volume') {
            videoPlayer.volume = Math.max(effectDetails.min, Math.min(effectDetails.max, value));
            if (volumeSlider) volumeSlider.value = videoPlayer.volume;
             UI.updateActiveMappingIndicators(); // Update indicators if volume is mapped
        }
    }

    function loadInitialPlayerEffects() {
        Utils.loadPlayerSettings(videoPlayer, volumeSlider, brightnessSlider, saturationSlider, contrastSlider, hueSlider); // Pass hueSlider
        
        setEffect('brightness', parseFloat(brightnessSlider.value));
        setEffect('saturation', parseFloat(saturationSlider.value));
        setEffect('contrast', parseFloat(contrastSlider.value));
        setEffect('hue', parseFloat(hueSlider.value)); // Load initial hue
        setEffect('volume', parseFloat(volumeSlider.value));
        
        AVAILABLE_EFFECTS.forEach(eff => {
            if (eff.target === 'player' && currentFilterStyles[eff.id] === undefined && eff.prop !== 'volume' && eff.prop !== 'playbackRate') {
                if (eff.isFilter) setEffect(eff.id, eff.default);
            }
        });
        
        if (videoPlayer.playbackRate === 1) {
            setEffect('playbackRate', getEffectById('playbackRate').default);
        }
        applyCombinedVideoFilters(); // Ensure indicators are updated on load
    }

    function togglePlayPause() {
        if (videoPlayer.paused || videoPlayer.ended) {
            videoPlayer.play().catch(Utils.handlePlayError);
        } else {
            videoPlayer.pause();
        }
    }

    function seekVideo(event, progressContainerElement) {
        if (!videoPlayer.duration) return;
        const progressContainerWidth = progressContainerElement.offsetWidth;
        const clickPosition = event.offsetX;
        const seekTime = (clickPosition / progressContainerWidth) * videoPlayer.duration;
        videoPlayer.currentTime = seekTime;
    }
    
    function toggleVideoFullscreen() {
        if (!mainVideoContainer.classList.contains('fullscreen')) enterVideoFullscreenMode();
        else exitVideoFullscreenMode();
    }

    function enterVideoFullscreenMode() {
        mainVideoContainer.classList.add('fullscreen');
        document.body.style.overflow = 'hidden';
        videoFullscreenBtn.textContent = 'Exit Full';
        UI.showVideoFullscreenControlsBriefly(fullscreenControlsOverlay);
        if (mainVideoContainer.requestFullscreen) mainVideoContainer.requestFullscreen().catch(err => console.error("FS Error:", err));
    }

    function exitVideoFullscreenMode() {
        mainVideoContainer.classList.remove('fullscreen');
        document.body.style.overflow = '';
        videoFullscreenBtn.textContent = 'Fullscreen';
        fullscreenControlsOverlay.classList.remove('active');
        if (document.exitFullscreen) document.exitFullscreen().catch(err => console.error("Exit FS Error:", err));
    }
    
    function setupEventListeners() {
        fileInput.addEventListener('change', function() {
            const file = this.files[0];
            if (file) {
                const videoURL = URL.createObjectURL(file);
                videoPlayer.src = videoURL;
                fileName.textContent = file.name;
                
                videoPlayer.loop = isLooping;
                loopCount = 0;
                UI.updateLoopInfo(loopInfo, videoPlayer, loopCount);
                UI.updateLoopButton(loopBtn, isLooping);
                
                videoPlaceholder.classList.add('hidden');
                if (currentModeGetter() === 'videoPlayer') {
                    videoPlayerControls.classList.remove('hidden');
                    videoFilterControls.classList.remove('hidden');
                }
            }
        });

        videoPlayer.addEventListener('loadedmetadata', function() {
            durationEl.textContent = Utils.formatTime(videoPlayer.duration);
            if (currentModeGetter() === 'pointCloud' && pointCloudModuleRef) { 
                pointCloudModuleRef.setupCanvasDimensions();
            }
            if (videoPlayer.src && videoPlayer.paused) {
               videoPlayer.play().catch(Utils.handlePlayError);
            }
        });

        playPauseBtn.addEventListener('click', togglePlayPause);
        playPauseFullscreen.addEventListener('click', togglePlayPause);

        loopBtn.addEventListener('click', function() {
            isLooping = !isLooping;
            videoPlayer.loop = isLooping;
            UI.updateLoopButton(loopBtn, isLooping);
            UI.updateLoopInfo(loopInfo, videoPlayer, loopCount);
            if (!isLooping) loopCount = 0; 
        });

        videoPlayer.addEventListener('timeupdate', function() {
            if (!videoPlayer.duration) return;
            const percentage = (videoPlayer.currentTime / videoPlayer.duration) * 100;
            progressBar.style.width = percentage + '%';
            progressBarFullscreen.style.width = percentage + '%';
            currentTimeEl.textContent = Utils.formatTime(videoPlayer.currentTime);
        });

        mainProgressContainer.addEventListener('click', (e) => seekVideo(e, mainProgressContainer));
        if(fullscreenProgressContainer) { 
             fullscreenProgressContainer.addEventListener('click', (e) => seekVideo(e, fullscreenProgressContainer));
        }
        
        volumeSlider.addEventListener('input', function() {
            setEffect('volume', parseFloat(this.value));
            localStorage.setItem('videoPlayerVolume', this.value);
        });
        
        videoPlayer.addEventListener('ended', function() {
            if (videoPlayer.loop) {
                loopCount++;
                UI.updateLoopInfo(loopInfo, videoPlayer, loopCount);
            } else {
                UI.updatePlayPauseButtons(playPauseBtn, playPauseFullscreen, false);
            }
        });
        
        videoPlayer.addEventListener('play', () => { 
            UI.updatePlayPauseButtons(playPauseBtn, playPauseFullscreen, true);
            if (currentModeGetter() === 'pointCloud' && pointCloudModuleRef) pointCloudModuleRef.startRendering();
        });
        videoPlayer.addEventListener('pause', () => {
            UI.updatePlayPauseButtons(playPauseBtn, playPauseFullscreen, false);
        });

        brightnessSlider.addEventListener('input', () => {
            setEffect('brightness', parseFloat(brightnessSlider.value));
            localStorage.setItem('videoPlayerBrightness', brightnessSlider.value);
        });
        
        saturationSlider.addEventListener('input', () => {
            setEffect('saturation', parseFloat(saturationSlider.value));
            localStorage.setItem('videoPlayerSaturation', saturationSlider.value);
        });
        
        contrastSlider.addEventListener('input', () => {
            setEffect('contrast', parseFloat(contrastSlider.value));
            localStorage.setItem('videoPlayerContrast', contrastSlider.value);
        });

        hueSlider.addEventListener('input', () => { // Event listener for hueSlider
            setEffect('hue', parseFloat(hueSlider.value));
            localStorage.setItem('videoPlayerHue', hueSlider.value);
        });
        
        resetFiltersBtn.addEventListener('click', function() {
            // Reset all filters that have UI sliders
            AVAILABLE_EFFECTS.forEach(eff => {
                if (eff.isFilter && eff.target === 'player') {
                    const slider = document.getElementById(eff.id + 'Slider'); // e.g. brightnessSlider
                    if (slider) { // Check if a slider exists for this filter
                         setEffect(eff.id, eff.default);
                         slider.value = eff.default;
                    } else if (currentFilterStyles.hasOwnProperty(eff.id)) { // If no slider but was set by mapping
                        setEffect(eff.id, eff.default); // Reset to default
                    }
                }
            });
            
            UI.updateFilterDisplayValues(
                brightnessSlider, saturationSlider, contrastSlider, hueSlider,
                brightnessValue, saturationValue, contrastValue, hueValue
            );
            Utils.saveVideoPlayerSettings(brightnessSlider, saturationSlider, contrastSlider, hueSlider);
            applyCombinedVideoFilters(); // Re-apply and update indicators
        });

        videoPlayer.addEventListener('touchend', (e) => {
            if (currentModeGetter() !== 'videoPlayer') return;
            const currentTime = new Date().getTime();
            if (currentTime - lastVideoTap < 500) { toggleVideoFullscreen(); e.preventDefault(); }
            lastVideoTap = currentTime;
        });
        videoPlayer.addEventListener('dblclick', () => { if (currentModeGetter() === 'videoPlayer') toggleVideoFullscreen(); });
        videoFullscreenBtn.addEventListener('click', toggleVideoFullscreen);
        exitVideoFullscreenBtn.addEventListener('click', exitVideoFullscreenMode);
        
        videoPlayer.addEventListener('touchstart', () => {
            if (mainVideoContainer.classList.contains('fullscreen')) UI.showVideoFullscreenControlsBriefly(fullscreenControlsOverlay);
        });
    }

    function init(modeGetter, pcModule) {
        currentModeGetter = modeGetter;
        pointCloudModuleRef = pcModule;
        cacheDOMElements();
        setupEventListeners();
        loadInitialPlayerEffects(); // This now includes applyCombinedVideoFilters
        UI.updateFilterDisplayValues( // Ensure this uses all relevant sliders/values
            brightnessSlider, saturationSlider, contrastSlider, hueSlider,
            brightnessValue, saturationValue, contrastValue, hueValue
        );
        UI.updateLoopButton(loopBtn, isLooping);
    }

    return {
        init,
        setEffect,
        getVideoElement: () => videoPlayer,
        getMainVideoContainer: () => mainVideoContainer,
        toggleVideoFullscreen,
        enterVideoFullscreenMode,
        exitVideoFullscreenMode,
        resetFilters: () => {
            resetFiltersBtn.click();
        },
        getDOM: () => ({
            videoPlayerControls, 
            videoFilterControls,
            videoPlaceholder
        }),
        // Expose for UI module to check which effects are applied by player itself
        isFilterApplied: (effectId) => currentFilterStyles.hasOwnProperty(effectId) && currentFilterStyles[effectId] !== getEffectById(effectId)?.default,
        isEffectActive: (effectId) => { // More generic check
            const effect = getEffectById(effectId);
            if (!effect) return false;
            if (effect.isFilter) {
                 return currentFilterStyles.hasOwnProperty(effectId) && currentFilterStyles[effectId] !== effect.default;
            } else if (effect.prop === 'volume') {
                return videoPlayer.volume !== effect.default;
            } else if (effect.prop === 'playbackRate') {
                return videoPlayer.playbackRate !== effect.default;
            }
            return false;
        }
    };
})();
