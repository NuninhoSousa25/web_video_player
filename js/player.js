// js/player.js
const Player = (function() {
    let videoPlayer, mainVideoContainer, videoPlaceholder, videoPlayerControls, // videoFilterControls removed
        playPauseBtn, loopBtn, fileInput, fileName, progressBar, mainProgressContainer,
        currentTimeEl, durationEl, volumeSlider, /* loopInfo removed */
        videoFullscreenBtn, fullscreenControlsOverlay, progressBarFullscreen,
        playPauseFullscreen;

    let isLooping = true;
    let loopCount = 0;
    let currentFilterStyles = {}; 
    let lastVideoTap = 0;
    let fsControlsTimeout; // For fullscreen controls auto-hide

    let currentModeGetter = () => 'videoPlayer'; 
    let pointCloudModuleRef; 

    function cacheDOMElements() {
        videoPlayer = document.getElementById('videoPlayer');
        mainVideoContainer = document.getElementById('mainVideoContainer');
        videoPlaceholder = document.getElementById('videoPlaceholder');
        videoPlayerControls = document.getElementById('videoPlayerControls');
        // videoFilterControls = document.getElementById('videoFilterControls'); // Removed
        playPauseBtn = document.getElementById('playPauseBtn');
        loopBtn = document.getElementById('loopBtn');
        fileInput = document.getElementById('fileInput');
        fileName = document.getElementById('fileName');
        progressBar = document.getElementById('progressBar');
        mainProgressContainer = document.getElementById('mainProgressContainer');
        currentTimeEl = document.getElementById('currentTime');
        durationEl = document.getElementById('duration');
        volumeSlider = document.getElementById('volumeSlider');
        // loopInfo = document.getElementById('loopInfo'); // Removed
        // brightnessSlider = document.getElementById('brightnessSlider'); // Removed
        // saturationSlider = document.getElementById('saturationSlider'); // Removed
        // contrastSlider = document.getElementById('contrastSlider'); // Removed
        // hueSlider = document.getElementById('hueSlider'); // Removed
        // brightnessValue = document.getElementById('brightnessValue'); // Removed
        // saturationValue = document.getElementById('saturationValue'); // Removed
        // contrastValue = document.getElementById('contrastValue'); // Removed
        // hueValue = document.getElementById('hueValue'); // Removed
        // resetFiltersBtn = document.getElementById('resetFiltersBtn'); // Removed
        videoFullscreenBtn = document.getElementById('videoFullscreenBtn'); // Button to ENTER fullscreen
        fullscreenControlsOverlay = document.getElementById('fullscreenControlsOverlay');
        progressBarFullscreen = document.getElementById('progressBarFullscreen');
        playPauseFullscreen = document.getElementById('playPauseFullscreen');
        fullscreenProgressContainer = fullscreenControlsOverlay.querySelector('.progress-container');
    }
    
    function applyCombinedVideoFilters() {
        let filterString = "";
        AVAILABLE_EFFECTS.forEach(effect => {
            if (effect.isFilter && currentFilterStyles[effect.id] !== undefined) {
                // Only apply if the value is not the default, to avoid adding redundant filters
                if (currentFilterStyles[effect.id] !== effect.default) {
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
            // No UI sliders to update for filters
        } else if (effectDetails.prop === 'playbackRate') {
            videoPlayer.playbackRate = Math.max(effectDetails.min, Math.min(effectDetails.max, value));
            UI.updateActiveMappingIndicators(); 
        } else if (effectDetails.prop === 'volume') {
            videoPlayer.volume = Math.max(effectDetails.min, Math.min(effectDetails.max, value));
            if (volumeSlider) volumeSlider.value = videoPlayer.volume;
            UI.updateActiveMappingIndicators(); 
        }
    }

    // `loadInitialPlayerEffects` function is removed as filters are removed from UI
    // `resetFilters` function is removed as filters are removed from UI

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

    function enterVideoFullscreenMode() {
        if (mainVideoContainer.classList.contains('fullscreen')) return;
        mainVideoContainer.classList.add('fullscreen');
        document.body.style.overflow = 'hidden';
        videoFullscreenBtn.textContent = 'Exit Full'; // Keep this for the button in normal view
        showFullscreenControls(); // Show controls briefly
        if (mainVideoContainer.requestFullscreen) {
            mainVideoContainer.requestFullscreen().catch(err => {
                console.error("FS Error:", err);
                // If request fails, revert UI
                mainVideoContainer.classList.remove('fullscreen');
                document.body.style.overflow = '';
                videoFullscreenBtn.textContent = 'Fullscreen';
            });
        } else if (mainVideoContainer.webkitRequestFullscreen) { // Safari
             mainVideoContainer.webkitRequestFullscreen();
        }
    }

    function exitVideoFullscreenMode() {
        if (!mainVideoContainer.classList.contains('fullscreen') && !document.fullscreenElement && !document.webkitIsFullScreen) return;

        mainVideoContainer.classList.remove('fullscreen');
        document.body.style.overflow = '';
        videoFullscreenBtn.textContent = 'Fullscreen';
        fullscreenControlsOverlay.classList.remove('active');
        
        if (document.exitFullscreen) {
            document.exitFullscreen().catch(err => console.error("Exit FS Error:", err));
        } else if (document.webkitExitFullscreen) { // Safari
            document.webkitExitFullscreen();
        }
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
                // UI.updateLoopInfo(loopInfo, videoPlayer, loopCount); // Removed
                UI.updateLoopButton(loopBtn, isLooping);
                videoPlaceholder.classList.add('hidden');
                if (currentModeGetter() === 'videoPlayer') {
                    videoPlayerControls.classList.remove('hidden');
                    // videoFilterControls.classList.remove('hidden'); // Removed
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
            // Ensure default filters are set programmatically if no mappings are active
            AVAILABLE_EFFECTS.forEach(eff => {
                if (eff.target === 'player' && eff.isFilter && currentFilterStyles[eff.id] === undefined) {
                    currentFilterStyles[eff.id] = eff.default;
                }
            });
            applyCombinedVideoFilters();
        });

        playPauseBtn.addEventListener('click', togglePlayPause);
        playPauseFullscreen.addEventListener('click', togglePlayPause);

        loopBtn.addEventListener('click', function() {
            isLooping = !isLooping;
            videoPlayer.loop = isLooping;
            UI.updateLoopButton(loopBtn, isLooping);
            // UI.updateLoopInfo(loopInfo, videoPlayer, loopCount); // Removed
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
                // UI.updateLoopInfo(loopInfo, videoPlayer, loopCount); // Removed
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

        // Removed all filter slider event listeners (brightness, saturation, contrast, hue, reset)

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

        videoFullscreenBtn.addEventListener('click', toggleVideoFullscreen);

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
        
        // Load initial volume, other filters are now mapping-driven
        Utils.loadPlayerSettings(videoPlayer, volumeSlider); 
        setEffect('volume', parseFloat(volumeSlider.value));

        // Initialize currentFilterStyles with default values for all filters
        AVAILABLE_EFFECTS.forEach(eff => {
            if (eff.target === 'player' && eff.isFilter) {
                currentFilterStyles[eff.id] = eff.default;
            }
        });
        applyCombinedVideoFilters(); 

        UI.updateLoopButton(loopBtn, isLooping);
    }

    return {
        init,
        setEffect,
        getVideoElement: () => videoPlayer,
        getMainVideoContainer: () => mainVideoContainer,
        enterVideoFullscreenMode,
        exitVideoFullscreenMode, // Keep for global Esc key handler
        getDOM: () => ({
            videoPlayerControls, 
            // videoFilterControls is removed
            videoPlaceholder
        }),
        // isFilterApplied and isEffectActive are still needed for mapping indicators
        isFilterApplied: (effectId) => currentFilterStyles.hasOwnProperty(effectId) && currentFilterStyles[effectId] !== getEffectById(effectId)?.default,
        isEffectActive: (effectId) => { 
            const effect = getEffectById(effectId);
            if (!effect) return false;
            if (effect.isFilter) {
                 return currentFilterStyles.hasOwnProperty(effectId) && currentFilterStyles[effectId] !== effect.default;
            } else if (effect.prop === 'volume') {
                return videoPlayer.volume !== effect.default;
            } else if (effect.prop === 'playbackRate') {
                // Playback rate can be changed by user, but mapping should override it
                return videoPlayer.playbackRate !== effect.default;
            }
            return false;
        }
    };
})();
