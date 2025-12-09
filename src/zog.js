/**
 * Zog.js v2.2
 * Full reactivity with minimal code size
 * Optimized: Removed route, nextTick, toRaw, symbols. Streamlined array handling and compiler.
 */

// --- Reactivity Core ---
let activeEffect = null;
const effectStack = [];

class Dep {
    subs = new Set();
    depend() {
        if (activeEffect && !this.subs.has(activeEffect)) {
            this.subs.add(activeEffect);
            activeEffect.deps.push(this);
        }
    }
    notify() {
        // Create a copy to avoid infinite loops when effects modify reactive data
        const effectsToRun = new Set(this.subs);
        effectsToRun.forEach(e => {
            // Prevent running effect that is currently executing
            if (e !== activeEffect) {
                if (e.scheduler) e.scheduler(e.run.bind(e));
                else queueEffect(e);
            }
        });
    }
}

// Effect queue for batching updates
let effectQueue = [];
let isFlushing = false;

const queueEffect = (effect) => {
    if (!effectQueue.includes(effect)) {
        effectQueue.push(effect);
        if (!isFlushing) {
            isFlushing = true;
            Promise.resolve().then(flushEffects);
        }
    }
};

const flushEffects = () => {
    try {
        effectQueue.sort((a, b) => (a.id || 0) - (b.id || 0));
        for (const effect of effectQueue) {
            if (effect.active) effect.run();
        }
    } finally {
        effectQueue = [];
        isFlushing = false;
    }
};

let effectId = 0;

class ReactiveEffect {
    constructor(fn, scheduler = null) {
        this.id = effectId++;
        this.fn = fn;
        this.scheduler = scheduler;
        this.deps = [];
        this.active = true;
    }

    run() {
        if (!this.active) return this.fn();
        
        this.cleanup();
        
        try {
            effectStack.push(this);
            activeEffect = this;
            return this.fn();
        } finally {
            effectStack.pop();
            activeEffect = effectStack[effectStack.length - 1] || null;
        }
    }

    cleanup() {
        for (const dep of this.deps) {
            dep.subs.delete(this);
        }
        this.deps = [];
    }

    stop() {
        if (this.active) {
            this.cleanup();
            this.active = false;
        }
    }
}

export const watchEffect = (fn, opts = {}) => {
    const effect = new ReactiveEffect(fn, opts.scheduler);
    effect.run();
    return () => effect.stop();
};

// --- Deep Reactivity ---
const RAW = Symbol('raw');
const IS_REACTIVE = Symbol('isReactive');
const reactiveMap = new WeakMap();
const isObj = v => v && typeof v === 'object';

// Optimized: Unified array method handling
const arrayMethodsThatMutate = new Set([
    'push', 'pop', 'shift', 'unshift', 'splice', 
    'sort', 'reverse', 'fill', 'copyWithin'
]);

const arrayMethodsThatIterate = new Set([
    'includes', 'indexOf', 'lastIndexOf', 'find', 'findIndex',
    'some', 'every', 'filter', 'map', 'forEach', 'reduce',
    'reduceRight', 'flat', 'flatMap', 'join', 'slice', 'concat'
]);

