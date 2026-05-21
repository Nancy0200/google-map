/**
 * speed.js — Option data definitions for the quick-report menu.
 *
 * Each key matches the `data-key` attribute on a .menu-option button.
 * Exported via the global `window.REPORT_OPTIONS` object.
 */

window.REPORT_OPTIONS = {
    red: {
        icon: '🔴',
        label: '車速 < 30',
        content: '目前車速緩慢（< 30 km/h），請注意壅塞。',
        category: 'speed',
        speed_level: 'red',
    },
    yellow: {
        icon: '🟡',
        label: '車速 30–60',
        content: '目前車速中等（30–60 km/h），行駛順暢。',
        category: 'speed',
        speed_level: 'yellow',
    },
    green: {
        icon: '🟢',
        label: '車速 > 60',
        content: '目前車速良好（> 60 km/h），道路暢通。',
        category: 'speed',
        speed_level: 'green',
    },
    accident: {
        icon: '🚗💥',
        label: '前方車禍',
        content: '前方有車禍，請減速並注意安全！',
        category: 'accident',
        speed_level: null,
    },
    debris: {
        icon: '📦⚠️',
        label: '前方掉落物',
        content: '前方路面有掉落物，請小心閃避！',
        category: 'debris',
        speed_level: null,
    },
};
