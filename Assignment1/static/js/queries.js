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
            const endpoint = `/api/shapes/in_bounds/?min_lat=${lat - 0.05}&max_lat=${lat + 0.05}&min_lon=${lon - 0.05}&max_lon=${lon + 0.05}`;
            const response = await fetch(endpoint);
            const data = await response.json();
            displayRouteResults(data.results || []);
        } else {
            // For stops - convert meters to km
            const distanceKm = radius / 1000;
            const endpoint = `/api/${queryType}/nearby/?lat=${lat}&lon=${lon}&distance_km=${distanceKm}`;
            const response = await fetch(endpoint);
            const data = await response.json();
            displayResults(data.results, `Radius Search: ${data.results.length} ${queryType} found`, lat, lon);
        }
    } catch (error) {
        console.error('Error performing radius search:', error);
        alert('Error performing search');
    }
}

async function performBoundsSearch() {
    const minLat = parseFloat(document.getElementById('bboxMinLat').value);
    const maxLat = parseFloat(document.getElementById('bboxMaxLat').value);
    const minLon = parseFloat(document.getElementById('bboxMinLon').value);
    const maxLon = parseFloat(document.getElementById('bboxMaxLon').value);
    const queryType = document.getElementById('boundsType').value;

    if (isNaN(minLat) || isNaN(maxLat) || isNaN(minLon) || isNaN(maxLon)) {
        alert('Please enter valid bounding box coordinates');
        return;
    }

    try {
        const layer = window.queryLayer || queryLayer;
        layer.clearLayers();
        const bounds = [[minLat, minLon], [maxLat, maxLon]];
        const rectangle = L.rectangle(bounds, {
            color: 'green',
            fill: false,
            weight: 2,
            dashArray: '5, 5',
            opacity: 0.7
        });
        layer.addLayer(rectangle);

        if (queryType === 'routes') {
            // For routes, use shapes endpoint
            const endpoint = `/api/shapes/in_bounds/?min_lat=${minLat}&max_lat=${maxLat}&min_lon=${minLon}&max_lon=${maxLon}`;
            const response = await fetch(endpoint);
            const data = await response.json();
            displayRouteResults(data.results || []);
        } else {
            // For stops
            const endpoint = `/api/${queryType}/in_bounds/?min_lat=${minLat}&max_lat=${maxLat}&min_lon=${minLon}&max_lon=${maxLon}`;
            const response = await fetch(endpoint);
            const data = await response.json();
            displayResults(data.results, `Bounds Search: ${data.results.length} ${queryType} found`, (minLat + maxLat) / 2, (minLon + maxLon) / 2);
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
            endpoint = '/api/shapes/in_bounds/?min_lat=' + minLat + '&max_lat=' + maxLat + '&min_lon=' + minLon + '&max_lon=' + maxLon;
        }

        const response = await fetch(endpoint);
        const data = await response.json();

        if (queryType === 'congestion') {
            displayCongestionResults(data.results);
        } else if (queryType === 'routes-bbox') {
            displayRouteResults(data.results || []);
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
                        html: '<i class="fas fa-star"></i>',
                        iconSize: [25, 25],
                        iconAnchor: [12, 12]
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

function displayResultsList(results, title) {
    const resultsDiv = document.getElementById('queryResults');
    const resultsList = document.getElementById('resultsList');

    let html = `<div class="alert alert-info">${title}</div>`;
    html += `<div class="results-count">Total: <strong>${results.length}</strong></div>`;

    results.forEach((result, index) => {
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
                const routeColor = getRouteTypeColor(props.route_type);

                const polyline = L.polyline(coords, {
                    color: routeColor,
                    weight: 3,
                    opacity: 0.7
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
