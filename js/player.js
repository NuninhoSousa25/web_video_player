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
    let lastVideoFilterValues = { brightness: 100, saturation: 100, contrast: 100 };
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
    
    function applyVideoFilters() {
        lastVideoFilterValues.brightness = brightnessSlider.value;
        lastVideoFilterValues.saturation = saturationSlider.value;
        lastVideoFilterValues.contrast = contrastSlider.value;
        videoPlayer.style.filter = `brightness(${lastVideoFilterValues.brightness}%) saturate(${lastVideoFilterValues.saturation}%) contrast(${lastVideoFilterValues.contrast}%)`;
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
        // document.addEventListener('keydown', exitFullscreenOnEscape); // Managed by Main.js
        if (mainVideoContainer.requestFullscreen) mainVideoContainer.requestFullscreen().catch(err => console.error("FS Error:", err));
    }

    function exitVideoFullscreenMode() {
        mainVideoContainer.classList.remove('fullscreen');
        document.body.style.overflow = '';
        videoFullscreenBtn.textContent = 'Fullscreen';
        fullscreenControlsOverlay.classList.remove('active');
        // document.removeEventListener('keydown', exitFullscreenOnEscape); // Managed by Main.js
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
                pointCloudModuleRef.setupCanvasDimensions(); // Notify PointCloud module
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
            videoPlayer.volume = this.value;
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

        [brightnessSlider, saturationSlider, contrastSlider].forEach(slider => {
            slider.addEventListener('input', () => {
                UI.updateFilterDisplayValues(brightnessSlider, saturationSlider, contrastSlider, brightnessValue, saturationValue, contrastValue);
                Utils.saveVideoPlayerSettings(brightnessSlider, saturationSlider, contrastSlider);
                applyVideoFilters();
            });
        });
        
        resetFiltersBtn.addEventListener('click', function() {
            brightnessSlider.value = 100;
            saturationSlider.value = 100;
            contrastSlider.value = 100;
            UI.updateFilterDisplayValues(brightnessSlider, saturationSlider, contrastSlider, brightnessValue, saturationValue, contrastValue);
            Utils.saveVideoPlayerSettings(brightnessSlider, saturationSlider, contrastSlider);
            applyVideoFilters();
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
        Utils.loadPlayerSettings(videoPlayer, volumeSlider, brightnessSlider, saturationSlider, contrastSlider);
        UI.updateFilterDisplayValues(brightnessSlider, saturationSlider, contrastSlider, brightnessValue, saturationValue, contrastValue);
        applyVideoFilters();
        UI.updateLoopButton(loopBtn, isLooping);
    }

    // Public API
    return {
        init,
        applyVideoFilters, // Mappings might need this
        getFilterSliderElements: () => ({ brightnessSlider, saturationSlider, contrastSlider }), // Mappings might need these
        getLastFilterValues: () => lastVideoFilterValues, // Mappings might need these for smoothing
        getVideoElement: () => videoPlayer,
        getMainVideoContainer: () => mainVideoContainer,
        toggleVideoFullscreen,
        enterVideoFullscreenMode,
        exitVideoFullscreenMode,
        resetFilters: () => resetFiltersBtn.click(),
        getDOM: () => ({ // For main.js to show/hide relevant controls
            videoPlayerControls, 
            videoFilterControls,
            videoPlaceholder
        })
    };
})();
