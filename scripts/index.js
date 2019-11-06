if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('service worker registered'))
        .catch(err => console.log('service worker not registered', err));
}

// global krpano interface (will be set in the onready callback)
var krpano = null;
var config
var state = {
    map: undefined,
    maphotspots: [],
    currentAlpha: 0,
    intervalID: null
}

// embed the krpano viewer into the 'pano' div element
embedpano({
    swf: null, // path to flash viewer (use null if no flash fallback will be requiered)
    id: "krpanoSWFObject",
    xml: null,
    target: "pano",
    html5: "auto",
    webglsettings: {
        preserveDrawingBuffer: true
    },
    mobilescale: 1.0,
    passQueryParameters: true, // pass query parameters of the url to krpano
    onready: krpano_onready_callback
});

// callback function that will be called when krpano is embedded and ready for using
function krpano_onready_callback(krpano_interface) {
    krpano = krpano_interface

    fetch('./config/config.json', {})
        .then(res => {
            return res.json()
        })
        .then(json => {
            set_manifest(json.manifest)
            loadPano(json.scenes)
            config = json
        })
        .catch((err) => {
            console.log('錯誤:', err);
        })
}

function set_manifest(json) {

    // set manifest dynamically

    const stringManifest = JSON.stringify(json);
    const blob = new Blob([stringManifest], {
        type: 'application/json'
    });
    const manifestURL = URL.createObjectURL(blob);
    document.querySelector('#manifest').setAttribute('href', manifestURL);

    document.head.querySelector("[name~=apple-mobile-web-app-title]").content = json.name
    document.head.querySelector("[name~=apple-mobile-web-app-status-bar-style]").content = json.background_color
    document.head.querySelector("[rel~=apple-touch-icon]").href = json.icons[0].src
    document.head.querySelector("[rel~=apple-touch-icon]").size = json.icons[0].size
    document.head.querySelector("[rel~=apple-touch-startup-image]").href = json.icons[0].src

}

function loadPano(json) {
    if (krpano) {
        var xmlstring =
            `<krpano>
                <include url="./plugins/contextmenu.xml" />
                <include url="./plugins/comparemode.xml" />
                <include url="./plugins/circle_hotspots.xml"/>
                <include url="./plugins/webim.xml"/>
                <include url="./skin/vtourskin.xml" />
                <include url="./plugins/map.xml"/>
                <skin_settings layout_maxwidth="600" showpanomap="False" showpanocompare="False"/>

                <plugin name="gyro" devices="html5"
                        url="%VIEWER%/plugins/gyro2.js"
                        enabled="false"
                        onavailable="gyro_available_info();"
                        onunavailable="gyro_not_available_info();"
                        softstart="1"
                        />

                <action name="gyro_available_info">
                    set(layer[infotext].html, 'Gyroscope available, press the gyro button...');
                    set(layer[gyrobutton].visible, true);
                </action>
                
                <action name="gyro_not_available_info" xautorun.flash="onstart">
                    set(layer[infotext].html, 'No gyroscope available...');
                </action>

                <action name="startup" autorun="onstart">
                    if(startscene === null OR !scene[get(startscene)], copy(startscene,scene[0].name); );
                    loadscene(get(startscene), null, MERGE);
                    if(startactions !== null, startactions() );
                </action>
                
                ${loadScene(json)}

             </krpano>`
        krpano.call("loadxml(" + escape(xmlstring) + ", null, MERGE, BLEND(0.5));")
    }
}

function loadScene(json) {

    var xml = ''

    json.forEach(e => {

        xml +=
            `
            <scene name="${e.id}" title="${e.title}" onstart="updateradar(${e.heading});js(stopCompareCube());js(initialPanoCompare());">

                <view hlookat="${e.view.hlookat}" vlookat="${e.view.vlookat}" fovtype="${e.view.fovtype}" fov="${e.view.fov}" maxpixelzoom="${e.view.maxpixelzoom}" fovmin="${e.view.fovmin}" fovmax="${e.view.fovmax}" limitview="${e.view.limitview}" />

                <preview type="${e.preview.type}" />

                <image>
                    <cube url="${e.image.url}" />
                </image>
                ${loadHotspots(e.hotspots)}          
            
            </scene>
            `

    })

    return xml


}

function loadHotspots(hotspots) {

    var xml = ''

    hotspots.forEach(e => {
        xml += `<hotspot name="${e.id}" style="${e.style}" ath="${e.ath}" atv="${e.atv}" tag="${e.tag}" />`
    })

    return xml

}

function setPanoCompareVisible() {
    var isVisible = krpano.get('plugin[slider_bg].visible');
    let nowScene = krpano.get('xml.scene');
    let url = config.scenes.filter(x => x.id === nowScene)[0].compare.url;

    if (isVisible === true) {
        stopCompareCube();
    } else if (url) {
        addCompareCube(url, true);
    }
}

function initialPanoCompare() {
    let nowScene = krpano.get('xml.scene');
    let url = config.scenes.filter(x => x.id === nowScene)[0].compare.url;
    addCompareCube(url);
}

function addCompareCube(url, controller = false) {
    krpano.call("removecube(comparePano);");
    krpano.call(`addcube("comparePano", ${url.split('_%s')[0]});`);
    if (controller) {
        krpano.set('plugin[slider_bg].visible', true);
        krpano.set('plugin[slider_grip].visible', true);
    }
    krpano.call("startcomapre();");
}

function stopCompareCube() {
    krpano.call(`removecube("comparePano");`);
    if (krpano.get('plugin[slider_bg].visible') || krpano.get('plugin[slider_grip].visible')) {
        krpano.set('plugin[slider_bg].visible', false);
        krpano.set('plugin[slider_grip].visible', false);
    }
    krpano.get("plugin[slider_grip]").x = 0;
}

