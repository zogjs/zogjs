/**
 * Zog.js v0.3.0 - Full reactivity with minimal code size + Hook System
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
        new Set(this.subs).forEach(e => {
            if (e !== activeEffect) e.scheduler ? e.scheduler(e.run.bind(e)) : queueEffect(e);
        });
    }
}

let effectQueue = [], isFlushing = false;

const queueEffect = effect => {
    if (!effectQueue.includes(effect)) {
        effectQueue.push(effect);
        if (!isFlushing) { isFlushing = true; Promise.resolve().then(flushEffects); }
    }
};

const flushEffects = () => {
    try {
        effectQueue.sort((a, b) => (a.id || 0) - (b.id || 0));
        for (const effect of effectQueue) {
            if (effect.active) try { effect.run(); } catch (e) { console.error?.('Effect error:', e); }
        }
    } finally { effectQueue = []; isFlushing = false; }
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
            runHooks('beforeEffect', this);
            return this.fn();
        } finally {
            effectStack.pop();
            activeEffect = effectStack.at(-1) || null;
        }
    }
    cleanup() {
        for (const dep of this.deps) dep.subs.delete(this);
        this.deps = [];
    }
    stop() {
        if (this.active) { this.cleanup(); this.active = false; }
    }
}

export const watchEffect = (fn, opts = {}) => {
    const effect = new ReactiveEffect(fn, opts.scheduler);
    effect.run();
    return () => effect.stop();
};

// --- Deep Reactivity ---
const RAW = Symbol('raw'), IS_REACTIVE = Symbol('isReactive');
const reactiveMap = new WeakMap();
const isObj = v => v && typeof v === 'object';

const arrayMutators = new Set(['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill', 'copyWithin']);
const arrayIterators = new Set(['includes', 'indexOf', 'lastIndexOf', 'find', 'findIndex', 'some', 'every', 'filter', 'map', 'forEach', 'reduce', 'reduceRight', 'flat', 'flatMap', 'join', 'slice', 'concat']);

export const reactive = target => {
    if (!isObj(target) || target[IS_REACTIVE]) return target;
    const existing = reactiveMap.get(target);
    if (existing) return existing;

    const isArray = Array.isArray(target);
    const depsMap = new Map(), iterationDep = new Dep();
    const getDep = k => { let d = depsMap.get(k); return d || (depsMap.set(k, d = new Dep()), d); };

    const createArrayMethod = method => {
        const isMutating = arrayMutators.has(method), isIterating = arrayIterators.has(method);
        return function (...args) {
            const raw = this[RAW];
            if (isIterating) { iterationDep.depend(); getDep('length').depend(); }
            const result = raw[method].apply(raw, args.map(a => isObj(a) && a[IS_REACTIVE] ? a[RAW] : a));
            if (isMutating) {
                iterationDep.notify(); getDep('length').notify();
                if (method === 'sort' || method === 'reverse') for (let i = 0; i < raw.length; i++) getDep(String(i)).notify();
            }
            return isObj(result) && !result[IS_REACTIVE] ? reactive(result) : result;
        };
    };

    const arrayMethods = isArray ? Object.fromEntries([...arrayMutators, ...arrayIterators].map(m => [m, createArrayMethod(m)])) : null;

    const proxy = new Proxy(target, {
        get: (t, k, r) => {
            if (k === IS_REACTIVE) return true;
            if (k === RAW) return t;
            if (isArray && arrayMethods?.[k]) return arrayMethods[k].bind(r);
            if (isArray && k === 'length') { getDep('length').depend(); iterationDep.depend(); return t.length; }
            if (k === Symbol.iterator) {
                iterationDep.depend();
                return function* () { for (let i = 0; i < t.length; i++) yield isObj(t[i]) ? reactive(t[i]) : t[i]; };
            }
            getDep(k).depend();
            const res = Reflect.get(t, k, r);
            return res?._isRef ? res : isObj(res) ? reactive(res) : res;
        },
        set: (t, k, v, r) => {
            const old = t[k], numKey = Number(k);
            const hadKey = isArray ? Number.isInteger(numKey) && numKey >= 0 && numKey < t.length : Object.hasOwn(t, k);
            const rawValue = isObj(v) && v[IS_REACTIVE] ? v[RAW] : v;
            const res = Reflect.set(t, k, rawValue, r);
            if (!Object.is(old, rawValue)) {
                getDep(k).notify();
                if (!hadKey || (isArray && k === 'length')) { iterationDep.notify(); if (isArray) getDep('length').notify(); }
            }
            return res;
        },
        deleteProperty: (t, k) => {
            const had = k in t, res = Reflect.deleteProperty(t, k);
            if (had) { getDep(k).notify(); iterationDep.notify(); }
            return res;
        },
        ownKeys: t => { iterationDep.depend(); return Reflect.ownKeys(t); },
        has: (t, k) => { iterationDep.depend(); getDep(k).depend(); return Reflect.has(t, k); }
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
    const effect = new ReactiveEffect(getter, () => { if (!dirty) { dirty = true; dep.notify(); } });
    return {
        _isRef: true,
        get value() { if (dirty) { value = effect.run(); dirty = false; } dep.depend(); return value; },
        _effect: effect
    };
};

// --- Component Scope ---
class Scope {
    constructor(data) { this.data = data; this.effects = []; this.listeners = []; }
    addEffect(stop) { this.effects.push(stop); }
    addListener(el, ev, fn) { this.listeners.push({ el, ev, fn }); }
    cleanup() {
        this.effects.forEach(s => s());
        this.listeners.forEach(({ el, ev, fn }) => el.removeEventListener(ev, fn));
        this.effects = []; this.listeners = [];
    }
}

// --- Expression Evaluator ---
const expCache = new Map();
const evalExp = (exp, scope) => {
    try {
        const keys = Object.keys(scope);
        const cacheKey = exp + '|' + keys.join(',');
        let cached = expCache.get(cacheKey);
        if (!cached) {
            cached = Function(...keys, `"use strict";return(${exp})`);
            if (expCache.size > 200) expCache.delete(expCache.keys().next().value);
            expCache.set(cacheKey, cached);
        }
        return cached(...keys.map(k => { const v = scope[k]; return v?._isRef ? v.value : v; }));
    } catch { return undefined; }
};

// --- Hook System ---
const hooks = {
    beforeCompile: [],
    afterCompile: [],
    beforeEffect: [],
    onError: []
};

export const addHook = (name, fn) => {
    if (!hooks[name]) hooks[name] = [];
    hooks[name].push(fn);
};

export const removeHook = (name, fn) => {
    if (hooks[name]) hooks[name] = hooks[name].filter(h => h !== fn);
};

const runHooks = (name, ...args) => {
    if (!hooks[name]) return false;
    try {
        return hooks[name].some(fn => fn(...args) === false);
    } catch (err) {
        runHooks('onError', err, name, args);
        return false;
    }
};

// --- Compiler ---
export const compile = (el, scope, cs) => {
    if (!el) return;

    if (el.nodeType === 3) {
        const txt = el.textContent;
        if (txt.includes('{{')) cs.addEffect(watchEffect(() => { el.textContent = txt.replace(/{{\s*(.*?)\s*}}/g, (_, e) => evalExp(e, scope) ?? ''); }));
        return;
    }
    if (el.nodeType !== 1) return;

    // Run beforeCompile hooks - if any returns false, stop compilation
    if (runHooks('beforeCompile', el, scope, cs)) return;

    // z-if
    if (el.hasAttribute('z-if')) {
        const branches = [], parent = el.parentNode;
        if (!parent) return;
        const ph = document.createComment('z-if');
        parent.insertBefore(ph, el);

        let curr = el;
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
                    if (!b.el?.parentNode) {
                        b.scope?.cleanup();
                        b.el = b.template.cloneNode(true);
                        b.scope = new Scope({ ...scope });
                        parent.insertBefore(b.el, ph);
                        compile(b.el, b.scope.data, b.scope);
                    }
                } else {
                    b.el?.parentNode && b.el.remove();
                    b.scope?.cleanup(); b.scope = null; b.el = null;
                }
            });
        }));
        cs.addEffect(() => branches.forEach(b => b.scope?.cleanup()));
        runHooks('afterCompile', el, scope, cs);
        return;
    }

    if (el.hasAttribute('z-else-if') || el.hasAttribute('z-else')) return;

    // z-for
    if (el.hasAttribute('z-for')) {
        const rawFor = el.getAttribute('z-for');
        const forMatch = rawFor.match(/^\s*(?:\((\w+)\s*,\s*(\w+)\)|(\w+))\s+(?:in|of)\s+(.*)$/);
        let itemName = 'item', indexName = 'index', listExp = rawFor;

        if (forMatch) { itemName = forMatch[1] || forMatch[3]; indexName = forMatch[2] || 'index'; listExp = forMatch[4]; }
        else { const p = rawFor.split(/\s+(?:in|of)\s+/); if (p.length === 2) { itemName = p[0].trim(); listExp = p[1].trim(); } }

        const parent = el.parentNode;
        if (!parent) return;
        const ph = document.createComment('z-for');
        parent.insertBefore(ph, el);
        el.remove();
        el.removeAttribute('z-for');

        const keyAttr = el.getAttribute(':key') || el.getAttribute('z-key');
        if (keyAttr) { el.removeAttribute(':key'); el.removeAttribute('z-key'); }

        let itemsMap = new Map();

        const updateList = () => {
            let arr = evalExp(listExp, scope);
            if (arr?._isRef) arr = arr.value;
            if (!Array.isArray(arr)) arr = [];

            const newItemsMap = new Map(), newKeys = [];
            arr.forEach((v, i) => {
                const key = '_' + (keyAttr ? evalExp(keyAttr, { ...scope, [itemName]: { _isRef: true, value: v }, [indexName]: { _isRef: true, value: i } }) : i);
                newKeys.push(key);
                const existing = itemsMap.get(key);
                const val = isObj(v) ? reactive(v) : v;
                if (existing) { existing.itemRef.value = val; existing.indexRef.value = i; newItemsMap.set(key, existing); }
                else {
                    const clone = el.cloneNode(true), itemRef = ref(val), indexRef = ref(i);
                    const s = new Scope({ ...scope, [itemName]: itemRef, [indexName]: indexRef });
                    compile(clone, s.data, s);
                    newItemsMap.set(key, { clone, scope: s, itemRef, indexRef });
                }
            });

            for (const [key, item] of itemsMap) if (!newItemsMap.has(key)) { item.clone.remove(); item.scope.cleanup(); }

            let prevNode = ph;
            for (const key of newKeys) {
                const item = newItemsMap.get(key);
                if (item.clone.previousSibling !== prevNode) parent.insertBefore(item.clone, prevNode.nextSibling);
                prevNode = item.clone;
            }
            itemsMap = newItemsMap;
        };

        cs.addEffect(watchEffect(updateList));
        cs.addEffect(() => { for (const item of itemsMap.values()) item.scope.cleanup(); itemsMap.clear(); });
        runHooks('afterCompile', el, scope, cs);
        return;
    }

    // Directives
    for (const { name, value } of [...el.attributes]) {
        if (name.startsWith('@') || name.startsWith('z-on:')) {
            const ev = name[0] === '@' ? name.slice(1) : name.slice(5);
            el.removeAttribute(name);
            const fn = e => {
                const handler = scope[value];
                if (typeof handler === 'function') handler(e);
                else try { Function(...Object.keys(scope), 'e', `"use strict";${value}`)(...Object.values(scope), e); } catch (err) { console.error?.('Event error:', err); runHooks('onError', err, 'event', { name, value }); }
            };
            el.addEventListener(ev, fn);
            cs.addListener(el, ev, fn);
        }
        else if (name === 'z-model') {
            el.removeAttribute(name);
            const isCheck = el.type === 'checkbox' || el.type === 'radio';
            const prop = isCheck ? 'checked' : 'value';
            const ev = isCheck || el.tagName === 'SELECT' ? 'change' : 'input';
            const fn = () => {
                if (el.type === 'radio' && !el.checked) return;
                scope[value]?._isRef ? scope[value].value = el[prop] : evalExp(value + '=_v', { ...scope, _v: el[prop] });
            };
            el.addEventListener(ev, fn);
            cs.addListener(el, ev, fn);
            cs.addEffect(watchEffect(() => {
                const res = evalExp(value, scope);
                el.type === 'radio' ? el.checked = String(el.value) === String(res) : el[prop] = res;
            }));
        }
        else if (name.startsWith(':') || name.startsWith('z-')) {
            const attr = name[0] === ':' ? name.slice(1) : name;
            el.removeAttribute(name);
            const staticClass = attr === 'class' ? (el.getAttribute('class') || '') : '';
            cs.addEffect(watchEffect(() => {
                const res = evalExp(value, scope);
                if (attr === 'z-text') el.textContent = res ?? '';
                else if (attr === 'z-html') el.innerHTML = res ?? '';
                else if (attr === 'z-show') el.style.display = res ? '' : 'none';
                else if (attr === 'style' && isObj(res)) Object.assign(el.style, res);
                else if (attr === 'class') {
                    const classValue = isObj(res) ? (staticClass + ' ' + Object.keys(res).filter(k => res[k]).join(' ')).trim()
                        : typeof res === 'string' ? (staticClass + ' ' + res).trim() : staticClass;
                    el.setAttribute('class', classValue);
                }
                else {
                    const setName = attr.startsWith('z-') ? attr.slice(2) : attr;
                    typeof res === 'boolean' ? (res ? el.setAttribute(setName, '') : el.removeAttribute(setName))
                        : res == null ? el.removeAttribute(setName) : el.setAttribute(setName, res);
                }
            }));
        }
    }

    [...el.childNodes].forEach(child => compile(child, scope, cs));
    runHooks('afterCompile', el, scope, cs);
};

// --- Plugin System ---
const installedPlugins = new Set();

export const use = (plugin, options = {}) => {
    if (installedPlugins.has(plugin)) { console.warn?.('Plugin already installed:', plugin); return; }
    if (typeof plugin.install !== 'function') { console.error?.('Plugin must have an install method:', plugin); return; }
    installedPlugins.add(plugin);
    try {
        plugin.install({ 
            reactive, ref, computed, watchEffect, createApp, 
            addHook, removeHook,
            utils: { isObj, evalExp, Dep, ReactiveEffect, Scope, compile }
        }, options);
    } catch (err) { 
        console.error?.('Plugin installation failed:', plugin, err); 
        runHooks('onError', err, 'plugin', plugin);
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
        unmount() { if (rootScope) { rootScope.cleanup(); rootScope = null; } }
    };
};