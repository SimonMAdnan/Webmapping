/**
 * Transport API - Spatial Query Execution
 */

async function performRadiusSearch() {
    const lat = parseFloat(document.getElementById('radiusLat').value);
    const lon = parseFloat(document.getElementById('radiusLon').value);
    const radius = parseInt(document.getElementById('radiusDistance').value);
    const queryType = document.getElementById('radiusType').value;

    if (isNaN(lat) || isNaN(lon) || isNaN(radius)) {
        alert('Please enter valid coordinates and radius');
        return;
    }

    try {
        const layer = window.queryLayer || queryLayer;
        layer.clearLayers();
        const circle = L.circle([lat, lon], {
            radius: radius,
            color: 'blue',
            fill: false,
            weight: 2,
            dashArray: '5, 5',
            opacity: 0.7
        });
        layer.addLayer(circle);

        if (queryType === 'routes') {
            // For routes, we need to search for shapes/routes near the point
            const distanceKm = radius / 1000;
            const endpoint = `/api/shapes/nearby/?lat=${lat}&lon=${lon}&distance_km=${distanceKm}`;
            const response = await fetch(endpoint);
            const data = await response.json();
            
            // Add routes directly to layer (don't use displayRouteResults which clears the layer)
            const routesResults = data.results || [];
            routesResults.forEach(route => {
                const props = route.properties || route;
                const coordinates = route.geometry?.coordinates;
                if (coordinates && Array.isArray(coordinates)) {
                    const latLngs = coordinates.map(coord => [coord[1], coord[0]]);
                    const polyline = L.polyline(latLngs, {
                        color: '#9b59b6',
                        weight: 4,
                        opacity: 0.8,
                        lineCap: 'round',
                        lineJoin: 'round'
                    });
                    // Enhanced popup with all route data
                    const popupContent = `
                        <div class="popup-content">
                            <strong>${props.route_short_name || 'Route'}</strong><br>
                            ${props.route_long_name ? `<small>${props.route_long_name}</small><br>` : ''}
                            Route ID: ${props.route_id || 'N/A'}<br>
                            ${props.route_type ? `Type: ${getRouteTypeName(props.route_type)}<br>` : ''}
                            ${props.route_color ? `<small>Color: #${props.route_color}</small>` : ''}
                        </div>
                    `;
                    polyline.bindPopup(popupContent);
                    layer.addLayer(polyline);
                }
            });
            
            // Display results in the results panel
            displayResultsList(routesResults, `Radius Search: ${routesResults.length} routes found`);
        } else if (queryType === 'both') {
            // For BOTH stops and routes - fetch stops first, add to layer, then routes
            const distanceKm = radius / 1000;
            const stopsUrl = `/api/stops/nearby/?lat=${lat}&lon=${lon}&distance_km=${distanceKm}`;
            const shapesUrl = `/api/shapes/nearby/?lat=${lat}&lon=${lon}&distance_km=${distanceKm}`;
            
            const stopsResp = await fetch(stopsUrl);
            const stopsData = await stopsResp.json();
            
            // Add stops to map
            const stopsResults = stopsData.results || [];
            stopsResults.forEach(stop => {
                // Handle GeoJSON Feature format
                const props = stop.properties || stop;
                const coords = stop.geometry?.coordinates;
                
                if (coords) {
                    const marker = L.marker([coords[1], coords[0]], {
                        icon: L.divIcon({
                            className: 'query-marker stop-marker',
                            html: '<i class="fas fa-star" style="color: #9b59b6; font-size: 32px; text-shadow: -1px -1px 0 white, 1px -1px 0 white, -1px 1px 0 white, 1px 1px 0 white;"></i>',
                            iconSize: [50, 50],
                            iconAnchor: [25, 25]
                        })
                    });
                    // Enhanced popup with all stop data
                    const popupContent = `
                        <div class="popup-content">
                            <strong>${props.stop_name || props.name}</strong><br>
                            <small>Stop ID: ${props.stop_id}</small><br>
                            ${props.stop_code ? `Code: ${props.stop_code}<br>` : ''}
                            ${props.stop_type ? `Type: ${props.stop_type}<br>` : ''}
                            ${props.stop_desc ? `Description: ${props.stop_desc}<br>` : ''}
                            <small>(${coords[1].toFixed(4)}, ${coords[0].toFixed(4)})</small>
                        </div>
                    `;
                    marker.bindPopup(popupContent);
                    layer.addLayer(marker);
                }
            });
            
            const routesResp = await fetch(shapesUrl);
            const routesData = await routesResp.json();
            console.log('Radius both - Routes data:', routesData);
            
            // Add routes to map
            const routesResults = routesData.results || [];
            console.log('Radius both - Routes count:', routesResults.length);
            routesResults.forEach(route => {
                const props = route.properties || route;
                const coordinates = route.geometry?.coordinates;
                console.log('Radius both - Route:', props.route_short_name, 'has coords:', !!coordinates);
                if (coordinates && Array.isArray(coordinates)) {
                    const latLngs = coordinates.map(coord => [coord[1], coord[0]]);
                    const polyline = L.polyline(latLngs, {
                        color: '#9b59b6',
                        weight: 4,
                        opacity: 0.8
                    });
                    // Enhanced popup with all route data
                    const popupContent = `
                        <div class="popup-content">
                            <strong>${props.route_short_name || 'Route'}</strong><br>
                            ${props.route_long_name ? `<small>${props.route_long_name}</small><br>` : ''}
                            Route ID: ${props.route_id || 'N/A'}<br>
                            ${props.route_type ? `Type: ${getRouteTypeName(props.route_type)}<br>` : ''}
                            ${props.route_color ? `<small>Color: #${props.route_color}</small>` : ''}
                        </div>
                    `;
                    polyline.bindPopup(popupContent);
                    layer.addLayer(polyline);
                    console.log('Radius both - Added route to layer');
                }
            });
            
            // Display results in the results panel
            console.log('Radius both - Display results. Stops:', stopsResults.length, 'Routes:', routesResults.length);
            displayBothResults(stopsResults, routesResults);
            return;
        } else {
            // For stops - convert meters to km, don't use displayResults as it clears layers
            const distanceKm = radius / 1000;
            const endpoint = `/api/stops/nearby/?lat=${lat}&lon=${lon}&distance_km=${distanceKm}`;
            const response = await fetch(endpoint);
            const data = await response.json();
            
            // Add stops directly to layer (don't clear - circle already exists)
            const stopsResults = data.results || [];
            stopsResults.forEach(stop => {
                const props = stop.properties || stop;
                const coords = stop.geometry?.coordinates;
                
                if (coords) {
                    const marker = L.marker([coords[1], coords[0]], {
                        icon: L.divIcon({
                            className: 'query-marker stop-marker',
                            html: '<i class="fas fa-star" style="color: #9b59b6; font-size: 32px; text-shadow: -1px -1px 0 white, 1px -1px 0 white, -1px 1px 0 white, 1px 1px 0 white;"></i>',
                            iconSize: [50, 50],
                            iconAnchor: [25, 25]
                        })
                    });
                    // Enhanced popup with all stop data
                    const popupContent = `
                        <div class="popup-content">
                            <strong>${props.stop_name || props.name || 'Stop'}</strong><br>
                            <small>Stop ID: ${props.stop_id || 'N/A'}</small><br>
                            ${props.stop_code ? `Code: ${props.stop_code}<br>` : ''}
                            ${props.stop_type ? `Type: ${props.stop_type}<br>` : ''}
                            ${props.stop_desc ? `Description: ${props.stop_desc}<br>` : ''}
                            <small>(${coords[1].toFixed(4)}, ${coords[0].toFixed(4)})</small>
                        </div>
                    `;
                    marker.bindPopup(popupContent);
                    layer.addLayer(marker);
                }
            });
            
            // Display results in the results panel (without clearing layers)
            displayResultsList(stopsResults, `Radius Search: ${stopsResults.length} stops found`);
        }
    } catch (error) {
        console.error('Error performing radius search:', error);
        alert('Error performing search');
    }
}

async function performBoundsSearch() {
    let minLat = parseFloat(document.getElementById('bboxMinLat').value);
    let maxLat = parseFloat(document.getElementById('bboxMaxLat').value);
    let minLon = parseFloat(document.getElementById('bboxMinLon').value);
    let maxLon = parseFloat(document.getElementById('bboxMaxLon').value);
    const queryType = document.getElementById('boundsType').value;

    if (isNaN(minLat) || isNaN(maxLat) || isNaN(minLon) || isNaN(maxLon)) {
        alert('Please enter valid bounding box coordinates');
        return;
    }

    // If both markers exist, recalculate bounds from them to ensure correct min/max
    if (window.boundsMarkers && window.boundsMarkers.point1 && window.boundsMarkers.point2) {
        const p1 = window.boundsMarkers.point1.getLatLng();
        const p2 = window.boundsMarkers.point2.getLatLng();
        
        // Ensure correct min/max ordering
        minLat = Math.min(p1.lat, p2.lat);
        maxLat = Math.max(p1.lat, p2.lat);
        minLon = Math.min(p1.lng, p2.lng);
        maxLon = Math.max(p1.lng, p2.lng);
        
        console.log(`Recalculated bounds from markers: minLat=${minLat}, maxLat=${maxLat}, minLon=${minLon}, maxLon=${maxLon}`);
    }

    try {
        const layer = window.queryLayer || queryLayer;
        layer.clearLayers();
        
        // Create a separate rectangle that will persist
        let rectangleLayer = L.featureGroup();
        
        // Draw rectangle with calculated bounds
        const boundsForRect = [[minLat, minLon], [maxLat, maxLon]];
        const rectangle = L.rectangle(boundsForRect, {
            color: '#9b59b6',
            fill: true,
            fillColor: '#9b59b6',
            fillOpacity: 0.1,
            weight: 3,
            opacity: 0.8,
            dashArray: '5, 5'
        });
        rectangleLayer.addLayer(rectangle);
        
        // Re-add the markers on top if they exist
        if (window.boundsMarkers && window.boundsMarkers.point1) rectangleLayer.addLayer(window.boundsMarkers.point1);
        if (window.boundsMarkers && window.boundsMarkers.point2) rectangleLayer.addLayer(window.boundsMarkers.point2);
        
        console.log('Drawing rectangle with bounds:', boundsForRect);

        // Add rectangle layer FIRST so results appear on top
        layer.addLayer(rectangleLayer);

        if (queryType === 'routes') {
            // For routes, use shapes endpoint
            const endpoint = `/api/shapes/in_bounds/?min_lat=${minLat}&max_lat=${maxLat}&min_lon=${minLon}&max_lon=${maxLon}`;
            const response = await fetch(endpoint);
            const data = await response.json();
            
            // Add routes directly to layer (don't use displayRouteResults which clears the layer)
            const routesResults = data.results || [];
            routesResults.forEach(route => {
                const props = route.properties || route;
                const coordinates = route.geometry?.coordinates;
                if (coordinates && Array.isArray(coordinates)) {
                    const latLngs = coordinates.map(coord => [coord[1], coord[0]]);
                    const polyline = L.polyline(latLngs, {
                        color: '#9b59b6',
                        weight: 4,
                        opacity: 0.8,
                        lineCap: 'round',
                        lineJoin: 'round'
                    });
                    // Enhanced popup with all route data
                    const popupContent = `
                        <div class="popup-content">
                            <strong>${props.route_short_name || 'Route'}</strong><br>
                            ${props.route_long_name ? `<small>${props.route_long_name}</small><br>` : ''}
                            Route ID: ${props.route_id || 'N/A'}<br>
                            ${props.route_type ? `Type: ${getRouteTypeName(props.route_type)}<br>` : ''}
                            ${props.route_color ? `<small>Color: #${props.route_color}</small>` : ''}
                        </div>
                    `;
                    polyline.bindPopup(popupContent);
                    layer.addLayer(polyline);
                }
            });
            
            // Display results in the results panel
            displayResultsList(routesResults, `Bounds Search: ${routesResults.length} routes found`);
        } else if (queryType === 'both') {
            // For BOTH stops and routes - fetch stops first, add to layer, then routes
            const stopsUrl = `/api/stops/in_bounds/?min_lat=${minLat}&max_lat=${maxLat}&min_lon=${minLon}&max_lon=${maxLon}`;
            const shapesUrl = `/api/shapes/in_bounds/?min_lat=${minLat}&max_lat=${maxLat}&min_lon=${minLon}&max_lon=${maxLon}`;
            
            console.log('Fetching stops from:', stopsUrl);
            const stopsResp = await fetch(stopsUrl);
            const stopsData = await stopsResp.json();
            console.log('Stops received:', stopsData.results ? stopsData.results.length : 0);
            
            // Add stops to map
            const stopsResults = stopsData.results || [];
            stopsResults.forEach(stop => {
                const props = stop.properties || stop;
                const coords = stop.geometry?.coordinates || stop.point;
                if (coords) {
                    const marker = L.marker([coords[1], coords[0]], {
                        icon: L.divIcon({
                            className: 'query-marker stop-marker',
                            html: '<i class="fas fa-star" style="color: #9b59b6; font-size: 32px; text-shadow: -1px -1px 0 white, 1px -1px 0 white, -1px 1px 0 white, 1px 1px 0 white;"></i>',
                            iconSize: [50, 50],
                            iconAnchor: [25, 25]
                        })
                    });
                    // Enhanced popup with all stop data
                    const popupContent = `
                        <div class="popup-content">
                            <strong>${props.stop_name || props.name || 'Stop'}</strong><br>
                            <small>Stop ID: ${props.stop_id || 'N/A'}</small><br>
                            ${props.stop_code ? `Code: ${props.stop_code}<br>` : ''}
                            ${props.stop_type ? `Type: ${props.stop_type}<br>` : ''}
                            ${props.stop_desc ? `Description: ${props.stop_desc}<br>` : ''}
                            <small>(${coords[1].toFixed(4)}, ${coords[0].toFixed(4)})</small>
                        </div>
                    `;
                    marker.bindPopup(popupContent);
                    layer.addLayer(marker);
                }
            });
            
            const routesResp = await fetch(shapesUrl);
            const routesData = await routesResp.json();
            
            // Add routes to map
            const routesResults = routesData.results || [];
            routesResults.forEach(route => {
                const props = route.properties || route;
                const coordinates = route.geometry?.coordinates;
                if (coordinates && Array.isArray(coordinates)) {
                    const latLngs = coordinates.map(coord => [coord[1], coord[0]]);
                    const polyline = L.polyline(latLngs, {
                        color: '#9b59b6',
                        weight: 4,
                        opacity: 0.8,
                        lineCap: 'round',
                        lineJoin: 'round'
                    });
                    // Enhanced popup with all route data
                    const popupContent = `
                        <div class="popup-content">
                            <strong>${props.route_short_name || 'Route'}</strong><br>
                            ${props.route_long_name ? `<small>${props.route_long_name}</small><br>` : ''}
                            Route ID: ${props.route_id || 'N/A'}<br>
                            ${props.route_type ? `Type: ${getRouteTypeName(props.route_type)}<br>` : ''}
                            ${props.route_color ? `<small>Color: #${props.route_color}</small>` : ''}
                        </div>
                    `;
                    polyline.bindPopup(popupContent);
                    layer.addLayer(polyline);
                }
            });
            
            // Display results in the results panel
            displayBothResults(stopsResults, routesResults);
        } else {
            // For stops - don't use displayResults as it clears layers
            const endpoint = `/api/stops/in_bounds/?min_lat=${minLat}&max_lat=${maxLat}&min_lon=${minLon}&max_lon=${maxLon}`;
            const response = await fetch(endpoint);
            const data = await response.json();
            
            // Add stops directly to layer (don't clear - rectangle already exists)
            const stopsResults = data.results || [];
            stopsResults.forEach(stop => {
                const props = stop.properties || stop;
                const coords = stop.geometry?.coordinates || stop.point;
                if (coords) {
                    const marker = L.marker([coords[1], coords[0]], {
                        icon: L.divIcon({
                            className: 'query-marker stop-marker',
                            html: '<i class="fas fa-star" style="color: #9b59b6; font-size: 32px; text-shadow: -1px -1px 0 white, 1px -1px 0 white, -1px 1px 0 white, 1px 1px 0 white;"></i>',
                            iconSize: [50, 50],
                            iconAnchor: [25, 25]
                        })
                    });
                    // Enhanced popup with all stop data
                    const popupContent = `
                        <div class="popup-content">
                            <strong>${props.stop_name || props.name || 'Stop'}</strong><br>
                            <small>Stop ID: ${props.stop_id || 'N/A'}</small><br>
                            ${props.stop_code ? `Code: ${props.stop_code}<br>` : ''}
                            ${props.stop_type ? `Type: ${props.stop_type}<br>` : ''}
                            ${props.stop_desc ? `Description: ${props.stop_desc}<br>` : ''}
                            <small>(${coords[1].toFixed(4)}, ${coords[0].toFixed(4)})</small>
                        </div>
                    `;
                    marker.bindPopup(popupContent);
                    layer.addLayer(marker);
                }
            });
            
            // Display results in the results panel (without clearing layers)
            displayResultsList(stopsResults, `Bounds Search: ${stopsResults.length} stops found`);
        }
    } catch (error) {
        console.error('Error performing bounds search:', error);
        alert('Error performing search');
    }
}

async function performAdvancedQuery() {
    const queryType = document.getElementById('advancedQueryType').value;
    const minLat = parseFloat(document.getElementById('bboxMinLat').value);
    const maxLat = parseFloat(document.getElementById('bboxMaxLat').value);
    const minLon = parseFloat(document.getElementById('bboxMinLon').value);
    const maxLon = parseFloat(document.getElementById('bboxMaxLon').value);

    try {
        let endpoint;
        let title;
        const layer = window.queryLayer || queryLayer;
        
        if (queryType === 'congestion') {
            endpoint = '/api/vehicles/congestion/?min_lat=' + minLat + '&max_lat=' + maxLat + '&min_lon=' + minLon + '&max_lon=' + maxLon;
        } else if (queryType === 'route-analysis') {
            const routeId = document.getElementById('routeSelect').value;
            if (!routeId) {
                alert('Please select a route');
                return;
            }
            endpoint = '/api/routes/' + routeId + '/';
        } else if (queryType === 'nearest-stops') {
            const lat = parseFloat(document.getElementById('nearestLat').value);
            const lon = parseFloat(document.getElementById('nearestLon').value);
            const count = parseInt(document.getElementById('nearestCount').value) || 5;
            if (isNaN(lat) || isNaN(lon)) {
                alert('Please enter valid coordinates');
                return;
            }
            endpoint = '/api/stops/nearby/?lat=' + lat + '&lon=' + lon + '&distance_km=5';
        } else if (queryType === 'routes-bbox') {
            // Draw rectangle for routes-bbox
            layer.clearLayers();
            const boundsForRect = [[minLat, minLon], [maxLat, maxLon]];
            const rectangle = L.rectangle(boundsForRect, {
                color: '#9b59b6',
                fill: true,
                fillColor: '#9b59b6',
                fillOpacity: 0.1,
                weight: 3,
                opacity: 0.8,
                dashArray: '5, 5'
            });
            layer.addLayer(rectangle);
            
            endpoint = '/api/shapes/in_bounds/?min_lat=' + minLat + '&max_lat=' + maxLat + '&min_lon=' + minLon + '&max_lon=' + maxLon;
        } else if (queryType === 'both-bbox') {
            // For BOTH stops and routes in bounding box - fetch stops first, add to layer, then routes
            const layer = window.queryLayer || queryLayer;
            layer.clearLayers();
            
            const stopsUrl = '/api/stops/in_bounds/?min_lat=' + minLat + '&max_lat=' + maxLat + '&min_lon=' + minLon + '&max_lon=' + maxLon;
            const shapesUrl = '/api/shapes/in_bounds/?min_lat=' + minLat + '&max_lat=' + maxLat + '&min_lon=' + minLon + '&max_lon=' + maxLon;
            
            const stopsResp = await fetch(stopsUrl);
            const stopsData = await stopsResp.json();
            
            // Add stops to map
            const stopsResults = stopsData.results || [];
            stopsResults.forEach(stop => {
                const props = stop.properties || stop;
                const coords = stop.geometry?.coordinates || stop.point;
                if (coords) {
                    const marker = L.marker([coords[1], coords[0]], {
                        icon: L.divIcon({
                            className: 'query-marker stop-marker',
                            html: '<i class="fas fa-star" style="color: #9b59b6; font-size: 32px; text-shadow: -1px -1px 0 white, 1px -1px 0 white, -1px 1px 0 white, 1px 1px 0 white;"></i>',
                            iconSize: [50, 50],
                            iconAnchor: [25, 25]
                        })
                    });
                    // Enhanced popup with all stop data
                    const popupContent = `
                        <div class="popup-content">
                            <strong>${props.stop_name || props.name || 'Stop'}</strong><br>
                            <small>Stop ID: ${props.stop_id || 'N/A'}</small><br>
                            ${props.stop_code ? `Code: ${props.stop_code}<br>` : ''}
                            ${props.stop_type ? `Type: ${props.stop_type}<br>` : ''}
                            ${props.stop_desc ? `Description: ${props.stop_desc}<br>` : ''}
                            <small>(${coords[1].toFixed(4)}, ${coords[0].toFixed(4)})</small>
                        </div>
                    `;
                    marker.bindPopup(popupContent);
                    layer.addLayer(marker);
                }
            });
            
            const routesResp = await fetch(shapesUrl);
            const routesData = await routesResp.json();
            
            // Add routes to map
            const routesResults = routesData.results || [];
            routesResults.forEach(route => {
                const props = route.properties || route;
                const coordinates = route.geometry?.coordinates || route.coordinates;
                if (coordinates && Array.isArray(coordinates)) {
                    const latLngs = coordinates.map(coord => [coord[1], coord[0]]);
                    const polyline = L.polyline(latLngs, {
                        color: '#9b59b6',
                        weight: 4,
                        opacity: 0.8,
                        lineCap: 'round',
                        lineJoin: 'round'
                    });
                    // Enhanced popup with all route data
                    const popupContent = `
                        <div class="popup-content">
                            <strong>${props.route_short_name || 'Route'}</strong><br>
                            ${props.route_long_name ? `<small>${props.route_long_name}</small><br>` : ''}
                            Route ID: ${props.route_id || 'N/A'}<br>
                            ${props.route_type ? `Type: ${getRouteTypeName(props.route_type)}<br>` : ''}
                            ${props.route_color ? `<small>Color: #${props.route_color}</small>` : ''}
                        </div>
                    `;
                    polyline.bindPopup(popupContent);
                    layer.addLayer(polyline);
                }
            });
            
            // Display results in the results panel
            displayBothResults(stopsResults, routesResults);
            return;
        }

        const response = await fetch(endpoint);
        const data = await response.json();

        if (queryType === 'congestion') {
            displayCongestionResults(data.results);
        } else if (queryType === 'routes-bbox') {
            // Add routes directly to layer (don't use displayRouteResults which clears the layer)
            const routesResults = data.results || [];
            routesResults.forEach(route => {
                const props = route.properties || route;
                const coordinates = route.geometry?.coordinates;
                if (coordinates && Array.isArray(coordinates)) {
                    const latLngs = coordinates.map(coord => [coord[1], coord[0]]);
                    const polyline = L.polyline(latLngs, {
                        color: '#9b59b6',
                        weight: 4,
                        opacity: 0.8,
                        lineCap: 'round',
                        lineJoin: 'round'
                    });
                    // Enhanced popup with all route data
                    const popupContent = `
                        <div class="popup-content">
                            <strong>${props.route_short_name || 'Route'}</strong><br>
                            ${props.route_long_name ? `<small>${props.route_long_name}</small><br>` : ''}
                            Route ID: ${props.route_id || 'N/A'}<br>
                            ${props.route_type ? `Type: ${getRouteTypeName(props.route_type)}<br>` : ''}
                            ${props.route_color ? `<small>Color: #${props.route_color}</small>` : ''}
                        </div>
                    `;
                    polyline.bindPopup(popupContent);
                    layer.addLayer(polyline);
                }
            });
            
            // Display results in the results panel
            displayResultsList(routesResults, `Advanced Query: ${routesResults.length} routes found`);
        } else {
            displayResults(data.results || [data], 'Advanced Query Results', minLat, minLon);
        }
    } catch (error) {
        console.error('Error performing advanced query:', error);
        alert('Error performing search');
    }
}

function displayResults(results, title, centerLat, centerLon) {
    const layer = window.queryLayer || queryLayer;
    layer.clearLayers();
    
    results.forEach((result, idx) => {
        // Handle GeoJSON feature format
        const geom = result.geometry;
        const props = result.properties || result;
        
        if (geom && geom.coordinates) {
            const coords = geom.coordinates;
            
            // Only create markers for Point geometries
            if (geom.type === 'Point') {
                const marker = L.marker([coords[1], coords[0]], {
                    icon: L.divIcon({
                        className: 'query-result-icon',
                        html: '<i class="fas fa-star" style="color: #9b59b6; font-size: 28px;"></i>',
                        iconSize: [40, 40],
                        iconAnchor: [20, 20]
                    })
                });

                const popupContent = `
                    <div class="popup-content">
                        <strong>${props.stop_name || props.vehicle_id || props.route_short_name}</strong><br>
                        ${props.stop_code ? 'Code: ' + props.stop_code + '<br>' : ''}
                        ${props.stop_type ? 'Type: ' + props.stop_type + '<br>' : ''}
                        ${props.speed ? 'Speed: ' + props.speed.toFixed(1) + ' km/h<br>' : ''}
                        ${props.status ? 'Status: ' + props.status + '<br>' : ''}
                    </div>
                `;
                marker.bindPopup(popupContent);
                layer.addLayer(marker);
            }
        }
    });

    if (centerLat && centerLon) {
        map.setView([centerLat, centerLon], 15);
    }

    displayResultsList(results, title);
}

function displayCongestionResults(clusters) {
    const layer = window.queryLayer || queryLayer;
    layer.clearLayers();

    clusters.forEach((cluster, index) => {
        if (cluster.center && cluster.center.coordinates) {
            const coords = cluster.center.coordinates;
            const severity = cluster.severity || 'medium';
            const radius = cluster.radius || 100;

            const circle = L.circle([coords[1], coords[0]], {
                radius: radius,
                color: severity === 'high' ? 'red' : severity === 'medium' ? 'orange' : 'yellow',
                fill: true,
                fillColor: severity === 'high' ? 'red' : severity === 'medium' ? 'orange' : 'yellow',
                fillOpacity: 0.3,
                weight: 2
            });

            const popupContent = `
                <div class="popup-content">
                    <strong>Congestion Zone ${index + 1}</strong><br>
                    Severity: <span class="badge badge-${severity}">${severity.toUpperCase()}</span><br>
                    Vehicles: ${cluster.vehicle_count || 0}<br>
                    Avg Speed: ${cluster.avg_speed ? cluster.avg_speed.toFixed(1) : '--'} km/h
                </div>
            `;
            circle.bindPopup(popupContent);
            layer.addLayer(circle);
        }
    });

    if (layer.getLayers().length > 0) {
        map.fitBounds(layer.getBounds(), { padding: [50, 50] });
    }

    displayResultsList(clusters, `Congestion Analysis: ${clusters.length} zones detected`);
}

function displayBothResults(stops, routes) {
    const resultsDiv = document.getElementById('queryResults');
    const resultsList = document.getElementById('resultsList');

    let html = `<div class="alert alert-info">Both Search: <strong>${stops.length} stops</strong> and <strong>${routes.length} routes</strong> found</div>`;
    html += `<div class="results-count">Total: <strong>${stops.length + routes.length}</strong></div>`;

    // Display stops
    if (stops.length > 0) {
        html += `<div style="margin-top: 10px;"><strong style="color: #9b59b6;">📍 Stops (${stops.length})</strong></div>`;
        
        // Show first 3 stops
        stops.slice(0, 3).forEach((stop, index) => {
            const props = stop.properties || stop;
            const name = props.stop_name || props.name || `Stop ${index + 1}`;
            const coords = stop.geometry?.coordinates || [];
            
            const details = [];
            if (props.stop_code) details.push(`Code: ${props.stop_code}`);
            if (props.stop_type) details.push(`Type: ${props.stop_type}`);
            if (coords.length > 0) details.push(`(${coords[1].toFixed(4)}, ${coords[0].toFixed(4)})`);
            
            html += `<div class="result-item" style="padding: 8px; border-left: 3px solid #9b59b6; margin-bottom: 5px;">
                <strong>${name}</strong><br>
                <small>${details.join(' • ')}</small>
            </div>`;
        });
        
        // Show dropdown for additional stops if more than 3
        if (stops.length > 3) {
            html += `<details style="margin: 10px 0; cursor: pointer;">
                <summary style="color: #9b59b6; font-weight: bold;">Show ${stops.length - 3} more stops...</summary>
                <div style="margin-top: 10px;">`;
            
            stops.slice(3).forEach((stop, index) => {
                const props = stop.properties || stop;
                const name = props.stop_name || props.name || `Stop ${index + 4}`;
                const coords = stop.geometry?.coordinates || [];
                
                const details = [];
                if (props.stop_code) details.push(`Code: ${props.stop_code}`);
                if (props.stop_type) details.push(`Type: ${props.stop_type}`);
                if (coords.length > 0) details.push(`(${coords[1].toFixed(4)}, ${coords[0].toFixed(4)})`);
                
                html += `<div class="result-item" style="padding: 8px; border-left: 3px solid #9b59b6; margin-bottom: 5px;">
                    <strong>${name}</strong><br>
                    <small>${details.join(' • ')}</small>
                </div>`;
            });
            
            html += `</div></details>`;
        }
    }

    // Display routes
    if (routes.length > 0) {
        html += `<div style="margin-top: 15px;"><strong style="color: #9b59b6;">🛣️ Routes (${routes.length})</strong></div>`;
        
        // Show first 3 routes
        routes.slice(0, 3).forEach((route, index) => {
            const props = route.properties || route;
            const shortName = props.route_short_name || 'Route';
            const longName = props.route_long_name || '';
            const routeId = props.route_id || index + 1;
            
            const details = [];
            if (props.route_type) details.push(`Type: ${getRouteTypeName(props.route_type)}`);
            
            html += `<div class="result-item" style="padding: 8px; border-left: 3px solid #9b59b6; margin-bottom: 5px;">
                <strong>${shortName}</strong><br>
                ${longName ? `<small>${longName}</small><br>` : ''}
                <small>Route ID: ${routeId}${details.length > 0 ? ' • ' + details.join(' • ') : ''}</small>
            </div>`;
        });
        
        // Show dropdown for additional routes if more than 3
        if (routes.length > 3) {
            html += `<details style="margin: 10px 0; cursor: pointer;">
                <summary style="color: #9b59b6; font-weight: bold;">Show ${routes.length - 3} more routes...</summary>
                <div style="margin-top: 10px;">`;
            
            routes.slice(3).forEach((route, index) => {
                const props = route.properties || route;
                const shortName = props.route_short_name || 'Route';
                const longName = props.route_long_name || '';
                const routeId = props.route_id || index + 4;
                
                const details = [];
                if (props.route_type) details.push(`Type: ${getRouteTypeName(props.route_type)}`);
                
                html += `<div class="result-item" style="padding: 8px; border-left: 3px solid #9b59b6; margin-bottom: 5px;">
                    <strong>${shortName}</strong><br>
                    ${longName ? `<small>${longName}</small><br>` : ''}
                    <small>Route ID: ${routeId}${details.length > 0 ? ' • ' + details.join(' • ') : ''}</small>
                </div>`;
            });
            
            html += `</div></details>`;
        }
    }

    resultsList.innerHTML = html;
    resultsDiv.style.display = 'block';
}

function displayResultsList(results, title) {
    const resultsDiv = document.getElementById('queryResults');
    const resultsList = document.getElementById('resultsList');

    let html = `<div class="alert alert-info">${title}</div>`;
    html += `<div class="results-count">Total: <strong>${results.length}</strong></div>`;

    // Show first 3 results
    results.slice(0, 3).forEach((result, index) => {
        // Handle GeoJSON feature format
        const props = result.properties || result;
        
        let name = props.stop_name || props.vehicle_id || props.route_short_name || `Result ${index + 1}`;
        
        // Handle different geometry types
        if (result.geometry) {
            const geomType = result.geometry.type;
            const coords = result.geometry.coordinates;
            
            if (geomType === 'Point') {
                // Point: [lon, lat]
                name = `${props.stop_name || props.route_short_name} (${coords[1].toFixed(4)}, ${coords[0].toFixed(4)})`;
            } else if (geomType === 'LineString') {
                // LineString: [[lon, lat], [lon, lat], ...]
                // Get the first coordinate for display
                if (coords.length > 0) {
                    name = `${props.route_short_name} - ${props.route_long_name}`;
                }
            }
        }
        
        const details = [];
        
        // Add relevant details based on result type
        if (props.stop_code) details.push(`Code: ${props.stop_code}`);
        if (props.stop_type) details.push(`Type: ${props.stop_type}`);
        if (props.route_short_name && !props.stop_name) details.push(`Route: ${props.route_short_name}`);
        if (props.route_long_name) details.push(`${props.route_long_name}`);
        if (props.route_type) details.push(`Type: ${getRouteTypeName(props.route_type)}`);
        if (props.speed) details.push(`Speed: ${props.speed.toFixed(1)} km/h`);
        if (props.status) details.push(`Status: ${props.status}`);
        if (props.vehicle_count) details.push(`Vehicles: ${props.vehicle_count}`);
        if (props.avg_speed) details.push(`Avg Speed: ${props.avg_speed.toFixed(1)} km/h`);
        if (props.shape_id) details.push(`Shape ID: ${props.shape_id}`);

        html += `
            <div class="result-item">
                <div class="result-title">${name}</div>
                <small class="text-muted">${details.join(' • ')}</small>
            </div>
        `;
    });

    // Show dropdown for additional results if more than 3
    if (results.length > 3) {
        html += `<details style="margin: 10px 0; cursor: pointer;">
            <summary style="color: #9b59b6; font-weight: bold;">Show ${results.length - 3} more results...</summary>
            <div style="margin-top: 10px;">`;
        
        results.slice(3).forEach((result, index) => {
            // Handle GeoJSON feature format
            const props = result.properties || result;
            
            let name = props.stop_name || props.vehicle_id || props.route_short_name || `Result ${index + 4}`;
            
            // Handle different geometry types
            if (result.geometry) {
                const geomType = result.geometry.type;
                const coords = result.geometry.coordinates;
                
                if (geomType === 'Point') {
                    // Point: [lon, lat]
                    name = `${props.stop_name || props.route_short_name} (${coords[1].toFixed(4)}, ${coords[0].toFixed(4)})`;
                } else if (geomType === 'LineString') {
                    // LineString: [[lon, lat], [lon, lat], ...]
                    if (coords.length > 0) {
                        name = `${props.route_short_name} - ${props.route_long_name}`;
                    }
                }
            }
            
            const details = [];
            
            // Add relevant details based on result type
            if (props.stop_code) details.push(`Code: ${props.stop_code}`);
            if (props.stop_type) details.push(`Type: ${props.stop_type}`);
            if (props.route_short_name && !props.stop_name) details.push(`Route: ${props.route_short_name}`);
            if (props.route_long_name) details.push(`${props.route_long_name}`);
            if (props.route_type) details.push(`Type: ${getRouteTypeName(props.route_type)}`);
            if (props.speed) details.push(`Speed: ${props.speed.toFixed(1)} km/h`);
            if (props.status) details.push(`Status: ${props.status}`);
            if (props.vehicle_count) details.push(`Vehicles: ${props.vehicle_count}`);
            if (props.avg_speed) details.push(`Avg Speed: ${props.avg_speed.toFixed(1)} km/h`);
            if (props.shape_id) details.push(`Shape ID: ${props.shape_id}`);

            html += `
                <div class="result-item">
                    <div class="result-title">${name}</div>
                    <small class="text-muted">${details.join(' • ')}</small>
                </div>
            `;
        });
        
        html += `</div></details>`;
    }

    resultsList.innerHTML = html;
    resultsDiv.style.display = 'block';
}

function displayRouteResults(shapes) {
    const layer = window.queryLayer || queryLayer;
    layer.clearLayers();

    // Group shapes by route for better display
    const shapesByRoute = {};
    
    shapes.forEach(shape => {
        const props = shape.properties;
        const routeKey = `${props.route_short_name || 'Unknown'}-${props.route_type || 'N/A'}`;
        
        if (!shapesByRoute[routeKey]) {
            shapesByRoute[routeKey] = [];
        }
        shapesByRoute[routeKey].push(shape);
    });

    // Display each route as a polyline
    Object.entries(shapesByRoute).forEach(([routeKey, routeShapes]) => {
        routeShapes.forEach(shape => {
            if (shape.geometry && shape.geometry.type === 'LineString') {
                const coords = shape.geometry.coordinates.map(c => [c[1], c[0]]);
                const props = shape.properties;

                const polyline = L.polyline(coords, {
                    color: '#9b59b6',
                    weight: 4,
                    opacity: 0.8,
                    lineCap: 'round',
                    lineJoin: 'round'
                });

                const popupContent = `
                    <div class="popup-content">
                        <strong>${props.route_short_name}</strong><br>
                        ${props.route_long_name}<br>
                        Type: ${getRouteTypeName(props.route_type)}<br>
                        Shape ID: ${props.shape_id}
                    </div>
                `;
                polyline.bindPopup(popupContent);
                layer.addLayer(polyline);
            }
        });
    });

    if (layer.getLayers().length > 0) {
        map.fitBounds(layer.getBounds(), { padding: [50, 50] });
    }

    displayResultsList(shapes, `Routes in Area: ${Object.keys(shapesByRoute).length} routes found`);
}

function updateRadiusOptions() {
    // This function can be extended in the future for radius-specific options
    console.log('Radius search type changed');
}

function updateAdvancedOptions() {
    const queryType = document.getElementById('advancedQueryType').value;
    const routeOptionsDiv = document.getElementById('routeOptions');
    const nearestOptionsDiv = document.getElementById('nearestOptions');

    routeOptionsDiv.style.display = queryType === 'route-analysis' ? 'block' : 'none';
    nearestOptionsDiv.style.display = queryType === 'nearest-stops' ? 'block' : 'none';
}

// Initialize coordinate inputs with current map bounds
document.addEventListener('DOMContentLoaded', function() {
    const radiusLatInput = document.getElementById('radiusLat');
    const radiusLonInput = document.getElementById('radiusLon');
    const nearestLatInput = document.getElementById('nearestLat');
    const nearestLonInput = document.getElementById('nearestLon');

    if (radiusLatInput && radiusLonInput) {
        radiusLatInput.value = '53.3498';
        radiusLonInput.value = '-6.2603';
    }

    if (nearestLatInput && nearestLonInput) {
        nearestLatInput.value = '53.3498';
        nearestLonInput.value = '-6.2603';
    }
});
