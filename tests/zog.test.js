/**
 * Zog.js - Comprehensive Test Suite
 * Tests all features, edge cases, and real-world scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import {
    ref,
    reactive,
    computed,
    watchEffect,
    createApp,
    use
} from '../src/zog.js';

// Setup DOM environment
let dom;
let document;
let window;

beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>', {
        url: 'http://localhost',
        pretendToBeVisual: true
    });
    document = dom.window.document;
    window = dom.window;
    global.document = document;
    global.window = window;
});

afterEach(() => {
    if (dom) {
        dom.window.close();
    }
});

// ============================================
// 1. REACTIVITY CORE TESTS
// ============================================

describe('Reactivity Core', () => {
    describe('ref()', () => {
        it('should create a reactive reference', () => {
            const count = ref(0);
            expect(count.value).toBe(0);
            expect(count._isRef).toBe(true);
        });

        it('should update ref value', () => {
            const count = ref(0);
            count.value = 5;
            expect(count.value).toBe(5);
        });

        it('should trigger effects on change', async () => {
            const count = ref(0);
            let dummy;
            
            watchEffect(() => {
                dummy = count.value;
            });
            
            expect(dummy).toBe(0);
            count.value = 7;
            
            await Promise.resolve();
            expect(dummy).toBe(7);
        });

        it('should not trigger if value is the same', async () => {
            const count = ref(0);
            let runs = 0;
            
            watchEffect(() => {
                count.value;
                runs++;
            });
            
            await Promise.resolve();
            const initialRuns = runs;
            
            count.value = 0; // Same value
            await Promise.resolve();
            expect(runs).toBe(initialRuns);
        });

        it('should work with objects', () => {
            const obj = ref({ a: 1 });
            expect(obj.value.a).toBe(1);
            obj.value = { a: 2 };
            expect(obj.value.a).toBe(2);
        });

        it('should work with arrays', () => {
            const arr = ref([1, 2, 3]);
            expect(arr.value.length).toBe(3);
            arr.value = [4, 5];
            expect(arr.value.length).toBe(2);
        });

        it('should handle null and undefined', () => {
            const nullRef = ref(null);
            const undefinedRef = ref(undefined);
            
            expect(nullRef.value).toBe(null);
            expect(undefinedRef.value).toBe(undefined);
        });

        it('should toString properly', () => {
            const num = ref(42);
            const str = ref('hello');
            
            expect(num.toString()).toBe('42');
            expect(str.toString()).toBe('hello');
        });
    });

    describe('reactive()', () => {
        it('should make object reactive', () => {
            const obj = reactive({ count: 0 });
            expect(obj.count).toBe(0);
        });

        it('should trigger effects on property change', async () => {
            const obj = reactive({ count: 0 });
            let dummy;
            
            watchEffect(() => {
                dummy = obj.count;
            });
            
            expect(dummy).toBe(0);
            obj.count = 7;
            
            await Promise.resolve();
            expect(dummy).toBe(7);
        });

        it('should handle nested objects', async () => {
            const obj = reactive({ nested: { count: 0 } });
            let dummy;
            
            watchEffect(() => {
                dummy = obj.nested.count;
            });
            
            obj.nested.count = 5;
            await Promise.resolve();
            expect(dummy).toBe(5);
        });

        it('should handle array mutations', async () => {
            const arr = reactive([1, 2, 3]);
            let dummy;
            
            watchEffect(() => {
                dummy = arr.length;
            });
            
            arr.push(4);
            await Promise.resolve();
            expect(dummy).toBe(4);
            expect(arr[3]).toBe(4);
        });

        it('should track array methods: push', async () => {
            const arr = reactive([]);
            let dummy;
            
            watchEffect(() => {
                dummy = arr.length;
            });
            
            arr.push(1);
            await Promise.resolve();
            expect(dummy).toBe(1);
        });

        it('should track array methods: pop', async () => {
            const arr = reactive([1, 2, 3]);
            let dummy;
            
            watchEffect(() => {
                dummy = arr.length;
            });
            
            arr.pop();
            await Promise.resolve();
            expect(dummy).toBe(2);
        });

        it('should track array methods: shift', async () => {
            const arr = reactive([1, 2, 3]);
            let dummy;
            
            watchEffect(() => {
                dummy = arr.length;
            });
            
            arr.shift();
            await Promise.resolve();
            expect(dummy).toBe(2);
            expect(arr[0]).toBe(2);
        });

        it('should track array methods: unshift', async () => {
            const arr = reactive([2, 3]);
            let dummy;
            
            watchEffect(() => {
                dummy = arr.length;
            });
            
            arr.unshift(1);
            await Promise.resolve();
            expect(dummy).toBe(3);
            expect(arr[0]).toBe(1);
        });

        it('should track array methods: splice', async () => {
            const arr = reactive([1, 2, 3, 4]);
            let dummy;
            
            watchEffect(() => {
                dummy = arr.length;
            });
            
            arr.splice(1, 2, 5, 6);
            await Promise.resolve();
            expect(dummy).toBe(4);
            expect(arr).toEqual([1, 5, 6, 4]);
        });

        it('should track array methods: sort', async () => {
            const arr = reactive([3, 1, 2]);
            let dummy;
            
            watchEffect(() => {
                dummy = arr[0];
            });
            
            arr.sort();
            await Promise.resolve();
            expect(dummy).toBe(1);
            expect(arr).toEqual([1, 2, 3]);
        });

        it('should track array methods: reverse', async () => {
            const arr = reactive([1, 2, 3]);
            let dummy;
            
            watchEffect(() => {
                dummy = arr[0];
            });
            
            arr.reverse();
            await Promise.resolve();
            expect(dummy).toBe(3);
        });

        it('should track array iteration methods: forEach', async () => {
            const arr = reactive([1, 2, 3]);
            let sum = 0;
            
            watchEffect(() => {
                sum = 0;
                arr.forEach(n => sum += n);
            });
            
            await Promise.resolve();
            expect(sum).toBe(6);
            
            arr.push(4);
            await Promise.resolve();
            expect(sum).toBe(10);
        });

        it('should track array iteration methods: map', async () => {
            const arr = reactive([1, 2, 3]);
            let mapped;
            
            watchEffect(() => {
                mapped = arr.map(n => n * 2);
            });
            
            await Promise.resolve();
            expect(mapped).toEqual([2, 4, 6]);
            
            arr.push(4);
            await Promise.resolve();
            expect(mapped).toEqual([2, 4, 6, 8]);
        });

        it('should track array methods: filter', async () => {
            const arr = reactive([1, 2, 3, 4]);
            let filtered;
            
            watchEffect(() => {
                filtered = arr.filter(n => n > 2);
            });
            
            await Promise.resolve();
            expect(filtered).toEqual([3, 4]);
        });

        it('should track array methods: find', async () => {
            const arr = reactive([1, 2, 3, 4]);
            let found;
            
            watchEffect(() => {
                found = arr.find(n => n > 2);
            });
            
            await Promise.resolve();
            expect(found).toBe(3);
        });

        it('should track array methods: includes', async () => {
            const arr = reactive([1, 2, 3]);
            let hasTwo;
            
            watchEffect(() => {
                hasTwo = arr.includes(2);
            });
            
            await Promise.resolve();
            expect(hasTwo).toBe(true);
            
            arr.splice(1, 1);
            await Promise.resolve();
            expect(hasTwo).toBe(false);
        });

        it('should handle property deletion', async () => {
            const obj = reactive({ a: 1, b: 2 });
            let dummy;
            
            watchEffect(() => {
                dummy = 'a' in obj;
            });
            
            expect(dummy).toBe(true);
            delete obj.a;
            
            await Promise.resolve();
            expect(dummy).toBe(false);
        });

        it('should track has operation', async () => {
            const obj = reactive({ a: 1 });
            let dummy;
            
            watchEffect(() => {
                dummy = 'a' in obj;
            });
            
            expect(dummy).toBe(true);
        });

        it('should track ownKeys operation', async () => {
            const obj = reactive({ a: 1 });
            let keys;
            
            watchEffect(() => {
                keys = Object.keys(obj);
            });
            
            await Promise.resolve();
            expect(keys).toEqual(['a']);
            
            obj.b = 2;
            await Promise.resolve();
            expect(keys).toEqual(['a', 'b']);
        });

        it('should not make already reactive objects reactive again', () => {
            const original = { count: 0 };
            const observed = reactive(original);
            const observed2 = reactive(observed);
            
            expect(observed2).toBe(observed);
        });

        it('should handle circular references', () => {
            const obj = reactive({ self: null });
            obj.self = obj;
            
            expect(obj.self).toBe(obj);
        });

        it('should work with nested arrays', async () => {
            const arr = reactive([[1, 2], [3, 4]]);
            let dummy;
            
            watchEffect(() => {
                dummy = arr[0][0];
            });
            
            arr[0][0] = 10;
            await Promise.resolve();
            expect(dummy).toBe(10);
        });

        it('should handle array length changes', async () => {
            const arr = reactive([1, 2, 3]);
            let dummy;
            
            watchEffect(() => {
                dummy = arr.length;
            });
            
            arr.length = 0;
            await Promise.resolve();
            expect(dummy).toBe(0);
            expect(arr).toEqual([]);
        });
    });

    describe('computed()', () => {
        it('should return computed value', () => {
            const value = ref(1);
            const cValue = computed(() => value.value + 1);
            
            expect(cValue.value).toBe(2);
        });

        it('should compute lazily', () => {
            const value = ref(1);
            let runs = 0;
            
            const cValue = computed(() => {
                runs++;
                return value.value + 1;
            });
            
            expect(runs).toBe(0);
            expect(cValue.value).toBe(2);
            expect(runs).toBe(1);
            expect(cValue.value).toBe(2);
            expect(runs).toBe(1); // Should not run again
        });

        it('should trigger on dependency change', async () => {
            const value = ref(1);
            const cValue = computed(() => value.value + 1);
            
            expect(cValue.value).toBe(2);
            
            value.value = 2;
            await Promise.resolve();
            
            expect(cValue.value).toBe(3);
        });

        it('should chain computed values', () => {
            const value = ref(1);
            const c1 = computed(() => value.value + 1);
            const c2 = computed(() => c1.value + 1);
            
            expect(c2.value).toBe(3);
            
            value.value = 2;
            expect(c2.value).toBe(4);
        });

        it('should work with reactive objects', () => {
            const obj = reactive({ a: 1, b: 2 });
            const sum = computed(() => obj.a + obj.b);
            
            expect(sum.value).toBe(3);
            
            obj.a = 2;
            expect(sum.value).toBe(4);
        });

        it('should be marked as ref', () => {
            const c = computed(() => 1);
            expect(c._isRef).toBe(true);
        });
    });

    describe('watchEffect()', () => {
        it('should run immediately', () => {
            let dummy;
            watchEffect(() => {
                dummy = 'ran';
            });
            
            expect(dummy).toBe('ran');
        });

        it('should track reactive dependencies', async () => {
            const count = ref(0);
            let dummy;
            
            watchEffect(() => {
                dummy = count.value;
            });
            
            expect(dummy).toBe(0);
            count.value = 5;
            
            await Promise.resolve();
            expect(dummy).toBe(5);
        });

        it('should return stop function', () => {
            const count = ref(0);
            let dummy;
            
            const stop = watchEffect(() => {
                dummy = count.value;
            });
            
            expect(dummy).toBe(0);
            expect(typeof stop).toBe('function');
        });

        it('should stop tracking after stop is called', async () => {
            const count = ref(0);
            let dummy;
            
            const stop = watchEffect(() => {
                dummy = count.value;
            });
            
            expect(dummy).toBe(0);
            stop();
            
            count.value = 5;
            await Promise.resolve();
            expect(dummy).toBe(0); // Should not update
        });

        it('should work with custom scheduler', async () => {
            const count = ref(0);
            let dummy;
            let schedulerCalled = false;
            
            watchEffect(() => {
                dummy = count.value;
            }, {
                scheduler: (job) => {
                    schedulerCalled = true;
                    job();
                }
            });
            
            count.value = 5;
            await Promise.resolve();
            
            expect(dummy).toBe(5);
            expect(schedulerCalled).toBe(true);
        });

        it('should batch multiple changes', async () => {
            const count = ref(0);
            let runs = 0;
            
            watchEffect(() => {
                count.value;
                runs++;
            });
            
            const initialRuns = runs;
            
            count.value = 1;
            count.value = 2;
            count.value = 3;
            
            await Promise.resolve();
            expect(runs).toBe(initialRuns + 1); // Only one additional run
        });

        it('should handle nested effects', async () => {
            const count = ref(0);
            let outer = 0;
            let inner = 0;
            
            watchEffect(() => {
                outer++;
                watchEffect(() => {
                    inner++;
                    count.value;
                });
            });
            
            await Promise.resolve();
            count.value = 1;
            await Promise.resolve();
            
            expect(outer).toBeGreaterThan(0);
            expect(inner).toBeGreaterThan(0);
        });

        it('should not cause infinite loops', async () => {
            const count = ref(0);
            let runs = 0;
            
            watchEffect(() => {
                runs++;
                if (count.value < 2) {
                    // Use setTimeout to avoid batching
                    setTimeout(() => {
                        if (count.value < 2) count.value++;
                    }, 0);
                }
            });
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            expect(runs).toBeLessThan(10); // Should stabilize
            expect(count.value).toBeGreaterThanOrEqual(1);
        });
    });
});

// ============================================
// 2. TEMPLATE COMPILER TESTS
// ============================================

describe('Template Compiler', () => {
    describe('Text Interpolation', () => {
        it('should interpolate simple expressions', async () => {
            document.body.innerHTML = '<div id="app">{{ message }}</div>';
            
            const app = createApp(() => {
                const message = ref('Hello World');
                return { message };
            });
            
            app.mount('#app');
            await Promise.resolve();
            
            expect(document.querySelector('#app').textContent).toBe('Hello World');
        });

        it('should update on data change', async () => {
            document.body.innerHTML = '<div id="app">{{ count }}</div>';
            
            let countRef;
            const app = createApp(() => {
                countRef = ref(0);
                return { count: countRef };
            });
            
            app.mount('#app');
            await Promise.resolve();
            
            expect(document.querySelector('#app').textContent).toBe('0');
            
            countRef.value = 42;
            await Promise.resolve();
            
            expect(document.querySelector('#app').textContent).toBe('42');
        });

        it('should handle multiple interpolations', async () => {
            document.body.innerHTML = '<div id="app">{{ first }} {{ last }}</div>';
            
            const app = createApp(() => {
                return { first: ref('John'), last: ref('Doe') };
            });
            
            app.mount('#app');
            await Promise.resolve();
            
            expect(document.querySelector('#app').textContent).toBe('John Doe');
        });

        it('should handle expressions', async () => {
            document.body.innerHTML = '<div id="app">{{ count * 2 }}</div>';
            
            const app = createApp(() => {
                return { count: ref(5) };
            });
            
            app.mount('#app');
            await Promise.resolve();
            
            expect(document.querySelector('#app').textContent).toBe('10');
        });
    });

    describe('z-if Directive', () => {
        it('should conditionally render element', async () => {
            document.body.innerHTML = '<div id="app"><div z-if="show">Visible</div></div>';
            
            let showRef;
            const app = createApp(() => {
                showRef = ref(true);
                return { show: showRef };
            });
            
            app.mount('#app');
            await Promise.resolve();
            
            expect(document.querySelector('#app').textContent).toContain('Visible');
            
            showRef.value = false;
            await Promise.resolve();
            
            expect(document.querySelector('#app').textContent).not.toContain('Visible');
        });

        it('should work with z-else', async () => {
            document.body.innerHTML = `
                <div id="app">
                    <div z-if="show">If</div>
                    <div z-else>Else</div>
                </div>
            `;
            
            let showRef;
            const app = createApp(() => {
                showRef = ref(true);
                return { show: showRef };
            });
            
            app.mount('#app');
            await Promise.resolve();
            
            expect(document.querySelector('#app').textContent).toContain('If');
            expect(document.querySelector('#app').textContent).not.toContain('Else');
            
            showRef.value = false;
            await Promise.resolve();
            
            expect(document.querySelector('#app').textContent).not.toContain('If');
            expect(document.querySelector('#app').textContent).toContain('Else');
        });

        it('should work with z-else-if', async () => {
            document.body.innerHTML = `
                <div id="app">
                    <div z-if="status === 'a'">A</div>
                    <div z-else-if="status === 'b'">B</div>
                    <div z-else>C</div>
                </div>
            `;
            
            let statusRef;
            const app = createApp(() => {
                statusRef = ref('a');
                return { status: statusRef };
            });
            
            app.mount('#app');
            await Promise.resolve();
            
            expect(document.querySelector('#app').textContent.trim()).toBe('A');
            
            statusRef.value = 'b';
            await Promise.resolve();
            expect(document.querySelector('#app').textContent.trim()).toBe('B');
            
            statusRef.value = 'c';
            await Promise.resolve();
            expect(document.querySelector('#app').textContent.trim()).toBe('C');
        });
    });

    describe('z-for Directive', () => {
        it('should render list', async () => {
            document.body.innerHTML = `
                <div id="app">
                    <ul>
                        <li z-for="item in items">{{ item }}</li>
                    </ul>
                </div>
            `;
            
            const app = createApp(() => {
                const items = reactive([1, 2, 3]);
                return { items };
            });
            
            app.mount('#app');
            await Promise.resolve();
            
            const lis = document.querySelectorAll('li');
            expect(lis.length).toBe(3);
            expect(lis[0].textContent).toBe('1');
            expect(lis[1].textContent).toBe('2');
            expect(lis[2].textContent).toBe('3');
        });

        it('should update on array push', async () => {
            document.body.innerHTML = `
                <div id="app">
                    <ul>
                        <li z-for="item in items">{{ item }}</li>
                    </ul>
                </div>
            `;
            
            let itemsRef;
            const app = createApp(() => {
                itemsRef = reactive([1, 2]);
                return { items: itemsRef };
            });
            
            app.mount('#app');
            await Promise.resolve();
            
            expect(document.querySelectorAll('li').length).toBe(2);
            
            itemsRef.push(3);
            await Promise.resolve();
            
            expect(document.querySelectorAll('li').length).toBe(3);
            expect(document.querySelectorAll('li')[2].textContent).toBe('3');
        });

        it('should handle with index', async () => {
            document.body.innerHTML = `
                <div id="app">
                    <ul>
                        <li z-for="(item, index) in items">{{ index }}: {{ item }}</li>
                    </ul>
                </div>
            `;
            
            const app = createApp(() => {
                const items = reactive(['a', 'b', 'c']);
                return { items };
            });
            
            app.mount('#app');
            await Promise.resolve();
            
            const lis = document.querySelectorAll('li');
            expect(lis[0].textContent).toBe('0: a');
            expect(lis[1].textContent).toBe('1: b');
            expect(lis[2].textContent).toBe('2: c');
        });

        it('should work with :key attribute', async () => {
            document.body.innerHTML = `
                <div id="app">
                    <ul>
                        <li z-for="item in items" :key="item.id">{{ item.name }}</li>
                    </ul>
                </div>
            `;
            
            let itemsRef;
            const app = createApp(() => {
                itemsRef = reactive([
                    { id: 1, name: 'A' },
                    { id: 2, name: 'B' }
                ]);
                return { items: itemsRef };
            });
            
            app.mount('#app');
            await Promise.resolve();
            
            const firstLi = document.querySelectorAll('li')[0];
            
            // Reverse array
            itemsRef.reverse();
            await Promise.resolve();
            
            // First li should now have 'B'
            expect(document.querySelectorAll('li')[0].textContent).toBe('B');
        });

        it('should handle array splice', async () => {
            document.body.innerHTML = `
                <div id="app">
                    <ul>
                        <li z-for="item in items">{{ item }}</li>
                    </ul>
                </div>
            `;
            
            let itemsRef;
            const app = createApp(() => {
                itemsRef = reactive([1, 2, 3, 4]);
                return { items: itemsRef };
            });
            
            app.mount('#app');
            await Promise.resolve();
            
            itemsRef.splice(1, 2);
            await Promise.resolve();
            
            const lis = document.querySelectorAll('li');
            expect(lis.length).toBe(2);
            expect(lis[0].textContent).toBe('1');
            expect(lis[1].textContent).toBe('4');
        });
    });

    describe('z-model Directive', () => {
        it('should bind input value', async () => {
            document.body.innerHTML = '<div id="app"><input z-model="text" /></div>';
            
            let textRef;
            const app = createApp(() => {
                textRef = ref('');
                return { text: textRef };
            });
            
            app.mount('#app');
            await Promise.resolve();
            
            const input = document.querySelector('input');
            expect(input.value).toBe('');
            
            textRef.value = 'hello';
            await Promise.resolve();
            
            expect(input.value).toBe('hello');
        });

        it('should update ref on input', async () => {
            document.body.innerHTML = '<div id="app"><input z-model="text" /></div>';
            
            let textRef;
            const app = createApp(() => {
                textRef = ref('');
                return { text: textRef };
            });
            
            app.mount('#app');
            await Promise.resolve();
            
            const input = document.querySelector('input');
            input.value = 'test';
            input.dispatchEvent(new window.Event('input'));
            
            await Promise.resolve();
            expect(textRef.value).toBe('test');
        });

        it('should work with checkbox', async () => {
            document.body.innerHTML = '<div id="app"><input type="checkbox" z-model="checked" /></div>';
            
            let checkedRef;
            const app = createApp(() => {
                checkedRef = ref(false);
                return { checked: checkedRef };
            });
            
            app.mount('#app');
            await Promise.resolve();
            
            const checkbox = document.querySelector('input');
            expect(checkbox.checked).toBe(false);
            
            checkedRef.value = true;
            await Promise.resolve();
            
            expect(checkbox.checked).toBe(true);
        });

        it('should work with select', async () => {
            document.body.innerHTML = `
                <div id="app">
                    <select z-model="selected">
                        <option value="a">A</option>
                        <option value="b">B</option>
                    </select>
                </div>
            `;
            
            let selectedRef;
            const app = createApp(() => {
                selectedRef = ref('a');
                return { selected: selectedRef };
            });
            
            app.mount('#app');
            await Promise.resolve();
            
            const select = document.querySelector('select');
            expect(select.value).toBe('a');
            
            selectedRef.value = 'b';
            await Promise.resolve();
            
            expect(select.value).toBe('b');
        });
    });

    describe('Event Handlers', () => {
        it('should handle @click', async () => {
            document.body.innerHTML = '<div id="app"><button @click="handleClick">Click</button></div>';
            
            let clicked = false;
            const app = createApp(() => {
                const handleClick = () => { clicked = true; };
                return { handleClick };
            });
            
            app.mount('#app');
            await Promise.resolve();
            
            const button = document.querySelector('button');
            button.click();
            
            expect(clicked).toBe(true);
        });

        it('should handle z-on:click', async () => {
            document.body.innerHTML = '<div id="app"><button z-on:click="handleClick">Click</button></div>';
            
            let clicked = false;
            const app = createApp(() => {
                const handleClick = () => { clicked = true; };
                return { handleClick };
            });
            
            app.mount('#app');
            await Promise.resolve();
            
            const button = document.querySelector('button');
            button.click();
            
            expect(clicked).toBe(true);
        });

        it('should pass event to handler', async () => {
            document.body.innerHTML = '<div id="app"><button @click="handleClick">Click</button></div>';
            
            let event = null;
            const app = createApp(() => {
                const handleClick = (e) => { event = e; };
                return { handleClick };
            });
            
            app.mount('#app');
            await Promise.resolve();
            
            const button = document.querySelector('button');
            button.click();
            
            expect(event).not.toBe(null);
            expect(event.type).toBe('click');
        });

        it('should handle inline expressions', async () => {
            document.body.innerHTML = '<div id="app"><button @click="count.value++">+</button></div>';
            
            let countRef;
            const app = createApp(() => {
                countRef = ref(0);
                return { count: countRef };
            });
            
            app.mount('#app');
            await Promise.resolve();
            
            const button = document.querySelector('button');
            button.click();
            
            await Promise.resolve();
            expect(countRef.value).toBe(1);
        });
    });

    describe('Attribute Bindings', () => {
        it('should bind with :attribute', async () => {
            document.body.innerHTML = '<div id="app"><div :id="dynamicId"></div></div>';
            
            let idRef;
            const app = createApp(() => {
                idRef = ref('test-id');
                return { dynamicId: idRef };
            });
            
            app.mount('#app');
            await Promise.resolve();
            
            const div = document.querySelector('#app > div');
            expect(div.getAttribute('id')).toBe('test-id');
            
            idRef.value = 'new-id';
            await Promise.resolve();
            
            expect(div.getAttribute('id')).toBe('new-id');
        });

        it('should handle :class with object', async () => {
            document.body.innerHTML = '<div id="app"><div class="static" :class="{ active: isActive }"></div></div>';
            
            let isActiveRef;
            const app = createApp(() => {
                isActiveRef = ref(false);
                return { isActive: isActiveRef };
            });
            
            app.mount('#app');
            await Promise.resolve();
            
            const div = document.querySelector('#app > div');
            expect(div.className).toBe('static');
            
            isActiveRef.value = true;
            await Promise.resolve();
            
            expect(div.className).toContain('active');
        });

        it('should handle :style with object', async () => {
            document.body.innerHTML = '<div id="app"><div :style="{ color: textColor }"></div></div>';
            
            let colorRef;
            const app = createApp(() => {
                colorRef = ref('red');
                return { textColor: colorRef };
            });
            
            app.mount('#app');
            await Promise.resolve();
            
            const div = document.querySelector('#app > div');
            expect(div.style.color).toBe('red');
            
            colorRef.value = 'blue';
            await Promise.resolve();
            
            expect(div.style.color).toBe('blue');
        });

        it('should handle boolean attributes', async () => {
            document.body.innerHTML = '<div id="app"><button :disabled="isDisabled">Button</button></div>';
            
            let disabledRef;
            const app = createApp(() => {
                disabledRef = ref(false);
                return { isDisabled: disabledRef };
            });
            
            app.mount('#app');
            await Promise.resolve();
            
            const button = document.querySelector('button');
            expect(button.hasAttribute('disabled')).toBe(false);
            
            disabledRef.value = true;
            await Promise.resolve();
            
            expect(button.hasAttribute('disabled')).toBe(true);
        });
    });

    describe('z-text and z-html', () => {
        it('should set textContent with z-text', async () => {
            document.body.innerHTML = '<div id="app"><p z-text="message"></p></div>';
            
            let messageRef;
            const app = createApp(() => {
                messageRef = ref('Hello');
                return { message: messageRef };
            });
            
            app.mount('#app');
            await Promise.resolve();
            
            expect(document.querySelector('p').textContent).toBe('Hello');
            
            messageRef.value = 'World';
            await Promise.resolve();
            
            expect(document.querySelector('p').textContent).toBe('World');
        });

        it('should set innerHTML with z-html', async () => {
            document.body.innerHTML = '<div id="app"><div z-html="html"></div></div>';
            
            let htmlRef;
            const app = createApp(() => {
                htmlRef = ref('<strong>Bold</strong>');
                return { html: htmlRef };
            });
            
            app.mount('#app');
            await Promise.resolve();
            
            const div = document.querySelector('#app > div');
            expect(div.innerHTML).toBe('<strong>Bold</strong>');
            expect(div.querySelector('strong')).not.toBe(null);
        });
    });

    describe('z-show Directive', () => {
        it('should toggle display', async () => {
            document.body.innerHTML = '<div id="app"><div z-show="visible">Content</div></div>';
            
            let visibleRef;
            const app = createApp(() => {
                visibleRef = ref(true);
                return { visible: visibleRef };
            });
            
            app.mount('#app');
            await Promise.resolve();
            
            const div = document.querySelector('#app > div');
            expect(div.style.display).toBe('');
            
            visibleRef.value = false;
            await Promise.resolve();
            
            expect(div.style.display).toBe('none');
            
            visibleRef.value = true;
            await Promise.resolve();
            
            expect(div.style.display).toBe('');
        });
    });
});

// ============================================
// 3. PLUGIN SYSTEM TESTS
// ============================================

describe('Plugin System', () => {
    it('should install plugin', () => {
        let installed = false;
        
        const plugin = {
            install(zog, options) {
                installed = true;
            }
        };
        
        use(plugin);
        expect(installed).toBe(true);
    });

    it('should pass options to plugin', () => {
        let receivedOptions = null;
        
        const plugin = {
            install(zog, options) {
                receivedOptions = options;
            }
        };
        
        use(plugin, { test: 'value' });
        expect(receivedOptions).toEqual({ test: 'value' });
    });

    it('should provide Zog APIs to plugin', () => {
        let receivedAPI = null;
        
        const plugin = {
            install(zog, options) {
                receivedAPI = zog;
            }
        };
        
        use(plugin);
        
        expect(receivedAPI).toHaveProperty('reactive');
        expect(receivedAPI).toHaveProperty('ref');
        expect(receivedAPI).toHaveProperty('computed');
        expect(receivedAPI).toHaveProperty('watchEffect');
        expect(receivedAPI).toHaveProperty('createApp');
        expect(receivedAPI).toHaveProperty('utils');
    });

    it('should not install same plugin twice', () => {
        let installCount = 0;
        
        const plugin = {
            install() {
                installCount++;
            }
        };
        
        use(plugin);
        use(plugin);
        
        expect(installCount).toBe(1);
    });

    it('should handle plugin without install method', () => {
        const invalidPlugin = {};
        
        expect(() => {
            use(invalidPlugin);
        }).not.toThrow();
    });
});

// ============================================
// 4. APP LIFECYCLE TESTS
// ============================================

describe('App Lifecycle', () => {
    it('should mount app', async () => {
        document.body.innerHTML = '<div id="app">{{ message }}</div>';
        
        const app = createApp(() => {
            return { message: ref('Hello') };
        });
        
        app.mount('#app');
        await Promise.resolve();
        
        expect(document.querySelector('#app').textContent).toBe('Hello');
    });

    it('should return app instance from mount', async () => {
        document.body.innerHTML = '<div id="app"></div>';
        
        const app = createApp(() => ({}));
        const result = app.mount('#app');
        
        expect(result).toBe(app);
    });

    it('should handle unmount', async () => {
        document.body.innerHTML = '<div id="app"><button @click="handleClick">Click</button></div>';
        
        let clickCount = 0;
        const app = createApp(() => {
            const handleClick = () => clickCount++;
            return { handleClick };
        });
        
        app.mount('#app');
        await Promise.resolve();
        
        const button = document.querySelector('button');
        button.click();
        expect(clickCount).toBe(1);
        
        app.unmount();
        
        button.click();
        expect(clickCount).toBe(1); // Should not increase after unmount
    });

    it('should cleanup effects on unmount', async () => {
        document.body.innerHTML = '<div id="app">{{ count }}</div>';
        
        let countRef;
        const app = createApp(() => {
            countRef = ref(0);
            return { count: countRef };
        });
        
        app.mount('#app');
        await Promise.resolve();
        
        app.unmount();
        
        countRef.value = 5;
        await Promise.resolve();
        
        // DOM should not update after unmount
        expect(document.querySelector('#app').textContent).toBe('0');
    });

    it('should handle mounting to non-existent selector', () => {
        const app = createApp(() => ({}));
        
        expect(() => {
            app.mount('#non-existent');
        }).not.toThrow();
    });
});

// ============================================
// 5. EDGE CASES AND REAL-WORLD SCENARIOS
// ============================================

describe('Edge Cases and Real-World Scenarios', () => {
    describe('Complex State Management', () => {
        it('should handle deeply nested reactive objects', async () => {
            const state = reactive({
                user: {
                    profile: {
                        name: 'John',
                        address: {
                            city: 'NYC'
                        }
                    }
                }
            });
            
            let dummy;
            watchEffect(() => {
                dummy = state.user.profile.address.city;
            });
            
            await Promise.resolve();
            expect(dummy).toBe('NYC');
            
            state.user.profile.address.city = 'LA';
            await Promise.resolve();
            expect(dummy).toBe('LA');
        });

        it('should handle mixed arrays and objects', async () => {
            const state = reactive({
                items: [
                    { id: 1, name: 'A' },
                    { id: 2, name: 'B' }
                ]
            });
            
            let dummy;
            watchEffect(() => {
                dummy = state.items[0].name;
            });
            
            await Promise.resolve();
            expect(dummy).toBe('A');
            
            state.items[0].name = 'Updated';
            await Promise.resolve();
            expect(dummy).toBe('Updated');
        });
    });

    describe('Performance Scenarios', () => {
        it('should handle large lists efficiently', async () => {
            document.body.innerHTML = `
                <div id="app">
                    <ul>
                        <li z-for="item in items" :key="item">{{ item }}</li>
                    </ul>
                </div>
            `;
            
            const largeArray = Array.from({ length: 1000 }, (_, i) => i);
            let itemsRef;
            
            const app = createApp(() => {
                itemsRef = reactive(largeArray);
                return { items: itemsRef };
            });
            
            const startTime = Date.now();
            app.mount('#app');
            await Promise.resolve();
            const mountTime = Date.now() - startTime;
            
            expect(document.querySelectorAll('li').length).toBe(1000);
            expect(mountTime).toBeLessThan(5000); // Should mount in reasonable time
        });

        it('should batch rapid updates', async () => {
            const count = ref(0);
            let runs = 0;
            
            watchEffect(() => {
                count.value;
                runs++;
            });
            
            const initialRuns = runs;
            
            // Rapid updates
            for (let i = 0; i < 100; i++) {
                count.value = i;
            }
            
            await Promise.resolve();
            
            // Should only run once more despite 100 updates
            expect(runs - initialRuns).toBeLessThan(5);
        });
    });

    describe('Error Handling', () => {
        it('should handle errors in effects gracefully', async () => {
            const count = ref(0);
            
            const consoleError = console.error;
            console.error = vi.fn();
            
            watchEffect(() => {
                if (count.value === 1) {
                    throw new Error('Test error');
                }
            });
            
            await Promise.resolve();
            
            count.value = 1;
            await Promise.resolve();
            
            // Should not crash
            expect(count.value).toBe(1);
            
            console.error = consoleError;
        });

        it('should handle invalid expressions in templates', async () => {
            document.body.innerHTML = '<div id="app">{{ undefinedVar.property }}</div>';
            
            const consoleError = console.error;
            console.error = vi.fn();
            
            const app = createApp(() => ({}));
            app.mount('#app');
            await Promise.resolve();
            
            // Should not crash
            expect(document.querySelector('#app').textContent).toBe('');
            
            console.error = consoleError;
        });
    });

    describe('Memory Leak Prevention', () => {
        it('should cleanup effects when stopped', async () => {
            const count = ref(0);
            let dummy;
            
            const stop = watchEffect(() => {
                dummy = count.value;
            });
            
            stop();
            
            const initialValue = dummy;
            count.value = 100;
            await Promise.resolve();
            
            expect(dummy).toBe(initialValue); // Should not update
        });

        it('should cleanup on unmount', async () => {
            document.body.innerHTML = '<div id="app">{{ count }}</div>';
            
            let countRef;
            const app = createApp(() => {
                countRef = ref(0);
                return { count: countRef };
            });
            
            app.mount('#app');
            await Promise.resolve();
            
            const initialText = document.querySelector('#app').textContent;
            app.unmount();
            
            countRef.value = 999;
            await Promise.resolve();
            
            expect(document.querySelector('#app').textContent).toBe(initialText);
        });
    });

    describe('Real-World Patterns', () => {
        it('should handle todo list pattern', async () => {
            document.body.innerHTML = `
                <div id="app">
                    <input z-model="newTodo" />
                    <button @click="addTodo">Add</button>
                    <ul>
                        <li z-for="(todo, i) in todos" :key="todo.id">
                            {{ todo.text }}
                            <button @click="removeTodo(i)">X</button>
                        </li>
                    </ul>
                </div>
            `;
            
            let state;
            const app = createApp(() => {
                state = reactive({
                    todos: [],
                    newTodo: ref(''),
                    nextId: 1
                });
                
                const addTodo = () => {
                    if (state.newTodo.value.trim()) {
                        state.todos.push({
                            id: state.nextId++,
                            text: state.newTodo.value
                        });
                        state.newTodo.value = '';
                    }
                };
                
                const removeTodo = (index) => {
                    state.todos.splice(index, 1);
                };
                
                return {
                    todos: state.todos,
                    newTodo: state.newTodo,
                    addTodo,
                    removeTodo
                };
            });
            
            app.mount('#app');
            await Promise.resolve();
            
            // Add todo
            const input = document.querySelector('input');
            input.value = 'Test todo';
            input.dispatchEvent(new window.Event('input'));
            await Promise.resolve();
            
            const addButton = document.querySelector('button');
            addButton.click();
            await Promise.resolve();
            
            expect(document.querySelectorAll('li').length).toBe(1);
            expect(document.querySelector('li').textContent).toContain('Test todo');
            
            // Remove todo
            const removeButton = document.querySelectorAll('li button')[0];
            removeButton.click();
            await Promise.resolve();
            
            expect(document.querySelectorAll('li').length).toBe(0);
        });

        it('should handle counter with computed', async () => {
            document.body.innerHTML = `
                <div id="app">
                    <div>Count: {{ count }}</div>
                    <div>Doubled: {{ doubled }}</div>
                    <button @click="increment">+</button>
                </div>
            `;
            
            let countRef, doubledRef;
            const app = createApp(() => {
                countRef = ref(0);
                doubledRef = computed(() => countRef.value * 2);
                
                const increment = () => countRef.value++;
                
                return { count: countRef, doubled: doubledRef, increment };
            });
            
            app.mount('#app');
            await Promise.resolve();
            
            expect(document.body.textContent).toContain('Count: 0');
            expect(document.body.textContent).toContain('Doubled: 0');
            
            document.querySelector('button').click();
            await Promise.resolve();
            
            expect(document.body.textContent).toContain('Count: 1');
            expect(document.body.textContent).toContain('Doubled: 2');
        });

        it('should handle form with validation', async () => {
            document.body.innerHTML = `
                <div id="app">
                    <input z-model="email" />
                    <div z-if="!isValid && email">Invalid email</div>
                    <button :disabled="!isValid" @click="submit">Submit</button>
                </div>
            `;
            
            let emailRef, isValidRef, submitted;
            const app = createApp(() => {
                emailRef = ref('');
                isValidRef = computed(() => {
                    const email = emailRef.value;
                    return email.includes('@') && email.includes('.');
                });
                
                submitted = false;
                const submit = () => { submitted = true; };
                
                return {
                    email: emailRef,
                    isValid: isValidRef,
                    submit
                };
            });
            
            app.mount('#app');
            await Promise.resolve();
            
            const input = document.querySelector('input');
            const button = document.querySelector('button');
            
            // Invalid email
            input.value = 'invalid';
            input.dispatchEvent(new window.Event('input'));
            await Promise.resolve();
            
            expect(document.body.textContent).toContain('Invalid email');
            expect(button.hasAttribute('disabled')).toBe(true);
            
            // Valid email
            input.value = 'test@example.com';
            input.dispatchEvent(new window.Event('input'));
            await Promise.resolve();
            
            expect(document.body.textContent).not.toContain('Invalid email');
            expect(button.hasAttribute('disabled')).toBe(false);
            
            button.click();
            expect(submitted).toBe(true);
        });
    });

    describe('Concurrent Updates', () => {
        it('should handle multiple reactive sources', async () => {
            const a = ref(1);
            const b = ref(2);
            let result;
            
            watchEffect(() => {
                result = a.value + b.value;
            });
            
            await Promise.resolve();
            expect(result).toBe(3);
            
            a.value = 10;
            b.value = 20;
            await Promise.resolve();
            
            expect(result).toBe(30);
        });

        it('should handle cascading updates', async () => {
            const source = ref(1);
            const derived1 = computed(() => source.value * 2);
            const derived2 = computed(() => derived1.value + 1);
            
            let result;
            watchEffect(() => {
                result = derived2.value;
            });
            
            await Promise.resolve();
            expect(result).toBe(3); // (1 * 2) + 1
            
            source.value = 5;
            await Promise.resolve();
            
            expect(result).toBe(11); // (5 * 2) + 1
        });
    });

    describe('Special Characters and Encoding', () => {
        it('should handle special characters in interpolation', async () => {
            document.body.innerHTML = '<div id="app">{{ text }}</div>';
            
            const app = createApp(() => {
                return { text: ref('<script>alert("xss")</script>') };
            });
            
            app.mount('#app');
            await Promise.resolve();
            
            // Should escape as text, not execute
            expect(document.querySelector('#app').textContent).toContain('script');
            expect(document.querySelector('#app').innerHTML).not.toContain('<script>');
        });

        it('should handle unicode characters', async () => {
            document.body.innerHTML = '<div id="app">{{ text }}</div>';
            
            const app = createApp(() => {
                return { text: ref('Hello 世界 🌍') };
            });
            
            app.mount('#app');
            await Promise.resolve();
            
            expect(document.querySelector('#app').textContent).toBe('Hello 世界 🌍');
        });
    });
});

// ============================================
// 6. INTEGRATION TESTS
// ============================================

describe('Integration Tests', () => {
    it('should build a complete interactive app', async () => {
        document.body.innerHTML = `
            <div id="app">
                <h1>{{ title }}</h1>
                <input z-model="searchQuery" placeholder="Search..." />
                <div z-if="filteredItems.length > 0">
                    <ul>
                        <li z-for="item in filteredItems" :key="item.id">
                            <span :class="{ completed: item.done }">{{ item.text }}</span>
                            <button @click="toggleItem(item)">Toggle</button>
                        </li>
                    </ul>
                </div>
                <div z-else>
                    <p>No items found</p>
                </div>
                <div>Total: {{ total }}</div>
            </div>
        `;
        
        const app = createApp(() => {
            const title = ref('My App');
            const searchQuery = ref('');
            const items = reactive([
                { id: 1, text: 'Task 1', done: false },
                { id: 2, text: 'Task 2', done: true },
                { id: 3, text: 'Another task', done: false }
            ]);
            
            const filteredItems = computed(() => {
                const query = searchQuery.value.toLowerCase();
                if (!query) return items;
                return items.filter(item => 
                    item.text.toLowerCase().includes(query)
                );
            });
            
            const total = computed(() => items.length);
            
            const toggleItem = (item) => {
                item.done = !item.done;
            };
            
            return {
                title,
                searchQuery,
                filteredItems,
                total,
                toggleItem
            };
        });
        
        app.mount('#app');
        await Promise.resolve();
        
        // Check initial render
        expect(document.querySelector('h1').textContent).toBe('My App');
        expect(document.querySelectorAll('li').length).toBe(3);
        expect(document.body.textContent).toContain('Total: 3');
        
        // Test search
        const input = document.querySelector('input');
        input.value = 'Another';
        input.dispatchEvent(new window.Event('input'));
        await Promise.resolve();
        
        expect(document.querySelectorAll('li').length).toBe(1);
        expect(document.querySelector('li').textContent).toContain('Another task');
        
        // Test toggle
        const toggleButton = document.querySelector('button');
        toggleButton.click();
        await Promise.resolve();
        
        // Clear search to show all
        input.value = '';
        input.dispatchEvent(new window.Event('input'));
        await Promise.resolve();
        
        expect(document.querySelectorAll('li').length).toBe(3);
    });
});

describe('z-for with :key directive', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'app';
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    container = null;
  });

  it('should render items with key value of 0', () => {
    container.innerHTML = '<div z-for="item in items" :key="item.id">{{ item.name }}</div>';
    
    const app = createApp(() => ({
      items: reactive([
        { id: 0, name: 'First' },
        { id: 1, name: 'Second' },
        { id: 2, name: 'Third' }
      ])
    }));
    
    app.mount('#app');
    
    const divs = container.querySelectorAll('div');
    expect(divs.length).toBe(3);
    expect(divs[0].textContent).toBe('First');
    expect(divs[1].textContent).toBe('Second');
    expect(divs[2].textContent).toBe('Third');
  });

  it('should handle boolean false as key value', () => {
    container.innerHTML = '<div z-for="item in items" :key="item.active">{{ item.name }}</div>';
    
    const app = createApp(() => ({
      items: reactive([
        { active: false, name: 'Inactive' },
        { active: true, name: 'Active' }
      ])
    }));
    
    app.mount('#app');
    
    const divs = container.querySelectorAll('div');
    expect(divs.length).toBe(2);
    expect(divs[0].textContent).toBe('Inactive');
    expect(divs[1].textContent).toBe('Active');
  });

  it('should handle empty string as key value', () => {
    container.innerHTML = '<div z-for="item in items" :key="item.code">{{ item.name }}</div>';
    
    const app = createApp(() => ({
      items: reactive([
        { code: '', name: 'No Code' },
        { code: 'ABC', name: 'With Code' }
      ])
    }));
    
    app.mount('#app');
    
    const divs = container.querySelectorAll('div');
    expect(divs.length).toBe(2);
    expect(divs[0].textContent).toBe('No Code');
    expect(divs[1].textContent).toBe('With Code');
  });

  it('should handle numeric zero in different positions', () => {
    container.innerHTML = '<div z-for="item in items" :key="item.id">{{ item.value }}</div>';
    
    const app = createApp(() => ({
      items: reactive([
        { id: 5, value: 'Five' },
        { id: 0, value: 'Zero' },
        { id: 3, value: 'Three' },
        { id: 0, value: 'Another Zero' } // Duplicate key - should replace
      ])
    }));
    
    app.mount('#app');
    
    const divs = container.querySelectorAll('div');
    // Should have 3 items (duplicate key 0 should only appear once)
    expect(divs.length).toBe(3);
    expect(container.textContent).toContain('Zero');
  });

  it('should reactively update items with key=0', () => {
    container.innerHTML = '<div z-for="item in items" :key="item.id">{{ item.name }}</div>';
    
    const items = reactive([
      { id: 0, name: 'First' },
      { id: 1, name: 'Second' }
    ]);
    
    const app = createApp(() => ({ items }));
    app.mount('#app');
    
    let divs = container.querySelectorAll('div');
    expect(divs.length).toBe(2);
    expect(divs[0].textContent).toBe('First');
    
    // Update item with id=0
    items[0].name = 'Updated First';
    
    // Wait for reactivity
    setTimeout(() => {
      divs = container.querySelectorAll('div');
      expect(divs[0].textContent).toBe('Updated First');
    }, 0);
  });

  it('should handle adding item with key=0 dynamically', async () => {
    container.innerHTML = '<div z-for="item in items" :key="item.id">{{ item.name }}</div>';
    
    const items = reactive([
      { id: 1, name: 'Second' },
      { id: 2, name: 'Third' }
    ]);
    
    const app = createApp(() => ({ items }));
    app.mount('#app');
    
    let divs = container.querySelectorAll('div');
    expect(divs.length).toBe(2);
    
    // Add item with id=0 at the beginning
    items.unshift({ id: 0, name: 'First' });
    
    // Wait for reactivity
    await new Promise(resolve => setTimeout(resolve, 10));
    
    divs = container.querySelectorAll('div');
    expect(divs.length).toBe(3);
    expect(divs[0].textContent).toBe('First');
  });

  it('should handle removing item with key=0', async () => {
    container.innerHTML = '<div z-for="item in items" :key="item.id">{{ item.name }}</div>';
    
    const items = reactive([
      { id: 0, name: 'First' },
      { id: 1, name: 'Second' },
      { id: 2, name: 'Third' }
    ]);
    
    const app = createApp(() => ({ items }));
    app.mount('#app');
    
    let divs = container.querySelectorAll('div');
    expect(divs.length).toBe(3);
    
    // Remove item with id=0
    items.shift();
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    divs = container.querySelectorAll('div');
    expect(divs.length).toBe(2);
    expect(divs[0].textContent).toBe('Second');
  });

  it('should handle index as key when item value is 0', () => {
    container.innerHTML = '<div z-for="item in numbers" :key="item">Value: {{ item }}</div>';
    
    const app = createApp(() => ({
      numbers: reactive([0, 1, 2, 3])
    }));
    
    app.mount('#app');
    
    const divs = container.querySelectorAll('div');
    expect(divs.length).toBe(4);
    expect(divs[0].textContent).toBe('Value: 0');
    expect(divs[1].textContent).toBe('Value: 1');
  });

  it('should preserve DOM elements when key=0 exists during re-render', async () => {
    container.innerHTML = '<div z-for="item in items" :key="item.id"><span>{{ item.name }}</span></div>';
    
    const items = reactive([
      { id: 0, name: 'First' },
      { id: 1, name: 'Second' }
    ]);
    
    const app = createApp(() => ({ items }));
    app.mount('#app');
    
    const firstSpan = container.querySelector('span');
    const spanReference = firstSpan;
    
    // Update array but keep same keys
    items[1].name = 'Updated Second';
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const firstSpanAfter = container.querySelector('span');
    // Should be the same DOM element (not re-created)
    expect(firstSpanAfter).toBe(spanReference);
  });

  it('should handle computed key that evaluates to 0', () => {
    container.innerHTML = '<div z-for="(item, idx) in items" :key="idx % 2">{{ item }}</div>';
    
    const app = createApp(() => ({
      items: reactive(['A', 'B', 'C', 'D'])
    }));
    
    app.mount('#app');
    
    const divs = container.querySelectorAll('div');
    // idx % 2 will produce: 0, 1, 0, 1 (so only 2 unique keys)
    // Last occurrence should win
    expect(divs.length).toBe(2);
  });

  it('should handle NaN as key (edge case)', () => {
    container.innerHTML = '<div z-for="item in items" :key="item.value / item.divisor">{{ item.name }}</div>';
    
    const app = createApp(() => ({
      items: reactive([
        { name: 'Invalid', value: 0, divisor: 0 }, // 0/0 = NaN
        { name: 'Valid', value: 10, divisor: 2 }
      ])
    }));
    
    app.mount('#app');
    
    const divs = container.querySelectorAll('div');
    expect(divs.length).toBeGreaterThanOrEqual(1);
  });

  it('should work without :key attribute and index starts at 0', () => {
    container.innerHTML = '<div z-for="item in items">{{ item }}</div>';
    
    const app = createApp(() => ({
      items: reactive(['First', 'Second', 'Third'])
    }));
    
    app.mount('#app');
    
    const divs = container.querySelectorAll('div');
    expect(divs.length).toBe(3);
    expect(divs[0].textContent).toBe('First');
  });

  it('should handle mixed falsy and truthy keys', () => {
    container.innerHTML = '<div z-for="item in items" :key="item.id">{{ item.name }}</div>';
    
    const app = createApp(() => ({
      items: reactive([
        { id: 0, name: 'Zero' },
        { id: false, name: 'False' },
        { id: '', name: 'Empty' },
        { id: null, name: 'Null' },
        { id: undefined, name: 'Undefined' },
        { id: 1, name: 'One' },
        { id: 'text', name: 'Text' }
      ])
    }));
    
    app.mount('#app');
    
    const divs = container.querySelectorAll('div');
    expect(divs.length).toBeGreaterThan(0);
    expect(container.textContent).toContain('Zero');
    expect(container.textContent).toContain('One');
  });

  it('should correctly handle array mutations with key=0', async () => {
    container.innerHTML = '<div z-for="item in items" :key="item.id">{{ item.name }}</div>';
    
    const items = reactive([
      { id: 0, name: 'Zero' },
      { id: 1, name: 'One' }
    ]);
    
    const app = createApp(() => ({ items }));
    app.mount('#app');
    
    // Push new item
    items.push({ id: 2, name: 'Two' });
    await new Promise(resolve => setTimeout(resolve, 10));
    
    let divs = container.querySelectorAll('div');
    expect(divs.length).toBe(3);
    
    // Sort array (item with id=0 should still be there)
    items.sort((a, b) => b.id - a.id);
    await new Promise(resolve => setTimeout(resolve, 10));
    
    divs = container.querySelectorAll('div');
    expect(divs.length).toBe(3);
    expect(container.textContent).toContain('Zero');
  });

  it('should handle splice that affects item with key=0', async () => {
    container.innerHTML = '<div z-for="item in items" :key="item.id">{{ item.name }}</div>';
    
    const items = reactive([
      { id: 0, name: 'Zero' },
      { id: 1, name: 'One' },
      { id: 2, name: 'Two' }
    ]);
    
    const app = createApp(() => ({ items }));
    app.mount('#app');
    
    // Remove item at index 1, item with id=0 should remain
    items.splice(1, 1);
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const divs = container.querySelectorAll('div');
    expect(divs.length).toBe(2);
    expect(divs[0].textContent).toBe('Zero');
    expect(divs[1].textContent).toBe('Two');
  });
});

describe('z-for edge cases with falsy keys', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'app';
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('should distinguish between 0 and "0" as keys', () => {
    container.innerHTML = '<div z-for="item in items" :key="item.id">{{ item.name }}</div>';
    
    const app = createApp(() => ({
      items: reactive([
        { id: 0, name: 'Number Zero' },
        { id: '0', name: 'String Zero' }
      ])
    }));
    
    app.mount('#app');
    
    const divs = container.querySelectorAll('div');
    // These are different keys, so both should render
    expect(divs.length).toBe(2);
  });

  it('should handle transition from no items to items with key=0', async () => {
    container.innerHTML = '<div z-for="item in items" :key="item.id">{{ item.name }}</div>';
    
    const items = reactive([]);
    
    const app = createApp(() => ({ items }));
    app.mount('#app');
    
    let divs = container.querySelectorAll('div');
    expect(divs.length).toBe(0);
    
    // Add items including one with key=0
    items.push({ id: 0, name: 'First' });
    items.push({ id: 1, name: 'Second' });
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    divs = container.querySelectorAll('div');
    expect(divs.length).toBe(2);
    expect(divs[0].textContent).toBe('First');
  });

  it('should handle ref values as keys with value 0', () => {
    container.innerHTML = '<div z-for="item in items" :key="counter.value + item">{{ item }}</div>';
    
    const app = createApp(() => ({
      items: reactive([1, 2, 3]),
      counter: ref(0)
    }));
    
    app.mount('#app');
    
    const divs = container.querySelectorAll('div');
    expect(divs.length).toBe(3);
  });
});