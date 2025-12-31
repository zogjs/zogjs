/**
 * Zog.js v0.4.8 - Minimal reactive framework
 * 
 * A lightweight Vue-inspired reactive framework for small to medium projects.
 * Provides reactivity, template binding, and directives without build steps.
 * 
 * Features:
 * - Reactive state with ref() and reactive()
 * - Computed properties with computed()
 * - Template interpolation {{ expression }}
 * - Directives: z-if, z-else-if, z-else, z-for, z-model, z-show, z-text, z-html
 * - Event binding: @event or z-on:event
 * - Attribute binding: :attr or z-bind:attr
 * - Plugin system for extensibility
 * 
 * @example
 * // Basic usage
 * import { createApp, ref, reactive } from './zog.js';
 * 
 * createApp(() => ({
 *   count: ref(0),
 *   items: reactive([{ name: 'Item 1' }]),
 *   increment() { this.count.value++ }
 * })).mount('#app');
 * 
 * @license MIT
 */

// =============================================================================
// REACTIVITY CORE
// =============================================================================
// The reactivity system is based on the Observer pattern.
// When a reactive value is read, the current effect is tracked as a subscriber.
// When the value changes, all subscribers are notified to re-run.
// =============================================================================

/** Currently running effect (used for dependency tracking) */
let activeEffect = null;

/** Stack of nested effects (supports computed inside computed, etc.) */
const effectStack = [];

/** Current scope for automatic effect registration */
let currentScope = null;

/**
 * Dependency tracker class
 * Each reactive property has its own Dep instance to track which effects depend on it
 */
class Dep {
    /** Set of effects that depend on this value */
    subs = new Set();
    
    /**
     * Track the current effect as a subscriber
     * Called when a reactive value is READ
     */
    depend() {
        if (activeEffect && !this.subs.has(activeEffect)) {
            this.subs.add(activeEffect);
            activeEffect.deps.push(this);
        }
    }
    
    /**
     * Notify all subscribers that the value has changed
     * Called when a reactive value is WRITTEN
     */
    notify() {
        // Create a copy to avoid issues if subs is modified during iteration
        new Set(this.subs).forEach(e => {
            if (e !== activeEffect) e.scheduler ? e.scheduler(e.run.bind(e)) : queueEffect(e);
        });
    }
}

// =============================================================================
// EFFECT SCHEDULING
// =============================================================================
// Effects are batched and run asynchronously in the next microtask.
// This prevents multiple updates when several reactive values change at once.
// Effects are sorted by ID to ensure consistent execution order.
// =============================================================================

/** Queue of effects waiting to be executed */
let effectQueue = [];

/** Flag to prevent multiple flush scheduling */
let isFlushing = false;

/**
 * Add an effect to the queue for batch execution
 * @param {ReactiveEffect} effect - The effect to queue
 */
const queueEffect = effect => {
    if (!effectQueue.includes(effect)) {
        effectQueue.push(effect);
        // Schedule flush in next microtask (after current sync code completes)
        if (!isFlushing) { 
            isFlushing = true; 
            Promise.resolve().then(flushEffects); 
        }
    }
};

/**
 * Execute all queued effects
 * Effects are sorted by ID to ensure parent effects run before children
 */
const flushEffects = () => {
    // Copy and sort queue, then clear it (allows new effects to be queued during flush)
    const queue = effectQueue.slice().sort((a, b) => a.id - b.id);
    effectQueue.length = 0;
    isFlushing = false;
    
    for (const e of queue) {
        if (e.active) {
            try { 
                e.run(); 
            } catch (err) { 
                console.error?.('Effect error:', err); 
                runHooks('onError', err, 'effect', e); 
            }
        }
    }
};

/** Auto-incrementing ID for effect ordering */
let effectId = 0;

/**
 * ReactiveEffect - Wraps a function to make it reactive
 * When run, it tracks which reactive values are accessed (dependencies).
 * When those values change, the effect is re-run automatically.
 */
class ReactiveEffect {
    /**
     * @param {Function} fn - The function to run reactively
     * @param {Function|null} scheduler - Optional custom scheduler for updates
     */
    constructor(fn, scheduler = null) {
        this.id = effectId++;      // Unique ID for sorting
        this.fn = fn;              // The reactive function
        this.scheduler = scheduler; // Custom scheduler (used by computed)
        this.deps = [];            // Dependencies this effect has
        this.active = true;        // Whether this effect is still active
    }
    
