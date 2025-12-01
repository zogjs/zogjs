/**
 * Zog,js Library (The Definitive Version)
 * A minimal reactive framework inspired by Vue.js, ready for production build.
 */

// 1. Reactivity System
let activeEffect = null;

class Dep {
    constructor() {
        this.subscribers = new Set();
    }
    depend() {
        if (activeEffect) this.subscribers.add(activeEffect);
    }
    notify() {
        this.subscribers.forEach(effect => effect());
    }
}

/**
 * Executes a function and registers it as an active effect.
 * @param {Function} effect - The function to run and track dependencies for.
 */
export function watchEffect(effect) {
    activeEffect = effect;
    effect();
    activeEffect = null;
}

/**
 * Creates a reactive reference (Ref).
 * @param {*} initialValue - The initial value.
 * @returns {object} A Ref object with a reactive 'value' property.
 */
export function ref(initialValue) {
    let value = initialValue;
    const dep = new Dep();

    // Simple reactivity for arrays (detects whole array replacement, typical for z-for)
    if (Array.isArray(value)) {
        // Simple array logic: we detect the change of the whole array
        // (In more complex versions, push/pop methods should be proxied)
    }

    return {
        _isRef: true,
        get value() {
            dep.depend();
            return value;
        },
        set value(newValue) {
            if (newValue !== value) {
                value = newValue;
                dep.notify();
            }
        },
        toString() { return value; } // For easy display/debugging
    };
}

// 2. Core Engine
/**
 * Initializes the MiniVue application.
 * @param {Function} setupFunction - The function returning reactive state and methods.
 * @returns {object} Application instance with a 'mount' method.
 */
