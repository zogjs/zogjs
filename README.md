# Zog.js

**Full reactivity with minimal code size.**

Zog.js is a minimalist JavaScript library for building reactive user interfaces. It allows you to write clean, declarative templates directly in your HTML and power them with a simple, yet powerful, reactivity system. Inspired by the best parts of modern frameworks, Zog.js offers an intuitive developer experience with zero dependencies and no build step required.

---

## Highlights

* **Reactive primitives**: `ref`, `reactive`, `computed`
* **Effects**: `watchEffect` with automatic dependency tracking
* **Lightweight template compiler** for declarative DOM binding and interpolation (`{{ }}`)
* **Template directives**: `z-if`, `z-for`, `z-text`, `z-html`, `z-show`, `z-model`, `z-on` (shorthand `@`)
* **App lifecycle**: `createApp(...).mount(selector)` and `.unmount()`
* **Powerful Hook System**: Extend and customize behavior with lifecycle hooks
* **Plugin architecture**: `app.use(plugin, options)` for modular extensions
* **Async effect queue**: Batched updates for optimal performance

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
    <!-- 1. Define your component's HTML structure -->
    <div id="app">
        <h1>{{ title }}</h1>
        <p>Current count: {{ count }}</p>
        <button @click="increment">Increment</button>
        <button @click="decrement">Decrement</button>
    </div>

    <!-- 2. Import and initialize Zog.js -->
    <script type="module">
        import { createApp, ref } from './zog.js';

        createApp(() => {
            const title = ref('Counter App');
            const count = ref(0);

            const increment = () => {
                count.value++;
            };

            const decrement = () => {
                count.value--;
            };

            // Expose state and methods to the template
            return {
                title,
                count,
                increment,
                decrement
            };
        }).mount('#app');
    </script>
</body>
</html>
```

---

## Core Concepts

### Reactivity Primitives

#### `ref(initialValue)`

Creates a reactive reference with `.value` accessor.

```js
const count = ref(0);
count.value++; // Triggers reactive updates

// In templates, .value is automatically unwrapped:
// {{ count }} instead of {{ count.value }}
```

**New in v0.4.1:** `ref()` now automatically wraps objects with `reactive()`:
```js
const user = ref({ name: 'John' });
user.value.name = 'Jane'; // Fully reactive!
```

#### `reactive(object)`

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

**Array reactivity**: All array methods (`push`, `pop`, `shift`, `unshift`, `splice`, `sort`, `reverse`, `fill`, `copyWithin`) and iterators (`map`, `filter`, `find`, `findIndex`, `findLast`, `findLastIndex`, `every`, `some`, `forEach`, `reduce`, `reduceRight`, `flat`, `flatMap`, `values`, `entries`, `keys`, `includes`, `indexOf`, `lastIndexOf`) are fully reactive.

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

// Stop watching
stop();
```

**Options:**
- `scheduler`: Custom function to control when the effect runs

---

### Template Interpolation

Text nodes containing `{{ expression }}` are automatically reactive:

```html
<p>Hello, {{ name }}!</p>
<p>You have {{ items.length }} items.</p>
<p>Total: {{ price * quantity }}</p>
```

Expressions have access to the entire scope object returned from `createApp`.

---

### Template Directives

#### Conditional Rendering

**`z-if`**, **`z-else-if`**, **`z-else`**: Conditionally render elements.

```html
<div z-if="score >= 90">
    Excellent!
</div>
<div z-else-if="score >= 70">
    Good job!
</div>
<div z-else>
    Keep trying!
</div>
```

#### List Rendering

**`z-for`**: Repeat elements for each item in an array.

```html
<!-- Simple iteration -->
<li z-for="item in items">{{ item }}</li>

<!-- With index -->
<li z-for="(item, index) in items">
    {{ index + 1 }}. {{ item }}
</li>

<!-- With destructuring -->
<div z-for="(user, i) in users">
    {{ i }}: {{ user.name }}
</div>
```

**⚡ Fixed in v0.4.1:** Index is now fully reactive! When the array changes, index values update correctly in the DOM.