    /**
     * Run the effect function and track dependencies
     * @returns {*} The return value of the function
     */
    run() {
        // If stopped, just run without tracking
        if (!this.active) return this.fn();
        
        // Clear old dependencies before re-running
        this.cleanup();
        
        try {
            // Push to stack (supports nested effects)
            effectStack.push(this);
            activeEffect = this;
            // Run function - any reactive reads will call dep.depend()
            return this.fn();
        } finally {
            // Pop from stack, restore previous effect
            effectStack.pop();
            activeEffect = effectStack[effectStack.length - 1] || null;
        }
    }
    
    /**
     * Stop this effect from running
     * Removes it from all dependency lists
     */
    stop() {
        if (this.active) { 
            this.cleanup(); 
            this.active = false; 
        }
    }
    
    /**
     * Remove this effect from all its dependencies
     * Called before re-running to avoid stale subscriptions
     */
    cleanup() {
        for (const dep of this.deps) dep.subs.delete(this);
        this.deps.length = 0;
    }
}

/**
 * Create and run a reactive effect
 * The effect will automatically re-run when its dependencies change.
 * 
 * @param {Function} fn - Function to run reactively
 * @param {Object} opts - Options (scheduler)
 * @returns {Function} Stop function to cancel the effect
 * 
 * @example
 * const stop = watchEffect(() => {
 *   console.log('Count is:', count.value);
 * });
 * // Later: stop() to cancel
 */
export const watchEffect = (fn, opts = {}) => {
    const effect = new ReactiveEffect(fn, opts.scheduler);
    effect.run(); // Run immediately
    const stop = () => effect.stop();
    // Auto-register with current scope for cleanup
    currentScope?.addEffect(stop);
    return stop;
};

// =============================================================================
// DEEP REACTIVITY (reactive)
// =============================================================================
// Creates a deeply reactive proxy for objects and arrays.
// All nested objects are automatically wrapped in proxies.
// Array methods are specially handled to trigger proper updates.
// =============================================================================

/** Symbol to access the raw (unwrapped) object */
const RAW = Symbol('raw');

/** Symbol to check if an object is already reactive */
const IS_REACTIVE = Symbol('isReactive');

/** WeakMap to cache reactive proxies (prevents double-wrapping) */
const reactiveMap = new WeakMap();

/** Helper: Check if value is an object */
const isObj = v => v && typeof v === 'object';

/** Helper: Check if object has own property */
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

/** Array methods that mutate the array */
const arrayMutators = new Set([
    'push', 'pop', 'shift', 'unshift', 'splice', 
    'sort', 'reverse', 'fill', 'copyWithin'
]);

/** Array methods that iterate/read the array */
const arrayIterators = new Set([
    'includes', 'indexOf', 'lastIndexOf', 'find', 'findIndex', 
    'findLast', 'findLastIndex', 'every', 'some', 'forEach', 
    'map', 'filter', 'reduce', 'reduceRight', 'flat', 'flatMap', 
    'values', 'entries', 'keys', Symbol.iterator
]);

/**
 * Create a deeply reactive proxy for an object or array
 * 
 * @param {Object|Array} target - The object to make reactive
 * @returns {Proxy} A reactive proxy of the object
 * 
 * @example
 * const state = reactive({ 
 *   user: { name: 'John' },
 *   items: [1, 2, 3]
 * });
 * state.user.name = 'Jane'; // Triggers updates
 * state.items.push(4);      // Triggers updates
 */
