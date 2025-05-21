/**
 * Enhanced Sensor Video Processor - Utility Functions
 * Contains helper functions used across multiple modules
 */

// Format time (mm:ss)
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
}

// Normalize a value to 0-1 range
function normalizeSensorValue(value, min, max) {
    return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

// Map a value from one range to another
function mapValue(value, inMin, inMax, outMin, outMax) {
    return outMin + (outMax - outMin) * (value - inMin) / (inMax - inMin);
}

// Apply smoothing to a value based on previous value and smoothing factor
function applySmoothing(value, previousValue, smoothingFactor) {
    if (smoothingFactor === 0) return value;
    return previousValue * smoothingFactor + value * (1 - smoothingFactor);
}

// Local storage functions
function saveToLocalStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.error(`Error saving ${key} to local storage:`, e);
    }
}

function loadFromLocalStorage(key, defaultValue) {
    try {
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : defaultValue;
    } catch (e) {
        console.error(`Error loading ${key} from local storage:`, e);
        return defaultValue;
    }
}

// Generate a unique ID
function generateId() {
    return Math.floor(Math.random() * 1000000);
}

// Get element by ID with error handling
function getElement(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.error(`Element with ID "${id}" not found`);
    }
    return element;
}

// Toggle element visibility
function toggleElementVisibility(element, isVisible) {
    if (!element) return;
    element.classList.toggle('hidden', !isVisible);
}

// Export all utility functions to global scope for use across modules
window.utils = {
    formatTime,
    normalizeSensorValue,
    mapValue,
    applySmoothing,
    saveToLocalStorage,
    loadFromLocalStorage,
    generateId,
    getElement,
    toggleElementVisibility
};