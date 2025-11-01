"""
URL configuration for transport_api app.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from transport_api.views import (
    StopViewSet, VehicleViewSet, RouteViewSet, 
    SpatialQueryViewSet, MapView, BlankMapView
)

router = DefaultRouter()
router.register(r'stops', StopViewSet, basename='stop')
router.register(r'vehicles', VehicleViewSet, basename='vehicle')
router.register(r'routes', RouteViewSet, basename='route')
router.register(r'spatial-queries', SpatialQueryViewSet, basename='spatial-query')

app_name = 'transport_api'

urlpatterns = [
    path('', MapView.as_view(), name='map'),
    path('blank/', BlankMapView.as_view(), name='blank_map'),
    path('api/', include(router.urls)),
]