export const reactive = target => {
    // Only objects can be reactive
    if (!isObj(target) || target[IS_REACTIVE]) return target;
    
    // Return cached proxy if exists (prevents double-wrapping)
    if (reactiveMap.has(target)) return reactiveMap.get(target);

    const isArray = Array.isArray(target);
    
    // Each property gets its own dependency tracker
    const depsMap = new Map();
    
    // Special dep for iteration (for...of, Object.keys, etc.)
    const iterationDep = new Dep();
    
    /** Get or create dependency tracker for a property */
    const getDep = k => depsMap.get(k) || (depsMap.set(k, new Dep()), depsMap.get(k));

    /**
     * Create a wrapped array method that triggers reactivity
     * @param {string|symbol} method - The array method name
     */
    const createArrayMethod = method => {
        const isMut = arrayMutators.has(method);
        const isIter = arrayIterators.has(method);
        
        return function (...args) {
            const raw = this[RAW];
            
            // Track iteration dependency for non-mutating iterators
            if (!isMut && isIter) iterationDep.depend();

            let res;
            // Special handling for search methods (need to unwrap reactive args)
            if (method === 'includes' || method === 'indexOf' || method === 'lastIndexOf') {
                getDep('length').depend();
                // Track all indices for search
                for (let i = 0; i < raw.length; i++) getDep(String(i)).depend();
                // Unwrap reactive argument if needed
                res = Array.prototype[method].call(raw, args[0]?.[RAW] ?? args[0], ...args.slice(1));
            } else {
                // Mutators work on raw array, iterators on proxy (for reactive nested objects)
                res = Array.prototype[method].apply(isMut ? raw : this, args);
            }

            // Notify subscribers for mutations
            if (isMut) {
                iterationDep.notify();
                getDep('length').notify();
                // Methods that reorder elements need to notify all indices
                if (method === 'sort' || method === 'reverse' || method === 'shift' || method === 'unshift') {
                    for (let i = 0; i < raw.length; i++) getDep(String(i)).notify();
                }
            }
            
            // Wrap result in reactive if it's an object
            return isObj(res) && !res[IS_REACTIVE] ? reactive(res) : res;
        };
    };

    // Pre-create wrapped array methods
    const arrayMethods = isArray 
        ? Object.fromEntries([...arrayMutators, ...arrayIterators].map(m => [m, createArrayMethod(m)])) 
        : null;

    // Create the proxy with reactive handlers
    const proxy = new Proxy(target, {
        /**
         * GET handler - tracks dependencies and returns reactive nested objects
         */
        get(t, k, r) {
            // Return raw object (used internally)
            if (k === RAW) return t;
            // Check if reactive
            if (k === IS_REACTIVE) return true;
            // Use wrapped array methods
            if (isArray && arrayMethods?.[k]) return arrayMethods[k];
            
            // Track this property as a dependency
            getDep(k).depend();
            
            const res = Reflect.get(t, k, r);
            // Recursively wrap nested objects
            return isObj(res) ? (res[IS_REACTIVE] ? res : reactive(res)) : res;
        },
        
        /**
         * SET handler - notifies subscribers when values change
         */
        set(t, k, v, r) {
            const old = t[k];
            const hadKey = has(t, k);
            const res = Reflect.set(t, k, v, r);
            
            // Only notify if value actually changed or key is new
            if (!hadKey || !Object.is(old, v)) {
                getDep(k).notify();
                // Notify iteration dep for new keys or array index changes
                if (!hadKey || (isArray && (k === 'length' || String(+k) === k))) {
                    iterationDep.notify();
                }
            }
            return res;
        },
        
        /**
         * DELETE handler - notifies when properties are deleted
         */
        deleteProperty(t, k) {
            const hadKey = has(t, k);
            const res = Reflect.deleteProperty(t, k);
            if (hadKey) { 
                getDep(k).notify(); 
                iterationDep.notify(); 
            }
            return res;
        },
        
        /**
         * OWNKEYS handler - tracks iteration (for...in, Object.keys, etc.)
         */
        ownKeys(t) { 
            iterationDep.depend(); 
            return Reflect.ownKeys(t); 
        },
        
        /**
         * HAS handler - tracks 'in' operator usage
         */
        has(t, k) { 
            getDep(k).depend(); 
            return Reflect.has(t, k); 
        }
    });

    // Cache the proxy
    reactiveMap.set(target, proxy);
    return proxy;
};

// =============================================================================
// REF & COMPUTED
// =============================================================================
// ref() - For primitive values (string, number, boolean)
// computed() - For derived/calculated values that auto-update
// =============================================================================

/**
 * Create a reactive reference for a primitive value
 * 
 * NOTE: ref() only accepts primitive values (string, number, boolean, null, undefined).
 * For objects and arrays, use reactive() instead.
 * 
 * @param {*} val - The primitive value
 * @returns {Object} A ref object with .value property
 * @throws {Error} If val is an object or array
 * 
 * @example
 * const count = ref(0);
 * count.value++;        // Updates and triggers reactivity
 * console.log(count.value); // 1
 * 
 * // In templates, .value is automatic:
 * // {{ count }} instead of {{ count.value }}
 */
export const ref = val => {
    // Enforce primitive-only rule for API clarity
    if (isObj(val)) {
        console.warn('ref() only accepts primitive values. Use reactive() for objects and arrays.');
        throw new Error('ref() cannot be used with objects or arrays. Use reactive() instead.');
    }
    
    let v = val;
    const dep = new Dep();
    
    return {
        /** Flag to identify refs (used by evalExp for auto-unwrapping) */
        _isRef: true,
        
        /** Get the value (tracks dependency) */
        get value() { 
            dep.depend(); 
            return v; 
        },
        
        /** Set the value (triggers updates if changed) */
        set value(nv) {
            // Also prevent setting to object/array
            if (isObj(nv)) {
                console.warn('ref() value cannot be set to an object or array. Use reactive() instead.');
                throw new Error('ref() value cannot be set to an object or array.');
            }
            if (!Object.is(nv, v)) { 
                v = nv; 
                dep.notify(); 
            }
        },
        
        /** String conversion for template interpolation */
        toString: () => String(v)
    };
};

