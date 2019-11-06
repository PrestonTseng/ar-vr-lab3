const staticCacheName = 'site-static-v3';
const dynamicCacheName = 'site-dynamic-v3';
const assets = [
    './',
    './index.html',
    './scripts/index.js',
    './scripts/krpano.js',
    './plugins/comparemode.xml',
    './plugins/contextmenu.xml',
    './plugins/webim.xml',
    './skin/vtourskin.xml',
    './skin/vtourskin.png',
    './plugins/webvr.xml',
    './plugins/webvr.js',
    './plugins/webvr_cursor_80x80_17f.png',
    './plugins/circle_hotspots.xml',
    './plugins/hs_circle.png',
    './plugins/radar.js',
    './plugins/scrollarea.js',
    './plugins/gyro2.js',
    './plugins/slider_background.png',
    './plugins/slider_grip.png',
    './plugins/mappointactive.png',
    './styles/index.css',
    './images/logo.jpg',
    './config/config.json'
];

// cache size limit function
const limitCacheSize = (name, size) => {
    caches.open(name).then(cache => {
        cache.keys().then(keys => {
            if (keys.length > size) {
                cache.delete(keys[0]).then(limitCacheSize(name, size));
            }
        });
    });
};

// install event
self.addEventListener('install', evt => {
    //console.log('service worker installed');
    evt.waitUntil(
        caches.open(staticCacheName).then((cache) => {
            console.log('caching shell assets');
            cache.addAll(assets);
        }).catch((err) => {
            console.log('錯誤:', err);
        }),
        caches.open(dynamicCacheName).then((cache) => {
            fetch('./config/config.json', {})
            .then(res => {
                return res.json()
            })
            .then(json => {
                var resources = []
                json.scenes.forEach(e => {
                    resources.push(`./images/${e.id}/${e.id}_b.jpg`)
                    resources.push(`./images/${e.id}/${e.id}_d.jpg`)
                    resources.push(`./images/${e.id}/${e.id}_f.jpg`)
                    resources.push(`./images/${e.id}/${e.id}_l.jpg`)
                    resources.push(`./images/${e.id}/${e.id}_r.jpg`)
                    resources.push(`./images/${e.id}/${e.id}_u.jpg`)
                    resources.push(`./images/${e.id}/thumb_border.png`)
                })
                return resources
            })
            .then(resources => {
                cache.addAll(resources);
            })
            .catch((err) => {
                console.log('錯誤:', err);
            })
        })
    );
});

// activate event
self.addEventListener('activate', evt => {
    //console.log('service worker activated');

    evt.waitUntil(
        caches.keys().then(keys => {
            //console.log(keys);
            return Promise.all(keys
                .filter(key => key !== staticCacheName && key !== dynamicCacheName)
                .map(key => caches.delete(key))
            );
        })
    );
});

self.addEventListener('fetch', function (event) {
    event.respondWith(
        caches.match(event.request).then(function (response) {
            return response || fetch(event.request);
        })
    );
});

function config_res() {

    
}