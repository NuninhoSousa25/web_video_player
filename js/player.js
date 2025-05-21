// js/player.js
const Player = (function() {
    let videoPlayer, mainVideoContainer, videoPlaceholder, videoPlayerControls, videoFilterControls,
        playPauseBtn, loopBtn, fileInput, fileName, progressBar, mainProgressContainer,
        currentTimeEl, durationEl, volumeSlider, loopInfo, brightnessSlider, saturationSlider,
        contrastSlider, brightnessValue, saturationValue, contrastValue, resetFiltersBtn,
        videoFullscreenBtn, fullscreenControlsOverlay, progressBarFullscreen, playPauseFullscreen,
        exitVideoFullscreenBtn, fullscreenProgressContainer;

    let isLooping = true;
    let loopCount = 0;
    let currentFilterStyles = {}; // To store current state of CSS filters
    let lastVideoTap = 0;

    // This will be called by main.js to set the current mode
    let currentModeGetter = () => 'videoPlayer'; // Default getter
    let pointCloudModuleRef; // To call PointCloud methods e.g. for setupPointCloudCanvasDimensions

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
        brightnessValue = document.getElementById('brightnessValue');
        saturationValue = document.getElementById('saturationValue');
        contrastValue = document.getElementById('contrastValue');
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
                // Special handling for filters that are "off" at their default.
                if ((effect.id === 'blur' && currentFilterStyles[effect.id] === 0) ||
                    (effect.id === 'hue' && currentFilterStyles[effect.id] === 0) ||
                    (effect.id === 'sepia' && currentFilterStyles[effect.id] === 0) ||
                    (effect.id === 'grayscale' && currentFilterStyles[effect.id] === 0) ||
                    (effect.id === 'invertColors' && currentFilterStyles[effect.id] === 0)
                ) {
                    // Don't add to filter string if it's at its "off" default
                } else {
                    filterString += `${effect.prop}(${currentFilterStyles[effect.id]}${effect.unit}) `;
                }
            }
        });
        videoPlayer.style.filter = filterString.trim();
    }

    function setEffect(effectId, value) {
        const effectDetails = getEffectById(effectId);
        if (!effectDetails || effectDetails.target !== 'player') return;

        if (effectDetails.isFilter) {
            currentFilterStyles[effectId] = value;
            applyCombinedVideoFilters();
            
            // Update corresponding UI slider if it exists and is for this effect
            if (effectId === 'brightness' && brightnessSlider) brightnessSlider.value = value;
            else if (effectId === 'saturation' && saturationSlider) saturationSlider.value = value;
            else if (effectId === 'contrast' && contrastSlider) contrastSlider.value = value;
            
            if (brightnessValue) UI.updateFilterDisplayValues(brightnessSlider, saturationSlider, contrastSlider, brightnessValue, saturationValue, contrastValue);
        } else if (effectDetails.prop === 'playbackRate') {
            videoPlayer.playbackRate = Math.max(effectDetails.min, Math.min(effectDetails.max, value));
        } else if (effectDetails.prop === 'volume') {
            videoPlayer.volume = Math.max(effectDetails.min, Math.min(effectDetails.max, value));
            if (volumeSlider) volumeSlider.value = videoPlayer.volume;
        }
    }

    function loadInitialPlayerEffects() {
        Utils.loadPlayerSettings(videoPlayer, volumeSlider, brightnessSlider, saturationSlider, contrastSlider);
        
        setEffect('brightness', parseFloat(brightnessSlider.value));
        setEffect('saturation', parseFloat(saturationSlider.value));
        setEffect('contrast', parseFloat(contrastSlider.value));
        setEffect('volume', parseFloat(volumeSlider.value));
        
        // Set other effects to their defaults if not mapped or controlled by UI
        AVAILABLE_EFFECTS.forEach(eff => {
            if (eff.target === 'player' && currentFilterStyles[eff.id] === undefined && eff.prop !== 'volume' && eff.prop !== 'playbackRate') {
                if (eff.isFilter) setEffect(eff.id, eff.default);
            }
        });
        
        if (videoPlayer.playbackRate === 1) {
            setEffect('playbackRate', getEffectById('playbackRate').default);
        }
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
        
        resetFiltersBtn.addEventListener('click', function() {
            const defaultBrightness = getEffectById('brightness').default;
            const defaultSaturation = getEffectById('saturation').default;
            const defaultContrast = getEffectById('contrast').default;
            
            setEffect('brightness', defaultBrightness); 
            brightnessSlider.value = defaultBrightness;
            
            setEffect('saturation', defaultSaturation);
            saturationSlider.value = defaultSaturation;

            setEffect('contrast', defaultContrast);
            contrastSlider.value = defaultContrast;

            // Reset other filters controlled by mappings to their defaults
            AVAILABLE_EFFECTS.forEach(eff => {
                if (eff.isFilter && eff.id !== 'brightness' && eff.id !== 'saturation' && eff.id !== 'contrast') {
                    setEffect(eff.id, eff.default);
                }
            });
            
            UI.updateFilterDisplayValues(brightnessSlider, saturationSlider, contrastSlider, brightnessValue, saturationValue, contrastValue);
            Utils.saveVideoPlayerSettings(brightnessSlider, saturationSlider, contrastSlider);
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
        loadInitialPlayerEffects();
        UI.updateFilterDisplayValues(brightnessSlider, saturationSlider, contrastSlider, brightnessValue, saturationValue, contrastValue);
        UI.updateLoopButton(loopBtn, isLooping);
    }

    // Public API
    return {
        init,
        setEffect,
        getVideoElement: () => videoPlayer,
        getMainVideoContainer: () => mainVideoContainer,
        toggleVideoFullscreen,
        enterVideoFullscreenMode,
        exitVideoFullscreenMode,
        resetFilters: () => resetFiltersBtn.click(),
        getDOM: () => ({
            videoPlayerControls, 
            videoFilterControls,
            videoPlaceholder
        })
    };
})();
