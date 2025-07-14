// js/utils/fullscreen.js
const FullscreenUtils = (function() {
    
    /**
     * Check if any element is currently in fullscreen
     * @returns {boolean} True if in fullscreen mode
     */
    function isInFullscreen() {
        return !!(document.fullscreenElement || 
                 document.webkitIsFullScreen || 
                 document.mozFullScreen || 
                 document.msFullscreenElement);
    }
    
    /**
     * Request fullscreen for an element with cross-browser support
     * @param {HTMLElement} element - Element to make fullscreen
     * @returns {Promise} Promise that resolves when fullscreen is entered
     */
    function requestFullscreen(element) {
        if (!element) {
            return Promise.reject(new Error('Element is required for fullscreen'));
        }
        
        if (element.requestFullscreen) {
            return element.requestFullscreen();
        } else if (element.webkitRequestFullscreen) {
            return element.webkitRequestFullscreen();
        } else if (element.mozRequestFullScreen) {
            return element.mozRequestFullScreen();
        } else if (element.msRequestFullscreen) {
            return element.msRequestFullscreen();
        } else {
            return Promise.reject(new Error('Fullscreen not supported'));
        }
    }
    
    /**
     * Exit fullscreen with cross-browser support
     * @returns {Promise} Promise that resolves when fullscreen is exited
     */
    function exitFullscreen() {
        if (document.exitFullscreen) {
            return document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            return document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            return document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
            return document.msExitFullscreen();
        } else {
            return Promise.reject(new Error('Exit fullscreen not supported'));
        }
    }
    
    /**
     * Add fullscreen change event listeners with cross-browser support
     * @param {Function} callback - Function to call on fullscreen change
     * @returns {Function} Cleanup function to remove listeners
     */
    function addFullscreenChangeListener(callback) {
        const events = [
            'fullscreenchange',
            'webkitfullscreenchange', 
            'mozfullscreenchange',
            'MSFullscreenChange'
        ];
        
        events.forEach(event => {
            document.addEventListener(event, callback);
        });
        
        // Return cleanup function
        return function cleanup() {
            events.forEach(event => {
                document.removeEventListener(event, callback);
            });
        };
    }
    
    /**
     * Manage fullscreen state for a container element
     * @param {HTMLElement} container - Container element
     * @param {Object} options - Configuration options
     * @returns {Object} Fullscreen manager with enter/exit methods
     */
    function createFullscreenManager(container, options = {}) {
        const {
            onEnter = () => {},
            onExit = () => {},
            onError = (error) => console.error('Fullscreen error:', error),
            addBodyOverflowHidden = true,
            fullscreenClass = 'fullscreen'
        } = options;
        
        let isFullscreen = false;
        let cleanupListener = null;
        
        function handleFullscreenChange() {
            const nowInFullscreen = isInFullscreen();
            
            if (isFullscreen && !nowInFullscreen) {
                // Exited fullscreen
                exitFullscreenMode();
            }
        }
        
        function enterFullscreenMode() {
            if (isFullscreen) return Promise.resolve();
            
            return requestFullscreen(container)
                .then(() => {
                    isFullscreen = true;
                    container.classList.add(fullscreenClass);
                    
                    if (addBodyOverflowHidden) {
                        document.body.style.overflow = 'hidden';
                    }
                    
                    // Setup listener for external exits (like Esc key)
                    if (!cleanupListener) {
                        cleanupListener = addFullscreenChangeListener(handleFullscreenChange);
                    }
                    
                    onEnter();
                })
                .catch(error => {
                    onError(error);
                    throw error;
                });
        }
        
        function exitFullscreenMode() {
            if (!isFullscreen) return Promise.resolve();
            
            const exitPromise = isInFullscreen() ? exitFullscreen() : Promise.resolve();
            
            return exitPromise
                .then(() => {
                    isFullscreen = false;
                    container.classList.remove(fullscreenClass);
                    
                    if (addBodyOverflowHidden) {
                        document.body.style.overflow = '';
                    }
                    
                    onExit();
                })
                .catch(error => {
                    // Still cleanup even if exit fails
                    isFullscreen = false;
                    container.classList.remove(fullscreenClass);
                    
                    if (addBodyOverflowHidden) {
                        document.body.style.overflow = '';
                    }
                    
                    onError(error);
                    throw error;
                });
        }
        
        function toggleFullscreen() {
            return isFullscreen ? exitFullscreenMode() : enterFullscreenMode();
        }
        
        function destroy() {
            if (cleanupListener) {
                cleanupListener();
                cleanupListener = null;
            }
            
            if (isFullscreen) {
                exitFullscreenMode();
            }
        }
        
        return {
            enter: enterFullscreenMode,
            exit: exitFullscreenMode,
            toggle: toggleFullscreen,
            destroy,
            get isFullscreen() { return isFullscreen; }
        };
    }
    
    /**
     * Add double-tap/double-click fullscreen handling to an element
     * @param {HTMLElement} element - Element to add handlers to
     * @param {Function} toggleCallback - Function to call on double tap/click
     * @param {number} [tapDelay=300] - Max time between taps in ms
     */
    function addDoubleTabFullscreenHandler(element, toggleCallback, tapDelay = 300) {
        let lastTap = 0;
        
        // Double tap for touch devices
        function handleTouchEnd(e) {
            const currentTime = Date.now();
            if (currentTime - lastTap < tapDelay) {
                e.preventDefault();
                toggleCallback();
            }
            lastTap = currentTime;
        }
        
        // Double click for mouse
        function handleDoubleClick(e) {
            e.preventDefault();
            toggleCallback();
        }
        
        element.addEventListener('touchend', handleTouchEnd);
        element.addEventListener('dblclick', handleDoubleClick);
        
        // Return cleanup function
        return function cleanup() {
            element.removeEventListener('touchend', handleTouchEnd);
            element.removeEventListener('dblclick', handleDoubleClick);
        };
    }
    
    return {
        isInFullscreen,
        requestFullscreen,
        exitFullscreen,
        addFullscreenChangeListener,
        createFullscreenManager,
        addDoubleTabFullscreenHandler
    };
})();
