# Zog.js

**Full reactivity with minimal code size.**

Zog.js is a minimalist JavaScript library for building reactive user interfaces. It allows you to write clean, declarative templates directly in your HTML and power them with a simple, yet powerful, reactivity system. Inspired by the best parts of modern frameworks, Zog.js offers an intuitive developer experience with zero dependencies and no build step required.

---

## Highlights

* **Reactive primitives**: `ref` (primitives only), `reactive` (objects/arrays), `computed`
* **Effects**: `watchEffect` with automatic dependency tracking
* **Lightweight template compiler** for declarative DOM binding and interpolation (`{{ }}`)
* **Template directives**: `z-if`, `z-for`, `z-text`, `z-html`, `z-show`, `z-model`, `z-on` (shorthand `@`)
* **App lifecycle**: `createApp(...).mount(selector)` and `.unmount()`
* **Hook System**: Extend and customize behavior with lifecycle hooks
* **Plugin architecture**: `app.use(plugin, options)` for modular extensions
* **Async effect queue**: Batched updates with effect sorting for optimal performance

---

## Installation

### Via npm

```bash
npm install zogjs
```

### Direct ES Module

```html
<script type="module">
  import { createApp, ref } from './zog.js';
  // or from CDN
  import { createApp, ref } from 'https://cdn.example.com/zog.js';
</script>
```

---

## Quick Start

### Basic Counter Example

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <title>Zog.js Counter</title>
</head>
<body>
    <div id="app">
        <h1>{{ title }}</h1>
        <p>Current count: {{ count }}</p>
        <button @click="increment">Increment</button>
        <button @click="decrement">Decrement</button>
    </div>

    <script type="module">
        import { createApp, ref } from './zog.js';

        createApp(() => {
            const title = ref('Counter App');
            const count = ref(0);

            const increment = () => count.value++;
            const decrement = () => count.value--;

            return { title, count, increment, decrement };
        }).mount('#app');
    </script>
</body>
</html>
```

---

## Core Concepts

### Reactivity Primitives

#### `ref(primitive)` — For primitive values only

Creates a reactive reference for **strings, numbers, and booleans only**.

```js
const count = ref(0);
count.value++; // Triggers reactive updates

// In templates, .value is automatically unwrapped:
// {{ count }} instead of {{ count.value }}
```

**⚠️ Important (v0.4.7):** `ref()` throws an error if passed an object or array. Use `reactive()` instead.

```js
// ❌ WRONG - throws error
const user = ref({ name: 'John' });

// ✅ CORRECT
const user = reactive({ name: 'John' });
```

#### `reactive(object)` — For objects and arrays

Returns a deep reactive proxy of an object or array.

```js
const state = reactive({
    user: { name: 'John', age: 30 },
    todos: ['Learn Zog.js']
});

// All nested properties are reactive
state.user.age = 31;
state.todos.push('Build an app');
```

**Array reactivity**: All array methods are fully reactive:
- **Mutators**: `push`, `pop`, `shift`, `unshift`, `splice`, `sort`, `reverse`, `fill`, `copyWithin`
- **Iterators**: `map`, `filter`, `find`, `findIndex`, `findLast`, `findLastIndex`, `every`, `some`, `forEach`, `reduce`, `reduceRight`, `flat`, `flatMap`, `values`, `entries`, `keys`, `includes`, `indexOf`, `lastIndexOf`

#### `computed(getter)`

Creates a lazily evaluated, memoized reactive value.

```js
const firstName = ref('John');
const lastName = ref('Doe');

const fullName = computed(() => `${firstName.value} ${lastName.value}`);

console.log(fullName.value); // "John Doe"
firstName.value = 'Jane';
console.log(fullName.value); // "Jane Doe"
```

#### `watchEffect(fn, opts?)`

Runs a reactive effect immediately and re-runs when dependencies change.

```js
const count = ref(0);

const stop = watchEffect(() => {
    console.log('Count is:', count.value);
});