export const reactive = target => {
    if (!isObj(target) || target[IS_REACTIVE]) return target;

    const existing = reactiveMap.get(target);
    if (existing) return existing;

    const isArray = Array.isArray(target);
    const depsMap = new Map();
    const iterationDep = new Dep();
    
    const getDep = k => {
        let d = depsMap.get(k);
        if (!d) { d = new Dep(); depsMap.set(k, d); }
        return d;
    };

    // Optimized: Single method handler for all array methods
    const createArrayMethod = (method) => {
        const isMutating = arrayMethodsThatMutate.has(method);
        const isIterating = arrayMethodsThatIterate.has(method);
        
        return function(...args) {
            const rawTarget = this[RAW];
            
            // Track dependencies for iteration methods
            if (isIterating) {
                iterationDep.depend();
                getDep('length').depend();
            }
            
            // Convert reactive arguments to raw
            const rawArgs = args.map(arg => 
                (isObj(arg) && arg[IS_REACTIVE]) ? arg[RAW] : arg
            );
            
            const result = rawTarget[method].apply(rawTarget, rawArgs);
            
            // Notify on mutations
            if (isMutating) {
                iterationDep.notify();
                getDep('length').notify();
            }
            
            // Make result reactive if needed
            return (isObj(result) && !result[IS_REACTIVE]) ? reactive(result) : result;
        };
    };

    // Create all array method overrides
    const arrayMethods = isArray ? {} : null;
    if (isArray) {
        [...arrayMethodsThatMutate, ...arrayMethodsThatIterate].forEach(method => {
            arrayMethods[method] = createArrayMethod(method);
        });
    }

    const proxy = new Proxy(target, {
        get: (t, k, receiver) => {
            if (k === IS_REACTIVE) return true;
            if (k === RAW) return t;

            // Array method override
            if (isArray && arrayMethods && k in arrayMethods) {
                return arrayMethods[k].bind(receiver);
            }

            // Array length tracking
            if (isArray && k === 'length') {
                getDep('length').depend();
                iterationDep.depend();
                return t.length;
            }

            // Iterator tracking
            if (k === Symbol.iterator) {
                iterationDep.depend();
                return function* () {
                    const len = t.length;
                    for (let i = 0; i < len; i++) {
                        const val = t[i];
                        yield isObj(val) ? reactive(val) : val;
                    }
                };
            }

            getDep(k).depend();
            const res = Reflect.get(t, k, receiver);

            // Return refs directly, make objects reactive
            return (res && res._isRef) ? res : (isObj(res) ? reactive(res) : res);
        },

        set: (t, k, v, receiver) => {
            const old = t[k];
            const numKey = Number(k);
            const hadKey = isArray 
                ? (Number.isInteger(numKey) && numKey >= 0 && numKey < t.length)
                : Object.prototype.hasOwnProperty.call(t, k);
            
            const rawValue = (isObj(v) && v[IS_REACTIVE]) ? v[RAW] : v;
            const res = Reflect.set(t, k, rawValue, receiver);

            if (!Object.is(old, rawValue)) {
                getDep(k).notify();
                if (!hadKey || (isArray && k === 'length')) {
                    iterationDep.notify();
                    if (isArray) getDep('length').notify();
                }
            }

            return res;
        },

        deleteProperty: (t, k) => {
            const had = k in t;
            const res = Reflect.deleteProperty(t, k);
            if (had) {
                getDep(k).notify();
                iterationDep.notify();
            }
            return res;
        },

        ownKeys: (t) => {
            iterationDep.depend();
            return Reflect.ownKeys(t);
        },

        has: (t, k) => {
            iterationDep.depend();
            getDep(k).depend();
            return Reflect.has(t, k);
        }
    });

    reactiveMap.set(target, proxy);
    return proxy;
};

export const ref = val => {
    const dep = new Dep();
    return {
        _isRef: true,
        get value() { dep.depend(); return val; },
        set value(v) { if (!Object.is(v, val)) { val = v; dep.notify(); } },
        toString: () => String(val)
    };
};

export const computed = getter => {
    let value, dirty = true;
    const dep = new Dep();
    const effect = new ReactiveEffect(getter, () => {
        if (!dirty) { dirty = true; dep.notify(); }
    });

    return {
        _isRef: true,
        get value() {
            if (dirty) { value = effect.run(); dirty = false; }
            dep.depend();
            return value;
        },
        _effect: effect
    };
};

// --- Component Scope ---
class Scope {
    constructor(data) {
        this.data = data;
        this.effects = [];
        this.listeners = [];
    }

    addEffect(stop) { this.effects.push(stop); }
    addListener(el, ev, fn) { this.listeners.push({ el, ev, fn }); }

    cleanup() {
        this.effects.forEach(s => s());
        this.listeners.forEach(({el, ev, fn}) => el.removeEventListener(ev, fn));
        this.effects = [];
        this.listeners = [];
    }
}

// --- Optimized Expression Evaluator ---
// Caching compiled functions for better performance
const expCache = new Map();

const evalExp = (exp, scope) => {
    try {
        // Check cache first
        let cached = expCache.get(exp);
        
        if (!cached) {
            const keys = Object.keys(scope);
            const fn = Function(...keys, `"use strict";return(${exp})`);
            cached = { fn, keys };
            
            // Limit cache size to prevent memory leaks
            if (expCache.size > 200) {
                const firstKey = expCache.keys().next().value;
                expCache.delete(firstKey);
            }
            expCache.set(exp, cached);
        }
        
        // Get current values, unwrap refs
        const vals = cached.keys.map(k => {
            const v = scope[k];
            return v?._isRef ? v.value : v;
        });
        
        return cached.fn(...vals);
    } catch (err) {
        if (typeof console !== 'undefined') console.error('evalExp error:', err, 'exp:', exp);
        return undefined;
    }
};

