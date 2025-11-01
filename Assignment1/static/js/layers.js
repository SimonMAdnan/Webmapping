/**
 * Transport API - Map Layers Configuration
 * Multiple tile layer providers and layer controls
 */

// Define different tile layers
const tileLayers = {
    'OpenStreetMap': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
        minZoom: 10,
        name: 'OpenStreetMap'
    }),
    
    'Satellite': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri',
        maxZoom: 18,
        minZoom: 0,
        name: 'Satellite'
    }),
    
    'Terrain': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri',
        maxZoom: 13,
        minZoom: 0,
        name: 'Terrain'
    }),
    
    'CartoDB Positron': L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap, &copy; CartoDB',
        subdomains: 'abcd',
        maxZoom: 20,
        minZoom: 0,
        name: 'CartoDB Positron'
    }),
    
    'CartoDB Voyager': L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap, &copy; CartoDB',
        subdomains: 'abcd',
        maxZoom: 20,
        minZoom: 0,
        name: 'CartoDB Voyager'
    })
};

// Feature layers (data overlays)
const featureLayers = {
    'Stops': null,
    'Routes': null,
    'Vehicles': null,
    'Query Results': null
};

/**
 * Initialize map with layer controls
 */
function initializeMapWithLayers(map) {
    // Add default tile layer
    tileLayers['OpenStreetMap'].addTo(map);
    
    // Create layer control groups
    const baseLayers = {
        'OpenStreetMap': tileLayers['OpenStreetMap'],
        'Satellite': tileLayers['Satellite'],
        'Terrain': tileLayers['Terrain'],
        'CartoDB Light': tileLayers['CartoDB Positron'],
        'CartoDB Voyager': tileLayers['CartoDB Voyager']
    };
    
    const overlayLayers = {
        'Stops': L.featureGroup(),
        'Routes': L.featureGroup(),
        'Vehicles': L.featureGroup(),
        'Query Results': L.featureGroup()
    };
    
    // Store in window scope for use by other scripts
    window.featureLayers = overlayLayers;
    
    // Add overlays to map by default
    overlayLayers['Stops'].addTo(map);
    overlayLayers['Vehicles'].addTo(map);
    overlayLayers['Query Results'].addTo(map);
    
    console.log('Feature layers added to map');
    
    // Create and add layer control
    const layerControl = L.control.layers(baseLayers, overlayLayers, {
        position: 'topright',
        collapsed: true
    });
    layerControl.addTo(map);
    
    return { baseLayers, overlayLayers };
}

/**
 * Add a heatmap layer for density visualization
 */
function addHeatmapLayer(map, data, maxZoom = 18) {
    if (!window.L.heatLayer) {
        console.warn('Leaflet.heat plugin not loaded');
        return null;
    }
    
    const heatData = data.map(item => {
        const coords = item.geometry.coordinates;
        return [coords[1], coords[0], 1]; // [lat, lon, intensity]
    });
    
    const heatmapLayer = L.heatLayer(heatData, {
        radius: 25,
        blur: 15,
        maxZoom: maxZoom,
        gradient: {0.4: 'blue', 0.65: 'lime', 1.0: 'red'}
    });
    
    return heatmapLayer;
}

/**
 * Add a cluster layer for data aggregation
 */
function addClusterLayer(map, data) {
    if (!window.L.markerClusterGroup) {
        console.warn('Leaflet.markercluster plugin not loaded');
        return null;
    }
    
    const clusterLayer = L.markerClusterGroup({
        maxClusterRadius: 80,
        spiderfyOnMaxZoom: true
    });
    
    data.forEach(item => {
        const coords = item.geometry.coordinates;
        const marker = L.circleMarker([coords[1], coords[0]], {
            radius: 5,
            fillColor: '#3388ff',
            color: '#000',
            weight: 1,
            opacity: 0.8,
            fillOpacity: 0.7
        });
        clusterLayer.addLayer(marker);
    });
    
    return clusterLayer;
}

/**
 * Toggle between different visualizations
 */
function setVisualizationMode(map, mode, data) {
    switch(mode) {
        case 'markers':
            // Individual markers - already handled by loadStops/loadVehicles
            break;
        case 'heatmap':
            // Add heatmap visualization
            const heatmap = addHeatmapLayer(map, data);
            if (heatmap) {
                heatmap.addTo(map);
            }
            break;
        case 'clusters':
            // Add clustered markers
            const clusters = addClusterLayer(map, data);
            if (clusters) {
                clusters.addTo(map);
            }
            break;
    }
}

/**
 * Get current active base layer
 */
function getActiveBaseLayer() {
    // This would need access to the map object to check
    return 'OpenStreetMap';
}

/**
 * Add a drawing/measurement tool overlay
 */
function addDrawingTools(map) {
    if (!window.L.Draw) {
        console.warn('Leaflet-draw plugin not loaded');
        return null;
    }
    
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    
    const drawControl = new L.Control.Draw({
        draw: {
            polygon: true,
            polyline: true,
            rectangle: true,
            circle: true,
            marker: true
        },
        edit: {
            featureGroup: drawnItems
        }
    });
    
    map.addControl(drawControl);
    
    // Handle drawn items
    map.on('draw:created', function(e) {
        const layer = e.layer;
        drawnItems.addLayer(layer);
    });
    
    return drawnItems;
}

/**
 * Create a mini map in corner showing zoomed-out view
 */
function addMiniMap(map) {
    if (!window.L.control.minimap) {
        console.warn('Leaflet-minimap plugin not loaded');
        return null;
    }
    
    const miniLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'OSM'
    });
    
    const miniMap = new L.Control.MiniMap(miniLayer, {
        toggleDisplay: true,
        position: 'bottomleft'
    });
    
    map.addControl(miniMap);
    return miniMap;
}

/**
 * Add measurement tool
 */
function addMeasurementTool(map) {
    if (!window.L.measureControl) {
        console.warn('Leaflet-measure plugin not loaded');
        return null;
    }
    
    const measureControl = L.measureControl({
        position: 'topleft',
        primaryLengthUnit: 'meters',
        secondaryLengthUnit: 'kilometers',
        primaryAreaUnit: 'sqmeters',
        secondaryAreaUnit: 'hectares'
    });
    
    map.addControl(measureControl);
    return measureControl;
}

/**
 * Create a GeoJSON layer with custom styling
 */
function createGeoJSONLayer(geoJsonData, options = {}) {
    const defaultOptions = {
        style: {
            color: '#3388ff',
            weight: 2,
            opacity: 0.8,
            fillOpacity: 0.2
        },
        pointToLayer: function(feature, latlng) {
            return L.circleMarker(latlng, {
                radius: 5,
                fillColor: '#3388ff',
                color: '#000',
                weight: 1,
                opacity: 0.8,
                fillOpacity: 0.7
            });
        },
        onEachFeature: function(feature, layer) {
            if (feature.properties) {
                let popupContent = '<div class="popup-content">';
                for (const [key, value] of Object.entries(feature.properties)) {
                    popupContent += `<strong>${key}:</strong> ${value}<br>`;
                }
                popupContent += '</div>';
                layer.bindPopup(popupContent);
            }
        }
    };
    
    const mergedOptions = { ...defaultOptions, ...options };
    return L.geoJSON(geoJsonData, mergedOptions);
}