function removeCompareCube(name) {
    krpano.call(`removecube("comparePano");`);
    krpano.set('plugin[slider_bg].visible', false);
    krpano.set('plugin[slider_grip].visible', false);
    krpano.get("plugin[slider_grip]").x = 0;
}

document.addEventListener('keydown', controllerDetect);

function controllerDetect(e) {

    switch (e.keyCode) {

        // 向左
        case 37:
            state.intervalID = setInterval(() => { fade('in') }, 10);
            break;

        // 左 到 中間
        case 81:
            clearInterval(state.intervalID);
            break;

        // 向右
        case 39:
            state.intervalID = setInterval(() => { fade('out') }, 10);
            break;

        // 右 到 中間
        case 67:
            clearInterval(state.intervalID);
            break;
    }
}

function fade(direct) {

    var moveUnit = 0.01;
    var newAlpha;

    if (direct === 'in') {
        newAlpha = new Number(state.currentAlpha) - new Number(moveUnit);
        state.currentAlpha = newAlpha >= 0 ? newAlpha : 0;
        krpano.call(`setblend(${state.currentAlpha};`);
    }

    if (direct === 'out') {
        newAlpha = new Number(state.currentAlpha) + new Number(moveUnit);
        state.currentAlpha = newAlpha <= 1 ? newAlpha : 1;
        krpano.call(`setblend(${state.currentAlpha};`);
    }
}

function setPanoMapVisible() {
    krpano.set("layer[map].visible", !krpano.get("layer[map].visible"))
}

function initMap(sceneId) {
    var scene = config.scenes.filter(x => x.id === sceneId)
    var mapId = scene[0].map;
    var map = config.maps.filter(x => x.id === mapId)[0];
    state.maphotspots = map.spots;

    loadMap(mapId).then(() => addMapLoc(sceneId)).then(() => addMapHotspot());

}

async function loadMap(mapId) {

    if (mapId !== state.map) {

        state.map = mapId;
        var map = config.maps.filter(x => x.id === mapId)[0];

        krpano.call("addlayer(map);");
        krpano.set("layer[map].url", map.url);
        krpano.set("layer[map].keep", true);
        krpano.set("layer[map].handcursor", false);
        krpano.set("layer[map].capture", false);
        krpano.set("layer[map].align", "leftbottom");
        krpano.set("layer[map].scale", map.scale);
        krpano.set("layer[map].scalechildren", true);
        krpano.set("layer[map].onclick", "openmap();");
        krpano.set("layer[map].visible", true);
    }
}

async function addMapLoc(sceneId) {

    startScene = state.maphotspots.filter(x => x.id === sceneId)[0];

    // now location point
    krpano.call("addlayer(mapactivespot);");
    krpano.set("layer[mapactivespot].parent", 'map');
    krpano.set("layer[mapactivespot].url", "%BASEDIR%/plugins/mappointactive.png");
    krpano.set("layer[mapactivespot].align", "lefttop");
    krpano.set("layer[mapactivespot].edge", "center");
    krpano.set("layer[mapactivespot].zorder", 3);
    krpano.set("layer[mapactivespot].keep", true);
    krpano.set("layer[mapactivespot].x", startScene.x);
    krpano.set("layer[mapactivespot].y", startScene.y);

    // radar
    krpano.call("addlayer(mapradar);");
    krpano.set("layer[mapradar].parent", "map");
    krpano.set("layer[mapradar].url", "%BASEDIR%/plugins/radar.js");
    krpano.set("layer[mapradar].align", "lefttop");
    krpano.set("layer[mapradar].edge", "center");
    krpano.set("layer[mapradar].zorder", 2);
    krpano.set("layer[mapradar].fillalpha", 0.5);
    krpano.set("layer[mapradar].fillcolor", 0x6FA8DC);
    krpano.set("layer[mapradar].linewidth", 1.0);
    krpano.set("layer[mapradar].linecolor", 0xFFFFFF);
    krpano.set("layer[mapradar].linealpha", 0.5);
    krpano.set("layer[mapradar].keep", true);
    krpano.set("layer[mapradar].x", startScene.x);
    krpano.set("layer[mapradar].y", startScene.y);

}


async function addMapHotspot() {

    state.maphotspots.forEach(e => {

        krpano.call(`addlayer(${e.id});`);
        krpano.set(`layer[${e.id}].url`, e.url);
        // krpano.set(`layer[${e.id}].width`, e.width);
        // krpano.set(`layer[${e.id}].height`, e.height);
        krpano.set(`layer[${e.id}].parent`, "map");
        krpano.set(`layer[${e.id}].scale.mobile`, 2);
        krpano.set(`layer[${e.id}].align`, "lefttop");
        krpano.set(`layer[${e.id}].edge`, "center");
        krpano.set(`layer[${e.id}].zorder`, 1);
        krpano.set(`layer[${e.id}].onclick`, "mapspot_loadscene();");
        krpano.set(`layer[${e.id}].keep`, true);
        // krpano.call(`layer[${e.id}].loadstyle(mapTooltip));`);
        krpano.set(`layer[${e.id}].x`, e.x);
        krpano.set(`layer[${e.id}].y`, e.y);

    })
}

function updateMapHotspots() {
    state.maphotspots.forEach(e => {

        krpano.set(`layer[${e.id}].visible`, true);

    })
}

function removeMapHotspots() {
    krpano.set('layer[radar].visible', false);
    krpano.set('layer[activespot].visible', false);
    state.maphotspots.forEach(e => {
        krpano.call(`removelayer('${e}');`);
    });
}
