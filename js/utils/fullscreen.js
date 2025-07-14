// js/utils/fullscreen-ui.js - Fullscreen UI utilities
const FullscreenUIUtils = (function() {
    
    /**
     * Show double-tap indicator animation
     * @param {HTMLElement} container - Container to show indicator in
     */
    function showDoubleTapIndicator(container) {
        // Remove any existing indicator
        const existingIndicator = container.querySelector('.double-tap-indicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }
        
        // Create new indicator
        const indicator = document.createElement('div');
        indicator.className = 'double-tap-indicator';
        container.appendChild(indicator);
        
        // Remove after animation completes
        setTimeout(() => {
            if (indicator.parentNode) {
                indicator.parentNode.removeChild(indicator);
            }
        }, 600);
    }
    
    /**
     * Create a temporary UI notification in fullscreen
     * @param {string} message - Message to display
     * @param {number} duration - Duration in ms (default 2000)
     * @param {string} position - Position: 'center', 'top', 'bottom' (default 'center')
     */
    function showFullscreenNotification(message, duration = 2000, position = 'center') {
        const notification = document.createElement('div');
        notification.className = `fullscreen-notification ${position}`;
        notification.textContent = message;
        
        // Styling
        notification.style.cssText = `
            position: absolute;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 16px;
            z-index: 10003;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            opacity: 0;
            transform: translateY(20px);
            transition: all 0.3s ease;
            pointer-events: none;
        `;
        
        // Position the notification
        switch (position) {
            case 'top':
                notification.style.top = '20px';
                notification.style.left = '50%';
                notification.style.transform = 'translateX(-50%) translateY(-20px)';
                break;
            case 'bottom':
                notification.style.bottom = '20px';
                notification.style.left = '50%';
                notification.style.transform = 'translateX(-50%) translateY(20px)';
                break;
            case 'center':
            default:
                notification.style.top = '50%';
                notification.style.left = '50%';
                notification.style.transform = 'translate(-50%, -50%) translateY(20px)';
                break;
        }
        
        // Find fullscreen container
        const fullscreenContainer = document.querySelector('.video-container.fullscreen') || document.body;
        fullscreenContainer.appendChild(notification);
        
        // Animate in
        requestAnimationFrame(() => {
            notification.style.opacity = '1';
            switch (position) {
                case 'top':
                    notification.style.transform = 'translateX(-50%) translateY(0)';
                    break;
                case 'bottom':
                    notification.style.transform = 'translateX(-50%) translateY(0)';
                    break;
                case 'center':
                default:
                    notification.style.transform = 'translate(-50%, -50%)';
                    break;
            }
        });
        
        // Remove after duration
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.opacity = '0';
                notification.style.transform += ' translateY(20px)';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }
        }, duration);
        
        return notification;
    }
    
    /**
     * Show volume indicator
     * @param {number} volume - Volume level (0-1)
     */
    function showVolumeIndicator(volume) {
        const percentage = Math.round(volume * 100);
        const volumeIcon = volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊';
        showFullscreenNotification(`${volumeIcon} ${percentage}%`, 1000, 'center');
    }
    
    /**
     * Show seek indicator
     * @param {number} seconds - Seconds seeked (positive for forward, negative for backward)
     * @param {number} currentTime - Current playback time
     */
    function showSeekIndicator(seconds, currentTime) {
        const direction = seconds > 0 ? '⏩' : '⏪';
        const absSeconds = Math.abs(seconds);
        const timeFormatted = formatTime(currentTime);
        showFullscreenNotification(`${direction} ${absSeconds}s (${timeFormatted})`, 1000, 'center');
    }
    
    /**
     * Show playback rate indicator
     * @param {number} rate - Playback rate
     */
    function showPlaybackRateIndicator(rate) {
        const rateText = rate === 1 ? 'Normal Speed' : `${rate}x Speed`;
        showFullscreenNotification(`⚡ ${rateText}`, 1500, 'center');
    }
    
    /**
     * Show rotation indicator
     * @param {number} rotation - Rotation in degrees
     */
    function showRotationIndicator(rotation) {
        const rotationText = rotation === 0 ? 'No Rotation' : `${rotation}° Rotation`;
        showFullscreenNotification(`🔄 ${rotationText}`, 1500, 'center');
    }
    
    /**
     * Show auto-rotate indicator
     * @param {boolean} enabled - Whether auto-rotate is enabled
     */
    function showAutoRotateIndicator(enabled) {
        const text = enabled ? 'Auto-Rotate: ON' : 'Auto-Rotate: OFF';
        const icon = enabled ? '📱' : '🔒';
        showFullscreenNotification(`${icon} ${text}`, 2000, 'center');
    }
    
    /**
     * Format time in MM:SS format
     * @param {number} seconds - Time in seconds
     * @returns {string} Formatted time string
     */
    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    
    /**
     * Create smooth fade transition for fullscreen enter/exit
     * @param {HTMLElement} element - Element to animate
     * @param {string} type - 'enter' or 'exit'
     */
    function animateFullscreenTransition(element, type) {
        element.classList.remove('entering-fullscreen', 'exiting-fullscreen');
        
        if (type === 'enter') {
            element.classList.add('entering-fullscreen');
            setTimeout(() => {
                element.classList.remove('entering-fullscreen');
            }, 300);
        } else if (type === 'exit') {
            element.classList.add('exiting-fullscreen');
            setTimeout(() => {
                element.classList.remove('exiting-fullscreen');
            }, 300);
        }
    }
    
    /**
     * Update fullscreen time displays
     * @param {number} currentTime - Current playback time
     * @param {number} duration - Total duration
     */
    function updateFullscreenTimeDisplays(currentTime, duration) {
        const currentTimeEl = document.getElementById('currentTimeFullscreen');
        const durationEl = document.getElementById('durationFullscreen');
        
        if (currentTimeEl) {
            currentTimeEl.textContent = formatTime(currentTime);
        }
        
        if (durationEl) {
            durationEl.textContent = formatTime(duration);
        }
    }
    
    /**
     * Sync fullscreen controls with main controls
     * @param {Object} playerState - Current player state
     */
    function syncFullscreenControls(playerState) {
        const {
            isPlaying = false,
            volume = 1,
            currentTime = 0,
            duration = 0,
            currentRotation = 0,
            isFitToScreen = false
        } = playerState;
        
        // Update play/pause button
        const playPauseBtn = document.getElementById('playPauseFullscreen');
        if (playPauseBtn) {
            playPauseBtn.textContent = isPlaying ? 'Pause' : 'Play';
        }
        
        // Update volume slider
        const volumeSlider = document.getElementById('volumeSliderFullscreen');
        if (volumeSlider) {
            volumeSlider.value = volume;
        }
        
        // Update time displays
        updateFullscreenTimeDisplays(currentTime, duration);
        
        // Update transform buttons
        const rotateBtn = document.getElementById('rotateFullscreen');
        if (rotateBtn) {
            rotateBtn.textContent = currentRotation === 0 ? 'Rotate' : `${currentRotation}°`;
        }
        
        const fitBtn = document.getElementById('fitFullscreen');
        if (fitBtn) {
            fitBtn.textContent = isFitToScreen ? 'Unfit' : 'Fit';
        }
    }
    
    /**
     * Setup fullscreen control event listeners
     * @param {Object} playerMethods - Player control methods
     */
    function setupFullscreenControlListeners(playerMethods) {
        const {
            togglePlayPause,
            setVolume,
            rotateVideo,
            toggleFitToScreen,
            exitFullscreen,
            seekToPercentage
        } = playerMethods;
        
        // Play/pause button
        const playPauseBtn = document.getElementById('playPauseFullscreen');
        if (playPauseBtn) {
            playPauseBtn.addEventListener('click', togglePlayPause);
        }
        
        // Volume slider
        const volumeSlider = document.getElementById('volumeSliderFullscreen');
        if (volumeSlider) {
            volumeSlider.addEventListener('input', (e) => {
                const volume = parseFloat(e.target.value);
                setVolume(volume);
                showVolumeIndicator(volume);
            });
        }
        
        // Transform controls
        const rotateBtn = document.getElementById('rotateFullscreen');
        if (rotateBtn) {
            rotateBtn.addEventListener('click', rotateVideo);
        }
        
        const fitBtn = document.getElementById('fitFullscreen');
        if (fitBtn) {
            fitBtn.addEventListener('click', toggleFitToScreen);
        }
        
        // Exit fullscreen button
        const exitBtn = document.getElementById('exitFullscreen');
        if (exitBtn) {
            exitBtn.addEventListener('click', exitFullscreen);
        }
        
        // Progress bar seeking
        const progressContainer = document.querySelector('.controls-overlay .progress-container');
        if (progressContainer) {
            progressContainer.addEventListener('click', (e) => {
                const rect = progressContainer.getBoundingClientRect();
                const percentage = ((e.clientX - rect.left) / rect.width) * 100;
                seekToPercentage(percentage);
            });
        }
    }
    
    /**
     * Initialize enhanced fullscreen UI
     * @param {Object} playerMethods - Player control methods
     */
    function initializeFullscreenUI(playerMethods) {
        setupFullscreenControlListeners(playerMethods);
        
        console.log('Enhanced fullscreen UI initialized');
    }
    
    return {
        showDoubleTapIndicator,
        showFullscreenNotification,
        showVolumeIndicator,
        showSeekIndicator,
        showPlaybackRateIndicator,
        showRotationIndicator,
        showAutoRotateIndicator,
        animateFullscreenTransition,
        updateFullscreenTimeDisplays,
        syncFullscreenControls,
        setupFullscreenControlListeners,
        initializeFullscreenUI,
        formatTime
    };
})();

