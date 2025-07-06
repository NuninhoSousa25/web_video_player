// js/utils/dom.js
const DOMUtils = (function() {
    
    /**
     * Cache multiple DOM elements by their IDs
     * @param {string[]} ids - Array of element IDs to cache
     * @returns {Object} Object with element references
     */
    function cacheElements(ids) {
        const elements = {};
        ids.forEach(id => {
            elements[id] = document.getElementById(id);
            if (!elements[id]) {
                console.warn(`Element not found: ${id}`);
            }
        });
        return elements;
    }
    
    /**
     * Cache elements using a mapping object
     * @param {Object} mapping - Object mapping property names to element IDs
     * @returns {Object} Object with element references
     */
    function cacheElementsWithMapping(mapping) {
        const elements = {};
        Object.entries(mapping).forEach(([key, id]) => {
            elements[key] = document.getElementById(id);
            if (!elements[key]) {
                console.warn(`Element not found: ${id}`);
            }
        });
        return elements;
    }
    
    /**
     * Add event listeners to multiple elements
     * @param {Object} listeners - Object mapping element IDs to event configs
     */
    function addEventListeners(listeners) {
        Object.entries(listeners).forEach(([elementId, events]) => {
            const element = document.getElementById(elementId);
            if (!element) {
                console.warn(`Cannot add listeners to missing element: ${elementId}`);
                return;
            }
            
            Object.entries(events).forEach(([eventType, handler]) => {
                element.addEventListener(eventType, handler);
            });
        });
    }
    
    /**
     * Toggle class on element with optional condition
     * @param {HTMLElement} element - Target element
     * @param {string} className - Class to toggle
     * @param {boolean} [condition] - Optional condition for toggling
     */
    function toggleClass(element, className, condition) {
        if (!element) return;
        
        if (typeof condition === 'boolean') {
            element.classList.toggle(className, condition);
        } else {
            element.classList.toggle(className);
        }
    }
    
    /**
     * Update text content safely
     * @param {HTMLElement} element - Target element
     * @param {string|number} text - Text to set
     */
    function updateText(element, text) {
        if (element) {
            element.textContent = text;
        }
    }
    
    /**
     * Update numeric value with formatting
     * @param {HTMLElement} element - Target element
     * @param {number} value - Numeric value
     * @param {number} [decimals=2] - Number of decimal places
     * @param {string} [suffix=''] - Optional suffix (%, °, etc.)
     */
    function updateNumericValue(element, value, decimals = 2, suffix = '') {
        if (!element) return;
        
        const formattedValue = value != null ? value.toFixed(decimals) : '0.00';
        element.textContent = formattedValue + suffix;
    }
    
    /**
     * Show/hide elements based on condition
     * @param {Object} elements - Object mapping elements to visibility conditions
     */
    function updateVisibility(elements) {
        Object.entries(elements).forEach(([element, shouldShow]) => {
            if (element && element.classList) {
                toggleClass(element, 'hidden', !shouldShow);
            }
        });
    }
    
    /**
     * Create element with attributes and children
     * @param {string} tag - HTML tag name
     * @param {Object} [attributes={}] - Element attributes
     * @param {Array|string} [children=[]] - Child elements or text
     * @returns {HTMLElement} Created element
     */
    function createElement(tag, attributes = {}, children = []) {
        const element = document.createElement(tag);
        
        // Set attributes
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'textContent') {
                element.textContent = value;
            } else {
                element.setAttribute(key, value);
            }
        });
        
        // Add children
        if (typeof children === 'string') {
            element.textContent = children;
        } else if (Array.isArray(children)) {
            children.forEach(child => {
                if (typeof child === 'string') {
                    element.appendChild(document.createTextNode(child));
                } else if (child instanceof HTMLElement) {
                    element.appendChild(child);
                }
            });
        }
        
        return element;
    }
    
    return {
        cacheElements,
        cacheElementsWithMapping,
        addEventListeners,
        toggleClass,
        updateText,
        updateNumericValue,
        updateVisibility,
        createElement
    };
})();