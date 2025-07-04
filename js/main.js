// Enhanced js/main.js with device detection and compatibility
const App = (function() {
    let currentMode = 'videoPlayer'; 
    let deviceInfo = null;

    let showVideoPlayerModeBtn, showPointCloudModeBtn,
        videoPlayerModeContent, pointCloudModeContent,
        sensorMappingInfo;
    
    let player, pointcloud, sensors, mappings, ui, utils, mappingPanel;

    function cacheGlobalDOMElements() {
        showVideoPlayerModeBtn = document.getElementById('showVideoPlayerModeBtn');
        showPointCloudModeBtn = document.getElementById('showPointCloudModeBtn');
        videoPlayerModeContent = document.getElementById('videoPlayerModeContent');
        pointCloudModeContent = document.getElementById('pointCloudModeContent');
        sensorMappingInfo = document.getElementById('sensorMappingInfo');
    }

    function updateModeUI() {
        showVideoPlayerModeBtn.classList.toggle('active', currentMode === 'videoPlayer');
        showPointCloudModeBtn.classList.toggle('active', currentMode === 'pointCloud');

        videoPlayerModeContent.classList.toggle('hidden', currentMode !== 'videoPlayer');
        pointCloudModeContent.classList.toggle('hidden', currentMode !== 'pointCloud');
        
        const videoElement = player.getVideoElement();
        const playerDOM = player.getDOM();

        playerDOM.videoPlaceholder.classList.toggle('hidden', !!videoElement.src);
        playerDOM.videoPlayerControls.classList.toggle('hidden', !videoElement.src || currentMode !== 'videoPlayer');
        playerDOM.videoFilterControls.classList.toggle('hidden', !videoElement.src || currentMode !== 'videoPlayer');

        UI.updateSensorMappingInfoText(sensorMappingInfo, currentMode);
        UI.updateActiveMappingIndicators();
        
        // Update device-specific mode information
        updateDeviceSpecificModeInfo();
    }

    function updateDeviceSpecificModeInfo() {
        if (!deviceInfo) return;
        
        // Add device-specific mode indicators
        const modeInfo = document.createElement('div');
        modeInfo.id = 'device-mode-info';
        modeInfo.style.cssText = `
            background: rgba(44, 123, 229, 0.1);
            border: 1px solid rgba(44, 123, 229, 0.3);
            border-radius: 5px;
            padding: 8px 12px;
            margin-bottom: 10px;
            font-size: 13px;
            color: #2c7be5;
            text-align: center;
        `;
        
        let infoText = '';
        if (deviceInfo.isAndroidTV) {
            if (currentMode === 'videoPlayer') {
                infoText = '📺 Android TV Mode - Use remote/keyboard for controls';
            } else {
                infoText = '📺 Android TV - Virtual sensors via keyboard/gamepad';
            }
        } else if (!deviceInfo.hasTouch) {
            infoText = '🖱️ Desktop Mode - Mouse and keyboard controls';
        } else {
            infoText = '📱 Mobile Mode - Touch and sensor controls';
        }
        
        modeInfo.textContent = infoText;
        
        // Remove existing info
        const existing = document.getElementById('device-mode-info');
        if (existing) existing.remove();
        
        // Add to container
        const container = document.querySelector('.container');
        if (container && infoText) {
            container.insertBefore(modeInfo, container.firstChild.nextSibling);
        }
    }

    function switchMode(newMode) {
        if (newMode === currentMode) return;

        currentMode = newMode;
        updateModeUI();
        const videoElement = player.getVideoElement();

        if (currentMode === 'pointCloud') {
            pointcloud.stopRendering(); 
            if (!videoElement.src || videoElement.readyState < videoElement.HAVE_METADATA) {
                let alertMsg = "Please load and play a video first to use Point Cloud mode.";
                if (deviceInfo && deviceInfo.isAndroidTV) {
                    alertMsg += "\n\nFor Android TV: Use virtual sensors via keyboard/gamepad controls.";
                }
                alert(alertMsg);
                currentMode = 'videoPlayer'; 
                updateModeUI();
                return;
            }
            pointcloud.setupCanvasDimensions();
            if (videoElement.paused) videoElement.play().catch(Utils.handlePlayError); 
            else pointcloud.startRendering(); 
        } else { 
            pointcloud.stopRendering();
        }
    }
    
    function exitFullscreenOnEscape(e) {
        if (e.key === 'Escape') {
            const videoContainer = player.getMainVideoContainer();
            const pcContainer = pointcloud.getMainPointCloudContainer();
            
            if (document.fullscreenElement || document.webkitIsFullScreen) {
                if (videoContainer && videoContainer.classList.contains('fullscreen')) {
                    player.exitVideoFullscreenMode();
                }
                if (pcContainer && pcContainer.classList.contains('fullscreen')) {
                    pointcloud.exitPointCloudFullscreenMode();
                }
            }
        }
    }

    function handleFullscreenChange() {
        if (!document.fullscreenElement && !document.webkitIsFullScreen && !document.mozFullScreen && !document.msFullscreenElement) {
            const videoContainer = player.getMainVideoContainer();
            const pcContainer = pointcloud.getMainPointCloudContainer();
            
            if (videoContainer && videoContainer.classList.contains('fullscreen')) {
                player.exitVideoFullscreenMode();
            }
            if (pcContainer && pcContainer.classList.contains('fullscreen')) {
                pointcloud.exitPointCloudFullscreenMode();
            }
       }
    }

    function setupGlobalEventListeners() {
        showVideoPlayerModeBtn.addEventListener('click', () => switchMode('videoPlayer'));
        showPointCloudModeBtn.addEventListener('click', () => switchMode('pointCloud'));

        document.addEventListener('keydown', exitFullscreenOnEscape);
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange); 
        document.addEventListener('mozfullscreenchange', handleFullscreenChange);    
        document.addEventListener('MSFullscreenChange', handleFullscreenChange);   
    }

    function setupDeviceSpecificFeatures() {
        if (!deviceInfo) return;
        
        // Android TV specific setup
        if (deviceInfo.isAndroidTV) {
            console.log('Setting up Android TV specific features');
            
            // Add TV-specific welcome message
            const welcomeMsg = document.createElement('div');
            welcomeMsg.style.cssText = `
                background: #1a1a1a;
                color: #f0f0f0;
                padding: 15px;
                border-radius: 8px;
                margin: 10px;
                text-align: center;
                border: 2px solid #2c7be5;
            `;
            welcomeMsg.innerHTML = `
                <h3 style="color: #2c7be5; margin-bottom: 10px;">🎉 Android TV Detected!</h3>
                <p style="margin-bottom: 8px;"><strong>Keyboard Controls:</strong></p>
                <p style="font-size: 14px; line-height: 1.4;">
                    <strong>Video:</strong> Space (Play/Pause), F (Fullscreen), L (Loop)<br>
                    <strong>Sensors:</strong> Arrow Keys (Tilt), A/D (Rotate), Q/E (Roll)<br>
                    <strong>Navigation:</strong> Tab (Move), Enter (Select), Esc (Exit)
                </p>
                <button onclick="this.parentElement.remove()" style="
                    margin-top: 10px; 
                    background: #2c7be5; 
                    color: white; 
                    border: none; 
                    padding: 8px 16px; 
                    border-radius: 4px; 
                    cursor: pointer;
                ">Got it!</button>
            `;
            
            document.body.appendChild(welcomeMsg);
            
            // Auto-remove after 10 seconds
            setTimeout(() => {
                if (welcomeMsg.parentElement) {
                    welcomeMsg.remove();
                }
            }, 10000);
            
            // Enhance sensor mapping info for TV
            const sensorSection = document.getElementById('sensorSectionControls');
            if (sensorSection) {
                const tvSensorInfo = document.createElement('div');
                tvSensorInfo.className = 'tv-sensor-info';
                tvSensorInfo.style.cssText = `
                    background: #2d4a87;
                    color: white;
                    padding: 12px;
                    border-radius: 6px;
                    margin-bottom: 15px;
                    text-align: center;
                `;
                tvSensorInfo.innerHTML = `
                    <strong>📺 Android TV Virtual Sensors</strong><br>
                    <small>Press sensor toggle, then use keyboard to simulate device movement</small>
                `;
                
                const sensorHeading = sensorSection.querySelector('.sensor-heading');
                if (sensorHeading) {
                    sensorHeading.parentNode.insertBefore(tvSensorInfo, sensorHeading.nextSibling);
                }
            }
        }
        
        // Desktop specific setup
        if (deviceInfo.type === 'desktop' && !deviceInfo.isAndroidTV) {
            console.log('Setting up desktop specific features');
            
            // Add desktop-friendly tooltips
            addDesktopTooltips();
        }
        
        // Mobile specific setup
        if (deviceInfo.type === 'mobile') {
            console.log('Setting up mobile specific features');
            
            // Add mobile-specific gesture hints
            addMobileGestureHints();
        }
    }

    function addDesktopTooltips() {
        const buttons = document.querySelectorAll('button');
        const tooltips = {
            'playPauseBtn': 'Play/Pause video (Space)',
            'videoFullscreenBtn': 'Toggle fullscreen (F)',
            'loopBtn': 'Toggle loop mode (L)',
            'rotateBtn': 'Rotate video display',
            'fitToScreenBtn': 'Fit video to screen',
            'sensorToggleBtn': 'Enable motion sensors',
            'resetFiltersBtn': 'Reset all video filters',
            'toggleMappingPanelBtn': 'Open sensor mapping panel'
        };
        
        buttons.forEach(btn => {
            if (tooltips[btn.id]) {
                btn.title = tooltips[btn.id];
            }
        });
    }

    function addMobileGestureHints() {
        // Add subtle gesture indicators for mobile
        const style = document.createElement('style');
        style.textContent = `
            .mobile-gesture-hint {
                position: relative;
            }
            
            .mobile-gesture-hint::after {
                content: "👆";
                position: absolute;
                top: -5px;
                right: -5px;
                font-size: 12px;
                opacity: 0.7;
                pointer-events: none;
            }
            
            .video-container.mobile-gesture-hint::after {
                content: "Double tap for fullscreen";
                top: 10px;
                right: 10px;
                background: rgba(0,0,0,0.7);
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 11px;
                font-family: system-ui;
            }
        `;
        document.head.appendChild(style);
        
        // Add gesture hints to key elements
        const videoContainer = document.getElementById('mainVideoContainer');
        const pointCloudContainer = document.getElementById('mainPointCloudContainer');
        
        if (videoContainer) {
            videoContainer.classList.add('mobile-gesture-hint');
        }
        if (pointCloudContainer) {
            pointCloudContainer.classList.add('mobile-gesture-hint');
        }
    }

    async function initializeDeviceDetection() {
        console.log('Initializing device detection...');
        
        try {
            deviceInfo = await DeviceDetection.init();
            console.log('Device detection complete:', deviceInfo);
            
            // Setup device-specific features
            setupDeviceSpecificFeatures();
            
            return deviceInfo;
        } catch (error) {
            console.error('Device detection failed:', error);
            // Fallback to basic detection
            deviceInfo = {
                type: 'unknown',
                platform: 'unknown',
                hasTouch: 'ontouchstart' in window,
                isAndroidTV: false,
                capabilities: {}
            };
            return deviceInfo;
        }
    }

    async function init() {
        console.log('App initialization starting...');
        
        // Initialize device detection first
        await initializeDeviceDetection();
        
        // Cache DOM elements
        cacheGlobalDOMElements();

        // Initialize modules with device awareness
        player = Player;
        pointcloud = PointCloud;
        ui = UI;
        utils = Utils;
        mappingPanel = MappingPanel;

        const getCurrentMode = () => currentMode;
        const getSensorState = () => sensors.isGloballyEnabled();

        // Initialize player (works on all devices)
        player.init(getCurrentMode, pointcloud);
        
        // Initialize point cloud (works on all devices)
        pointcloud.init(player.getVideoElement(), getCurrentMode, getSensorState);
        
        // Initialize mappings system
        mappings = Mappings;
        mappings.init(player, pointcloud, sensors, getCurrentMode);
        
        // Initialize sensors with device detection
        if (deviceInfo && (deviceInfo.isAndroidTV || !DeviceDetection.hasRealSensors())) {
            console.log('Using enhanced sensors for device without real sensors');
            sensors = EnhancedSensors;
        } else {
            console.log('Using standard sensors for device with real sensors');
            sensors = Sensors;
        }
        
        sensors.init(mappings.applyAllActiveMappings, player, pointcloud);
        
        // Initialize mapping panel
        mappingPanel.init();

        // Setup global event listeners
        setupGlobalEventListeners();
        
        // Update UI for initial state
        updateModeUI();
        
        console.log('App initialization complete');
        
        // Show device-specific startup message
        showStartupMessage();
    }

    function showStartupMessage() {
        if (!deviceInfo) return;
        
        let message = '';
        let bgColor = '#2c7be5';
        
        if (deviceInfo.isAndroidTV) {
            message = `🎮 Android TV detected! Virtual sensors and keyboard controls enabled.`;
            bgColor = '#4caf50';
        } else if (deviceInfo.type === 'desktop') {
            message = `💻 Desktop mode active. Keyboard shortcuts available.`;
            bgColor = '#ff9800';
        } else if (deviceInfo.type === 'mobile') {
            message = `📱 Mobile device detected. Touch and sensor controls active.`;
            bgColor = '#2c7be5';
        }
        
        if (message) {
            const toast = document.createElement('div');
            toast.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: ${bgColor};
                color: white;
                padding: 12px 20px;
                border-radius: 25px;
                z-index: 10000;
                font-size: 14px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                transition: all 0.3s ease;
                opacity: 0;
                animation: slideInFade 0.5s ease forwards;
            `;
            
            const style = document.createElement('style');
            style.textContent = `
                @keyframes slideInFade {
                    from {
                        opacity: 0;
                        transform: translateX(-50%) translateY(-20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(-50%) translateY(0);
                    }
                }
            `;
            document.head.appendChild(style);
            
            toast.textContent = message;
            document.body.appendChild(toast);
            
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(-50%) translateY(-20px)';
                setTimeout(() => {
                    if (toast.parentElement) {
                        toast.remove();
                    }
                    style.remove();
                }, 300);
            }, 4000);
        }
    }
    
    function forceSwitchMode(mode) {
        console.warn(`Forcing mode switch to: ${mode}`);
        currentMode = mode; 
        updateModeUI(); 
        if (mode === 'videoPlayer') {
            pointcloud.stopRendering();
        }
    }

    function getDeviceInfo() {
        return deviceInfo;
    }

    return {
        init,
        forceSwitchMode,
        getDeviceInfo
    };
})();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, starting app initialization...');
    App.init().catch(error => {
        console.error('App initialization failed:', error);
        alert('Failed to initialize the application. Please refresh the page.');
    });
});