**`:key` attribute**: Optimize list updates with unique keys.

```html
<li z-for="todo in todos" :key="todo.id">
    {{ todo.text }}
</li>
```

#### Content Directives

**`z-text`**: Set `textContent` (safe from XSS).

```html
<p z-text="message"></p>
```

**`z-html`**: Set `innerHTML` (⚠️ use only with trusted content).

```html
<div z-html="htmlContent"></div>
```

**`z-show`**: Toggle visibility with CSS `display`.

```html
<div z-show="isVisible">
    This element toggles visibility
</div>
```

#### Two-Way Binding

**`z-model`**: Bind form inputs bidirectionally.

```html
<!-- Text input -->
<input z-model="username" />

<!-- Textarea -->
<textarea z-model="bio"></textarea>

<!-- Checkbox -->
<input type="checkbox" z-model="agreed" />

<!-- Radio buttons -->
<input type="radio" z-model="color" value="red" />
<input type="radio" z-model="color" value="blue" />

<!-- Select -->
<select z-model="country">
    <option value="us">United States</option>
    <option value="uk">United Kingdom</option>
</select>
```

#### Event Handling

**`@event`** or **`z-on:event`**: Attach event listeners.

```html
<!-- Method from scope -->
<button @click="handleClick">Click me</button>

<!-- Inline expression -->
<button @click="count++">Increment</button>

<!-- With event object -->
<input @input="handleInput" />
<form @submit="handleSubmit">

<!-- Event modifiers via standard DOM -->
<button @click.prevent="save">Save</button>
```

In JavaScript:
```js
createApp(() => {
    const handleClick = (e) => {
        console.log('Button clicked!', e);
    };
    
    return { handleClick };
});
```

**🔧 Improved in v0.4.1:** Event handlers now properly unwrap refs in scope, preventing unexpected behavior.

#### Attribute Binding

**`:attribute`**: Dynamically bind any attribute.

```html
<!-- Simple binding -->
<img :src="imageUrl" :alt="imageAlt" />

<!-- Boolean attributes -->
<button :disabled="isDisabled">Submit</button>
<input :readonly="isReadonly" />

<!-- Dynamic ID -->
<div :id="dynamicId">Content</div>
```

#### Class Binding

**`:class`**: Bind classes dynamically (object or string).

```html
<!-- Object syntax -->
<div :class="{ active: isActive, 'text-bold': isBold }">
    Content
</div>

<!-- String syntax -->
<div :class="dynamicClass">Content</div>

<!-- Combined with static class -->
<div class="base-class" :class="{ active: isActive }">
    Content
</div>
```

#### Style Binding

**`:style`**: Bind inline styles dynamically (object).

```html
<div :style="{ color: textColor, fontSize: size + 'px' }">
    Styled content
</div>
```

```js
createApp(() => ({
    textColor: ref('blue'),
    size: ref(16)
}));
```

---

## Hook System

Zog.js provides a powerful hook system for extending and customizing behavior.

### Available Hooks

#### `beforeCompile`

Called before compiling an element. Return `false` to prevent compilation.

```js
import { addHook } from './zog.js';

addHook('beforeCompile', (el, scope, componentScope) => {
    console.log('Compiling element:', el.tagName);
    
    // Return false to stop compilation
    if (el.hasAttribute('skip-compile')) {
        return false;
    }
});
```

#### `afterCompile`

Called after an element is compiled.

```js
addHook('afterCompile', (el, scope, componentScope) => {
    console.log('Compiled:', el.tagName);
});
```

#### `beforeEffect`

Called before a reactive effect runs.

```js
addHook('beforeEffect', (effect) => {
    console.log('Effect running:', effect.id);
});
```

#### `onError`

Called when an error occurs during compilation, effect execution, or event handling.

```js
addHook('onError', (error, context, details) => {
    console.error(`Error in ${context}:`, error);
    // Send to error tracking service
    if (context === 'compile') {
        console.log('Failed element:', details.el);
    }
});
```

**🛡️ Enhanced in v0.4.1:** Error hooks now receive better context and details for debugging.

### Hook API

#### `addHook(name, fn)`

