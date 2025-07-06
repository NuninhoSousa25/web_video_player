// js/utils/animation.js
const AnimationUtils = (function() {
    
    // Global registry to track all active animations
    const activeAnimations = new Map();
    let animationIdCounter = 0;
    
    /**
     * Create a managed animation loop with automatic cleanup
     * @param {string} name - Unique name for the animation
     * @param {Function} frameCallback - Function to call on each frame
     * @param {Object} options - Configuration options
     * @returns {Object} Animation controller
     */
    function createAnimation(name, frameCallback, options = {}) {
        const {
            autoStart = false,
            onStart = () => {},
            onStop = () => {},
            onError = (error) => console.error('Animation error:', error)
        } = options;
        
        let animationId = null;
        let isRunning = false;
        let isPaused = false;
        let frameCount = 0;
        let startTime = null;
        let pauseTime = null;
        let totalPauseTime = 0;
        
        const animationKey = `${name}_${++animationIdCounter}`;
        
        function frame(timestamp) {
            if (!isRunning || isPaused) return;
            
            if (!startTime) {
                startTime = timestamp;
            }
            
            try {
                const elapsedTime = timestamp - startTime - totalPauseTime;
                const shouldContinue = frameCallback(timestamp, elapsedTime, frameCount++);
                
                if (shouldContinue !== false && isRunning) {
                    animationId = requestAnimationFrame(frame);
                } else {
                    stop();
                }
            } catch (error) {
                onError(error);
                stop();
            }
        }
        
        function start() {
            if (isRunning) return;
            
            isRunning = true;
            isPaused = false;
            frameCount = 0;
            startTime = null;
            totalPauseTime = 0;
            
            activeAnimations.set(animationKey, { name, stop });
            animationId = requestAnimationFrame(frame);
            
            onStart();
        }
        
        function stop() {
            if (!isRunning) return;
            
            isRunning = false;
            isPaused = false;
            
            if (animationId) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }
            
            activeAnimations.delete(animationKey);
            onStop();
        }
        
        function pause() {
            if (!isRunning || isPaused) return;
            
            isPaused = true;
            pauseTime = performance.now();
            
            if (animationId) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }
        }
        
        function resume() {
            if (!isRunning || !isPaused) return;
            
            if (pauseTime) {
                totalPauseTime += performance.now() - pauseTime;
                pauseTime = null;
            }
            
            isPaused = false;
            animationId = requestAnimationFrame(frame);
        }
        
        function restart() {
            stop();
            start();
        }
        
        if (autoStart) {
            start();
        }
        
        return {
            start,
            stop,
            pause,
            resume,
            restart,
            get isRunning() { return isRunning; },
            get isPaused() { return isPaused; },
            get frameCount() { return frameCount; },
            get name() { return name; }
        };
    }
    
    /**
     * Stop all active animations
     * @param {string} [nameFilter] - Optional filter to stop only animations with matching name
     */
    function stopAllAnimations(nameFilter) {
        for (const [key, animation] of activeAnimations) {
            if (!nameFilter || animation.name.includes(nameFilter)) {
                animation.stop();
            }
        }
    }
    
    /**
     * Get information about active animations
     * @returns {Array} Array of active animation info
     */
    function getActiveAnimations() {
        return Array.from(activeAnimations.entries()).map(([key, animation]) => ({
            key,
            name: animation.name
        }));
    }
    
    /**
     * Create a simple timeout using requestAnimationFrame
     * @param {Function} callback - Function to call after delay
     * @param {number} delay - Delay in milliseconds
     * @returns {Function} Cancel function
     */
    function createAnimationTimeout(callback, delay) {
        let startTime = null;
        let animationId = null;
        let cancelled = false;
        
        function frame(timestamp) {
            if (cancelled) return;
            
            if (!startTime) {
                startTime = timestamp;
            }
            
            if (timestamp - startTime >= delay) {
                callback();
            } else {
                animationId = requestAnimationFrame(frame);
            }
        }
        
        animationId = requestAnimationFrame(frame);
        
        return function cancel() {
            cancelled = true;
            if (animationId) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }
        };
    }
    
    /**
     * Throttle a function to run at most once per animation frame
     * @param {Function} func - Function to throttle
     * @returns {Function} Throttled function
     */
    function throttleAnimationFrame(func) {
        let animationId = null;
        let args = null;
        
        return function throttled(...newArgs) {
            args = newArgs;
            
            if (animationId === null) {
                animationId = requestAnimationFrame(() => {
                    func.apply(this, args);
                    animationId = null;
                    args = null;
                });
            }
        };
    }
    
    /**
     * Create a performance monitor for animations
     * @param {string} name - Name of the animation to monitor
     * @returns {Object} Performance monitor
     */
    function createPerformanceMonitor(name) {
        let frameCount = 0;
        let startTime = null;
        let lastFrameTime = null;
        let minFrameTime = Infinity;
        let maxFrameTime = 0;
        let totalFrameTime = 0;
        
        function recordFrame(timestamp) {
            if (!startTime) {
                startTime = timestamp;
                lastFrameTime = timestamp;
                return;
            }
            
            const frameTime = timestamp - lastFrameTime;
            frameCount++;
            
            minFrameTime = Math.min(minFrameTime, frameTime);
            maxFrameTime = Math.max(maxFrameTime, frameTime);
            totalFrameTime += frameTime;
            
            lastFrameTime = timestamp;
        }
        
        function getStats() {
            if (frameCount === 0) {
                return {
                    fps: 0,
                    avgFrameTime: 0,
                    minFrameTime: 0,
                    maxFrameTime: 0,
                    totalTime: 0
                };
            }
            
            const totalTime = lastFrameTime - startTime;
            const avgFrameTime = totalFrameTime / frameCount;
            const fps = 1000 / avgFrameTime;
            
            return {
                fps: Math.round(fps * 100) / 100,
                avgFrameTime: Math.round(avgFrameTime * 100) / 100,
                minFrameTime: Math.round(minFrameTime * 100) / 100,
                maxFrameTime: Math.round(maxFrameTime * 100) / 100,
                totalTime: Math.round(totalTime)
            };
        }
        
        function reset() {
            frameCount = 0;
            startTime = null;
            lastFrameTime = null;
            minFrameTime = Infinity;
            maxFrameTime = 0;
            totalFrameTime = 0;
        }
        
        function logStats() {
            const stats = getStats();
            console.log(`[${name}] FPS: ${stats.fps}, Avg: ${stats.avgFrameTime}ms, Min: ${stats.minFrameTime}ms, Max: ${stats.maxFrameTime}ms`);
        }
        
        return {
            recordFrame,
            getStats,
            reset,
            logStats
        };
    }
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        stopAllAnimations();
    });
    
    return {
        createAnimation,
        stopAllAnimations,
        getActiveAnimations,
        createAnimationTimeout,
        throttleAnimationFrame,
        createPerformanceMonitor
    };
})();