// --- Optimized Compiler ---
const compile = (el, scope, cs) => {
    if (!el) return;

    // Text nodes with interpolation
    if (el.nodeType === 3) {
        const txt = el.textContent;
        if (txt.includes('{{')) {
            cs.addEffect(watchEffect(() => {
                el.textContent = txt.replace(/{{\s*(.*?)\s*}}/g, (_, e) => evalExp(e, scope) ?? '');
            }));
        }
        return;
    }

    if (el.nodeType !== 1) return;

    // z-if branches
    if (el.hasAttribute('z-if')) {
        const branches = [];
        let curr = el, parent = el.parentNode;
        if (!parent) return;

        const ph = document.createComment('z-if');
        parent.insertBefore(ph, el);

        // Collect all branches
        while (curr) {
            const type = ['z-if', 'z-else-if', 'z-else'].find(t => curr.hasAttribute(t));
            if (!type) break;
            const exp = curr.getAttribute(type);
            curr.removeAttribute(type);
            branches.push({ template: curr.cloneNode(true), exp, type, el: null, scope: null });
            const next = curr.nextElementSibling;
            curr.remove();
            curr = next;
        }

        cs.addEffect(watchEffect(() => {
            const match = branches.find(b => b.type === 'z-else' || evalExp(b.exp, scope));
            branches.forEach(b => {
                if (b === match) {
                    if (!b.el || !b.el.parentNode) {
                        if (b.scope) b.scope.cleanup();
                        b.el = b.template.cloneNode(true);
                        b.scope = new Scope({ ...scope });
                        parent.insertBefore(b.el, ph);
                        compile(b.el, b.scope.data, b.scope);
                    }
                } else {
                    if (b.el && b.el.parentNode) b.el.remove();
                    if (b.scope) { b.scope.cleanup(); b.scope = null; }
                    b.el = null;
                }
            });
        }));

        cs.addEffect(() => branches.forEach(b => b.scope?.cleanup()));
        return;
    }

    if (el.hasAttribute('z-else-if') || el.hasAttribute('z-else')) return;

    // Optimized z-for with key-based diffing
    if (el.hasAttribute('z-for')) {
        const rawFor = el.getAttribute('z-for');
        
        // Parse for expression: item in list OR (item, index) in list
        const forMatch = rawFor.match(/^\s*(?:\((\w+)\s*,\s*(\w+)\)|(\w+))\s+(?:in|of)\s+(.*)$/);
        let itemName = 'item', indexName = 'index', listExp = rawFor;
        
        if (forMatch) {
            itemName = forMatch[1] || forMatch[3];
            indexName = forMatch[2] || 'index';
            listExp = forMatch[4];
        } else {
            const parts = rawFor.split(/\s+(?:in|of)\s+/);
            if (parts.length === 2) {
                itemName = parts[0].trim();
                listExp = parts[1].trim();
            }
        }

        const parent = el.parentNode;
        if (!parent) return;

        const ph = document.createComment('z-for');
        parent.insertBefore(ph, el);
        el.remove();
        el.removeAttribute('z-for');
        
        const keyAttr = el.getAttribute(':key') || el.getAttribute('z-key');
        if (keyAttr) {
            el.removeAttribute(':key');
            el.removeAttribute('z-key');
        }

        let itemsMap = new Map();
        
        const updateList = () => {
            let arr = evalExp(listExp, scope);
            
            // Unwrap refs
            if (arr?._isRef) arr = arr.value;
            if (!Array.isArray(arr)) arr = arr ? [] : [];

            const newItemsMap = new Map();
            const newKeys = [];
            
            arr.forEach((v, i) => {
                // Generate key
                const key = keyAttr 
                    ? evalExp(keyAttr, { ...scope, [itemName]: { _isRef: true, value: v }, [indexName]: { _isRef: true, value: i } })
                    : i;
                
                newKeys.push(key);
                const existing = itemsMap.get(key);
                
                if (existing) {
                    // Reuse existing element
                    existing.itemRef.value = v;
                    existing.indexRef.value = i;
                    newItemsMap.set(key, existing);
                } else {
                    // Create new element
                    const clone = el.cloneNode(true);
                    const itemRef = ref(v);
                    const indexRef = ref(i);
                    
                    const s = new Scope({ 
                        ...scope, 
                        [itemName]: itemRef, 
                        [indexName]: indexRef 
                    });
                    
                    compile(clone, s.data, s);
                    newItemsMap.set(key, { clone, scope: s, itemRef, indexRef });
                }
            });
            
            // Cleanup removed items
            for (const [key, item] of itemsMap) {
                if (!newItemsMap.has(key)) {
                    item.clone.remove();
                    item.scope.cleanup();
                }
            }
            
            // Reorder elements efficiently
            let prevNode = ph;
            for (const key of newKeys) {
                const item = newItemsMap.get(key);
                if (item.clone.previousSibling !== prevNode) {
                    parent.insertBefore(item.clone, prevNode.nextSibling);
                }
                prevNode = item.clone;
            }
            
            itemsMap = newItemsMap;
        };

        cs.addEffect(watchEffect(updateList));
        cs.addEffect(() => {
            for (const item of itemsMap.values()) {
                item.scope.cleanup();
            }
            itemsMap.clear();
        });
        return;
    }

    // Optimized directive processing
    const attrs = Array.from(el.attributes);
    
    for (const { name, value } of attrs) {
        // Event handlers
        if (name.startsWith('@') || name.startsWith('z-on:')) {
            const ev = name.startsWith('@') ? name.slice(1) : name.slice(5);
            el.removeAttribute(name);
            const fn = e => {
                const handler = scope[value];
                typeof handler === 'function' ? handler(e) : evalExp(value, scope);
            };
            el.addEventListener(ev, fn);
            cs.addListener(el, ev, fn);
        }
        // Two-way binding
        else if (name === 'z-model') {
            el.removeAttribute(name);
            const isCheck = el.type === 'checkbox' || el.type === 'radio';
            const prop = isCheck ? 'checked' : 'value';
            const ev = isCheck || el.tagName === 'SELECT' ? 'change' : 'input';

            const fn = () => {
                const val = el[prop];
                if (el.type === 'radio' && !el.checked) return;
                const target = scope[value];
                if (target?._isRef) target.value = val;
                else if (scope[value] !== undefined) scope[value] = val;
            };

            el.addEventListener(ev, fn);
            cs.addListener(el, ev, fn);
            cs.addEffect(watchEffect(() => {
                const res = evalExp(value, scope);
                el.type === 'radio' 
                    ? el.checked = String(el.value) === String(res) 
                    : el[prop] = res;
            }));
        }
        // Reactive bindings
        else if (name.startsWith(':') || name.startsWith('z-')) {
            const attr = name.startsWith(':') ? name.slice(1) : name;
            el.removeAttribute(name);
            const staticClass = attr === 'class' ? el.className : '';

            cs.addEffect(watchEffect(() => {
                const res = evalExp(value, scope);
                
                // Special directives
                if (attr === 'z-text') {
                    el.textContent = res ?? '';
                } else if (attr === 'z-html') {
                    el.innerHTML = res ?? '';
                } else if (attr === 'z-show') {
                    el.style.display = res ? '' : 'none';
                }
                // Style object binding
                else if (attr === 'style' && isObj(res)) {
                    Object.keys(res).forEach(k => el.style[k] = res[k]);
                }
                // Class binding
                else if (attr === 'class') {
                    if (isObj(res)) {
                        const dynamic = Object.keys(res).filter(k => res[k]).join(' ');
                        el.className = (staticClass + ' ' + dynamic).trim();
                    } else if (typeof res === 'string') {
                        el.className = (staticClass + ' ' + res).trim();
                    }
                }
                // Boolean attributes
                else if (typeof res === 'boolean') {
                    const setName = attr.startsWith('z-') ? attr.slice(2) : attr;
                    res ? el.setAttribute(setName, '') : el.removeAttribute(setName);
                }
                // Regular attributes
                else {
                    const setName = attr.startsWith('z-') ? attr.slice(2) : attr;
                    res == null ? el.removeAttribute(setName) : el.setAttribute(setName, res);
                }
            }));
        }
    }

    // Recursively compile children
    Array.from(el.childNodes).forEach(child => compile(child, scope, cs));
};

