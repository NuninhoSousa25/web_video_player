// Set up file input handling
function setupFileHandling() {
    fileInput.addEventListener('change', function() {
        const file = this.files[0];
        if (file) {
            const videoURL = URL.createObjectURL(file);
            videoPlayer.src = videoURL;
            fileName.textContent = file.name;
            
            videoPlayer.loop = isLooping;
            loopCount = 0;
            updateLoopInfo();
            updateLoopButton();
            
            videoPlaceholder.classList.add('hidden');
            if (window.currentMode === 'videoPlayer') {
                videoPlayerControls.classList.remove('hidden');
                videoFilterControls.classList.remove('hidden');
            }
            
            // If switching to point cloud, it will handle its own setup
        }
    });
    
    videoPlayer.addEventListener('loadedmetadata', function() {
        durationEl.textContent = utils.formatTime(videoPlayer.duration);
        
        if (window.currentMode === 'pointCloud') { 
            window.pointCloud.setupPointCloudCanvasDimensions();
        }
        
        // Autoplay if a file is loaded (useful for point cloud mode especially)
        if (videoPlayer.src && videoPlayer.paused) {
           videoPlayer.play().catch(handlePlayError);
        }
    });
}

// Set up playback controls
function setupPlaybackControls() {
    playPauseBtn.addEventListener('click', togglePlayPause);
    playPauseFullscreen.addEventListener('click', togglePlayPause);

    loopBtn.addEventListener('click', function() {
        isLooping = !isLooping;
        videoPlayer.loop = isLooping;
        updateLoopButton();
        updateLoopInfo();
        if (!isLooping) loopCount = 0; 
    });
    
    videoPlayer.addEventListener('timeupdate', function() {
        if (!videoPlayer.duration) return;
        const percentage = (videoPlayer.currentTime / videoPlayer.duration) * 100;
        progressBar.style.width = percentage + '%';
        progressBarFullscreen.style.width = percentage + '%';
        currentTimeEl.textContent = utils.formatTime(videoPlayer.currentTime);
    });
    
    mainProgressContainer.addEventListener('click', (e) => seekVideo(e, mainProgressContainer));
    
    if(fullscreenControlsOverlay) { 
        const fullscreenProgressContainer = fullscreenControlsOverlay.querySelector('.progress-container');
        fullscreenProgressContainer.addEventListener('click', (e) => seekVideo(e, fullscreenProgressContainer));
    }
    
    volumeSlider.addEventListener('input', function() {
        videoPlayer.volume = this.value;
        localStorage.setItem('videoPlayerVolume', this.value);
    });
    
    videoPlayer.addEventListener('ended', function() {
        if (videoPlayer.loop) {
            loopCount++;
            updateLoopInfo();
        } else {
            playPauseBtn.textContent = 'Play';
            playPauseFullscreen.textContent = 'Play';
        }
    });
    
    videoPlayer.addEventListener('play', () => { 
        playPauseBtn.textContent = 'Pause';
        playPauseFullscreen.textContent = 'Pause';
        
        // Resume point cloud if it was paused
        if (window.currentMode === 'pointCloud') {
            window.pointCloud.renderPointCloudFrame();
        }
    });
    
    videoPlayer.addEventListener('pause', () => {
        playPauseBtn.textContent = 'Play';
        playPauseFullscreen.textContent = 'Play';
    });
}

// Set up video filter controls
function setupFilterControls() {
    [brightnessSlider, saturationSlider, contrastSlider, hueRotateSlider, blurSlider].forEach(slider => {
        slider.addEventListener('input', () => {
            updateFilterDisplayValues();
            saveVideoPlayerSettings();
            applyVideoFilters();
        });
    });
    
    resetFiltersBtn.addEventListener('click', function() {
        brightnessSlider.value = 100;
        saturationSlider.value = 100;
        contrastSlider.value = 100;
        hueRotateSlider.value = 0;
        blurSlider.value = 0;
        updateFilterDisplayValues();
        saveVideoPlayerSettings();
        applyVideoFilters();
    });
}

// Set up fullscreen handling
function setupFullscreenHandling() {
    let lastVideoTap = 0;
    
    videoPlayer.addEventListener('touchend', (e) => {
        if (window.currentMode !== 'videoPlayer') return;
        const currentTime = new Date().getTime();
        if (currentTime - lastVideoTap < 500) { 
            toggleVideoFullscreen(); 
            e.preventDefault(); 
        }
        lastVideoTap = currentTime;
    });
    
    videoPlayer.addEventListener('dblclick', () => { 
        if (window.currentMode === 'videoPlayer') toggleVideoFullscreen(); 
    });
    
    videoFullscreenBtn.addEventListener('click', toggleVideoFullscreen);
    exitVideoFullscreenBtn.addEventListener('click', exitVideoFullscreenMode);
    
    videoPlayer.addEventListener('touchstart', () => {
        if (mainVideoContainer.classList.contains('fullscreen')) {
            showVideoFullscreenControlsBriefly();
        }
    });
    
    // Handle fullscreen change event
    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement && !document.webkitIsFullScreen && 
            !document.mozFullScreen && !document.msFullscreenElement) {
            if(mainVideoContainer.classList.contains('fullscreen')) {
                exitVideoFullscreenMode();
            }
        }
    });
}

