/**
 * Zog.js v2.0 - Compact & Optimized
 * Full reactivity with minimal code size
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
    notify() { this.subs.forEach(e => e.scheduler ? e.scheduler(e) : e.run()); }
}

class ReactiveEffect {
    constructor(fn, scheduler = null) {
        this.fn = fn;
        this.scheduler = scheduler;
        this.deps = [];
        this.active = true;
    }
    
    run() {
        if (!this.active) return;
        try {
            effectStack.push(this);
            activeEffect = this;
            return this.fn();
        } finally {
            effectStack.pop();
            activeEffect = effectStack[effectStack.length - 1];
        }
    }
    
    stop() {
        if (this.active) {
            this.deps.forEach(d => d.subs.delete(this));
            this.deps = [];
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
const RAW = Symbol();
const IS_REACTIVE = Symbol();
const reactiveMap = new WeakMap();
const isObj = v => v && typeof v === 'object';

export const reactive = target => {
    if (!isObj(target) || target[IS_REACTIVE]) return target;
    
    const existing = reactiveMap.get(target);
    if (existing) return existing;
    
    const depsMap = new Map();
    const getDep = k => depsMap.get(k) || (depsMap.set(k, new Dep()), depsMap.get(k));
    
    const proxy = new Proxy(target, {
        get: (t, k) => {
            if (k === IS_REACTIVE) return true;
            if (k === RAW) return t;
            getDep(k).depend();
            const res = Reflect.get(t, k);
            return isObj(res) ? reactive(res) : res;
        },
        set: (t, k, v) => {
            const old = t[k];
            const res = Reflect.set(t, k, v);
            if (old !== v) getDep(k).notify();
            return res;
        },
        deleteProperty: (t, k) => {
            const had = k in t;
            const res = Reflect.deleteProperty(t, k);
            if (had) getDep(k).notify();
            return res;
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
        set value(v) { if (v !== val) { val = v; dep.notify(); } },
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

// --- Expression Evaluator ---
const evalExp = (exp, scope) => {
    try {
        const keys = Object.keys(scope);
        const vals = keys.map(k => scope[k]?._isRef ? scope[k].value : scope[k]);
        return Function(...keys, `"use strict";return(${exp})`)(...vals);
    } catch { return undefined; }
};

// --- Compiler ---
const compile = (el, scope, cs) => {
    if (!el) return;

    // Text nodes
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

    // z-if
    if (el.hasAttribute('z-if')) {
        const branches = [];
        let curr = el, parent = el.parentNode;
        if (!parent) return;

        const ph = document.createComment('z-if');
        parent.insertBefore(ph, el);

        while (curr) {
            const type = ['z-if', 'z-else-if', 'z-else'].find(t => curr.hasAttribute(t));
            if (!type) break;
            const exp = curr.getAttribute(type);
            curr.removeAttribute(type);
            branches.push({ el: curr, exp, type, scope: null });
            const next = curr.nextElementSibling;
            curr.remove();
            curr = next;
        }

        cs.addEffect(watchEffect(() => {
            const match = branches.find(b => b.type === 'z-else' || evalExp(b.exp, scope));
            branches.forEach(b => {
                if (b === match) {
                    if (!b.el.parentNode) {
                        parent.insertBefore(b.el, ph.nextSibling);
                        if (!b.scope) {
                            b.scope = new Scope(scope);
                            compile(b.el, scope, b.scope);
                        }
                    }
                } else {
                    if (b.el.parentNode) b.el.remove();
                    if (b.scope) { b.scope.cleanup(); b.scope = null; }
                }
            });
        }));
        
        cs.addEffect(() => branches.forEach(b => b.scope?.cleanup()));
        return;
    }

    if (el.hasAttribute('z-else-if') || el.hasAttribute('z-else')) return;

    // z-for
    if (el.hasAttribute('z-for')) {
        const [item, list] = el.getAttribute('z-for').split(' in ').map(s => s.trim());
        const parent = el.parentNode;
        if (!parent) return;

        const ph = document.createComment('z-for');
        parent.insertBefore(ph, el);
        el.remove();
        el.removeAttribute('z-for');

        let items = [];
        cs.addEffect(watchEffect(() => {
            items.forEach(({clone, scope: s}) => { clone.remove(); s.cleanup(); });
            items = [];

            const arr = evalExp(list, scope) || [];
            if (Array.isArray(arr)) {
                arr.forEach((v, i) => {
                    const clone = el.cloneNode(true);
                    parent.insertBefore(clone, ph);
                    const s = new Scope({ ...scope, [item]: ref(v), index: ref(i) });
                    compile(clone, s.data, s);
                    items.push({ clone, scope: s });
                });
            }
        }));
        
        cs.addEffect(() => items.forEach(({scope: s}) => s.cleanup()));
        return;
    }

    // Directives
    Array.from(el.attributes).forEach(({ name, value }) => {
        // Events
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
        // z-model
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
                el.type === 'radio' ? el.checked = String(el.value) === String(res) : el[prop] = res;
            }));
        }
        // Bindings
        else if (name.startsWith(':') || name.startsWith('z-')) {
            const attr = name.startsWith(':') ? name.slice(1) : name;
            const staticClass = attr === 'class' ? el.className : '';
            if (name.startsWith(':')) el.removeAttribute(name);

            cs.addEffect(watchEffect(() => {
                const res = evalExp(value, scope);
                if (attr === 'z-text') el.textContent = res ?? '';
                else if (attr === 'z-html') el.innerHTML = res ?? '';
                else if (attr === 'z-show') el.style.display = res ? '' : 'none';
                else if (attr === 'style' && isObj(res)) Object.assign(el.style, res);
                else if (attr === 'class' && isObj(res)) {
                    const dynamic = Object.keys(res).filter(k => res[k]).join(' ');
                    el.className = (staticClass + ' ' + dynamic).trim();
                } else el.setAttribute(attr, res ?? '');
            }));
        }
    });

    Array.from(el.childNodes).forEach(child => compile(child, scope, cs));
};

// --- Router ---
const isBrowser = typeof window !== 'undefined';
const getQuery = () => isBrowser ? Object.fromEntries(new URLSearchParams(location.search)) : {};

const _r = {
    h: ref(isBrowser ? location.hash : ''),
    p: ref(isBrowser ? location.pathname : ''),
    q: ref(getQuery())
};

const sync = () => {
    if (!isBrowser) return;
    _r.h.value = location.hash;
    _r.p.value = location.pathname;
    _r.q.value = getQuery();
};

if (isBrowser) {
    addEventListener('hashchange', sync);
    addEventListener('popstate', sync);
}

export const route = {
    get hash() { return _r.h.value; },
    get path() { return _r.p.value; },
    get query() { return _r.q.value; }
};

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

// --- Utils ---
export const nextTick = fn => Promise.resolve().then(fn);
export const unref = v => v?._isRef ? v.value : v;
export const toRef = (obj, key) => {
    const val = obj[key];
    if (val?._isRef) return val;
    return {
        _isRef: true,
        get value() { return obj[key]; },
        set value(v) { obj[key] = v; }
    };
};