// Integration with existing player - add this to your main.js or player initialization
document.addEventListener('DOMContentLoaded', () => {
    // Initialize enhanced fullscreen UI when player is ready
    if (typeof Player !== 'undefined') {
        // Setup player methods for fullscreen controls
        const playerMethods = {
            togglePlayPause: () => Player.getVideoElement()?.paused ? 
                Player.getVideoElement().play() : Player.getVideoElement().pause(),
            setVolume: (volume) => {
                if (Player.getVideoElement()) {
                    Player.getVideoElement().volume = volume;
                }
            },
            rotateVideo: () => Player.rotateVideo(),
            toggleFitToScreen: () => Player.toggleFitToScreen(),
            exitFullscreen: () => Player.exitVideoFullscreenMode(),
            seekToPercentage: (percentage) => {
                const video = Player.getVideoElement();
                if (video && video.duration) {
                    video.currentTime = (percentage / 100) * video.duration;
                }
            }
        };
        
        // Initialize fullscreen UI
        FullscreenUIUtils.initializeFullscreenUI(playerMethods);
        
        // Listen for player events to sync fullscreen UI
        document.addEventListener('video:play', () => {
            if (document.querySelector('.video-container.fullscreen')) {
                FullscreenUIUtils.syncFullscreenControls({
                    isPlaying: true,
                    volume: Player.getVideoElement()?.volume || 1,
                    currentTime: Player.getVideoElement()?.currentTime || 0,
                    duration: Player.getVideoElement()?.duration || 0
                });
            }
        });
        
        document.addEventListener('video:pause', () => {
            if (document.querySelector('.video-container.fullscreen')) {
                FullscreenUIUtils.syncFullscreenControls({
                    isPlaying: false,
                    volume: Player.getVideoElement()?.volume || 1,
                    currentTime: Player.getVideoElement()?.currentTime || 0,
                    duration: Player.getVideoElement()?.duration || 0
                });
            }
        });
        
        document.addEventListener('video:timeUpdate', (e) => {
            if (document.querySelector('.video-container.fullscreen')) {
                const { currentTime, percentage } = e.detail;
                const video = Player.getVideoElement();
                
                FullscreenUIUtils.updateFullscreenTimeDisplays(currentTime, video?.duration || 0);
                
                // Update progress bar
                const progressBar = document.getElementById('progressBarFullscreen');
                if (progressBar) {
                    progressBar.style.width = percentage + '%';
                }
            }
        });
        
        // Listen for rotation events
        document.addEventListener('video:rotated', (e) => {
            if (document.querySelector('.video-container.fullscreen')) {
                FullscreenUIUtils.showRotationIndicator(e.detail.rotation);
            }
        });
        
        // Listen for auto-rotate events
        document.addEventListener('video:autoRotateToggled', (e) => {
            if (document.querySelector('.video-container.fullscreen')) {
                FullscreenUIUtils.showAutoRotateIndicator(e.detail.autoRotate);
            }
        });
    }
});