Register a hook function.

```js
import { addHook } from './zog.js';

addHook('beforeCompile', (el, scope, cs) => {
    // Your logic here
});
```

#### `removeHook(name, fn)`

Unregister a hook function.

```js
const myHook = (el, scope, cs) => { /* ... */ };

addHook('beforeCompile', myHook);
// Later...
removeHook('beforeCompile', myHook);
```

---

## Plugin System

Plugins extend Zog.js with reusable functionality.

### Creating a Plugin

```js
// my-plugin.js
export const MyPlugin = {
    install(app, options) {
        console.log('Plugin installed with options:', options);
        
        // Access to Zog's reactivity system
        // (import these from zog.js)
        import { addHook, reactive, ref } from './zog.js';
        
        // Add custom hooks
        addHook('beforeCompile', (el, scope, cs) => {
            // Custom logic
        });
        
        // You can add methods to app or return API
        app.myCustomMethod = () => {
            console.log('Custom method');
        };
    }
};
```

**🔧 Changed in v0.4.1:** Plugin `install` method now receives `(app, options)` instead of `(api, options)`. This provides direct access to the app instance.

### Using Plugins

```js
import { createApp } from './zog.js';
import { MyPlugin } from './my-plugin.js';

const app = createApp(() => ({
    message: 'Hello'
}));

// Install plugin
app.use(MyPlugin, { debug: true });

// Access custom methods if added by plugin
app.myCustomMethod?.();

app.mount('#app');
```

### Official Plugins