count.value++; // Logs: "Count is: 1"
stop(); // Stop watching
```

---

### Template Interpolation

Text nodes containing `{{ expression }}` are automatically reactive:

```html
<p>Hello, {{ name }}!</p>
<p>You have {{ items.length }} items.</p>
<p>Total: {{ price * quantity }}</p>
```

---

### Template Directives

#### Conditional Rendering

**`z-if`**, **`z-else-if`**, **`z-else`**: Conditionally render elements.

```html
<div z-if="score >= 90">Excellent!</div>
<div z-else-if="score >= 70">Good job!</div>
<div z-else>Keep trying!</div>
```

#### List Rendering

**`z-for`**: Repeat elements for each item in an array.

```html
<!-- Simple iteration -->
<li z-for="item in items">{{ item }}</li>

<!-- With index -->
<li z-for="(item, index) in items">
    {{ index + 1 }}. {{ item.name }}
</li>

<!-- With key (recommended) -->
<li z-for="item in items" :key="item.id">
    {{ item.name }}
</li>
```

**z-for behavior (v0.4.7):**
- Object items are reactive (direct property access)
- Primitive items are ref-wrapped (auto-unwrapped in templates)
- Index is a plain number that updates correctly when array changes
- Always use `:key` with unique IDs for performance

#### Content Directives

```html
<p z-text="message"></p>           <!-- Safe textContent -->
<div z-html="htmlContent"></div>   <!-- innerHTML (⚠️ XSS risk) -->
<div z-show="isVisible">...</div>  <!-- Toggle display -->
```

#### Two-Way Binding

**`z-model`**: Bind form inputs bidirectionally.

```html
<input z-model="username" />
<textarea z-model="bio"></textarea>
<input type="checkbox" z-model="agreed" />
<input type="radio" z-model="color" value="red" />
<select z-model="country">
    <option value="us">United States</option>
</select>
```

#### Event Handling

**`@event`** or **`z-on:event`**: Attach event listeners.

```html
<!-- Method handler (recommended) -->
<button @click="handleClick">Click me</button>

<!-- Inline expression (need .value for refs) -->
<button @click="count.value++">Increment</button>
```

#### Attribute Binding

**`:attribute`**: Dynamically bind any attribute.

```html
<img :src="imageUrl" :alt="imageAlt" />
<button :disabled="isDisabled">Submit</button>
<div :class="{ active: isActive, error: hasError }">Content</div>
<div :style="{ color: textColor, fontSize: size + 'px' }">Text</div>
```

---

## Hook System

```js
import { onHook } from './zog.js';

// Available hooks: beforeCompile, afterCompile, onError
onHook('beforeCompile', (el, scope, cs) => {
    console.log('Compiling:', el.tagName);
});

onHook('onError', (error, context, details) => {
    console.error(`Error in ${context}:`, error);
});
```

---

## Plugin System

### Creating a Plugin

```js
// my-plugin.js
export const MyPlugin = {
    install(api, options) {
        // api contains: app, reactive, ref, computed, watchEffect,
        //               onHook, compile, Scope, evalExp
        
        api.onHook('beforeCompile', (el, scope, cs) => {
            // Custom directive example
            if (el.hasAttribute('z-focus')) {
                el.removeAttribute('z-focus');
                setTimeout(() => el.focus(), 0);
            }
        });
    }
};
```

### Using Plugins

```js
import { createApp } from './zog.js';
import { MyPlugin } from './my-plugin.js';

createApp(() => ({ /* ... */ }))
    .use(MyPlugin, { debug: true })
    .mount('#app');
```

---

## Complete Example: Todo List

```html
<div id="app">
    <input z-model="newTodo" @keyup.enter="addTodo" placeholder="Add todo" />
    <button @click="addTodo">Add</button>

    <ul>
        <li z-for="(todo, index) in todos" :key="todo.id">
            <input type="checkbox" 
                   :checked="todo.done" 
                   @change="toggleTodo(todo.id)" />
            <span :class="{ done: todo.done }">
                {{ index + 1 }}. {{ todo.text }}
            </span>
            <button @click="removeTodo(todo.id)">×</button>
        </li>
    </ul>
    
    <p z-show="todos.length === 0">No todos yet!</p>
    <p>{{ remaining }} of {{ todos.length }} remaining</p>