/**
 * Create a computed property that auto-updates when dependencies change
 * 
 * Computed values are lazy - they only recalculate when accessed and dirty.
 * They cache their result until a dependency changes.
 * 
 * @param {Function} getter - Function that returns the computed value
 * @returns {Object} A ref-like object with .value property (read-only)
 * 
 * @example
 * const count = ref(1);
 * const doubled = computed(() => count.value * 2);
 * console.log(doubled.value); // 2
 * count.value = 5;
 * console.log(doubled.value); // 10
 */
export const computed = getter => {
    let value;
    let dirty = true; // Needs recalculation?
    const dep = new Dep();
    
    // Create effect with custom scheduler
    // Scheduler marks as dirty instead of re-running immediately
    const effect = new ReactiveEffect(getter, () => { 
        if (!dirty) { 
            dirty = true; 
            dep.notify(); // Notify computed's own subscribers
        } 
    });
    
    return {
        _isRef: true,
        
        /** Get the computed value (lazy evaluation) */
        get value() { 
            // Recalculate if dirty
            if (dirty) { 
                value = effect.run(); 
                dirty = false; 
            } 
            dep.depend(); 
            return value; 
        },
        
        /** Expose effect for debugging */
        _effect: effect
    };
};

// =============================================================================
// SCOPE MANAGEMENT
// =============================================================================
// Scopes track effects, event listeners, and child scopes for cleanup.
// Each z-if branch and z-for item gets its own scope.
// When a scope is cleaned up, all its effects and children are also cleaned up.
// =============================================================================

/**
 * Scope - Manages lifecycle of a reactive region
 * Tracks effects, event listeners, and child scopes for proper cleanup.
 */
class Scope {
    /**
     * @param {Object} data - The reactive data for this scope
     */
    constructor(data) { 
        this.data = data;       // Reactive data object
        this.effects = [];      // Stop functions for effects
        this.listeners = [];    // Event listeners to remove
        this.children = [];     // Child scopes (z-if, z-for items)
    }
    
    /**
     * Register an effect's stop function for cleanup
     * @param {Function} stop - Function to stop the effect
     */
    addEffect(stop) { 
        this.effects.push(stop); 
    }
    
    /**
     * Register an event listener for cleanup
     * @param {Element} el - The DOM element
     * @param {string} ev - Event name
     * @param {Function} fn - Event handler
     */
    addListener(el, ev, fn) { 
        this.listeners.push({ el, ev, fn }); 
    }
    
    /**
     * Register a child scope
     * @param {Scope} child - The child scope
     */
    addChild(child) { 
        this.children.push(child); 
    }
    
    /**
     * Remove a child scope
     * @param {Scope} child - The child scope to remove
     */
    removeChild(child) { 
        this.children = this.children.filter(c => c !== child); 
    }
    
    /**
     * Clean up this scope and all children
     * Stops all effects and removes all event listeners
     */
    cleanup() {
        // Recursively clean up children first
        this.children.forEach(c => c.cleanup());
        this.children.length = 0;
        
        // Stop all effects
        this.effects.forEach(stop => stop?.());
        this.effects.length = 0;
        
        // Remove all event listeners
        this.listeners.forEach(({ el, ev, fn }) => el.removeEventListener(ev, fn));
        this.listeners.length = 0;
    }
}

// =============================================================================
// EXPRESSION EVALUATION
// =============================================================================
// Evaluates JavaScript expressions in templates with access to scope variables.
// Expressions are compiled to functions and cached for performance.
// Refs are automatically unwrapped (no need for .value in templates).
// =============================================================================

/** Cache for compiled expression functions */
const expCache = new Map();

/**
 * Evaluate a JavaScript expression with scope variables
 * 
 * Features:
 * - Auto-unwraps refs (count instead of count.value)
 * - Cached compilation for performance
 * - Safe evaluation with try/catch
 * 
 * @param {string} exp - The expression to evaluate
 * @param {Object} scope - Variables available to the expression
 * @returns {*} The result of the expression, or undefined on error
 * 
 * @example
 * evalExp('count + 1', { count: ref(5) }) // Returns 6
 * evalExp('items.length', { items: reactive([1,2,3]) }) // Returns 3
 */
const evalExp = (exp, scope) => {
    try {
        const keys = Object.keys(scope);
        // Cache key includes expression and available variables
        const cacheKey = exp + '|' + keys.join(',');
        
        let fn = expCache.get(cacheKey);
        if (!fn) {
            // Compile expression to function
            // Inner try/catch returns undefined for invalid expressions
            fn = Function(...keys, `"use strict";try{return(${exp})}catch(e){return undefined}`);
            
            // Limit cache size to prevent memory leaks
            if (expCache.size > 500) {
                expCache.delete(expCache.keys().next().value);
            }
            expCache.set(cacheKey, fn);
        }
        
        // Auto-unwrap refs when passing to function
        const vals = keys.map(k => { 
            const v = scope[k]; 
            return v?._isRef ? v.value : v; 
        });
        
        return fn(...vals);
    } catch { 
        return undefined; 
    }
};