// Toggle play/pause state
function togglePlayPause() {
    if (videoPlayer.paused || videoPlayer.ended) {
        videoPlayer.play().catch(handlePlayError);
    } else {
        videoPlayer.pause();
    }
}

// Seek video to position
function seekVideo(event, progressContainerElement) {
    if (!videoPlayer.duration) return;
    const progressContainerWidth = progressContainerElement.offsetWidth;
    const clickPosition = event.offsetX;
    const seekTime = (clickPosition / progressContainerWidth) * videoPlayer.duration;
    videoPlayer.currentTime = seekTime;
}

// Update loop button text
function updateLoopButton() {
    loopBtn.textContent = isLooping ? 'Loop: ON' : 'Loop: OFF';
}

// Update loop count info
function updateLoopInfo() {
    loopInfo.textContent = videoPlayer.loop ? `Looped ${loopCount} time${loopCount === 1 ? '' : 's'}` : '';
}

// Update filter display values
function updateFilterDisplayValues() {
    brightnessValue.textContent = `${brightnessSlider.value}%`;
    saturationValue.textContent = `${saturationSlider.value}%`;
    contrastValue.textContent = `${contrastSlider.value}%`;
    hueRotateValue.textContent = `${hueRotateSlider.value}°`;
    blurValue.textContent = `${blurSlider.value}px`;
}

// Apply video filters
function applyVideoFilters() {
    lastVideoFilterValues.brightness = brightnessSlider.value;
    lastVideoFilterValues.saturation = saturationSlider.value;
    lastVideoFilterValues.contrast = contrastSlider.value;
    lastVideoFilterValues.hueRotate = hueRotateSlider.value;
    lastVideoFilterValues.blur = blurSlider.value;
    
    videoPlayer.style.filter = `
        brightness(${lastVideoFilterValues.brightness}%) 
        saturate(${lastVideoFilterValues.saturation}%) 
        contrast(${lastVideoFilterValues.contrast}%) 
        hue-rotate(${lastVideoFilterValues.hueRotate}deg) 
        blur(${lastVideoFilterValues.blur}px)
        ${lastVideoFilterValues.sepia ? `sepia(${lastVideoFilterValues.sepia}%)` : ''}
    `;
}

// Toggle video fullscreen mode
function toggleVideoFullscreen() {
    if (!mainVideoContainer.classList.contains('fullscreen')) {
        enterVideoFullscreenMode();
    } else {
        exitVideoFullscreenMode();
    }
}

// Enter video fullscreen mode
function enterVideoFullscreenMode() {
    mainVideoContainer.classList.add('fullscreen');
    document.body.style.overflow = 'hidden';
    videoFullscreenBtn.textContent = 'Exit Full';
    showVideoFullscreenControlsBriefly();
    document.addEventListener('keydown', exitFullscreenOnEscape);
    
    if (mainVideoContainer.requestFullscreen) {
        mainVideoContainer.requestFullscreen().catch(err => console.error("FS Error:", err));
    }
}

// Exit video fullscreen mode
function exitVideoFullscreenMode() {
    mainVideoContainer.classList.remove('fullscreen');
    document.body.style.overflow = '';
    videoFullscreenBtn.textContent = 'Fullscreen';
    fullscreenControlsOverlay.classList.remove('active');
    document.removeEventListener('keydown', exitFullscreenOnEscape);
    
    if (document.exitFullscreen) {
        document.exitFullscreen().catch(err => console.error("Exit FS Error:", err));
    }
}

// Show fullscreen controls briefly
function showVideoFullscreenControlsBriefly() {
    fullscreenControlsOverlay.classList.add('active');
    setTimeout(() => fullscreenControlsOverlay.classList.remove('active'), 3000);
}

// Handle ESC key to exit fullscreen
function exitFullscreenOnEscape(e) {
    if (e.key === 'Escape') {
        exitVideoFullscreenMode();
    }
}

// Handle play error
function handlePlayError(e) { 
    console.error("Video play error:", e); 
}