export function createApp(setupFunction) {
    let scope = {}; // Variable storage space

    /**
     * Executes a JavaScript expression in the current scope context (e.g., 'count + 1').
     * @param {string} exp - The expression string.
     * @param {object} elScope - The current compilation scope.
     * @returns {*} The result of the expression.
     */
    const evaluate = (exp, elScope = scope) => {
        try {
            const keys = Object.keys(elScope);
            const values = keys.map(k => {
                return elScope[k] && elScope[k]._isRef ? elScope[k].value : elScope[k];
            });
            return new Function(...keys, `return ${exp}`)(...values);
        } catch (e) { return ""; }
    };

    /**
     * Finds the conditional branches starting from a given element.
     * @param {Element} el - The starting element (must have z-if or z-else-if).
     * @returns {Array<object>} An array of branches: [{el: Element, exp: string/null}].
     */
    const getConditionalBranches = (el) => {
        const branches = [];
        let current = el;

        while (current) {
            if (current.hasAttribute('z-if')) {
                branches.push({ el: current, exp: current.getAttribute('z-if'), type: 'if' });
                current = current.nextElementSibling;
            } else if (current.hasAttribute('z-else-if')) {
                branches.push({ el: current, exp: current.getAttribute('z-else-if'), type: 'else-if' });
                current = current.nextElementSibling;
            } else if (current.hasAttribute('z-else')) {
                branches.push({ el: current, exp: null, type: 'else' });
                break; // z-else is the final branch
            } else {
                break;
            }
        }
        return branches;
    };


    /**
     * DOM Compiler (Recursive)
     * @param {Node} el - The current DOM node.
     * @param {object} localScope - The current compilation scope.
     */
    const compile = (el, localScope = scope) => {
        if (!el) return;

        // --- Handle Text Interpolation: {{ variable }} ---
        if (el.nodeType === 3) { // Text Node
            const content = el.textContent;
            if (content.match(/{{\s*(.*?)\s*}}/)) {
                watchEffect(() => {
                    el.textContent = content.replace(/{{\s*(.*?)\s*}}/g, (_, exp) => {
                        return evaluate(exp, localScope);
                    });
                });
            }
            return;
        }

        if (el.nodeType !== 1) return; // Only work on element nodes

        // --- Handle z-if / z-else-if / z-else (MODIFIED) ---
        if (el.hasAttribute('z-if')) {
            const branches = getConditionalBranches(el);
            const parent = el.parentNode;
            
            // 1. Compile all attributes (z-text, :attr, etc.) and children of all branches
            // before removing them from the DOM. This ensures all directives are tracked.
            branches.forEach(branch => {
                compileAttributes(branch.el, localScope); 
                Array.from(branch.el.childNodes).forEach(child => compile(child, localScope));
            });

            // 2. Manage the block rendering
            
            // Create a single placeholder for the entire conditional block
            const placeholder = document.createComment("z-if block");
            parent.insertBefore(placeholder, el);

            // Remove all branches from the DOM initially
            branches.forEach(branch => branch.el.remove());

            watchEffect(() => {
                let elementToRender = null;
                
                // Find the first truthy branch
                for (const branch of branches) {
                    const condition = branch.type === 'else' ? true : evaluate(branch.exp, localScope);
                    
                    if (condition) {
                        elementToRender = branch.el;
                        break;
                    }
                }
                
                // Remove any currently rendered branch that is no longer the match
                branches.forEach(branch => {
                    if (branch.el !== elementToRender && document.contains(branch.el)) {
                        branch.el.remove();
                    }
                });

                // Insert the matching branch
                if (elementToRender && !document.contains(elementToRender)) {
                    parent.insertBefore(elementToRender, placeholder);
                }
            });
            
            // Stop processing on the z-if element, as the whole block is handled.
            return; 
        }
        
        // Skip compilation of z-else-if and z-else elements, as they are part of the z-if block.
        if (el.hasAttribute('z-else-if') || el.hasAttribute('z-else')) return;


        // --- Handle z-for ---
        if (el.hasAttribute('z-for')) {
            const exp = el.getAttribute('z-for'); // "item in items"
            const [itemKey, listKey] = exp.split(' in ').map(s => s.trim());
            const parent = el.parentNode;
            const placeholder = document.createComment("z-for");
            parent.insertBefore(placeholder, el);
            el.remove(); // Remove the template element

            let clones = [];

            watchEffect(() => {
                // Clear previous clones
                clones.forEach(c => c.remove());
                clones = [];

                const list = evaluate(listKey, localScope); // Get the array
                
                if (Array.isArray(list)) {
                    list.forEach((itemVal, index) => {
                        const clone = el.cloneNode(true);
                        clone.removeAttribute('z-for');
                        parent.insertBefore(clone, placeholder);
                        clones.push(clone);

                        // Create new scope including the loop item
                        const newScope = { ...localScope, [itemKey]: { value: itemVal, _isRef: true }, index };
                        
                        // Recursive compilation for cloned children
                        Array.from(clone.childNodes).forEach(child => compile(child, newScope));
                        
                        // Compile the cloned element itself for other attributes
                        compileAttributes(clone, newScope);
                    });
                }
            });
            return; // Stop processing on the original template
        }

        // Process other attributes
        compileAttributes(el, localScope);

        // Compile children
        Array.from(el.childNodes).forEach(child => compile(child, localScope));
    };

    /**
     * Compiles attributes, handling directives and dynamic attributes.
     * @param {Element} el - The current element.
     * @param {object} localScope - The current compilation scope.
     */
    const compileAttributes = (el, localScope) => {
        // Use a copy of the attributes array to avoid issues when removing attributes in the loop
        const attrs = Array.from(el.attributes);
        
        attrs.forEach(attr => {
            const { name, value } = attr;

            // --- z-model (Comprehensive Support for ALL Input Types) ---
            if (name === 'z-model') {
                el.removeAttribute('z-model');
                const type = el.getAttribute('type');
                const tagName = el.tagName.toLowerCase();

                if (type === 'checkbox') {
                    // Checkbox: binds to `checked` property, updates on `change` event.
                    el.addEventListener('change', () => {
                        if (localScope[value]) localScope[value].value = el.checked;
                    });
                    watchEffect(() => el.checked = evaluate(value, localScope));

                } else if (type === 'radio') {
                    // Radio: binds to `checked` property, updates model with `el.value` on `change`.
                    el.addEventListener('change', () => {
                        if (el.checked && localScope[value]) localScope[value].value = el.value;
                    });
                    watchEffect(() => {
                        // Check if the model value matches this radio button's static value
                        el.checked = (evaluate(value, localScope) === el.value);
                    });
                } else if (tagName === 'select') {
                    // Select: binds to `value` property, updates on `change` event.
                    el.addEventListener('change', (e) => {
                        if (localScope[value]) localScope[value].value = e.target.value;
                    });
                    watchEffect(() => el.value = evaluate(value, localScope));

                } else {
                    // Default: Text inputs, textarea, range, etc. (uses `input` event and `value` property).
                    el.addEventListener('input', (e) => {
                        if (localScope[value]) localScope[value].value = e.target.value;
                    });
                    watchEffect(() => {
                        el.value = evaluate(value, localScope);
                    });
                }
            }

            // --- @click, @input, ... (Events) ---
            if (name.startsWith('@')) {
                const eventName = name.slice(1);
                el.removeAttribute(name);
                const handler = (e) => {
                     const fn = localScope[value];
                     // Execute function if it exists, otherwise evaluate the expression
                     if(typeof fn === 'function') fn(e);
                     else evaluate(value, localScope);
                };
                el.addEventListener(eventName, handler);
            }

            // --- :attr (Dynamic Attributes) ---
            if (name.startsWith(':')) {
                const attrName = name.slice(1);
                el.removeAttribute(name); 
                
                watchEffect(() => {
                    const result = evaluate(value, localScope);
                    
                    // Special handling for style and class objects
                    if (attrName === 'style' && typeof result === 'object') {
                        Object.assign(el.style, result);
                    } else if (attrName === 'class' && typeof result === 'object') {
                         // Simple object class handler: { 'active': true }
                         const classes = Object.keys(result).filter(k => result[k]).join(' ');
                         el.setAttribute('class', classes);
                    } else {
                        // Default attributes (src, href, value, etc.)
                        el.setAttribute(attrName, result);
                    }
                });
            }

            // --- z-text ---
            if (name === 'z-text') {
                el.removeAttribute('z-text');
                watchEffect(() => el.textContent = evaluate(value, localScope));
            }
            
            // --- z-html ---
            if (name === 'z-html') {
                el.removeAttribute('z-html');
                watchEffect(() => el.innerHTML = evaluate(value, localScope));
            }
            
            // --- z-show ---
            if (name === 'z-show') {
                el.removeAttribute('z-show');
                watchEffect(() => {
                    // Hides the element by setting display: none
                    el.style.display = evaluate(value, localScope) ? '' : 'none';
                });
            }

            // Note: 'rel' directive removed as it seems custom and non-standard.
        });
    };

    return {
        /**
         * Mounts the application to a specified DOM element.
         * @param {string} selector - The CSS selector for the root element.
         */
        mount(selector) {
            const root = document.querySelector(selector);
            scope = setupFunction(); // Execute user's setup function
            compile(root, scope);
        }
    };
}