// =============================================================================
// HOOK SYSTEM
// =============================================================================
// Simple plugin hook system for extending compiler behavior.
// Hooks: beforeCompile, afterCompile, onError
// =============================================================================

/** Registered hooks */
const hooks = {};

/**
 * Register a hook function
 * 
 * Available hooks:
 * - beforeCompile(el, scope, cs) - Called before compiling an element
 * - afterCompile(el, scope, cs) - Called after compiling an element
 * - onError(err, type, context) - Called when an error occurs
 * 
 * @param {string} name - Hook name
 * @param {Function} fn - Hook function
 * 
 * @example
 * onHook('beforeCompile', (el, scope) => {
 *   console.log('Compiling:', el.tagName);
 * });
 */
export const onHook = (name, fn) => (hooks[name] = hooks[name] || []).push(fn);

/**
 * Run all registered hooks for a given name
 * @param {string} name - Hook name
 * @param {...*} args - Arguments to pass to hooks
 */
const runHooks = (name, ...args) => {
    const list = hooks[name];
    if (!list) return;
    for (const fn of list) {
        try { if (fn(...args) === false) return false; }
        catch (err) { console.error?.(`Hook error (${name}):`, err); }
    }
};

// =============================================================================
// TEMPLATE COMPILER
// =============================================================================
// Compiles DOM elements with directives into reactive components.
// 
// Supported directives:
// - {{ expression }}     - Text interpolation
// - z-if / z-else-if / z-else - Conditional rendering
// - z-for="(item, index) in array" - List rendering
// - z-model              - Two-way binding
// - z-show               - Toggle display
// - z-text / z-html      - Content binding
// - :attr or z-bind:attr - Attribute binding
// - @event or z-on:event - Event handling
// =============================================================================

/**
 * Compile a DOM element and its children
 * 
 * @param {Node} el - DOM element to compile
 * @param {Object} scope - Reactive data scope
 * @param {Scope} cs - Current scope for cleanup tracking
 */
