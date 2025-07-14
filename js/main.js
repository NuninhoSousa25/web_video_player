// js/main.js - Point cloud feature removed
const App = (function() {
    let player, sensors, mappings, ui, utils, mappingPanel, deviceDetector;

    function exitFullscreenOnEscape(e) {
        if (e.key === 'Escape') {
            const videoContainer = player.getMainVideoContainer();
            // Check if any element is in fullscreen mode first
            if (document.fullscreenElement || document.webkitIsFullScreen) {
                if (videoContainer && videoContainer.classList.contains('fullscreen')) {
                    player.exitVideoFullscreenMode();
                }
            }
        }
    }

    function handleFullscreenChange() {
        // This function is called when browser fullscreen state changes (e.g., by Esc key)
        if (!document.fullscreenElement && !document.webkitIsFullScreen && !document.mozFullScreen && !document.msFullscreenElement) {
            const videoContainer = player.getMainVideoContainer();
            
            if (videoContainer && videoContainer.classList.contains('fullscreen')) {
                player.exitVideoFullscreenMode(); // Call module's exit to clean up classes
            }
        }
    }

    function setupGlobalEventListeners() {
        document.addEventListener('keydown', exitFullscreenOnEscape);
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange); 
        document.addEventListener('mozfullscreenchange', handleFullscreenChange);    
        document.addEventListener('MSFullscreenChange', handleFullscreenChange);   
    }

    function init() {
        player = Player;
        sensors = Sensors;
        mappings = Mappings;
        ui = UI;
        utils = Utils;
        mappingPanel = MappingPanel; 
        deviceDetector = DeviceDetector;

        deviceDetector.init(); // Run device detection

        const getSensorState = () => sensors.isGloballyEnabled();

        player.init();
        
        mappings.init(player, sensors);
        
        // Pass device capabilities to sensors.init for adaptive UI and functionality
        const capabilities = deviceDetector.getCapabilities();
        sensors.init(mappings.applyAllActiveMappings, player, capabilities); 
        
        mappingPanel.init();

        setupGlobalEventListeners();
    }

    return {
        init
    };
})();

document.addEventListener('DOMContentLoaded', App.init);
