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
        const endpoint = `/api/${queryType}/nearby/?lat=${lat}&lon=${lon}&distance=${radius}`;
        const response = await fetch(endpoint);
        const data = await response.json();

        queryLayer.clearLayers();
        const circle = L.circle([lat, lon], {
            radius: radius,
            color: 'blue',
            fill: false,
            weight: 2,
            dashArray: '5, 5',
            opacity: 0.7
        });
        queryLayer.addLayer(circle);

        displayResults(data.results, `Radius Search: ${data.results.length} ${queryType} found`, lat, lon);
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
        const endpoint = `/api/${queryType}/in_bounds/?min_lat=${minLat}&max_lat=${maxLat}&min_lon=${minLon}&max_lon=${maxLon}`;
        const response = await fetch(endpoint);
        const data = await response.json();

        queryLayer.clearLayers();
        const bounds = [[minLat, minLon], [maxLat, maxLon]];
        const rectangle = L.rectangle(bounds, {
            color: 'green',
            fill: false,
            weight: 2,
            dashArray: '5, 5',
            opacity: 0.7
        });
        queryLayer.addLayer(rectangle);

        displayResults(data.results, `Bounds Search: ${data.results.length} ${queryType} found`, (minLat + maxLat) / 2, (minLon + maxLon) / 2);
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
            endpoint = '/api/stops/nearby/?lat=' + lat + '&lon=' + lon + '&limit=' + count;
        }

        const response = await fetch(endpoint);
        const data = await response.json();

        if (queryType === 'congestion') {
            displayCongestionResults(data.results);
        } else {
            displayResults(data.results || [data], 'Advanced Query Results', minLat, minLon);
        }
    } catch (error) {
        console.error('Error performing advanced query:', error);
        alert('Error performing search');
    }
}

function displayResults(results, title, centerLat, centerLon) {
    queryLayer.clearLayers();
    
    results.forEach(result => {
        if (result.geometry && result.geometry.coordinates) {
            const coords = result.geometry.coordinates;
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
                    <strong>${result.stop_name || result.vehicle_id || result.route_short_name}</strong><br>
                    ${result.stop_code ? 'Code: ' + result.stop_code + '<br>' : ''}
                    ${result.speed ? 'Speed: ' + result.speed.toFixed(1) + ' km/h<br>' : ''}
                    ${result.status ? 'Status: ' + result.status + '<br>' : ''}
                </div>
            `;
            marker.bindPopup(popupContent);
            queryLayer.addLayer(marker);
        }
    });

    if (centerLat && centerLon) {
        map.setView([centerLat, centerLon], 15);
    }

    displayResultsList(results, title);
}

function displayCongestionResults(clusters) {
    queryLayer.clearLayers();

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
            queryLayer.addLayer(circle);
        }
    });

    if (clusters.length > 0) {
        map.fitBounds(queryLayer.getBounds(), { padding: [50, 50] });
    }

    displayResultsList(clusters, `Congestion Analysis: ${clusters.length} zones detected`);
}

function displayResultsList(results, title) {
    const resultsDiv = document.getElementById('queryResults');
    const resultsList = document.getElementById('resultsList');

    let html = `<div class="alert alert-info">${title}</div>`;
    html += `<div class="results-count">Total: <strong>${results.length}</strong></div>`;

    results.forEach((result, index) => {
        const name = result.stop_name || result.vehicle_id || result.route_short_name || `Result ${index + 1}`;
        const details = [];
        
        if (result.stop_code) details.push(`Code: ${result.stop_code}`);
        if (result.speed) details.push(`Speed: ${result.speed.toFixed(1)} km/h`);
        if (result.status) details.push(`Status: ${result.status}`);
        if (result.vehicle_count) details.push(`Vehicles: ${result.vehicle_count}`);
        if (result.avg_speed) details.push(`Avg Speed: ${result.avg_speed.toFixed(1)} km/h`);

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
