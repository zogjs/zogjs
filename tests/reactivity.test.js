import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref, reactive, computed, watchEffect, nextTick, createApp } from '../src/zog.js';

describe('Reactivity System', () => {
    describe('ref()', () => {
        it('should create a ref with primitive value', () => {
            const count = ref(0);
            expect(count.value).toBe(0);
            expect(count._isRef).toBe(true);
        });

        it('should be reactive when value changes',async () => {
            const count = ref(0);
            let dummy;
            watchEffect(() => {
                dummy = count.value;
            });
            expect(dummy).toBe(0);
            count.value = 1;
            await nextTick();
            expect(dummy).toBe(1);
        });

        it('should throw error when passed an object', () => {
            expect(() => ref({ name: 'test' })).toThrow();
        });

        it('should throw error when passed an array', () => {
            expect(() => ref([1, 2, 3])).toThrow();
        });

        it('should throw error when setting value to object', () => {
            const count = ref(0);
            expect(() => { count.value = { x: 1 }; }).toThrow();
        });

        it('should throw error when setting value to array', () => {
            const count = ref(0);
            expect(() => { count.value = [1, 2]; }).toThrow();
        });

        it('should work with string values', () => {
            const name = ref('Ali');
            expect(name.value).toBe('Ali');
            name.value = 'Hassan';
            expect(name.value).toBe('Hassan');
        });

        it('should work with boolean values', () => {
            const flag = ref(true);
            expect(flag.value).toBe(true);
            flag.value = false;
            expect(flag.value).toBe(false);
        });

        it('should work with null and undefined', () => {
            const nullRef = ref(null);
            const undefinedRef = ref(undefined);
            expect(nullRef.value).toBe(null);
            expect(undefinedRef.value).toBe(undefined);
        });

        it('should have toString method', () => {
            const count = ref(42);
            expect(count.toString()).toBe('42');
        });

        it('should not trigger when value is same', () => {
            const count = ref(0);
            let callCount = 0;
            watchEffect(() => {
                count.value;
                callCount++;
            });
            expect(callCount).toBe(1);
            count.value = 0;
            expect(callCount).toBe(1); // should not trigger
        });
    });

    describe('reactive()', () => {
        it('should create a reactive object', () => {
            const obj = reactive({ count: 0 });
            expect(obj.count).toBe(0);
        });

        it('should be reactive for object properties', async () => {
            const obj = reactive({ count: 0 });
            let dummy;
            watchEffect(() => {
                dummy = obj.count;
            });
            expect(dummy).toBe(0);
            obj.count = 1;
            await nextTick();
            expect(dummy).toBe(1);
        });

        it('should work with nested objects', async () => {
            const obj = reactive({
                nested: { count: 0 }
            });
            let dummy;
            watchEffect(() => {
                dummy = obj.nested.count;
            });
            expect(dummy).toBe(0);
            obj.nested.count = 1;
            await nextTick();
            expect(dummy).toBe(1);
        });

        it('should work with arrays', () => {
            const arr = reactive([1, 2, 3]);
            expect(arr[0]).toBe(1);
            expect(arr.length).toBe(3);
        });

        it('should be reactive for array mutations', async () => {
            const arr = reactive([1, 2, 3]);
            let dummy;
            watchEffect(() => {
                dummy = arr.length;
            });
            expect(dummy).toBe(3);
            arr.push(4);
            await nextTick();
            expect(dummy).toBe(4);
        });

        it('should track array push', async () => {
            const arr = reactive([]);
            let dummy;
            watchEffect(() => {
                dummy = arr.length;
            });
            expect(dummy).toBe(0);
            arr.push(1);
            await nextTick();
            expect(dummy).toBe(1);
            arr.push(2, 3);
            await nextTick();
            expect(dummy).toBe(3);
        });

        it('should track array pop', async () => {
            const arr = reactive([1, 2, 3]);
            let dummy;
            watchEffect(() => {
                dummy = arr.length;
            });
            expect(dummy).toBe(3);
            arr.pop();
            await nextTick();
            expect(dummy).toBe(2);
        });

        it('should track array shift',async () => {
            const arr = reactive([1, 2, 3]);
            let dummy;
            watchEffect(() => {
                dummy = arr[0];
            });
            expect(dummy).toBe(1);
            arr.shift();
            await new Promise(resolve => setTimeout(resolve, 10)); // ✅ زمان بیشتر
            expect(dummy).toBe(2);
        });

        it('should track array unshift', async () => {
            const arr = reactive([2, 3]);
            let dummy;
            watchEffect(() => {
                dummy = arr[0];
            });
            expect(dummy).toBe(2);
            arr.unshift(1);
            await new Promise(resolve => setTimeout(resolve, 10)); // ✅ زمان بیشتر
            expect(dummy).toBe(1);
        });

        it('should track array splice',async () => {
            const arr = reactive([1, 2, 3, 4]);
            let dummy;
            watchEffect(() => {
                dummy = arr.length;
            });
            expect(dummy).toBe(4);
            arr.splice(1, 2);
            await nextTick();
            expect(dummy).toBe(2);
        });

        it('should return same proxy for same object', () => {
            const original = { count: 0 };
            const proxy1 = reactive(original);
            const proxy2 = reactive(original);
            expect(proxy1).toBe(proxy2);
        });

        it('should not wrap already reactive object', () => {
            const obj = reactive({ count: 0 });
            const wrapped = reactive(obj);
            expect(wrapped).toBe(obj);
        });

        it('should track property deletion',async () => {
            const obj = reactive({ count: 0, name: 'test' });
            let dummy;
            watchEffect(() => {
                dummy = obj.name;
            });
            expect(dummy).toBe('test');
            delete obj.name;
            await nextTick();
            expect(dummy).toBe(undefined);
        });

        it('should track has operation',async () => {
            const obj = reactive({ count: 0 });
            let dummy;
            watchEffect(() => {
                dummy = 'count' in obj;
            });
            expect(dummy).toBe(true);
            delete obj.count;
            await nextTick();
            expect(dummy).toBe(false);
        });

        it('should handle array includes', () => {
            const arr = reactive([1, 2, 3]);
            expect(arr.includes(2)).toBe(true);
            expect(arr.includes(4)).toBe(false);
        });

        it('should handle array indexOf', () => {
            const arr = reactive([1, 2, 3]);
            expect(arr.indexOf(2)).toBe(1);
            expect(arr.indexOf(4)).toBe(-1);
        });

        it('should handle array find', () => {
            const arr = reactive([1, 2, 3]);
            const result = arr.find(x => x > 1);
            expect(result).toBe(2);
        });

        it('should handle array filter', () => {
            const arr = reactive([1, 2, 3, 4]);
            const result = arr.filter(x => x > 2);
            expect(result).toEqual([3, 4]);
        });

        it('should handle array map', () => {
            const arr = reactive([1, 2, 3]);
            const result = arr.map(x => x * 2);
            expect(result).toEqual([2, 4, 6]);
        });

        it('should track array sort',async () => {
            const arr = reactive([3, 1, 2]);
            let dummy;
            watchEffect(() => {
                dummy = arr[0];
            });
            expect(dummy).toBe(3);
            arr.sort();
            await nextTick();
            expect(dummy).toBe(1);
        });

        it('should track array reverse', async () => {
            const arr = reactive([1, 2, 3]);
            let dummy;
            watchEffect(() => {
                dummy = arr[0];
            });
            expect(dummy).toBe(1);
            arr.reverse();
            await nextTick();
            expect(dummy).toBe(3);
        });
    });

    describe('computed()', () => {
        it('should create a computed ref', () => {
            const count = ref(1);
            const double = computed(() => count.value * 2);
            expect(double.value).toBe(2);
            expect(double._isRef).toBe(true);
        });

        it('should be reactive', () => {
            const count = ref(1);
            const double = computed(() => count.value * 2);
            expect(double.value).toBe(2);
            count.value = 2;
            expect(double.value).toBe(4);
        });

        it('should compute lazily', () => {
            const count = ref(1);
            let callCount = 0;
            const double = computed(() => {
                callCount++;
                return count.value * 2;
            });
            expect(callCount).toBe(0); // not called yet
            double.value;
            expect(callCount).toBe(1);
            double.value;
            expect(callCount).toBe(1); // should not recompute
            count.value = 2;
            double.value;
            expect(callCount).toBe(2); // recompute after change
        });

        it('should work with multiple dependencies', () => {
            const a = ref(1);
            const b = ref(2);
            const sum = computed(() => a.value + b.value);
            expect(sum.value).toBe(3);
            a.value = 2;
            expect(sum.value).toBe(4);
            b.value = 3;
            expect(sum.value).toBe(5);
        });

        it('should work with reactive objects', () => {
            const obj = reactive({ count: 1 });
            const double = computed(() => obj.count * 2);
            expect(double.value).toBe(2);
            obj.count = 2;
            expect(double.value).toBe(4);
        });
    });

    describe('watchEffect()', () => {
        it('should run immediately', () => {
            let dummy;
            watchEffect(() => {
                dummy = 'hello';
            });
            expect(dummy).toBe('hello');
        });

        it('should track ref changes', async () => {
            const count = ref(0);
            let dummy;
            watchEffect(() => {
                dummy = count.value;
            });
            expect(dummy).toBe(0);
            count.value = 1;
            await nextTick()
            expect(dummy).toBe(1);
        });

        it('should track reactive object changes',async () => {
            const obj = reactive({ count: 0 });
            let dummy;
            watchEffect(() => {
                dummy = obj.count;
            });
            expect(dummy).toBe(0);
            obj.count = 1;
            await nextTick()
            expect(dummy).toBe(1);
        });

        it('should return stop function',async () => {
            const count = ref(0);
            let dummy;
            const stop = watchEffect(() => {
                dummy = count.value;
            });
            expect(dummy).toBe(0);
            count.value = 1;
            await nextTick()
            expect(dummy).toBe(1);
            stop();
            await nextTick()
            count.value = 2;
            await nextTick()
            expect(dummy).toBe(1); // should not update after stop
        });

        it('should track multiple dependencies', async () => {
            const a = ref(1);
            const b = ref(2);
            let dummy;
            watchEffect(() => {
                dummy = a.value + b.value;
            });
            expect(dummy).toBe(3);
            a.value = 2;
            await nextTick()
            expect(dummy).toBe(4);
            b.value = 3;
            await nextTick()
            expect(dummy).toBe(5);
        });

        it('should handle errors gracefully',async () => {
            const count = ref(0);
            const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
            watchEffect(() => {
                if (count.value > 0) throw new Error('test error');
            });
            count.value = 1;
            await nextTick()
            expect(spy).toHaveBeenCalled();
            spy.mockRestore();
        });
    });

    describe('Effect Scheduling', () => {
        it('should batch multiple changes', async () => {
            const count = ref(0);
            let callCount = 0;
            watchEffect(() => {
                count.value;
                callCount++;
            });
            expect(callCount).toBe(1);
            count.value = 1;
            count.value = 2;
            count.value = 3;
            // Effects are queued, so should only run once more
            await new Promise(resolve => setTimeout(resolve, 0));
            expect(callCount).toBe(2);
        });

        it('should avoid infinite loops', () => {
            const count = ref(0);
            let callCount = 0;
            watchEffect(() => {
                callCount++;
                if (callCount < 10) {
                    count.value++;
                }
            });
            expect(callCount).toBeLessThan(20);
        });
    });

    describe('Edge Cases', () => {
        it('should handle circular references', () => {
            const obj = reactive({ value: 1 });
            obj.self = obj;
            expect(obj.self.value).toBe(1);
            obj.self.value = 2;
            expect(obj.value).toBe(2);
        });

        it('should handle Symbol keys', () => {
            const sym = Symbol('test');
            const obj = reactive({ [sym]: 'value' });
            expect(obj[sym]).toBe('value');
        });

        it('should not track non-reactive changes', () => {
            const obj = { count: 0 };
            let dummy;
            watchEffect(() => {
                dummy = obj.count;
            });
            expect(dummy).toBe(0);
            obj.count = 1;
            expect(dummy).toBe(0); // should not update
        });

        it('should handle undefined and null properly', () => {
            const obj = reactive({ a: undefined, b: null });
            expect(obj.a).toBe(undefined);
            expect(obj.b).toBe(null);
        });

        it('should work with Object.is for NaN', () => {
            const count = ref(NaN);
            let callCount = 0;
            watchEffect(() => {
                count.value;
                callCount++;
            });
            expect(callCount).toBe(1);
            count.value = NaN;
            expect(callCount).toBe(1); // NaN === NaN with Object.is
        });
    });
});


