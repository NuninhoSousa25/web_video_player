// js/player.js
const Player = (function() {
    let videoPlayer, mainVideoContainer, videoPlaceholder, videoPlayerControls, videoFilterControls,
        playPauseBtn, loopBtn, fileInput, fileName, progressBar, mainProgressContainer,
        currentTimeEl, durationEl, volumeSlider, brightnessSlider, saturationSlider,
        contrastSlider, hueSlider, 
        brightnessValue, saturationValue, contrastValue, hueValue, 
        resetFiltersBtn, videoFullscreenBtn, fullscreenControlsOverlay, progressBarFullscreen,
        playPauseFullscreen /* exitVideoFullscreenBtn removed */ ;

    let isLooping = true;
    let currentFilterStyles = {}; 
    let lastVideoTap = 0;
    let fsControlsTimeout; // For fullscreen controls auto-hide
    let wakeLock = null; // For screen wake lock

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
        brightnessSlider = document.getElementById('brightnessSlider');
        saturationSlider = document.getElementById('saturationSlider');
        contrastSlider = document.getElementById('contrastSlider');
        hueSlider = document.getElementById('hueSlider'); 
        brightnessValue = document.getElementById('brightnessValue');
        saturationValue = document.getElementById('saturationValue');
        contrastValue = document.getElementById('contrastValue');
        hueValue = document.getElementById('hueValue'); 
        resetFiltersBtn = document.getElementById('resetFiltersBtn');
        videoFullscreenBtn = document.getElementById('videoFullscreenBtn'); // Button to ENTER fullscreen
        fullscreenControlsOverlay = document.getElementById('fullscreenControlsOverlay');
        progressBarFullscreen = document.getElementById('progressBarFullscreen');
        playPauseFullscreen = document.getElementById('playPauseFullscreen');
        // exitVideoFullscreenBtn = document.getElementById('exitVideoFullscreenBtn'); // Removed
        fullscreenProgressContainer = fullscreenControlsOverlay.querySelector('.progress-container');
    }
    
    function applyCombinedVideoFilters() {
        let filterString = "";
        AVAILABLE_EFFECTS.forEach(effect => {
            if (effect.isFilter && currentFilterStyles[effect.id] !== undefined) {
                if ((effect.id === 'blur' && currentFilterStyles[effect.id] === 0) ||
                    (effect.id === 'hue' && currentFilterStyles[effect.id] === 0) || 
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
        UI.updateActiveMappingIndicators(); 
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
            else if (effectId === 'hue' && hueSlider) hueSlider.value = value; 
            
            if (brightnessValue) UI.updateFilterDisplayValues(
                brightnessSlider, saturationSlider, contrastSlider, hueSlider, 
                brightnessValue, saturationValue, contrastValue, hueValue 
            );
        } else if (effectDetails.prop === 'playbackRate') {
            videoPlayer.playbackRate = Math.max(effectDetails.min, Math.min(effectDetails.max, value));
             UI.updateActiveMappingIndicators(); 
        } else if (effectDetails.prop === 'volume') {
            videoPlayer.volume = Math.max(effectDetails.min, Math.min(effectDetails.max, value));
            if (volumeSlider) volumeSlider.value = videoPlayer.volume;
             UI.updateActiveMappingIndicators(); 
        }
    }

    function loadInitialPlayerEffects() {
        Utils.loadPlayerSettings(videoPlayer, volumeSlider, brightnessSlider, saturationSlider, contrastSlider, hueSlider); 
        
        setEffect('brightness', parseFloat(brightnessSlider.value));
        setEffect('saturation', parseFloat(saturationSlider.value));
        setEffect('contrast', parseFloat(contrastSlider.value));
        setEffect('hue', parseFloat(hueSlider.value)); 
        setEffect('volume', parseFloat(volumeSlider.value));
        
        AVAILABLE_EFFECTS.forEach(eff => {
            if (eff.target === 'player' && currentFilterStyles[eff.id] === undefined && eff.prop !== 'volume' && eff.prop !== 'playbackRate') {
                if (eff.isFilter) setEffect(eff.id, eff.default);
            }
        });
        
        if (videoPlayer.playbackRate === 1) {
            setEffect('playbackRate', getEffectById('playbackRate').default);
        }
        applyCombinedVideoFilters(); 
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
    
    function showFullscreenControls() {
        if (mainVideoContainer.classList.contains('fullscreen')) {
            clearTimeout(fsControlsTimeout);
            fullscreenControlsOverlay.classList.add('active');
            fsControlsTimeout = setTimeout(() => {
                fullscreenControlsOverlay.classList.remove('active');
            }, 3000);
        }
    }
    
    function toggleVideoFullscreen() { // This function is now primarily for ENTERING fullscreen via button
        if (!mainVideoContainer.classList.contains('fullscreen')) {
            enterVideoFullscreenMode();
        } else {
             exitVideoFullscreenMode(); // Can still be called if needed, e.g. by Esc key handler
        }
    }

    async function enterVideoFullscreenMode() {
        if (mainVideoContainer.classList.contains('fullscreen')) return;
        
        try {
            // Request wake lock before entering fullscreen
            if ('wakeLock' in navigator) {
                try {
                    wakeLock = await navigator.wakeLock.request('screen');
                    console.log('Wake lock is active');
                } catch (err) {
                    console.warn('Wake lock request failed:', err);
                }
            }

            const enterFsPromise = mainVideoContainer.requestFullscreen ? 
                                 mainVideoContainer.requestFullscreen() : 
                                 (mainVideoContainer.webkitRequestFullscreen ? 
                                  mainVideoContainer.webkitRequestFullscreen() : 
                                  Promise.reject('Fullscreen not supported'));

            mainVideoContainer.classList.add('fullscreen');
            document.body.style.overflow = 'hidden';

            await enterFsPromise;
            setupVideoDimensions();
            showFullscreenControls();
        } catch (err) {
            console.error("Video Enter FS Error:", err);
            mainVideoContainer.classList.remove('fullscreen');
            document.body.style.overflow = '';
            setupVideoDimensions();
        }
    }

    function exitVideoFullscreenMode() {
        if (!mainVideoContainer.classList.contains('fullscreen') && !document.fullscreenElement && !document.webkitIsFullScreen) return;
        
        // Release wake lock when exiting fullscreen
        if (wakeLock) {
            wakeLock.release()
                .then(() => {
                    console.log('Wake lock released');
                    wakeLock = null;
                })
                .catch(err => {
                    console.warn('Error releasing wake lock:', err);
                });
        }

        const exitFsPromise = document.exitFullscreen ? 
                             document.exitFullscreen() : 
                             (document.webkitExitFullscreen ? document.webkitExitFullscreen() : Promise.reject());

        mainVideoContainer.classList.remove('fullscreen');
        document.body.style.overflow = '';

        exitFsPromise.then(() => {
            setTimeout(setupVideoDimensions, 50);
        }).catch(err => {
            console.error("Video Exit FS Error:", err);
            setupVideoDimensions();
        });
        setupVideoDimensions();
    }
    
    function setupEventListeners() {
        fileInput.addEventListener('change', function() {
            const file = this.files[0];
            if (file) {
                const videoURL = URL.createObjectURL(file);
                videoPlayer.src = videoURL;
                fileName.textContent = file.name;
                videoPlayer.loop = isLooping;
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
                UI.updatePlayPauseButtons(playPauseBtn, playPauseFullscreen, false);
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

        hueSlider.addEventListener('input', () => { 
            setEffect('hue', parseFloat(hueSlider.value));
            localStorage.setItem('videoPlayerHue', hueSlider.value);
        });
        
        resetFiltersBtn.addEventListener('click', function() {
            AVAILABLE_EFFECTS.forEach(eff => {
                if (eff.isFilter && eff.target === 'player') {
                    const slider = document.getElementById(eff.id + 'Slider'); 
                    if (slider) { 
                         setEffect(eff.id, eff.default);
                         slider.value = eff.default;
                    } else if (currentFilterStyles.hasOwnProperty(eff.id)) { 
                        setEffect(eff.id, eff.default); 
                    }
                }
            });
            
            UI.updateFilterDisplayValues(
                brightnessSlider, saturationSlider, contrastSlider, hueSlider,
                brightnessValue, saturationValue, contrastValue, hueValue
            );
            Utils.saveVideoPlayerSettings(brightnessSlider, saturationSlider, contrastSlider, hueSlider);
            applyCombinedVideoFilters(); 
        });

        // Double tap/click for fullscreen on video element itself
        videoPlayer.addEventListener('touchend', (e) => {
            if (currentModeGetter() !== 'videoPlayer') return;
            const currentTime = new Date().getTime();
            if (currentTime - lastVideoTap < 300) { // Reduced time for double tap
                 if (mainVideoContainer.classList.contains('fullscreen')) {
                    exitVideoFullscreenMode();
                } else {
                    enterVideoFullscreenMode();
                }
                e.preventDefault(); 
            }
            lastVideoTap = currentTime;
        });
        videoPlayer.addEventListener('dblclick', () => { 
            if (currentModeGetter() === 'videoPlayer') {
                 if (mainVideoContainer.classList.contains('fullscreen')) {
                    exitVideoFullscreenMode();
                } else {
                    enterVideoFullscreenMode();
                }
            }
        });

        videoFullscreenBtn.addEventListener('click', toggleVideoFullscreen); // Button in normal controls
        // exitVideoFullscreenBtn was removed

        // Show fullscreen controls on tap/mouse move when in fullscreen
        mainVideoContainer.addEventListener('click', showFullscreenControls); // For mouse click
        mainVideoContainer.addEventListener('mousemove', showFullscreenControls);
        mainVideoContainer.addEventListener('touchstart', (e) => { // For touch
            if (mainVideoContainer.classList.contains('fullscreen')) {
                showFullscreenControls();
            }
        });
    }

    function init(modeGetter, pcModule) {
        currentModeGetter = modeGetter;
        pointCloudModuleRef = pcModule;
        cacheDOMElements();
        setupEventListeners();
        loadInitialPlayerEffects(); 
        UI.updateFilterDisplayValues( 
            brightnessSlider, saturationSlider, contrastSlider, hueSlider,
            brightnessValue, saturationValue, contrastValue, hueValue
        );
        UI.updateLoopButton(loopBtn, isLooping);

        // Add visibility change handler for wake lock
        document.addEventListener('visibilitychange', async () => {
            if (document.visibilityState === 'visible' && mainVideoContainer.classList.contains('fullscreen')) {
                // Re-request wake lock when page becomes visible again
                if ('wakeLock' in navigator && !wakeLock) {
                    try {
                        wakeLock = await navigator.wakeLock.request('screen');
                        console.log('Wake lock re-activated');
                    } catch (err) {
                        console.warn('Wake lock re-request failed:', err);
                    }
                }
            }
        });
    }

    return {
        init,
        setEffect,
        getVideoElement: () => videoPlayer,
        getMainVideoContainer: () => mainVideoContainer,
        // toggleVideoFullscreen, // Dbl tap now primary toggle in FS mode
        enterVideoFullscreenMode,
        exitVideoFullscreenMode, // Keep for global Esc key handler
        resetFilters: () => {
            resetFiltersBtn.click();
        },
        getDOM: () => ({
            videoPlayerControls, 
            videoFilterControls,
            videoPlaceholder
        }),
        isFilterApplied: (effectId) => currentFilterStyles.hasOwnProperty(effectId) && currentFilterStyles[effectId] !== getEffectById(effectId)?.default,
        isEffectActive: (effectId) => { 
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