</div>

<script type="module">
import { createApp, ref, reactive, computed } from './zog.js';

createApp(() => {
    const newTodo = ref('');
    const todos = reactive([]);
    let nextId = 1;
    
    const remaining = computed(() => todos.filter(t => !t.done).length);

    function addTodo() {
        if (!newTodo.value.trim()) return;
        todos.push({ id: nextId++, text: newTodo.value, done: false });
        newTodo.value = '';
    }

    function removeTodo(id) {
        const idx = todos.findIndex(t => t.id === id);
        if (idx > -1) todos.splice(idx, 1);
    }

    function toggleTodo(id) {
        const todo = todos.find(t => t.id === id);
        if (todo) todo.done = !todo.done;
    }

    return { newTodo, todos, remaining, addTodo, removeTodo, toggleTodo };
}).mount('#app');
</script>
```

---

## API Reference

| Function | Description |
|----------|-------------|
| `ref(primitive)` | Reactive reference for primitives only |
| `reactive(object)` | Deep reactive proxy for objects/arrays |
| `computed(getter)` | Cached computed value |
| `watchEffect(fn, opts?)` | Auto-tracking reactive effect |
| `createApp(setup)` | Create app with `.mount()`, `.unmount()`, `.use()` |
| `nextTick(fn)` | Execute after DOM update |
| `onHook(name, fn)` | Register lifecycle hook |

## Directive Reference

| Directive | Example |
|-----------|---------|
| `{{ expr }}` | `<p>{{ message }}</p>` |
| `z-if` / `z-else-if` / `z-else` | `<div z-if="show">Text</div>` |
| `z-for` | `<li z-for="item in items" :key="item.id">` |
| `z-model` | `<input z-model="value" />` |
| `z-show` | `<div z-show="visible">` |
| `z-text` / `z-html` | `<p z-text="msg"></p>` |
| `@event` | `<button @click="handler">` |
| `:attr` | `<img :src="url" />` |
| `:class` | `<div :class="{ active: isActive }">` |
| `:style` | `<div :style="{ color: c }">` |

---

## Browser Support

Requires ES6 Proxy support:
- Chrome 49+, Firefox 18+, Safari 10+, Edge 12+
- ❌ Internet Explorer

---

## Bundle Size

- **~5KB** minified
- **Zero dependencies**
- **No build step required**

---

## Changelog

### v0.4.7 (Current)

- ✅ Added comprehensive code documentation
- ✅ Removed unused code

### v0.4.6

**Breaking Changes:**
- ⚠️ `ref()` now only accepts primitive values (string, number, boolean)
- ⚠️ Use `reactive()` for objects and arrays

**Bug Fixes:**
- 🐛 Fixed z-for index reactivity (index now updates correctly when array changes)
- 🐛 Restored effect sorting by ID for correct execution order
- 🐛 Added expression cache limit (500) to prevent memory leaks

**Improvements:**
- ✨ Plugin API now receives full access: `reactive`, `ref`, `computed`, `watchEffect`, `onHook`, `compile`, `Scope`, `evalExp`
- ✨ Cleaner separation between `ref` (primitives) and `reactive` (objects)
- ✨ Improved Scope management with parent-child relationships

### v0.3.2

- ✨ Added Hook System (`beforeCompile`, `afterCompile`, `beforeEffect`, `onError`)
- ✨ Plugin API with access to hooks and utilities
- 🚀 Optimized effect queue management

---

## Migration from v0.3.x to v0.4.x

**Breaking Change:** `ref()` no longer accepts objects/arrays.

```js
// Before (v0.3.x)
const user = ref({ name: 'John' });
user.value.name = 'Jane';

// After (v0.4.x)
const user = reactive({ name: 'John' });
user.name = 'Jane';
```

---

## License

MIT License - Free to use in commercial and non-commercial projects.

---

Made with ❤️ for simplicity.
