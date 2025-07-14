// js/player/core.js - Point cloud references removed
const PlayerCore = (function() {
    
    // Core elements
    let videoPlayer, fileInput, fileName, currentTimeEl, durationEl;
    let isLooping = true;
    let wakeLock = null;
    
    // DOM element mapping for caching
    const ELEMENT_IDS = {
        videoPlayer: 'videoPlayer',
        fileInput: 'fileInput', 
        fileName: 'fileName',
        currentTime: 'currentTime',
        duration: 'duration'
    };
    
    function cacheDOMElements() {
        const elements = DOMUtils.cacheElementsWithMapping(ELEMENT_IDS);
        videoPlayer = elements.videoPlayer;
        fileInput = elements.fileInput;
        fileName = elements.fileName;
        currentTimeEl = elements.currentTime;
        durationEl = elements.duration;
    }
    
    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
    }
    
    function handlePlayError(error) {
        console.error("Video play error:", error);
        // Could add user notification here
    }
    
    function loadVideoFile(file) {
        if (!file || !videoPlayer) return;
        
        const videoURL = URL.createObjectURL(file);
        videoPlayer.src = videoURL;
        videoPlayer.loop = isLooping;
        
        DOMUtils.updateText(fileName, file.name);
        
        // Trigger UI updates via event
        document.dispatchEvent(new CustomEvent('video:loaded', {
            detail: { file, videoURL }
        }));
    }
    
    function togglePlayPause() {
        if (!videoPlayer) return;
        
        if (videoPlayer.paused || videoPlayer.ended) {
            videoPlayer.play().catch(handlePlayError);
        } else {
            videoPlayer.pause();
        }
    }
    
    function toggleLoop() {
        isLooping = !isLooping;
        if (videoPlayer) {
            videoPlayer.loop = isLooping;
        }
        
        document.dispatchEvent(new CustomEvent('video:loopChanged', {
            detail: { isLooping }
        }));
    }
    
    function seekTo(time) {
        if (videoPlayer && videoPlayer.duration) {
            videoPlayer.currentTime = Math.max(0, Math.min(time, videoPlayer.duration));
        }
    }
    
    function seekToPercentage(percentage) {
        if (videoPlayer && videoPlayer.duration) {
            const time = (percentage / 100) * videoPlayer.duration;
            seekTo(time);
        }
    }
    
    async function requestWakeLock() {
        if ('wakeLock' in navigator) {
            try {
                wakeLock = await navigator.wakeLock.request('screen');
                console.log('Wake lock is active');
                return true;
            } catch (err) {
                console.warn('Wake lock request failed:', err);
                return false;
            }
        }
        return false;
    }
    
    function releaseWakeLock() {
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
    }
    
    function setupCoreEventListeners() {
        if (!videoPlayer) return;
        
        // File input handling
        if (fileInput) {
            fileInput.addEventListener('change', function() {
                const file = this.files[0];
                if (file) {
                    loadVideoFile(file);
                }
            });
        }
        
        // Video metadata loaded
        videoPlayer.addEventListener('loadedmetadata', function() {
            DOMUtils.updateText(durationEl, formatTime(videoPlayer.duration));
            
            document.dispatchEvent(new CustomEvent('video:metadataLoaded', {
                detail: {
                    duration: videoPlayer.duration,
                    videoWidth: videoPlayer.videoWidth,
                    videoHeight: videoPlayer.videoHeight
                }
            }));
        });
        
        // Time updates
        videoPlayer.addEventListener('timeupdate', function() {
            if (!videoPlayer.duration) return;
            
            const percentage = (videoPlayer.currentTime / videoPlayer.duration) * 100;
            DOMUtils.updateText(currentTimeEl, formatTime(videoPlayer.currentTime));
            
            document.dispatchEvent(new CustomEvent('video:timeUpdate', {
                detail: {
                    currentTime: videoPlayer.currentTime,
                    percentage: percentage
                }
            }));
        });
        
        // Play/pause events
        videoPlayer.addEventListener('play', () => {
            document.dispatchEvent(new CustomEvent('video:play'));
        });
        
        videoPlayer.addEventListener('pause', () => {
            document.dispatchEvent(new CustomEvent('video:pause'));
        });
        
        videoPlayer.addEventListener('ended', function() {
            document.dispatchEvent(new CustomEvent('video:ended', {
                detail: { loop: videoPlayer.loop }
            }));
        });
        
        // Wake lock management
        document.addEventListener('visibilitychange', async () => {
            if (document.visibilityState === 'visible' && !wakeLock) {
                // Re-request wake lock when page becomes visible again
                await requestWakeLock();
            }
        });
    }
    
    function init() {
        cacheDOMElements();
        setupCoreEventListeners();
        
        // Load saved settings
        loadPlayerSettings();
    }
    
    function loadPlayerSettings() {
        const savedVolume = localStorage.getItem('videoPlayerVolume');
        if (savedVolume && videoPlayer) {
            videoPlayer.volume = parseFloat(savedVolume);
        }
    }
    
    function getVideoElement() {
        return videoPlayer;
    }
    
    function getCurrentTime() {
        return videoPlayer ? videoPlayer.currentTime : 0;
    }
    
    function getDuration() {
        return videoPlayer ? videoPlayer.duration : 0;
    }
    
    function isPaused() {
        return videoPlayer ? videoPlayer.paused : true;
    }
    
    function isEnded() {
        return videoPlayer ? videoPlayer.ended : false;
    }
    
    function getVolume() {
        return videoPlayer ? videoPlayer.volume : 0;
    }
    
    function setVolume(volume) {
        if (videoPlayer) {
            videoPlayer.volume = Math.max(0, Math.min(1, volume));
            localStorage.setItem('videoPlayerVolume', videoPlayer.volume);
        }
    }
    
    function getPlaybackRate() {
        return videoPlayer ? videoPlayer.playbackRate : 1;
    }
    
    function setPlaybackRate(rate) {
        if (videoPlayer) {
            videoPlayer.playbackRate = Math.max(0.25, Math.min(4, rate));
        }
    }
    
    function hasVideo() {
        return videoPlayer && videoPlayer.src && videoPlayer.readyState >= videoPlayer.HAVE_METADATA;
    }
    
    function destroy() {
        releaseWakeLock();
        
        if (videoPlayer && videoPlayer.src) {
            URL.revokeObjectURL(videoPlayer.src);
            videoPlayer.src = '';
        }
    }
    
    return {
        init,
        destroy,
        
        // Playback controls
        togglePlayPause,
        toggleLoop,
        seekTo,
        seekToPercentage,
        
        // Getters
        getVideoElement,
        getCurrentTime,
        getDuration,
        isPaused,
        isEnded,
        getVolume,
        getPlaybackRate,
        hasVideo,
        
        // Setters
        setVolume,
        setPlaybackRate,
        
        // Wake lock
        requestWakeLock,
        releaseWakeLock,
        
        // File handling
        loadVideoFile,
        
        // State
        get isLooping() { return isLooping; }
    };
})();