// Load player settings from local storage
function loadPlayerSettings() {
    const savedVolume = localStorage.getItem('videoPlayerVolume');
    if (savedVolume) { 
        videoPlayer.volume = parseFloat(savedVolume); 
        volumeSlider.value = parseFloat(savedVolume);
    }
    
    brightnessSlider.value = localStorage.getItem('videoPlayerBrightness') || 100;
    saturationSlider.value = localStorage.getItem('videoPlayerSaturation') || 100;
    contrastSlider.value = localStorage.getItem('videoPlayerContrast') || 100;
    hueRotateSlider.value = localStorage.getItem('videoPlayerHueRotate') || 0;
    blurSlider.value = localStorage.getItem('videoPlayerBlur') || 0;
}

// Save video player settings to local storage
function saveVideoPlayerSettings() {
    localStorage.setItem('videoPlayerBrightness', brightnessSlider.value);
    localStorage.setItem('videoPlayerSaturation', saturationSlider.value);
    localStorage.setItem('videoPlayerContrast', contrastSlider.value);
    localStorage.setItem('videoPlayerHueRotate', hueRotateSlider.value);
    localStorage.setItem('videoPlayerBlur', blurSlider.value);
}

// Export functions to global scope
window.player = {
    initializePlayer,
    togglePlayPause,
    applyVideoFilters,
    updateFilterDisplayValues,
    resetFilters: function() {
        resetFiltersBtn.click();
    }
};

// Export global variables for other modules to access
window.lastVideoFilterValues = lastVideoFilterValues;
window.videoPlayer = videoPlayer;/**
 * Enhanced Sensor Video Processor - Player Module
 * Handles video player functionality and video filters
 */

// Player state variables
let isLooping = true;
let loopCount = 0;
let lastVideoFilterValues = { 
    brightness: 100, 
    saturation: 100, 
    contrast: 100,
    hueRotate: 0,
    blur: 0,
    sepia: 0
};

// DOM Elements
let videoPlayer;
let mainVideoContainer;
let videoPlaceholder;
let videoPlayerControls;
let videoFilterControls;
let playPauseBtn;
let loopBtn;
let fileInput;
let fileName;
let progressBar;
let mainProgressContainer;
let currentTimeEl;
let durationEl;
let volumeSlider;
let loopInfo;
let brightnessSlider;
let saturationSlider;
let contrastSlider;
let hueRotateSlider;
let blurSlider;
let brightnessValue;
let saturationValue;
let contrastValue;
let hueRotateValue;
let blurValue;
let resetFiltersBtn;
let videoFullscreenBtn;
let fullscreenControlsOverlay;
let progressBarFullscreen;
let playPauseFullscreen;
let exitVideoFullscreenBtn;

// Initialize the player module
function initializePlayer() {
    // Get DOM elements
    videoPlayer = utils.getElement('videoPlayer');
    mainVideoContainer = utils.getElement('mainVideoContainer');
    videoPlaceholder = utils.getElement('videoPlaceholder');
    videoPlayerControls = utils.getElement('videoPlayerControls');
    videoFilterControls = utils.getElement('videoFilterControls');
    playPauseBtn = utils.getElement('playPauseBtn');
    loopBtn = utils.getElement('loopBtn');
    fileInput = utils.getElement('fileInput');
    fileName = utils.getElement('fileName');
    progressBar = utils.getElement('progressBar');
    mainProgressContainer = utils.getElement('mainProgressContainer');
    currentTimeEl = utils.getElement('currentTime');
    durationEl = utils.getElement('duration');
    volumeSlider = utils.getElement('volumeSlider');
    loopInfo = utils.getElement('loopInfo');
    brightnessSlider = utils.getElement('brightnessSlider');
    saturationSlider = utils.getElement('saturationSlider');
    contrastSlider = utils.getElement('contrastSlider');
    hueRotateSlider = utils.getElement('hueRotateSlider');
    blurSlider = utils.getElement('blurSlider');
    brightnessValue = utils.getElement('brightnessValue');
    saturationValue = utils.getElement('saturationValue');
    contrastValue = utils.getElement('contrastValue');
    hueRotateValue = utils.getElement('hueRotateValue');
    blurValue = utils.getElement('blurValue');
    resetFiltersBtn = utils.getElement('resetFiltersBtn');
    videoFullscreenBtn = utils.getElement('videoFullscreenBtn');
    fullscreenControlsOverlay = utils.getElement('fullscreenControlsOverlay');
    progressBarFullscreen = utils.getElement('progressBarFullscreen');
    playPauseFullscreen = utils.getElement('playPauseFullscreen');
    exitVideoFullscreenBtn = utils.getElement('exitVideoFullscreenBtn');
    
    // Load saved settings
    loadPlayerSettings();
    
    // Set up event listeners
    setupFileHandling();
    setupPlaybackControls();
    setupFilterControls();
    setupFullscreenHandling();
    
    // Initialize filter displays
    updateFilterDisplayValues();
    applyVideoFilters();
    updateLoopButton();
}