// --- Plugin System ---
const installedPlugins = new Set();

/**
 * Install a plugin into Zog.js
 * 
 * Usage:
 *   use(MyPlugin)
 *   use(MyPlugin, { option: 'value' })
 * 
 * Plugin structure:
 *   export default {
 *     install(zog, options) {
 *       // Plugin logic
 *     }
 *   }
 */
export const use = (plugin, options = {}) => {
    if (installedPlugins.has(plugin)) {
        if (typeof console !== 'undefined') {
            console.warn('Plugin already installed:', plugin);
        }
        return;
    }

    if (typeof plugin.install !== 'function') {
        if (typeof console !== 'undefined') {
            console.error('Plugin must have an install method:', plugin);
        }
        return;
    }

    installedPlugins.add(plugin);

    const zogAPI = {
        reactive,
        ref,
        computed,
        watchEffect,
        createApp,
        // Internal utilities for advanced plugins
        utils: {
            isObj,
            evalExp,
            Dep,
            ReactiveEffect
        }
    };

    try {
        plugin.install(zogAPI, options);
    } catch (err) {
        if (typeof console !== 'undefined') {
            console.error('Plugin installation failed:', plugin, err);
        }
    }
};

export const nextTick = fn => Promise.resolve().then(fn);

// --- App ---
export const createApp = setup => {
    let rootScope = null;
    return {
        mount(sel) {
            const root = document.querySelector(sel);
            if (!root) return console.error(`Target not found: ${sel}`);
            const data = setup();
            rootScope = new Scope(data);
            compile(root, data, rootScope);
            return this;
        },
        unmount() {
            if (rootScope) { rootScope.cleanup(); rootScope = null; }
        }
    };
};