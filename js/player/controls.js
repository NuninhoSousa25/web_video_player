// js/player/controls.js - Point cloud references removed
const PlayerControls = (function() {
    
    let playerCore;
    let playPauseBtn, playPauseFullscreen, loopBtn;
    let progressBar, progressBarFullscreen, mainProgressContainer, fullscreenProgressContainer;
    let videoPlayerControls, videoPlaceholder;
    const ELEMENT_IDS = {
        playPauseBtn: 'playPauseBtn',
        playPauseFullscreen: 'playPauseFullscreen', 
        loopBtn: 'loopBtn',
        progressBar: 'progressBar',
        progressBarFullscreen: 'progressBarFullscreen',
        mainProgressContainer: 'mainProgressContainer',
        videoPlayerControls: 'videoPlayerControls',
        videoPlaceholder: 'videoPlaceholder'
    };
    
    function cacheDOMElements() {
        const elements = DOMUtils.cacheElementsWithMapping(ELEMENT_IDS);
        playPauseBtn = elements.playPauseBtn;
        playPauseFullscreen = elements.playPauseFullscreen;
        loopBtn = elements.loopBtn;
        progressBar = elements.progressBar;
        progressBarFullscreen = elements.progressBarFullscreen;
        mainProgressContainer = elements.mainProgressContainer;
        videoPlayerControls = elements.videoPlayerControls;
        videoPlaceholder = elements.videoPlaceholder;
        
        // Get fullscreen progress container
        const fullscreenOverlay = document.getElementById('fullscreenControlsOverlay');
        if (fullscreenOverlay) {
            fullscreenProgressContainer = fullscreenOverlay.querySelector('.progress-container');
        }
    }
    
    function updatePlayPauseButtons(isPlaying) {
        const text = isPlaying ? 'Pause' : 'Play';
        DOMUtils.updateText(playPauseBtn, text);
        DOMUtils.updateText(playPauseFullscreen, text);
    }
    
    function updateLoopButton(isLooping) {
        const text = isLooping ? 'Loop: ON' : 'Loop: OFF';
        DOMUtils.updateText(loopBtn, text);
    }
    
    function updateProgressBars(percentage) {
        if (progressBar) {
            progressBar.style.width = percentage + '%';
        }
        if (progressBarFullscreen) {
            progressBarFullscreen.style.width = percentage + '%';
        }
    }
    
    function seekVideo(event, progressContainerElement) {
        if (!playerCore.hasVideo()) return;
        
        const progressContainerWidth = progressContainerElement.offsetWidth;
        const clickPosition = event.offsetX;
        const percentage = (clickPosition / progressContainerWidth) * 100;
        
        playerCore.seekToPercentage(percentage);
    }
    
    function updateControlsVisibility() {
        const hasVideo = playerCore.hasVideo();
        
        DOMUtils.updateVisibility({
            [videoPlaceholder]: !hasVideo,
            [videoPlayerControls]: hasVideo
        });
    }
    
    function setupEventListeners() {
        // Play/pause buttons
        if (playPauseBtn) {
            playPauseBtn.addEventListener('click', () => {
                playerCore.togglePlayPause();
            });
        }
        
        if (playPauseFullscreen) {
            playPauseFullscreen.addEventListener('click', () => {
                playerCore.togglePlayPause();
            });
        }
        
        // Loop button
        if (loopBtn) {
            loopBtn.addEventListener('click', () => {
                playerCore.toggleLoop();
            });
        }
        
        // Progress bar click handling
        if (mainProgressContainer) {
            mainProgressContainer.addEventListener('click', (e) => {
                seekVideo(e, mainProgressContainer);
            });
        }
        
        if (fullscreenProgressContainer) {
            fullscreenProgressContainer.addEventListener('click', (e) => {
                seekVideo(e, fullscreenProgressContainer);
            });
        }
        
        // Listen for video events
        document.addEventListener('video:play', () => {
            updatePlayPauseButtons(true);
        });
        
        document.addEventListener('video:pause', () => {
            updatePlayPauseButtons(false);
        });
        
        document.addEventListener('video:ended', (event) => {
            const { loop } = event.detail;
            if (!loop) {
                updatePlayPauseButtons(false);
            }
        });
        
        document.addEventListener('video:timeUpdate', (event) => {
            const { percentage } = event.detail;
            updateProgressBars(percentage);
        });
        
        document.addEventListener('video:loopChanged', (event) => {
            const { isLooping } = event.detail;
            updateLoopButton(isLooping);
        });
        
        document.addEventListener('video:loaded', () => {
            updateControlsVisibility();
        });
    }
    
    function init(corePlayer) {
        playerCore = corePlayer;
        
        cacheDOMElements();
        setupEventListeners();
        
        // Initialize button states
        updatePlayPauseButtons(false);
        updateLoopButton(playerCore.isLooping);
        updateControlsVisibility();
    }
    
    function getDOM() {
        return {
            videoPlayerControls,
            videoPlaceholder
        };
    }
    
    return {
        init,
        getDOM,
        updatePlayPauseButtons,
        updateLoopButton,
        updateProgressBars,
        updateControlsVisibility
    };
})();