- **[@zogjs/component](https://npmjs.com/package/@zogjs/component)** - Component system with props, events, and slots
- **@zogjs/router** - Client-side routing (coming soon)
- **@zogjs/store** - State management (coming soon)

---

## Examples

### Todo List with Reactive Objects

```html
<div id="todo">
    <input z-model="newItem" placeholder="Add todo" @keyup.enter="add" />
    <button @click="add">Add</button>

    <ul>
        <li z-for="(todo, i) in todos" :key="todo.id">
            <input type="checkbox" :checked="todo.done" @change="toggle(i)" />
            <span :class="{ done: todo.done }">{{ todo.text }}</span>
            <button @click="remove(i)">×</button>
        </li>
    </ul>
    
    <p>{{ remaining }} of {{ todos.length }} remaining</p>
</div>

<script type="module">
import { createApp, reactive, ref, computed } from './zog.js';

createApp(() => {
    const state = reactive({
        todos: [
            { id: 1, text: 'Learn Zog.js', done: false },
            { id: 2, text: 'Build an app', done: false }
        ]
    });
    
    const newItem = ref('');
    
    const remaining = computed(() => 
        state.todos.filter(t => !t.done).length
    );

    function add() {
        if (newItem.value.trim()) {
            state.todos.push({
                id: Date.now(),
                text: newItem.value.trim(),
                done: false
            });
            newItem.value = '';
        }
    }

    function toggle(i) {
        state.todos[i].done = !state.todos[i].done;
    }

    function remove(i) {
        state.todos.splice(i, 1);
    }

    return {
        todos: state.todos,
        newItem,
        remaining,
        add,
        toggle,
        remove
    };
}).mount('#todo');
</script>
```

### Form Handling with Validation

```html
<div id="form">
    <form @submit="handleSubmit">
        <div>
            <label>Email:</label>
            <input z-model="email" type="email" />
            <span z-show="errors.email" class="error">{{ errors.email }}</span>
        </div>
        
        <div>
            <label>Password:</label>
            <input z-model="password" type="password" />
            <span z-show="errors.password" class="error">{{ errors.password }}</span>
        </div>
        
        <button :disabled="isSubmitting">
            {{ isSubmitting ? 'Submitting...' : 'Submit' }}
        </button>
    </form>
</div>

<script type="module">
import { createApp, ref, reactive } from './zog.js';

createApp(() => {
    const email = ref('');
    const password = ref('');
    const isSubmitting = ref(false);
    const errors = reactive({
        email: '',
        password: ''
    });

    function validate() {
        errors.email = email.value.includes('@') ? '' : 'Invalid email';
        errors.password = password.value.length >= 6 ? '' : 'Min 6 characters';
        return !errors.email && !errors.password;
    }

    async function handleSubmit(e) {
        e.preventDefault();
        
        if (!validate()) return;
        
        isSubmitting.value = true;
        
        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));
            console.log('Form submitted:', { email: email.value });
        } finally {
            isSubmitting.value = false;
        }
    }

    return { email, password, errors, isSubmitting, handleSubmit };
}).mount('#form');
</script>
```

### Dynamic Styling and Classes

```html
<div id="styling">
    <button @click="toggleTheme">Toggle Theme</button>
    <button @click="increaseSize">Increase Size</button>
    
    <div 
        :class="{ 
            dark: isDark, 
            light: !isDark,
            'text-large': isLarge 
        }"
        :style="{ 
            color: textColor, 
            fontSize: fontSize + 'px',
            padding: '20px'
        }">
        Dynamically styled content
    </div>
</div>

<script type="module">
import { createApp, ref, computed } from './zog.js';

createApp(() => {
    const isDark = ref(false);
    const fontSize = ref(16);
    
    const textColor = computed(() => isDark.value ? '#fff' : '#000');
    const isLarge = computed(() => fontSize.value > 20);
    
    const toggleTheme = () => isDark.value = !isDark.value;
    const increaseSize = () => fontSize.value += 2;
    
    return { 
        isDark, 
        fontSize, 
        textColor, 
        isLarge,
        toggleTheme, 
        increaseSize 
    };
}).mount('#styling');
</script>
```

---

## Advanced Features

### Effect Queue and Batching

Zog.js automatically batches reactive updates for optimal performance:

```js
const count = ref(0);

watchEffect(() => {
    console.log('Count:', count.value);
});

// These updates are batched into a single effect run
count.value++;
count.value++;
count.value++;
// Only logs once: "Count: 3"
```

**⚡ Optimized in v0.4.1:** Effect queue processing is now faster with improved batching logic.

### Custom Effect Schedulers

Control when effects run with custom schedulers:

```js
const count = ref(0);

const stop = watchEffect(() => {
    console.log('Count:', count.value);
}, {
    scheduler: (run) => {
        // Run on next animation frame
        requestAnimationFrame(run);
    }
});
```

### Computed Dependencies

Computed values automatically track their dependencies:

```js
const firstName = ref('John');
const lastName = ref('Doe');

const fullName = computed(() => {
    // Automatically tracks firstName and lastName
    return `${firstName.value} ${lastName.value}`;
});

// Only recomputes when dependencies change
console.log(fullName.value); // Computed
console.log(fullName.value); // Cached
firstName.value = 'Jane';
console.log(fullName.value); // Recomputed
```

### Manual Effect Cleanup

```js
const count = ref(0);

const stop = watchEffect(() => {
    console.log(count.value);
    
    // Setup
    const timer = setInterval(() => {
        count.value++;
    }, 1000);
    
    // Cleanup (returned function runs before next effect)
    return () => {
        clearInterval(timer);
    };
});

// Stop watching and run cleanup
stop();
```

### Access to Raw Values

Get the raw non-reactive value from a reactive object:

```js
import { reactive } from './zog.js';

const state = reactive({ count: 0 });

// Access internal raw symbol if needed
const raw = state[Symbol.for('raw')];
```

---

## API Reference

### Core Functions

#### `createApp(setup)`

Creates an application instance.

**Parameters:**
- `setup`: Function that returns the reactive scope object (optional in v0.4.1)

**Returns:** App instance with methods:
- `mount(selector | element)`: Mount to DOM element (accepts selector string or element)
- `unmount()`: Cleanup and unmount
- `use(plugin, options)`: Install a plugin

```js
const app = createApp(() => ({
    message: ref('Hello')
}));

app.use(SomePlugin, { option: 'value' });
app.mount('#app'); // or app.mount(document.getElementById('app'))
```

#### `ref(value)`

Create a reactive reference.

```js
const count = ref(0);
count.value = 10;

// Objects are automatically wrapped with reactive()
const user = ref({ name: 'John' });
user.value.name = 'Jane'; // Fully reactive
```

#### `reactive(object)`

Create a deeply reactive proxy.

```js
const state = reactive({
    user: { name: 'John' },
    todos: []
});
```

#### `computed(getter)`

Create a computed value.

```js
const doubled = computed(() => count.value * 2);
```

#### `watchEffect(fn, options)`

Create a reactive effect.

**Options:**
- `scheduler`: Custom scheduler function

```js
const stop = watchEffect(() => {
    console.log(count.value);
});
```

#### `nextTick(fn)`

Execute function after next DOM update.

```js
await nextTick(() => {
    // DOM is updated
});
```

---

## Template Directive Reference

| Directive | Purpose | Example |
|-----------|---------|---------|
| `{{ expr }}` | Interpolate expression | `<p>{{ message }}</p>` |
| `z-if` | Conditional rendering | `<div z-if="show">Text</div>` |
| `z-else-if` | Conditional branch | `<div z-else-if="other">Text</div>` |
| `z-else` | Fallback condition | `<div z-else>Text</div>` |
| `z-for` | List rendering | `<li z-for="item in items">{{ item }}</li>` |
| `:key` | Unique key for z-for | `<li z-for="item in items" :key="item.id">` |
| `z-text` | Set textContent | `<p z-text="message"></p>` |
| `z-html` | Set innerHTML | `<div z-html="html"></div>` |
| `z-show` | Toggle display | `<div z-show="visible">Text</div>` |
| `z-model` | Two-way binding | `<input z-model="value" />` |
| `@event` | Event listener | `<button @click="handle">Click</button>` |
| `z-on:event` | Event listener (alt) | `<button z-on:click="handle">Click</button>` |
| `:attr` | Bind attribute | `<img :src="url" />` |
| `:class` | Bind classes | `<div :class="{ active: isActive }">` |
| `:style` | Bind styles | `<div :style="{ color: color }">` |

---

## Tips & Best Practices

### Performance

1. **Use `:key` in lists**: Helps Zog efficiently reuse DOM elements
   ```html
   <li z-for="item in items" :key="item.id">{{ item.name }}</li>
   ```

2. **Computed values are cached**: Use them for expensive calculations
   ```js
   const expensiveResult = computed(() => {
       return items.value.filter(/* complex logic */);
   });
   ```

3. **Effects are batched**: Multiple updates trigger a single re-render

### Security

1. **Avoid `z-html` with user input**: Can lead to XSS vulnerabilities
   ```html
   <!-- ❌ Dangerous -->
   <div z-html="userInput"></div>
   
   <!-- ✅ Safe -->
   <div z-text="userInput"></div>
   ```

2. **Sanitize HTML if you must use it**:
   ```js
   import DOMPurify from 'dompurify';
   const safeHtml = ref(DOMPurify.sanitize(userInput));
   ```

### Code Organization

1. **Extract complex logic to functions**:
   ```js
   createApp(() => {
       const state = reactive({ /* ... */ });
       
       function complexOperation() {
           // Logic here
       }
       
       return { state, complexOperation };
   });
   ```

2. **Use plugins for reusable features**:
   ```js
   // Better than copying code across projects
   app.use(ValidationPlugin);
   app.use(RouterPlugin);
   ```

### Reactivity Gotchas

1. **Refs need `.value` in JavaScript**:
   ```js
   const count = ref(0);
   count.value++; // ✅
   count++;       // ❌
   ```

2. **Destructuring breaks reactivity**:
   ```js
   const state = reactive({ count: 0 });
   const { count } = state; // ❌ count is no longer reactive
   ```

3. **Arrays are fully reactive**:
   ```js
   const items = reactive([]);
   items.push('new'); // ✅ Reactive
   items[0] = 'updated'; // ✅ Reactive
   items.includes('new'); // ✅ Properly tracked
   ```

---

## Browser Support

Zog.js works in all modern browsers that support:
- ES6 Proxy
- ES6 Modules
- WeakMap/WeakSet

**Supported:**
- Chrome 49+
- Firefox 18+
- Safari 10+
- Edge 12+

**Not supported:**
- Internet Explorer (no Proxy support)

---

## Bundle Size

- **Core library**: ~3KB gzipped
- **No dependencies**
- **Tree-shakeable**: Import only what you need

---

## Development & Contributing

### Project Structure

```
zog.js          # Main library file (single file)
examples/       # Example applications
plugins/        # Official plugins
```

### Running Examples

1. Clone the repository
2. Open any example HTML file in a browser
3. Or use a local server:
   ```bash
   npx serve .
   ```

### Contributing

We welcome contributions! Please:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request

---

## Changelog

### v0.4.1 (Current)

**Critical Bug Fixes:**
- 🐛 **Fixed z-for index reactivity**: Index is now properly reactive (was plain number, now `ref`)
- 🐛 **Fixed array method tracking**: `includes`, `indexOf`, `lastIndexOf` now work correctly with reactive objects

**Performance Improvements:**
- ⚡ Removed unnecessary sort in effect queue (~5-10% faster)
- ⚡ Optimized effect queue cleanup (better memory management)
- ⚡ Improved proxy handler logic

**Error Handling:**
- 🛡️ Added try-catch in `mount()` with error hooks
- 🛡️ Better error context in effect execution
- 🛡️ Improved ref unwrapping in event handlers

**API Improvements:**
- ✨ `ref()` now automatically wraps objects with `reactive()`
- ✨ Plugin API simplified: `install(app, options)` instead of `install(api, options)`
- ✨ `mount()` accepts both selector string and DOM element
- ✨ Added support for `findLast`, `findLastIndex`, `values`, `entries`, `keys` array methods

**Developer Experience:**
- 📝 Better error messages
- 🔧 Improved hook system reliability
- 🐛 Fixed effectStack compatibility (`[length-1]` instead of `.at(-1)`)

### v0.3.2

**Major Features:**
- ✨ Added comprehensive **Hook System** (`beforeCompile`, `afterCompile`, `beforeEffect`, `onError`)
- ✨ Improved **Plugin API** with access to hooks and internal utilities
- ✨ Enhanced error handling with `onError` hook for debugging
- 🚀 Optimized reactivity with improved effect queue management
- 🚀 Reduced code size while adding more features

**Improvements:**
- Better expression evaluator with expanded cache (200 entries)
- Enhanced array reactivity with unified method handling
- Improved memory management with effect cleanup
- Effect ID system for debugging and ordering

### v0.2.3

- Added plugin system with `use()` function
- Optimized expression evaluator with caching
- Unified array method handling for smaller bundle size
- Improved z-for diffing algorithm
- Reduced code size by ~100 lines

### v0.2.2

- Full array reactivity support
- Key-based diffing for z-for
- Deep reactive objects and arrays
- Complete directive system

---

## Migration Guide

### Upgrading from v0.3.x to v0.4.1

**Breaking Changes:** None! v0.4.1 is fully backward compatible.

**What You Get:**
- Your z-for loops with indices will now work correctly
- Better error messages for debugging
- Improved performance

**Recommended Actions:**
1. Update to v0.4.1 immediately (critical bug fixes)
2. Test your z-for loops with indices
3. No code changes required

**Plugin Authors:**
If you're maintaining a plugin, update your `install` method signature:
```js
// Old (still works but deprecated)
install(api, options) { }

// New (recommended)
install(app, options) { }
```

---

## Resources

- **Website**: [zogjs.com](https://zogjs.com)
- **Documentation**: [zogjs.com/docs](https://zogjs.com/docs)
- **Examples**: [zogjs.com/examples](https://zogjs.com/examples)
- **GitHub**: [github.com/zogjs/zog](https://github.com/zogjs/zog)
- **npm**: [npmjs.com/package/zogjs](https://npmjs.com/package/zogjs)

---

## License

Zog.js is open-source software licensed under the **MIT License**.

You are free to use, modify, and distribute this project in commercial or non-commercial applications.

See the [LICENSE](LICENSE) file for full details.

---

I don't know why I made this. I can't stop doing this.