const compile = (el, scope, cs) => {
    // Run beforeCompile hooks (plugins can modify elements)
    if (runHooks('beforeCompile', el, scope, cs) === false) return;
    
    // -------------------------------------------------------------------------
    // TEXT NODE - Handle {{ expression }} interpolation
    // -------------------------------------------------------------------------
    if (el.nodeType === 3) {
        const text = el.nodeValue;
        const regex = /\{\{([^}]+)\}\}/g;
        
        // Skip if no interpolation
        if (!regex.test(text)) return;
        
        // Parse text into static parts and expression parts
        const parts = [];
        let lastIdx = 0, match;
        regex.lastIndex = 0;
        
        while ((match = regex.exec(text))) {
            // Add static text before this match
            if (match.index > lastIdx) {
                parts.push(text.slice(lastIdx, match.index));
            }
            // Add expression
            parts.push({ exp: match[1].trim() });
            lastIdx = regex.lastIndex;
        }
        
        // Add remaining static text
        if (lastIdx < text.length) {
            parts.push(text.slice(lastIdx));
        }
        
        // Create reactive effect to update text when expressions change
        cs.addEffect(watchEffect(() => {
            el.nodeValue = parts.map(p => 
                typeof p === 'string' ? p : evalExp(p.exp, scope) ?? ''
            ).join('');
        }));
        return;
    }
    
    // Only process element nodes
    if (el.nodeType !== 1) return;

    // -------------------------------------------------------------------------
    // Z-IF - Conditional rendering
    // -------------------------------------------------------------------------
    // Supports: z-if, z-else-if, z-else
    // Elements must be adjacent siblings
    // Each branch gets its own scope (created when shown, cleaned up when hidden)
    // -------------------------------------------------------------------------
    if (el.hasAttribute('z-if')) {
        const branches = [];
        const parent = el.parentNode;
        if (!parent) return;
        
        // Create placeholder comment for insertion point
        const ph = document.createComment('z-if');
        parent.insertBefore(ph, el);

        // Collect all branches (z-if, z-else-if, z-else)
        let curr = el;
        while (curr) {
            const type = ['z-if', 'z-else-if', 'z-else'].find(t => curr.hasAttribute(t));
            if (!type) break;
            
            const exp = curr.getAttribute(type);
            curr.removeAttribute(type);
            
            // Store template and metadata
            branches.push({ 
                template: curr.cloneNode(true), 
                exp,      // Condition expression (null for z-else)
                type,     // 'z-if', 'z-else-if', or 'z-else'
                el: null, // Current DOM element (when rendered)
                scope: null // Current scope (when rendered)
            });
            
            const next = curr.nextElementSibling;
            parent.removeChild(curr);
            curr = next;
        }

        // Create reactive effect to update which branch is shown
        cs.addEffect(watchEffect(() => {
            // Find first matching branch
            let chosen = null;
            for (const b of branches) {
                if (b.type === 'z-else' || evalExp(b.exp, scope)) { 
                    chosen = b; 
                    break; 
                }
            }

            // Update each branch
            branches.forEach(b => {
                if (b === chosen) {
                    // Show this branch (if not already shown)
                    if (!b.el) {
                        b.el = b.template.cloneNode(true);
                        b.scope = new Scope({ ...scope });
                        cs.addChild(b.scope);
                        parent.insertBefore(b.el, ph.nextSibling);
                        compile(b.el, b.scope.data, b.scope);
                    }
                } else if (b.scope) {
                    // Hide this branch
                    b.el?.remove();
                    b.scope.cleanup();
                    cs.removeChild(b.scope);
                    b.scope = null;
                    b.el = null;
                }
            });
        }));
        
        runHooks('afterCompile', el, scope, cs);
        return;
    }

    // Skip orphaned else branches (already processed with their z-if)
    if (el.hasAttribute('z-else-if') || el.hasAttribute('z-else')) return;

    // -------------------------------------------------------------------------
    // Z-FOR - List rendering
    // -------------------------------------------------------------------------
    // Syntax: z-for="item in items"
    //         z-for="(item, index) in items"
    // 
    // Key attribute (:key or z-key) recommended for efficient updates
    // Each item gets its own scope with item and index variables
    // Objects are automatically wrapped in reactive()
    // Primitives are wrapped in ref() (auto-unwrapped in templates)
    // Index is a plain number that updates when array changes
    // -------------------------------------------------------------------------
    if (el.hasAttribute('z-for')) {
        const rawFor = el.getAttribute('z-for');
        
        // Parse z-for expression: "(item, index) in items" or "item in items"
        const m = rawFor.match(/^\s*(?:\((\w+)\s*,\s*(\w+)\)|(\w+))\s+(?:in|of)\s+(.*)$/);
        const itemName = m?.[1] || m?.[3] || 'item';
        const indexName = m?.[2] || 'index';
        const listExp = m?.[4] || rawFor.split(/\s+(?:in|of)\s+/)[1]?.trim() || rawFor;

        const parent = el.parentNode;
        if (!parent) return;
        
        // Create placeholder and remove template element
        const ph = document.createComment('z-for');
        parent.insertBefore(ph, el);
        el.remove();
        el.removeAttribute('z-for');

        // Get key attribute for efficient diffing
        const keyAttr = el.getAttribute(':key') || el.getAttribute('z-key');
        if (keyAttr) { 
            el.removeAttribute(':key'); 
            el.removeAttribute('z-key'); 
        }

        // Map of key -> { clone, scope, itemValue, itemRef }
        let itemsMap = new Map();

        // Create reactive effect to update list when array changes
        cs.addEffect(watchEffect(() => {
            // Get array value
            let arr = evalExp(listExp, scope);
            if (arr?._isRef) arr = arr.value;
            if (!Array.isArray(arr)) arr = [];

            const newItemsMap = new Map();
            const newKeys = [];

            arr.forEach((v, i) => {
                // Create key for tracking (use :key if provided, else index)
                const key = '_' + (keyAttr 
                    ? evalExp(keyAttr, { ...scope, [itemName]: v, [indexName]: i }) 
                    : i);
                newKeys.push(key);
                
                const existing = itemsMap.get(key);
                
                // Convert to reactive if object (primitives stay as-is)
                const val = isObj(v) && !v[IS_REACTIVE] ? reactive(v) : v;
                const isReactiveObj = val && val[IS_REACTIVE];

                if (existing) {
                    // Handle reference change for reactive objects
                    if (isReactiveObj && existing.itemValue !== val) {
                        // Reference changed, rebuild item
                        existing.clone.remove();
                        existing.scope.cleanup();
                        cs.removeChild(existing.scope);
                        // Fall through to create new item
                    } else {
                        // Update existing item
                        if (!isReactiveObj) {
                            // For primitives, update the ref value
                            existing.itemRef.value = val;
                        }
                        // Update index in scope data (important for correct index after reorder)
                        existing.scope.data[indexName] = i;
                        newItemsMap.set(key, existing);
                        return;
                    }
                }

                // Create new item
                const clone = el.cloneNode(true);
                
                // For reactive objects: use directly (accessed as item.prop)
                // For primitives: wrap in ref (auto-unwrapped in templates)
                let itemValue, itemRef;
                if (isReactiveObj) {
                    itemValue = val;
                    itemRef = null;
                } else {
                    itemRef = ref(val);
                    itemValue = itemRef;
                }
                
                // Create scope with item and index
                const indexValue = i;
                const s = new Scope({ ...scope, [itemName]: itemValue, [indexName]: indexValue });
                cs.addChild(s);
                compile(clone, s.data, s);
                newItemsMap.set(key, { clone, scope: s, itemValue, itemRef });
            });

            // Remove items that no longer exist
            for (const [key, item] of itemsMap) {
                if (!newItemsMap.has(key)) {
                    item.clone.remove();
                    item.scope.cleanup();
                    cs.removeChild(item.scope);
                }
            }

            // Reorder DOM nodes to match array order
            let prevNode = ph;
            for (const key of newKeys) {
                const item = newItemsMap.get(key);
                if (item.clone.previousSibling !== prevNode) {
                    parent.insertBefore(item.clone, prevNode.nextSibling);
                }
                prevNode = item.clone;
            }
            
            itemsMap = newItemsMap;
        }));
        
        runHooks('afterCompile', el, scope, cs);
        return;
    }

    // -------------------------------------------------------------------------
    // DIRECTIVES - Process element attributes
    // -------------------------------------------------------------------------
    for (const { name, value } of [...el.attributes]) {
        
        // ---------------------------------------------------------------------
        // EVENT BINDING: @event or z-on:event
        // ---------------------------------------------------------------------
        // Examples: @click="handler" @input="count++" z-on:submit="save"
        // Handler can be a method name or inline expression
        // Event object available as 'e' in inline expressions
        // ---------------------------------------------------------------------
        if (name.startsWith('@') || name.startsWith('z-on:')) {
            const ev = name[0] === '@' ? name.slice(1) : name.slice(5);
            el.removeAttribute(name);
            
            const fn = e => {
                // If value is a function name in scope, call it
                if (typeof scope[value] === 'function') {
                    scope[value](e);
                } else {
                    // Otherwise evaluate as expression
                    try {
                        const keys = Object.keys(scope);
                        const vals = keys.map(k => scope[k]);
                        Function(...keys, 'e', `"use strict";${value}`)(...vals, e);
                    } catch (err) {
                        console.error?.('Event error:', err);
                        runHooks('onError', err, 'event', { name, value });
                    }
                }
            };
            
            el.addEventListener(ev, fn);
            cs.addListener(el, ev, fn);
        }
        
        // ---------------------------------------------------------------------
        // TWO-WAY BINDING: z-model
        // ---------------------------------------------------------------------
        // Binds input value to a reactive variable
        // Supports: text inputs, checkboxes, radio buttons, select
        // ---------------------------------------------------------------------
        else if (name === 'z-model') {
            el.removeAttribute(name);
            
            const isCheck = el.type === 'checkbox' || el.type === 'radio';
            const prop = isCheck ? 'checked' : 'value';
            const ev = isCheck || el.tagName === 'SELECT' ? 'change' : 'input';
            
            // Update model when input changes
            const fn = () => {
                if (el.type === 'radio' && !el.checked) return;
                const val = el.type === 'radio' ? el.value : el[prop];  // ✅ اضافه شد

                
                if (scope[value]?._isRef) {
                    scope[value].value = val;
                } else {
                    evalExp(value + '=_v', { ...scope, _v: val });
                }
            };
            
            el.addEventListener(ev, fn);
            cs.addListener(el, ev, fn);
            
            // Update input when model changes
            cs.addEffect(watchEffect(() => {
                const res = evalExp(value, scope);
                if (el.type === 'radio') {
                    el.checked = String(el.value) === String(res);
                } else {
                    el[prop] = res;
                }
            }));
        }
        
        // ---------------------------------------------------------------------
        // ATTRIBUTE/DIRECTIVE BINDING
        // ---------------------------------------------------------------------
        // z-text="exp"  - Set textContent
        // z-html="exp"  - Set innerHTML (caution: XSS risk)
        // z-show="exp"  - Toggle display:none
        // :attr="exp"   - Bind any attribute
        // :class="obj"  - Object syntax for classes { active: isActive }
        // :style="obj"  - Object syntax for styles { color: 'red' }
        // ---------------------------------------------------------------------
        else if (name === 'z-text' || name === 'z-html' || name === 'z-show' || 
                 name.startsWith(':') || name.startsWith('z-')) {
            const attr = name[0] === ':' ? name.slice(1) : name;
            el.removeAttribute(name);
            
            // Preserve static classes for merging
            const staticClass = attr === 'class' ? (el.getAttribute('class') || '') : '';
            
            cs.addEffect(watchEffect(() => {
                const res = evalExp(value, scope);
                
                if (attr === 'z-text') {
                    // Set text content (safe, no HTML)
                    el.textContent = res ?? '';
                } 
                else if (attr === 'z-html') {
                    // Set HTML content (use with caution)
                    el.innerHTML = res ?? '';
                } 
                else if (attr === 'z-show') {
                    // Toggle visibility
                    el.style.display = res ? '' : 'none';
                } 
                else if (attr === 'style' && isObj(res)) {
                    // Object style binding: :style="{ color: 'red' }"
                    Object.assign(el.style, res);
                } 
                else if (attr === 'class') {
                    // Class binding - supports string or object
                    // Object: :class="{ active: isActive, error: hasError }"
                    // String: :class="'btn ' + btnType"
                    el.setAttribute('class', (isObj(res) 
                        ? staticClass + ' ' + Object.keys(res).filter(k => res[k]).join(' ')
                        : typeof res === 'string' ? staticClass + ' ' + res : staticClass
                    ).trim());
                } 
                else {
                    // Generic attribute binding
                    const setName = attr.startsWith('z-') ? attr.slice(2) : attr;
                    
                    if (typeof res === 'boolean') {
                        // Boolean attributes: :disabled="isDisabled"
                        res ? el.setAttribute(setName, '') : el.removeAttribute(setName);
                    } else if (res == null) {
                        el.removeAttribute(setName);
                    } else {
                        el.setAttribute(setName, res);
                    }
                }
            }));
        }
    }

    // Recursively compile children
    [...el.childNodes].forEach(child => compile(child, scope, cs));
    
    runHooks('afterCompile', el, scope, cs);
};

