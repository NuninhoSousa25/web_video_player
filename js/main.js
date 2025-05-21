/**
 * Enhanced Sensor Video Processor - Main Module
 * Core initialization and application entry point
 */

// Initialize the application when the DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Initialize all modules in the correct order
    window.ui.initializeUI();
    window.player.initializePlayer();
    window.sensors.initializeSensors();
    window.pointCloud.initializePointCloud();
    window.mappings.initializeMappings();
    
    console.log('Enhanced Sensor Video Processor initialized successfully');
});

// Global error handler
window.addEventListener('error', function(e) {
    console.error('Application error:', e.error || e.message);
    
    // Handle critical errors
    if (e.error && e.error.message && e.error.message.includes("SecurityError")) {
        alert("Security Error: This may be due to cross-origin restrictions. Try a different video source or use a local file.");
    }
});

// Handle window resize for point cloud canvas
window.addEventListener('resize', function() {
    if (window.currentMode === 'pointCloud') {
        window.pointCloud.setupPointCloudCanvasDimensions();
    }
});

// Handle fullscreen change events
document.addEventListener('fullscreenchange', function() {
    const isFullscreen = Boolean(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
    );
    
    if (!isFullscreen) {
        // Clean up any fullscreen modes that might be active
        const videoContainer = document.getElementById('mainVideoContainer');
        const pointCloudContainer = document.getElementById('mainPointCloudContainer');
        
        if (videoContainer.classList.contains('fullscreen')) {
            videoContainer.classList.remove('fullscreen');
            document.body.style.overflow = '';
        }
        
        if (pointCloudContainer.classList.contains('fullscreen')) {
            pointCloudContainer.classList.remove('fullscreen');
            document.body.style.overflow = '';
        }
    }
});