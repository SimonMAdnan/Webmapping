//Transport API - Map Layers Configuration
//This module manages base tile layers and feature overlays for the Transport API map

// Base tile layers (only one active at a time)

// Define different tile layers
const tileLayers = {
    //OpenStreetMap Standard Tile Layer for the initial map view
    'OpenStreetMap': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
        minZoom: 10,
        name: 'OpenStreetMap'
    }),
    // Satellite imagery layer
    'Satellite': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri',
        maxZoom: 18,
        minZoom: 0,
        name: 'Satellite'
    }),
    // Terrain/topographic layer
    'Terrain': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri',
        maxZoom: 13,
        minZoom: 0,
        name: 'Terrain'
    }),
    // CartoDB Light tile layer
    'CartoDB Positron': L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap, &copy; CartoDB',
        subdomains: 'abcd',
        maxZoom: 20,
        minZoom: 0,
        name: 'CartoDB Positron'
    }),
    // CartoDB Voyager tile layer
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
    'Query Results': null
};

// Initialise map with layer controls
// This function sets up the map with base tile layers and overlay feature layers
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
    
    // Create organized overlay layers with shape types separated
    const overlayLayers = {
        'Stops': L.featureGroup(),
        'Routes': L.featureGroup(),
        'Routes - Bus': L.featureGroup(),
        'Routes - Rail': L.featureGroup(),
        'Routes - Tram': L.featureGroup(),
        'Routes - Ferry': L.featureGroup(),
        'Routes - Other': L.featureGroup(),
        'Shapes - Bus': L.featureGroup(),
        'Shapes - Rail': L.featureGroup(),
        'Shapes - Tram': L.featureGroup(),
        'Shapes - Other': L.featureGroup(),
        'Query Results': L.featureGroup()
    };
    
    // Store in window scope for use by other scripts
    window.featureLayers = overlayLayers;

    
    // Create and add layer control - only show base tile layers, not data overlays
    const layerControl = L.control.layers(baseLayers, {}, {
        position: 'topright',
        collapsed: true
    });
    layerControl.addTo(map);
    
    // Move zoom controls to topright below layer control
    map.zoomControl.setPosition('topright');
    
    return { baseLayers, overlayLayers };
}

// Add a heatmap layer for density visualization not implemented yet
// this requires Leaflet.heat plugin
// this function creates and returns a heatmap layer given data points
function addHeatmapLayer(map, data, maxZoom = 18) {
    if (!window.L.heatLayer) {//Check if Leaflet.heat plugin is loaded
        console.warn('Leaflet.heat plugin not loaded');
        return null;
    }
    // Create heatmap data from the input data
    const heatData = data.map(item => {//Map data points to heatmap format
        const coords = item.geometry.coordinates;
        return [coords[1], coords[0], 1]; // [lat, lon, intensity]
    });
    // Create heatmap layer with options
    const heatmapLayer = L.heatLayer(heatData, {
        radius: 25,
        blur: 15,
        maxZoom: maxZoom,
        gradient: {0.4: 'blue', 0.65: 'lime', 1.0: 'red'}
    });
    
    return heatmapLayer;
}

// Add clustered markers for better visualization of dense points not implemented yet
// This requires Leaflet.markercluster plugin
// This function creates and returns a marker cluster layer given data points
function addClusterLayer(map, data) {
    if (!window.L.markerClusterGroup) {//Checks if Leaflet.markercluster plugin is loaded
        console.warn('Leaflet.markercluster plugin not loaded');
        return null;
    }
    // Create marker cluster group
    const clusterLayer = L.markerClusterGroup({
        maxClusterRadius: 80,
        spiderfyOnMaxZoom: true
    });
    
    // Add data points as circle markers to the cluster layer
    data.forEach(item => {
        const coords = item.geometry.coordinates;//Extract coordinates
        const marker = L.circleMarker([coords[1], coords[0]], {//Create circle marker
            radius: 5,
            fillColor: '#3388ff',
            color: '#000',
            weight: 1,
            opacity: 0.8,
            fillOpacity: 0.7
        });
        clusterLayer.addLayer(marker);//Add marker to cluster layer
    });
    
    return clusterLayer;
}

// Set visualization mode for a given layer not implemented yet
// mode: 'markers', 'heatmap', 'clusters'
function setVisualizationMode(map, mode, data) {
    switch(mode) {
        case 'markers':
            // Individual markers - already handled by loadStops
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

// Get the currently active base tile layer 
function getActiveBaseLayer() {
    // This would need access to the map object to check
    return 'OpenStreetMap';
}

// Add a drawing/measurement tool overlay not implemented yet
function addDrawingTools(map) {
    if (!window.L.Draw) {
        console.warn('Leaflet-draw plugin not loaded');
        return null;
    }
    // Initialise the FeatureGroup to store editable layers
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    
    // Add drawing controls
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
    // Add the draw control to the map
    map.addControl(drawControl);
    
    // Handle drawn items
    map.on('draw:created', function(e) {
        const layer = e.layer;
        drawnItems.addLayer(layer);
    });
    
    return drawnItems;
}

// Create a mini map in corner showing zoomed-out view not implemented yet
// This requires Leaflet-minimap plugin
// This function creates and adds a mini map control to the main map
function addMiniMap(map) {
    if (!window.L.control.minimap) {
        console.warn('Leaflet-minimap plugin not loaded');
        return null;
    }

    // Create mini map layer
    const miniLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'OSM'
    });
    
    //Creates and add the mini map control
    const miniMap = new L.Control.MiniMap(miniLayer, {
        toggleDisplay: true,
        position: 'bottomleft'
    });
    
    map.addControl(miniMap);//Add mini map to main map
    return miniMap;
}

// Add a measurement tool to the map not 
// This requires Leaflet-measure plugin
// This function creates and adds a measurement control to the map
function addMeasurementTool(map) {
    if (!window.L.measureControl) {
        console.warn('Leaflet-measure plugin not loaded');
        return null;
    }
    
    //Creates and adds the measurement control
    const measureControl = L.measureControl({
        position: 'topleft',
        primaryLengthUnit: 'meters',
        secondaryLengthUnit: 'kilometers',
        primaryAreaUnit: 'sqmeters',
        secondaryAreaUnit: 'hectares'
    });
    
    map.addControl(measureControl);//Add measurement control to map
    return measureControl;
}

// Create a GeoJSON layer with custom styling and popups 
// This function creates and returns a GeoJSON layer given GeoJSON data and options
function createGeoJSONLayer(geoJsonData, options = {}) {
    //Creates and returns a GeoJSON layer with custom styling and popups
    const defaultOptions = {
        style: {
            color: '#3388ff',
            weight: 2,
            opacity: 0.8,
            fillOpacity: 0.2
        },
        // This function is called for each point feature
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
        // This function is called for each feature to bind popups
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
    // Merge default options with user-provided options
    const mergedOptions = { ...defaultOptions, ...options };
    return L.geoJSON(geoJsonData, mergedOptions);
}