/**
 * Execute a function after DOM updates are flushed
 * Useful when you need to access updated DOM after reactive changes
 * 
 * @param {Function} fn - Function to execute
 * @returns {Promise} Promise that resolves after execution
 * 
 * @example
 * count.value++;
 * nextTick(() => {
 *   console.log(document.querySelector('#count').textContent);
 * });
 */
export const nextTick = fn => Promise.resolve().then(fn);

// =============================================================================
// APPLICATION
// =============================================================================
// createApp() creates an application instance that can be mounted to the DOM.
// Supports plugin system for extensibility.
// =============================================================================

/**
 * Create a Zog application
 * 
 * @param {Function} setup - Setup function that returns reactive data
 * @returns {Object} App instance with mount(), unmount(), and use() methods
 * 
 * @example
 * const app = createApp(() => ({
 *   count: ref(0),
 *   items: reactive([]),
 *   increment() { this.count.value++ }
 * }));
 * 
 * app.use(myPlugin);
 * app.mount('#app');
 */
export const createApp = setup => {
    let rootScope = null;
    const appContext = { plugins: new Set() };

    return {
        /**
         * Install a plugin
         * 
         * @param {Object} plugin - Plugin with install(api, options) method
         * @param {Object} options - Options to pass to plugin
         * @returns {Object} App instance for chaining
         * 
         * @example
         * const myPlugin = {
         *   install(api, options) {
         *     api.onHook('beforeCompile', (el) => { ... });
         *   }
         * };
         * app.use(myPlugin, { debug: true });
         */
        use(plugin, options = {}) {
            if (appContext.plugins.has(plugin)) return this;
            if (typeof plugin.install !== 'function') { 
                console.error?.('Plugin must have install method'); 
                return this; 
            }
            
            // Provide API to plugin
            plugin.install({
                app: this,
                reactive, ref, computed, watchEffect,
                onHook, compile, Scope, evalExp
            }, options);
            
            appContext.plugins.add(plugin);
            return this;
        },
        
        /**
         * Mount the app to a DOM element
         * 
         * @param {string|Element} root - CSS selector or DOM element
         * @returns {Object} App instance for chaining
         * 
         * @example
         * app.mount('#app');
         * app.mount(document.getElementById('app'));
         */
        mount(root) {
            const el = typeof root === 'string' ? document.querySelector(root) : root;
            if (!el) { 
                console.error?.('Root not found:', root); 
                return; 
            }

            // Create root scope
            rootScope = new Scope({});
            currentScope = rootScope;
            
            // Run setup function to get reactive data
            rootScope.data = setup?.() || {};
            currentScope = null;
            
            // Compile the root element
            try { 
                compile(el, rootScope.data, rootScope); 
            } catch (err) { 
                console.error?.('Compile error:', err); 
                runHooks('onError', err, 'compile', { el }); 
            }
            
            return this;
        },
        
        /**
         * Unmount the app and clean up all effects and listeners
         */
        unmount() { 
            rootScope?.cleanup(); 
            rootScope = null; 
        }
    };
};