describe('z-model with Radio Buttons', () => {
    it('should bind radio button value correctly', async () => {
        document.body.innerHTML = `
           <div id="app"> <input type="radio" name="color" value="red" z-model="selected">
            <input type="radio" name="color" value="green" z-model="selected">
            <input type="radio" name="color" value="blue" z-model="selected">
            <span class="result">{{ selected }}</span></div>
        `;

        let selected;
        const app = createApp(() => {
            selected = ref('green');
            return { selected };
        });
        app.mount('#app');

        const radios = document.querySelectorAll('input[type="radio"]');
        const result = document.querySelector('.result');

        // Initial state: green should be checked
        expect(radios[0].checked).toBe(false);
        expect(radios[1].checked).toBe(true);
        expect(radios[2].checked).toBe(false);
        expect(result.textContent).toBe('green');

        // Click red radio
        radios[0].click();
        radios[0].dispatchEvent(new Event('change'));
        await nextTick();

        expect(selected.value).toBe('red');
        expect(radios[0].checked).toBe(true);
        expect(result.textContent).toBe('red');

        // Click blue radio
        radios[2].click();
        radios[2].dispatchEvent(new Event('change'));
        await nextTick();

        expect(selected.value).toBe('blue');
        expect(radios[2].checked).toBe(true);
        expect(result.textContent).toBe('blue');
    });

    it('should update radio when ref changes programmatically', async () => {
        document.body.innerHTML = `
            <div id="app">
                <input type="radio" name="size" value="sm" z-model="size">
                <input type="radio" name="size" value="md" z-model="size">
                <input type="radio" name="size" value="lg" z-model="size">
            </div>
        `;

        let size;
        const app = createApp(() => {
            size = ref('sm');
            return { size };
        });
        app.mount('#app');

        const radios = document.querySelectorAll('input[type="radio"]');

        expect(radios[0].checked).toBe(true);

        // Change ref programmatically
        size.value = 'lg';
        await nextTick();

        expect(radios[0].checked).toBe(false);
        expect(radios[1].checked).toBe(false);
        expect(radios[2].checked).toBe(true);
    });
});